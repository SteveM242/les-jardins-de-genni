const crypto = require("node:crypto");
const express = require("express");
const { query, withTransaction } = require("../db.cjs");
const { attachCustomer } = require("../auth.cjs");
const rateLimits = require("../lib/rateLimits.cjs");
const { cleanText } = require("../lib/text.cjs");
const { sendOrderEmail } = require("../lib/mailer.cjs");
const {
  DiscountError,
  computeSubtotal,
  computeTotal,
  assertDiscountUsable,
  discountAmountFor,
  clampQuantity
} = require("../lib/pricing.cjs");

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

async function priceItems(requestedItems) {
  const items = [];
  for (const requested of requestedItems) {
    const qty = clampQuantity(requested.qty);
    const isProduct = requested.type === "product";
    const { rows } = await query(
      `SELECT slug, name, price FROM ${isProduct ? "products" : "baskets"} WHERE slug = $1 AND active = true`,
      [requested.slug]
    );
    if (rows[0]) {
      items.push({
        type: isProduct ? "product" : "basket",
        slug: rows[0].slug,
        name: rows[0].name,
        price: Number(rows[0].price),
        qty
      });
    }
  }
  return items;
}

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

  const requestedItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 100) : [];
  if (requestedItems.length === 0) {
    return res.status(400).json({ ok: false, error: "Le panier est vide." });
  }

  const items = await priceItems(requestedItems);
  if (items.length === 0) {
    return res.status(400).json({ ok: false, error: "Aucun article reconnu dans le panier." });
  }

  const subtotal = computeSubtotal(items);
  const orderNumber = crypto.randomUUID().slice(0, 8).toUpperCase();

  let discountCode = null;
  let discountAmount = 0;
  try {
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
          (order_number, customer_id, name, phone, email, fulfillment, address, notes, items, discount_code, subtotal, discount_amount, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          orderNumber, req.customer?.sub || null, name, phone, email, fulfillment, address, notes,
          JSON.stringify(items), discountCode, subtotal, discountAmount, computeTotal(subtotal, discountAmount)
        ]
      );
    });
  } catch (err) {
    if (err instanceof DiscountError) return res.status(400).json({ ok: false, error: err.message });
    throw err;
  }

  const total = computeTotal(subtotal, discountAmount);
  sendOrderEmail({
    orderNumber, name, phone, email, fulfillment, address, notes, items, subtotal, discountAmount, total
  }).catch((err) => console.error("[orders] échec envoi email:", err.message));

  res.json({ ok: true, orderId: orderNumber, subtotal, discountAmount, total, customer: { name } });
});

module.exports = router;
