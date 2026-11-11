const express = require("express");
const { query } = require("../../db.cjs");
const { escapeLike } = require("../../lib/text.cjs");
const { sendStatusEmail } = require("../../lib/mailer.cjs");
const { numericId } = require("../../lib/params.cjs");
const { normalizeOrderCode, formatOrderCode } = require("../../lib/orderCode.cjs");
const { aggregatePrep } = require("../../lib/prep.cjs");
const { toCsv } = require("../../lib/csv.cjs");

const router = express.Router();
router.param("id", numericId);

const ORDER_STATUSES = ["nouvelle", "confirmee", "prete", "livree", "non_retiree", "annulee"];
// Commandes encore à préparer ou à remettre.
const ACTIVE_STATUSES = ["nouvelle", "confirmee", "prete"];
const PAGE_SIZE = 20;

// Liste paginée, filtrable par statut et recherche (n° de commande, nom, téléphone, email).
// Les compteurs par statut portent sur toutes les commandes, pas seulement la page affichée.
router.get("/", async (req, res) => {
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : null;
  const search = String(req.query.q || "").trim().slice(0, 80);
  const unpaidOnly = req.query.paid === "0";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (unpaidOnly) conditions.push("paid = false");
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

// Liste de préparation : quantités totales par article (paniers personnalisés compris) des commandes à préparer.
// ?date=YYYY-MM-DD limite aux commandes à retirer ce jour-là.
router.get("/prep", async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || "")) ? String(req.query.date) : null;
  const params = [ACTIVE_STATUSES];
  let where = "status = ANY($1)";
  if (date) {
    params.push(date);
    where += " AND desired_date = $2";
  }
  const { rows } = await query(`SELECT order_number, name, items FROM orders WHERE ${where} ORDER BY created_at`, params);
  res.json({ ok: true, date, ...aggregatePrep(rows) });
});

// Export CSV des commandes (comptabilité) : ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=…
router.get("/export.csv", async (req, res) => {
  const conditions = [];
  const params = [];
  const day = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);
  if (day(req.query.from)) {
    params.push(day(req.query.from));
    conditions.push(`created_at >= $${params.length}::date`);
  }
  if (day(req.query.to)) {
    params.push(day(req.query.to));
    conditions.push(`created_at < ($${params.length}::date + 1)`);
  }
  if (ORDER_STATUSES.includes(req.query.status)) {
    params.push(req.query.status);
    conditions.push(`status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT 5000`, params);

  const header = ["Code", "Date", "Retrait prévu", "Statut", "Payée", "Nom", "Téléphone", "Email", "Mode", "Adresse", "Articles", "Sous-total", "Réduction", "Code promo", "Total", "Notes"];
  const body = rows.map((order) => {
    const items = (Array.isArray(order.items) ? order.items : []).map((line) => `${line.qty} × ${line.name}`).join(" | ");
    return [
      formatOrderCode(order.order_number),
      order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : "",
      order.desired_date ? new Date(order.desired_date).toISOString().slice(0, 10) : "",
      order.status,
      order.paid ? "oui" : "non",
      order.name,
      order.phone,
      order.email,
      order.fulfillment,
      order.address,
      items,
      order.subtotal,
      order.discount_amount,
      order.discount_code,
      order.total,
      order.notes
    ];
  });
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv(header, body));
});

// Change le statut et/ou l'état de paiement d'une commande.
router.patch("/:id", async (req, res) => {
  const status = req.body.status;
  const paid = req.body.paid;
  if (status === undefined && typeof paid !== "boolean") {
    return res.status(400).json({ ok: false, error: "Rien à modifier." });
  }
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: "Statut invalide." });
  }
  const { rows: previous } = await query("SELECT status FROM orders WHERE id = $1", [req.params.id]);
  if (!previous[0]) return res.status(404).json({ ok: false, error: "Commande introuvable." });

  const { rows } = await query(
    `UPDATE orders SET
       status = COALESCE($1, status),
       paid = COALESCE($2::boolean, paid),
       paid_at = CASE WHEN $2::boolean IS NULL THEN paid_at WHEN $2::boolean THEN COALESCE(paid_at, now()) ELSE NULL END,
       updated_at = now()
     WHERE id = $3 RETURNING *`,
    [status ?? null, typeof paid === "boolean" ? paid : null, req.params.id]
  );

  if (status !== undefined && previous[0].status !== status) {
    sendStatusEmail(rows[0]).catch((err) => console.error("[orders] échec email de statut:", err.message));
  }
  res.json({ ok: true, order: rows[0] });
});

module.exports = router;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
