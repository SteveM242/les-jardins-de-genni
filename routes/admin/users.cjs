const express = require("express");
const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../../db.cjs");
const { numericId } = require("../../lib/params.cjs");
const { cleanText, escapeLike } = require("../../lib/text.cjs");
const { validPassword, PASSWORD_RULE } = require("../../lib/passwords.cjs");

// Gestion des comptes : clients (suppression, droit à l'effacement) et administrateurs (ajout / retrait).
const router = express.Router();
router.param("id", numericId);

const PAGE_SIZE = 25;

router.get("/customers", async (req, res) => {
  const search = String(req.query.q || "").trim().slice(0, 80);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const params = [];
  let where = "";
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    where = "WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1";
  }

  const [{ rows: customers }, { rows: totals }] = await Promise.all([
    query(
      `SELECT c.id, c.name, c.email, c.phone, c.created_at, (c.email_verified_at IS NOT NULL) AS email_verified,
              (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = c.id) AS orders
       FROM customers c ${where} ORDER BY c.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params
    ),
    query(`SELECT COUNT(*)::int AS n FROM customers c ${where}`, params)
  ]);
  res.json({ ok: true, customers, total: totals[0].n, page, pageSize: PAGE_SIZE });
});

// Supprime un compte client. Les commandes sont conservées (comptabilité) mais détachées du compte ;
// avec anonymizeOrders, les données personnelles de ses commandes sont effacées (demande d'effacement RGPD).
router.delete("/customers/:id", async (req, res) => {
  const anonymize = req.body?.anonymizeOrders === true;
  const found = await withTransaction(async (client) => {
    const { rows } = await client.query("SELECT id, email FROM customers WHERE id = $1", [req.params.id]);
    if (!rows[0]) return false;
    if (anonymize) {
      await client.query(
        `UPDATE orders SET name = 'Client supprimé', phone = '', email = NULL, address = NULL, notes = NULL
         WHERE customer_id = $1 OR (email <> '' AND lower(email) = lower($2))`,
        [rows[0].id, rows[0].email]
      );
    }
    await client.query("UPDATE orders SET customer_id = NULL WHERE customer_id = $1", [rows[0].id]);
    await client.query("DELETE FROM customers WHERE id = $1", [rows[0].id]);
    return true;
  });
  if (!found) return res.status(404).json({ ok: false, error: "Compte introuvable." });
  res.json({ ok: true });
});

router.get("/admins", async (req, res) => {
  const { rows } = await query("SELECT id, email, created_at FROM admins ORDER BY id");
  res.json({ ok: true, admins: rows.map((row) => ({ ...row, isSelf: row.id === req.auth.sub })) });
});

router.post("/admins", async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok: false, error: "Cette adresse email n'est pas valide." });
  if (!validPassword(password)) return res.status(400).json({ ok: false, error: PASSWORD_RULE });

  const { rows: existing } = await query("SELECT id FROM admins WHERE email = $1", [email]);
  if (existing.length > 0) return res.status(409).json({ ok: false, error: "Un administrateur existe déjà avec cet email." });

  const { rows } = await query("INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at", [
    email,
    await bcrypt.hash(password, 10)
  ]);
  res.json({ ok: true, admin: { ...rows[0], isSelf: false } });
});

router.delete("/admins/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.auth.sub) {
    return res.status(400).json({ ok: false, error: "Vous ne pouvez pas supprimer votre propre compte." });
  }
  const { rows: count } = await query("SELECT COUNT(*)::int AS n FROM admins");
  if (count[0].n <= 1) {
    return res.status(400).json({ ok: false, error: "Il doit rester au moins un administrateur." });
  }
  const { rows } = await query("DELETE FROM admins WHERE id = $1 RETURNING id", [id]);
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Administrateur introuvable." });
  res.json({ ok: true });
});

module.exports = router;
