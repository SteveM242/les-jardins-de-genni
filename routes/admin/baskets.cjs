const express = require("express");
const { query } = require("../../db.cjs");
const { numericId } = require("../../lib/params.cjs");
const { withImageUrl } = require("../../lib/images.cjs");
const { BASKET_COLUMNS } = require("../../lib/catalogRows.cjs");
const { slugify } = require("../../lib/text.cjs");
const { BasketInputError, parseBasketInput } = require("../../lib/basketRules.cjs");
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

// Deux paniers ne portent pas le même nom (casse ignorée) : évite deux fiches identiques en vitrine.
async function nameTaken(name, exceptId) {
  const { rows } = await query("SELECT 1 FROM baskets WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1", [name, exceptId]);
  return rows.length > 0;
}

function sendInvalid(res, err) {
  if (err instanceof BasketInputError) return res.status(400).json({ ok: false, error: err.message });
  throw err;
}

router.post("/", async (req, res) => {
  let input;
  try {
    input = parseBasketInput(req.body, { partial: false });
  } catch (err) {
    return sendInvalid(res, err);
  }
  if (await nameTaken(input.name, 0)) {
    return res.status(409).json({ ok: false, error: "Un panier porte déjà ce nom." });
  }
  const slug = await uniqueSlug(slugify(input.name));
  const items = input.items || [];

  const { rows } = await query(
    `INSERT INTO baskets (slug, name, icon, price, summary, details, origin, item_count, items, composition)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${BASKET_COLUMNS}`,
    [
      slug, input.name, "🧺", input.price, input.summary || "", input.details || "", input.origin || "",
      input.itemCount ?? items.length, JSON.stringify(items), input.composition ? JSON.stringify(input.composition) : null
    ]
  );
  res.json({ ok: true, basket: withImageUrl("baskets", rows[0]) });
});

router.patch("/:id", async (req, res) => {
  let input;
  try {
    input = parseBasketInput(req.body, { partial: true });
  } catch (err) {
    return sendInvalid(res, err);
  }

  const { rows: current } = await query("SELECT id, items, composition FROM baskets WHERE id = $1", [req.params.id]);
  if (!current[0]) return res.status(404).json({ ok: false, error: "Panier introuvable." });

  // Sur un panier personnalisable, le contenu se modifie par sa composition (sinon les deux divergeraient).
  if (current[0].composition && input.items && !input.composition && !input.clearComposition) {
    return res.status(400).json({ ok: false, error: "Ce panier est personnalisable : modifiez sa composition plutôt que sa liste d'articles." });
  }

  if (input.name && (await nameTaken(input.name, req.params.id))) {
    return res.status(409).json({ ok: false, error: "Un autre panier porte déjà ce nom." });
  }
  // Un panier vide ne se met pas en vente : le client commanderait « rien ».
  const finalItems = input.items || current[0].items || [];
  if (input.active === true && finalItems.length === 0) {
    return res.status(400).json({ ok: false, error: "Ajoutez au moins un article au panier avant de le mettre en vente." });
  }

  const items = input.items || null;
  const { rows } = await query(
    `UPDATE baskets SET
       name = COALESCE($1, name), price = COALESCE($2, price), summary = COALESCE($3, summary),
       details = COALESCE($4, details), origin = COALESCE($5, origin), active = COALESCE($6, active),
       items = COALESCE($7, items), item_count = COALESCE($8, item_count),
       composition = CASE WHEN $10::boolean THEN NULL ELSE COALESCE($11::jsonb, composition) END
     WHERE id = $9 RETURNING ${BASKET_COLUMNS}`,
    [
      input.name ?? null, input.price ?? null, input.summary ?? null, input.details ?? null, input.origin ?? null,
      input.active ?? null, items ? JSON.stringify(items) : null, items ? input.itemCount ?? items.length : null,
      req.params.id, Boolean(input.clearComposition), input.composition ? JSON.stringify(input.composition) : null
    ]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Panier introuvable." });
  res.json({ ok: true, basket: withImageUrl("baskets", rows[0]) });
});

router.delete("/:id", async (req, res) => {
  const { rowCount } = await query("DELETE FROM baskets WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ ok: false, error: "Panier introuvable." });
  res.json({ ok: true });
});

registerImageUpload(router, { table: "baskets", rowKey: "basket", notFound: "Panier introuvable." });

module.exports = router;
