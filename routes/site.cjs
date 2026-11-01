const express = require("express");
const { query } = require("../db.cjs");
const { numericId } = require("../lib/params.cjs");
const { parseDataUri } = require("../lib/images.cjs");
const { normalizeStoredSocials, galleryImageUrl } = require("../lib/siteContent.cjs");
const { sectionsFromRows, publicSections } = require("../lib/siteSections.cjs");

const router = express.Router();
router.param("id", numericId);

// Contenu éditorial public géré par Genni : réseaux sociaux, galerie d'accueil, annonce, coordonnées,
// présentation, infos de retrait/livraison et mentions légales.
router.get("/site", async (_req, res) => {
  const [{ rows: settings }, { rows: gallery }] = await Promise.all([
    query("SELECT key, value FROM site_settings"),
    query("SELECT id, caption, image_updated_at FROM gallery_images WHERE active = true ORDER BY position, id")
  ]);
  const socials = settings.find((row) => row.key === "socials")?.value;
  res.set("Cache-Control", "public, max-age=60");
  res.json({
    ok: true,
    socials: normalizeStoredSocials(socials),
    gallery: gallery.map((row) => ({ id: row.id, caption: row.caption, url: galleryImageUrl(row) })),
    ...publicSections(sectionsFromRows(settings))
  });
});

// Photo de galerie (base64 en base) servie avec un cache long : l'URL change à chaque nouvel envoi.
router.get("/gallery/:id/image", async (req, res) => {
  const { rows } = await query("SELECT image FROM gallery_images WHERE id = $1", [req.params.id]);
  const parsed = parseDataUri(rows[0]?.image);
  if (!parsed) return res.status(404).send("Not found");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.type(parsed.mimetype).send(parsed.buffer);
});

module.exports = router;
