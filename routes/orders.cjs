const express = require("express");
const { query, withTransaction } = require("../db.cjs");
const { attachCustomer } = require("../auth.cjs");
const rateLimits = require("../lib/rateLimits.cjs");
const { cleanText } = require("../lib/text.cjs");
const { sendOrderEmail } = require("../lib/mailer.cjs");
const { generateOrderCode } = require("../lib/orderCode.cjs");
const {
  DiscountError,
  computeSubtotal,
  computeTotal,
  assertDiscountUsable,
  discountAmountFor,
  roundMoney
} = require("../lib/pricing.cjs");
const { resolveLines, findPriceChanges } = require("../lib/cart.cjs");
const { currentSales } = require("../lib/sales.cjs");
const { subscribe } = require("../lib/reminders.cjs");
const { StockError, demandFromLines, reserveStock } = require("../lib/stock.cjs");
const payments = require("../lib/payments.cjs");
const { baseUrlFor } = require("../lib/urls.cjs");

const router = express.Router();

async function resolveDiscount(code, subtotal) {
  if (!code) return { discount: null, amount: 0 };
  const { rows } = await query("SELECT * FROM discount_codes WHERE code = $1 AND active = true", [
    String(code).trim().toUpperCase()
  ]);
  const discount = rows[0];
  assertDiscountUsable(discount);
  return { discount, amount: discountAmountFor(discount, subtotal) };
}

router.post("/discounts/validate", rateLimits.discounts, async (req, res) => {
  try {
    const subtotal = Number(req.body.subtotal) || 0;
    const { discount, amount } = await resolveDiscount(req.body.code, subtotal);
    if (!discount) return res.json({ ok: true, amount: 0 });
    res.json({ ok: true, amount, code: discount.code, type: discount.type, value: Number(discount.value) });
  } catch (err) {
    if (err instanceof DiscountError) return res.status(400).json({ ok: false, error: err.message });
    throw err;
  }
});

// Relit le panier du client en base (prix, disponibilité) sans rien enregistrer :
// sert à l'étape de relecture avant l'envoi de la commande.
router.post("/cart/check", async (req, res) => {
  const requested = Array.isArray(req.body.items) ? req.body.items : [];
  const { lines, unavailable, adjusted } = await resolveLines(requested, { query });
  const priceChanges = findPriceChanges(requested, lines);
  const sales = await currentSales();
  res.json({
    ok: true,
    lines: lines.map((line) => ({ ...line, lineTotal: roundMoney(line.price * line.qty) })),
    unavailable,
    adjusted,
    priceChanges,
    sales,
    subtotal: computeSubtotal(lines)
  });
});

