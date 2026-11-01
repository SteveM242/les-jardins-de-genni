const express = require("express");
const { query, withTransaction } = require("../../db.cjs");
const { numericId } = require("../../lib/params.cjs");
const { upload, matchesImageSignature, fileToDataUri } = require("../../lib/images.cjs");
const { cleanText } = require("../../lib/text.cjs");
const { MAX_GALLERY_IMAGES, galleryImageUrl } = require("../../lib/siteContent.cjs");

const router = express.Router();
router.param("id", numericId);

const COLUMNS = "id, caption, position, active, image_updated_at";

function present(row) {
  return { id: row.id, caption: row.caption, position: row.position, active: row.active, url: galleryImageUrl(row) };
}

router.get("/", async (_req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS} FROM gallery_images ORDER BY position, id`);
  res.json({ ok: true, images: rows.map(present), max: MAX_GALLERY_IMAGES });
});

router.post("/", upload.single("image"), async (req, res) => {
  if (!req.file || !matchesImageSignature(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ ok: false, error: "Image invalide (jpg, png ou webp, 3 Mo max)." });
  }
  const { rows: counts } = await query("SELECT COUNT(*)::int AS n, COALESCE(MAX(position), 0) AS last FROM gallery_images");
  if (counts[0].n >= MAX_GALLERY_IMAGES) {
    return res.status(400).json({ ok: false, error: `La galerie est limitée à ${MAX_GALLERY_IMAGES} photos. Supprimez-en une avant d'en ajouter.` });
  }
  const { rows } = await query(
    `INSERT INTO gallery_images (image, caption, position) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [fileToDataUri(req.file), cleanText(req.body.caption, 140), Number(counts[0].last) + 1]
  );
  res.json({ ok: true, image: present(rows[0]) });
});

// Réordonnancement : ids = liste complète des photos dans le nouvel ordre.
router.post("/reorder", async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ ok: false, error: "Ordre invalide." });
  }
  await withTransaction(async (client) => {
    for (const [index, id] of ids.entries()) {
      await client.query("UPDATE gallery_images SET position = $1 WHERE id = $2", [index + 1, id]);
    }
  });
  res.json({ ok: true });
});

router.patch("/:id", async (req, res) => {
  const caption = req.body.caption == null ? null : cleanText(req.body.caption, 140);
  const active = typeof req.body.active === "boolean" ? req.body.active : null;
  const { rows } = await query(
    `UPDATE gallery_images SET caption = COALESCE($1, caption), active = COALESCE($2, active)
     WHERE id = $3 RETURNING ${COLUMNS}`,
    [caption, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Photo introuvable." });
  res.json({ ok: true, image: present(rows[0]) });
});

router.delete("/:id", async (req, res) => {
  await query("DELETE FROM gallery_images WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
