const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db.cjs");
const { startSession, clearAuthCookie, requireRole, attachCustomer } = require("../auth.cjs");
const rateLimits = require("../lib/rateLimits.cjs");
const { cleanText } = require("../lib/text.cjs");

const router = express.Router();

function publicCustomer(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, address: row.address };
}

router.post("/auth/signup", rateLimits.signup, async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const email = cleanText(req.body.email, 160).toLowerCase();
  const phone = cleanText(req.body.phone, 40);
  const password = String(req.body.password || "");

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ ok: false, error: "Nom, email et mot de passe (6 caractères min.) requis." });
  }

  const { rows: existing } = await query("SELECT id FROM customers WHERE email = $1", [email]);
  if (existing.length > 0) {
    return res.status(409).json({ ok: false, error: "Un compte existe déjà avec cet email." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    "INSERT INTO customers (name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, name, email, phone, address, token_version",
    [name, email, phone, passwordHash]
  );

  startSession(res, "customer", rows[0]);
  res.json({ ok: true, customer: publicCustomer(rows[0]) });
});

router.post("/auth/login", rateLimits.login, async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  const { rows } = await query("SELECT * FROM customers WHERE email = $1", [email]);
  const customer = rows[0];
  if (!customer || !(await bcrypt.compare(password, customer.password_hash))) {
    const { rows: adminRows } = await query("SELECT id FROM admins WHERE email = $1", [email]);
    if (adminRows[0]) {
      return res.status(401).json({
        ok: false,
        error: "Cet email correspond à un compte Genni (espace pro), pas à un compte client. Utilisez le lien \"Espace Genni\" ci-dessus."
      });
    }
    return res.status(401).json({ ok: false, error: "Email ou mot de passe incorrect." });
  }
  startSession(res, "customer", customer);
  res.json({ ok: true, customer: publicCustomer(customer) });
});

router.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res, "customer");
  res.json({ ok: true });
});

router.get("/auth/me", attachCustomer, async (req, res) => {
  if (!req.customer) return res.json({ ok: true, customer: null });
  const { rows } = await query("SELECT * FROM customers WHERE id = $1", [req.customer.sub]);
  res.json({ ok: true, customer: rows[0] ? publicCustomer(rows[0]) : null });
});

router.get("/account/orders", requireRole("customer"), async (req, res) => {
  const { rows } = await query(
    "SELECT order_number, items, subtotal, discount_amount, total, status, fulfillment, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
    [req.auth.sub]
  );
  res.json({ ok: true, orders: rows });
});

module.exports = router;