router.post("/orders", rateLimits.orders, attachCustomer, async (req, res) => {
  if (req.body.website) {
    return res.json({ ok: true, orderId: "spam-ignored" });
  }

  // Une seule session de vente par semaine : hors session, on n'enregistre rien.
  const sales = await currentSales();
  if (!sales.open) {
    return res.status(403).json({
      ok: false,
      code: "SALES_CLOSED",
      error: sales.closedMessage || "La vente est fermée pour le moment. Elle rouvre le samedi et ferme le lundi soir : revenez à ce moment-là.",
      sales
    });
  }

  const customerInfo = req.body.customer || {};
  const name = cleanText(customerInfo.name, 120);
  const phone = cleanText(customerInfo.phone, 40);
  const email = cleanText(customerInfo.email, 160);
  const fulfillment = customerInfo.fulfillment === "livraison" ? "livraison" : "retrait";
  const address = cleanText(customerInfo.address, 300);
  const notes = cleanText(customerInfo.notes, 500);
  // Paiement en ligne : seulement si le site l'a activé ; sinon on paie au retrait.
  const paymentMethod = customerInfo.paymentMethod === "en_ligne" && payments.isEnabled() ? "en_ligne" : "retrait";

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: "Nom et téléphone requis." });
  }
  if (fulfillment === "livraison" && !address) {
    return res.status(400).json({ ok: false, error: "Merci d'indiquer l'adresse de livraison." });
  }

  // Le retrait a lieu le mercredi qui suit la session : la date n'est plus saisie par le client.
  const desiredDate = sales.pickupDate;

  const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (requestedItems.length === 0) {
    return res.status(400).json({ ok: false, error: "Le panier est vide." });
  }

  const { lines, unavailable, adjusted } = await resolveLines(requestedItems, { query });

  // Jamais d'article ignoré en silence : le client doit voir ce qui change avant de confirmer.
  if (unavailable.length > 0) {
    return res.status(409).json({
      ok: false,
      code: "ITEMS_UNAVAILABLE",
      error: "Certains articles de votre panier ne sont plus disponibles. Vérifiez votre panier avant de confirmer.",
      unavailable
    });
  }
  if (adjusted.length > 0) {
    return res.status(409).json({
      ok: false,
      code: "SELECTION_CHANGED",
      error: "La composition d'un panier a changé depuis votre choix. Vérifiez votre panier avant de confirmer.",
      adjusted
    });
  }
  const priceChanges = findPriceChanges(requestedItems, lines);
  if (priceChanges.length > 0) {
    return res.status(409).json({
      ok: false,
      code: "PRICES_CHANGED",
      error: "Certains prix ont changé depuis votre dernière visite. Vérifiez votre panier avant de confirmer.",
      priceChanges
    });
  }

  // Le snapshot enregistré garde le contenu des paniers au moment de la commande.
  const items = lines.map(({ key: _key, ...line }) => line);

  const subtotal = computeSubtotal(items);

  let discountCode = null;
  let discountAmount = 0;

  async function insertOrder(code) {
    discountCode = null;
    discountAmount = 0;
    await withTransaction(async (client) => {
      // Stock : verrouillé et décrémenté dans la même transaction que la commande (jamais de survente).
      await reserveStock(client, demandFromLines(items));
      if (req.body.discountCode) {
        const { rows } = await client.query(
          "SELECT * FROM discount_codes WHERE code = $1 AND active = true FOR UPDATE",
          [String(req.body.discountCode).trim().toUpperCase()]
        );
        const discount = rows[0];
        assertDiscountUsable(discount);
        discountCode = discount.code;
        discountAmount = discountAmountFor(discount, subtotal);
        await client.query("UPDATE discount_codes SET used_count = used_count + 1 WHERE id = $1", [discount.id]);
      }

      await client.query(
        `INSERT INTO orders
          (order_number, customer_id, name, phone, email, fulfillment, address, notes, items, discount_code, subtotal, discount_amount, total, desired_date, payment_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          code, req.customer?.sub || null, name, phone, email, fulfillment, address, notes,
          JSON.stringify(items), discountCode, subtotal, discountAmount, computeTotal(subtotal, discountAmount), desiredDate, paymentMethod
        ]
      );
    });
  }

  // Le code est unique (contrainte en base) : en cas de collision très rare, on en tire un autre.
  let orderNumber = null;
  try {
    for (let attempt = 1; !orderNumber; attempt += 1) {
      const candidate = generateOrderCode();
      try {
        await insertOrder(candidate);
        orderNumber = candidate;
      } catch (err) {
        if (err.code !== "23505" || attempt >= 5) throw err;
      }
    }
  } catch (err) {
    if (err instanceof DiscountError) return res.status(400).json({ ok: false, error: err.message });
    if (err instanceof StockError) {
      return res.status(409).json({
        ok: false,
        code: "STOCK",
        error: `${err.message} Mettez votre panier à jour avant de confirmer.`
      });
    }
    throw err;
  }

  const total = computeTotal(subtotal, discountAmount);
  const placed = { orderNumber, name, phone, email, fulfillment, address, notes, items, subtotal, discountAmount, total, desiredDate };
  if (customerInfo.reminder === true && email) {
    subscribe({ query }, { email, name }).catch((err) => console.error("[orders] échec inscription au rappel:", err.message));
  }
  sendOrderEmail(placed).catch((err) => console.error("[orders] échec envoi email:", err.message));

  // Paiement en ligne : la commande est déjà enregistrée ; si la session de paiement échoue, le client paiera au retrait.
  let paymentUrl = null;
  let paymentError = null;
  if (paymentMethod === "en_ligne") {
    try {
      const session = await payments.createCheckoutSession({ orderNumber, total, email, name, baseUrl: baseUrlFor(req) });
      paymentUrl = session.url;
    } catch (err) {
      console.error("[payments] session impossible:", err.message);
      paymentError = "Le paiement en ligne est momentanément indisponible : votre commande est bien enregistrée, vous réglerez au retrait.";
    }
  }

  res.json({ ok: true, orderId: orderNumber, subtotal, discountAmount, total, customer: { name }, paymentUrl, paymentError });
});

module.exports = router;
