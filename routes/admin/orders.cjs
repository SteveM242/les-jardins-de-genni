const express = require("express");
const { query } = require("../../db.cjs");
const { escapeLike } = require("../../lib/text.cjs");
const { sendStatusEmail } = require("../../lib/mailer.cjs");
const { numericId } = require("../../lib/params.cjs");
const { normalizeOrderCode } = require("../../lib/orderCode.cjs");

const router = express.Router();
router.param("id", numericId);

const ORDER_STATUSES = ["nouvelle", "confirmee", "prete", "livree", "annulee"];
const PAGE_SIZE = 20;

// Liste paginée, filtrable par statut et recherche (n° de commande, nom, téléphone, email).
// Les compteurs par statut portent sur toutes les commandes, pas seulement la page affichée.
router.get("/", async (req, res) => {
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : null;
  const search = String(req.query.q || "").trim().slice(0, 80);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const p = `$${params.length}`;
    // « K7M-4QH » retrouve la commande K7M4QH : on cherche aussi le code sans tiret ni espace.
    const code = normalizeOrderCode(search);
    let codeMatch = "";
    if (code.length >= 3) {
      params.push(`%${escapeLike(code)}%`);
      codeMatch = `order_number ILIKE $${params.length} OR `;
    }
    conditions.push(`(${codeMatch}order_number ILIKE ${p} OR name ILIKE ${p} OR phone ILIKE ${p} OR email ILIKE ${p})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [{ rows: orders }, { rows: totalRows }, { rows: countRows }] = await Promise.all([
    query(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, params),
    query(`SELECT COUNT(*)::int AS n FROM orders ${where}`, params),
    query("SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status")
  ]);

  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  let all = 0;
  for (const row of countRows) {
    counts[row.status] = row.n;
    all += row.n;
  }
  counts.all = all;

  res.json({
    ok: true,
    orders,
    counts,
    page,
    pageSize: PAGE_SIZE,
    total: totalRows[0].n
  });
});

// Retrait : le client donne son code, on retrouve sa commande (et donc la personne à servir).
router.get("/code/:code", async (req, res) => {
  const code = normalizeOrderCode(req.params.code);
  if (!code) return res.status(400).json({ ok: false, error: "Saisissez le code de commande." });
  const { rows } = await query("SELECT * FROM orders WHERE order_number = $1", [code]);
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Aucune commande avec ce code." });
  res.json({ ok: true, order: rows[0] });
});

router.patch("/:id", async (req, res) => {
  const status = req.body.status;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: "Statut invalide." });
  }
  const { rows: previous } = await query("SELECT status FROM orders WHERE id = $1", [req.params.id]);
  if (!previous[0]) return res.status(404).json({ ok: false, error: "Commande introuvable." });

  const { rows } = await query("UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *", [
    status,
    req.params.id
  ]);

  if (previous[0].status !== status) {
    sendStatusEmail(rows[0]).catch((err) => console.error("[orders] échec email de statut:", err.message));
  }
  res.json({ ok: true, order: rows[0] });
});

module.exports = router;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
