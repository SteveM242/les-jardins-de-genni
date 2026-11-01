const crypto = require("node:crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../db.cjs");
const { startSession, clearAuthCookie, requireRole, attachCustomer } = require("../auth.cjs");
const rateLimits = require("../lib/rateLimits.cjs");
const { cleanText } = require("../lib/text.cjs");
const { sendPasswordResetEmail } = require("../lib/mailer.cjs");
const { passwordMatches } = require("../lib/passwords.cjs");
const { baseUrlFor } = require("../lib/urls.cjs");

const router = express.Router();

const MIN_PASSWORD = 8;
// bcrypt ignore tout ce qui dépasse 72 octets : on refuse plutôt que de tronquer en silence.
const MAX_PASSWORD = 72;
const PASSWORD_RULE = `Le mot de passe doit contenir entre ${MIN_PASSWORD} et ${MAX_PASSWORD} caractères.`;
const GENERIC_LOGIN_ERROR = "Email ou mot de passe incorrect.";

function validPassword(password) {
  return password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function publicCustomer(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, address: row.address };
}

router.post("/auth/signup", rateLimits.signup, async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const email = cleanText(req.body.email, 160).toLowerCase();
  const phone = cleanText(req.body.phone, 40);
  const password = String(req.body.password || "");

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Nom et email valides requis." });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ ok: false, error: PASSWORD_RULE });
  }

  const { rows: existing } = await query("SELECT id FROM customers WHERE email = $1", [email]);
  if (existing.length > 0) {
    return res.status(409).json({ ok: false, error: "Un compte existe déjà avec cet email. Essayez de vous connecter." });
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

  if (!(await passwordMatches(customer?.password_hash, password))) {
    // Indice "espace Genni" uniquement si le mot de passe saisi est bien celui du compte pro :
    // sans ça, la réponse révélerait quels emails sont des comptes administrateur.
    const { rows: adminRows } = await query("SELECT password_hash FROM admins WHERE email = $1", [email]);
    if (await passwordMatches(adminRows[0]?.password_hash, password)) {
      return res.status(401).json({
        ok: false,
        error: "Cet email correspond à un compte Genni (espace pro), pas à un compte client. Utilisez le lien \"Espace Genni\" ci-dessus."
      });
    }
    return res.status(401).json({ ok: false, error: GENERIC_LOGIN_ERROR });
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

// Mot de passe oublié : la réponse est toujours la même, que l'email existe ou non.
router.post("/auth/forgot", rateLimits.forgot, async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const { rows } = await query("SELECT id, name, email FROM customers WHERE email = $1", [email]);
  const customer = rows[0];
  if (customer) {
    const token = crypto.randomBytes(32).toString("hex");
    await query(
      "INSERT INTO password_resets (customer_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
      [customer.id, sha256(token)]
    );
    const url = `${baseUrlFor(req)}/compte/reinitialiser?token=${token}`;
    sendPasswordResetEmail({ to: customer.email, name: customer.name, url }).catch((err) =>
      console.error("[auth] échec envoi email de réinitialisation:", err.message)
    );
  }
  res.json({ ok: true });
});

router.post("/auth/reset", rateLimits.reset, async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (!validPassword(password)) {
    return res.status(400).json({ ok: false, error: PASSWORD_RULE });
  }

  const { rows } = await query(
    "SELECT id, customer_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()",
    [sha256(token)]
  );
  if (!rows[0]) {
    return res.status(400).json({ ok: false, error: "Ce lien est invalide ou a expiré. Refaites une demande." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const customer = await withTransaction(async (client) => {
    // token_version + 1 déconnecte tous les appareils déjà connectés avec l'ancien mot de passe.
    const { rows: updated } = await client.query(
      "UPDATE customers SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING *",
      [passwordHash, rows[0].customer_id]
    );
    await client.query("UPDATE password_resets SET used_at = now() WHERE customer_id = $1 AND used_at IS NULL", [
      rows[0].customer_id
    ]);
    return updated[0];
  });

  startSession(res, "customer", customer);
  res.json({ ok: true, customer: publicCustomer(customer) });
});

// ---------- Espace client connecté ----------

router.patch("/account", requireRole("customer"), async (req, res) => {
  const name = cleanText(req.body.name, 120);
  if (!name) return res.status(400).json({ ok: false, error: "Le nom est obligatoire." });
  const { rows } = await query(
    "UPDATE customers SET name = $1, phone = $2, address = $3 WHERE id = $4 RETURNING *",
    [name, cleanText(req.body.phone, 40), cleanText(req.body.address, 300), req.auth.sub]
  );
  res.json({ ok: true, customer: publicCustomer(rows[0]) });
});

router.post("/account/password", rateLimits.reset, requireRole("customer"), async (req, res) => {
  const current = String(req.body.currentPassword || "");
  const next = String(req.body.newPassword || "");
  if (!validPassword(next)) return res.status(400).json({ ok: false, error: PASSWORD_RULE });

  const { rows } = await query("SELECT * FROM customers WHERE id = $1", [req.auth.sub]);
  if (!(await passwordMatches(rows[0]?.password_hash, current))) {
    return res.status(400).json({ ok: false, error: "Votre mot de passe actuel est incorrect." });
  }

  const { rows: updated } = await query(
    "UPDATE customers SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING *",
    [await bcrypt.hash(next, 10), req.auth.sub]
  );
  // Les autres appareils sont déconnectés ; celui-ci reçoit une nouvelle session.
  startSession(res, "customer", updated[0]);
  res.json({ ok: true });
});

router.get("/account/orders", requireRole("customer"), async (req, res) => {
  const { rows } = await query(
    "SELECT order_number, items, subtotal, discount_amount, total, status, fulfillment, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
    [req.auth.sub]
  );
  res.json({ ok: true, orders: rows });
});

module.exports = router;
