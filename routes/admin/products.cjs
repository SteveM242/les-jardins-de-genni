const express = require("express");
const { query } = require("../../db.cjs");
const { numericId } = require("../../lib/params.cjs");
const { withImageUrl } = require("../../lib/images.cjs");
const { PRODUCT_COLUMNS } = require("../../lib/catalogRows.cjs");
const { cleanText, slugify } = require("../../lib/text.cjs");
const { registerImageUpload } = require("./imageUpload.cjs");

const router = express.Router();
router.param("id", numericId);

router.get("/", async (_req, res) => {
  const { rows } = await query(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY category, name`);
  res.json({ ok: true, products: rows.map((row) => withImageUrl("products", row)) });
});

router.post("/", async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const slug = slugify(req.body.slug || name);
  const price = Number(req.body.price);
  if (!slug || !name || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ ok: false, error: "Nom et prix (supérieur à 0) requis." });
  }
  const { rows: existing } = await query("SELECT 1 FROM products WHERE slug = $1", [slug]);
  if (existing.length > 0) {
    return res.status(409).json({ ok: false, error: "Un article avec ce nom existe déjà." });
  }
  const { rows } = await query(
    `INSERT INTO products (slug, name, unit, price, category) VALUES ($1,$2,$3,$4,$5) RETURNING ${PRODUCT_COLUMNS}`,
    [slug, name, cleanText(req.body.unit, 40) || "pièce", price, cleanText(req.body.category, 60) || null]
  );
  res.json({ ok: true, product: withImageUrl("products", rows[0]) });
});

router.patch("/:id", async (req, res) => {
  const { name, unit, price, category, active } = req.body;
  if (price != null && (!Number.isFinite(Number(price)) || Number(price) <= 0)) {
    return res.status(400).json({ ok: false, error: "Le prix doit être supérieur à 0." });
  }
  const { rows } = await query(
    `UPDATE products SET
       name = COALESCE($1, name), unit = COALESCE($2, unit), price = COALESCE($3, price),
       category = COALESCE($4, category), active = COALESCE($5, active)
     WHERE id = $6 RETURNING ${PRODUCT_COLUMNS}`,
    [name, unit, price, category, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Article introuvable." });
  res.json({ ok: true, product: withImageUrl("products", rows[0]) });
});

router.delete("/:id", async (req, res) => {
  await query("DELETE FROM products WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

registerImageUpload(router, { table: "products", rowKey: "product", notFound: "Article introuvable." });

module.exports = router;
