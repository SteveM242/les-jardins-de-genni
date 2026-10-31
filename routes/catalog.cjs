const express = require("express");
const { query } = require("../db.cjs");
const { parseDataUri } = require("../lib/images.cjs");
const { BASKET_COLUMNS, PRODUCT_COLUMNS, publicBasket, publicProduct } = require("../lib/catalogRows.cjs");

const router = express.Router();

router.get("/baskets", async (_req, res) => {
  const { rows } = await query(`SELECT ${BASKET_COLUMNS} FROM baskets WHERE active = true ORDER BY price DESC`);
  res.json({ ok: true, baskets: rows.map(publicBasket) });
});

router.get("/products", async (_req, res) => {
  const { rows } = await query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE active = true ORDER BY category, name`);
  res.json({ ok: true, products: rows.map(publicProduct) });
});

// Sert une photo uploadée (stockée en base64 dans Postgres). L'URL contient ?v=<date d'upload> :
// le navigateur peut donc la garder en cache "pour toujours".
function imageRoute(table) {
  return async (req, res) => {
    const { rows } = await query(`SELECT image FROM ${table} WHERE slug = $1`, [req.params.slug]);
    const parsed = parseDataUri(rows[0]?.image);
    if (!parsed) return res.status(404).send("Not found");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.type(parsed.mimetype).send(parsed.buffer);
  };
}

router.get("/products/:slug/image", imageRoute("products"));
router.get("/baskets/:slug/image", imageRoute("baskets"));

module.exports = router;
