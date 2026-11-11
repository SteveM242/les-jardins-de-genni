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
const { DesiredDateError, parseDesiredDate } = require("../lib/dates.cjs");

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
  const { lines, unavailable } = await resolveLines(requested, { query });
  const priceChanges = findPriceChanges(requested, lines);
  res.json({
    ok: true,
    lines: lines.map((line) => ({ ...line, lineTotal: roundMoney(line.price * line.qty) })),
    unavailable,
    priceChanges,
    subtotal: computeSubtotal(lines)
  });
});

router.post("/orders", rateLimits.orders, attachCustomer, async (req, res) => {
  if (req.body.website) {
    return res.json({ ok: true, orderId: "spam-ignored" });
  }

  const customerInfo = req.body.customer || {};
  const name = cleanText(customerInfo.name, 120);
  const phone = cleanText(customerInfo.phone, 40);
  const email = cleanText(customerInfo.email, 160);
  const fulfillment = customerInfo.fulfillment === "livraison" ? "livraison" : "retrait";
  const address = cleanText(customerInfo.address, 300);
  const notes = cleanText(customerInfo.notes, 500);

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: "Nom et téléphone requis." });
  }
  if (fulfillment === "livraison" && !address) {
    return res.status(400).json({ ok: false, error: "Merci d'indiquer l'adresse de livraison." });
  }

  let desiredDate;
  try {
    desiredDate = parseDesiredDate(customerInfo.desiredDate);
  } catch (err) {
    if (err instanceof DesiredDateError) return res.status(400).json({ ok: false, error: err.message });
    throw err;
  }

  const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (requestedItems.length === 0) {
    return res.status(400).json({ ok: false, error: "Le panier est vide." });
  }

  const { lines, unavailable } = await resolveLines(requestedItems, { query });

  // Jamais d'article ignoré en silence : le client doit voir ce qui change avant de confirmer.
  if (unavailable.length > 0) {
    return res.status(409).json({
      ok: false,
      code: "ITEMS_UNAVAILABLE",
      error: "Certains articles de votre panier ne sont plus disponibles. Vérifiez votre panier avant de confirmer.",
      unavailable
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
          (order_number, customer_id, name, phone, email, fulfillment, address, notes, items, discount_code, subtotal, discount_amount, total, desired_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          code, req.customer?.sub || null, name, phone, email, fulfillment, address, notes,
          JSON.stringify(items), discountCode, subtotal, discountAmount, computeTotal(subtotal, discountAmount), desiredDate
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
    throw err;
  }

  const total = computeTotal(subtotal, discountAmount);
  const placed = { orderNumber, name, phone, email, fulfillment, address, notes, items, subtotal, discountAmount, total, desiredDate };
  sendOrderEmail(placed).catch((err) => console.error("[orders] échec envoi email:", err.message));

  res.json({ ok: true, orderId: orderNumber, subtotal, discountAmount, total, customer: { name } });
});

module.exports = router;
