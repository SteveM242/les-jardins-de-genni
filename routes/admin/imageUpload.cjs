const { query } = require("../../db.cjs");
const { upload, matchesImageSignature, fileToDataUri, withImageUrl, IMAGE_COLUMNS } = require("../../lib/images.cjs");

// POST /:id/image pour une table (products | baskets) : enregistre la photo en base64 dans la colonne image.
function registerImageUpload(router, { table, rowKey, notFound }) {
  router.post("/:id/image", upload.single("image"), async (req, res) => {
    if (!req.file || !matchesImageSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ ok: false, error: "Image invalide (jpg, png ou webp, 3 Mo max)." });
    }
    const { rows } = await query(
      `UPDATE ${table} SET image = $1, image_updated_at = now() WHERE id = $2
       RETURNING id, slug, name, active, ${IMAGE_COLUMNS}`,
      [fileToDataUri(req.file), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: notFound });
    res.json({ ok: true, [rowKey]: withImageUrl(table, rows[0]) });
  });
}

module.exports = { registerImageUpload };
