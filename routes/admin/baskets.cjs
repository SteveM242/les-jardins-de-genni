const express = require("express");
const { query } = require("../../db.cjs");
const { numericId } = require("../../lib/params.cjs");
const { withImageUrl } = require("../../lib/images.cjs");
const { BASKET_COLUMNS } = require("../../lib/catalogRows.cjs");
const { cleanText, slugify } = require("../../lib/text.cjs");
const { registerImageUpload } = require("./imageUpload.cjs");

const router = express.Router();
router.param("id", numericId);

async function uniqueSlug(base) {
  const root = base || "panier";
  let slug = root;
  let suffix = 1;
  while ((await query("SELECT 1 FROM baskets WHERE slug = $1", [slug])).rows.length > 0) {
    suffix += 1;
    slug = `${root}-${suffix}`;
  }
  return slug;
}

router.get("/", async (_req, res) => {
  const { rows } = await query(`SELECT ${BASKET_COLUMNS} FROM baskets ORDER BY price DESC`);
  res.json({ ok: true, baskets: rows.map((row) => withImageUrl("baskets", row)) });
});

router.post("/", async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const price = Number(req.body.price);
  if (!name || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ ok: false, error: "Le nom et le prix sont obligatoires." });
  }
  const slug = await uniqueSlug(slugify(name));
  const summary = cleanText(req.body.summary, 500);
  const items = Array.isArray(req.body.items) ? req.body.items.filter(Boolean) : [];

  const { rows } = await query(
    `INSERT INTO baskets (slug, name, icon, price, summary, details, origin, item_count, items)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${BASKET_COLUMNS}`,
    [slug, name, "🧺", price, summary, "", "", items.length, JSON.stringify(items)]
  );
  res.json({ ok: true, basket: withImageUrl("baskets", rows[0]) });
});

router.patch("/:id", async (req, res) => {
  const { name, price, summary, details, origin, active } = req.body;
  if (price != null && (!Number.isFinite(Number(price)) || Number(price) <= 0)) {
    return res.status(400).json({ ok: false, error: "Le prix doit être supérieur à 0." });
  }
  const items = Array.isArray(req.body.items) ? req.body.items.filter(Boolean) : null;
  const { rows } = await query(
    `UPDATE baskets SET
       name = COALESCE($1, name), price = COALESCE($2, price), summary = COALESCE($3, summary),
       details = COALESCE($4, details), origin = COALESCE($5, origin), active = COALESCE($6, active),
       items = COALESCE($7, items), item_count = COALESCE($8, item_count)
     WHERE id = $9 RETURNING ${BASKET_COLUMNS}`,
    [name, price, summary, details, origin, active, items ? JSON.stringify(items) : null, items ? items.length : null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Panier introuvable." });
  res.json({ ok: true, basket: withImageUrl("baskets", rows[0]) });
});

router.delete("/:id", async (req, res) => {
  await query("DELETE FROM baskets WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

registerImageUpload(router, { table: "baskets", rowKey: "basket", notFound: "Panier introuvable." });

module.exports = router;
