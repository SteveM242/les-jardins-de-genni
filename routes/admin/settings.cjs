const express = require("express");
const { query } = require("../../db.cjs");
const { SocialLinkError, sanitizeSocials, normalizeStoredSocials } = require("../../lib/siteContent.cjs");
const { SettingsError, SECTION_NAMES, sanitizeSection, sectionsFromRows } = require("../../lib/siteSections.cjs");

const router = express.Router();

async function saveSetting(key, value) {
  await query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

// Tout le contenu éditable d'un coup (écran « Contenu du site »).
router.get("/all", async (_req, res) => {
  const { rows } = await query("SELECT key, value FROM site_settings");
  res.json({
    ok: true,
    socials: normalizeStoredSocials(rows.find((row) => row.key === "socials")?.value),
    ...sectionsFromRows(rows)
  });
});

router.get("/socials", async (_req, res) => {
  const { rows } = await query("SELECT value FROM site_settings WHERE key = 'socials'");
  res.json({ ok: true, socials: normalizeStoredSocials(rows[0]?.value) });
});

router.put("/socials", async (req, res) => {
  let socials;
  try {
    socials = sanitizeSocials(req.body.socials);
  } catch (err) {
    if (err instanceof SocialLinkError) return res.status(400).json({ ok: false, error: err.message });
    throw err;
  }
  await saveSetting("socials", socials);
  res.json({ ok: true, socials });
});

// PUT /sections/:name  { value: {...} }  avec name ∈ announcement | contact | about | checkout | legal
router.put("/sections/:name", async (req, res) => {
  const name = req.params.name;
  if (!SECTION_NAMES.includes(name)) return res.status(404).json({ ok: false, error: "Section inconnue." });
  let value;
  try {
    value = sanitizeSection(name, req.body.value);
  } catch (err) {
    if (err instanceof SettingsError) return res.status(400).json({ ok: false, error: err.message });
    throw err;
  }
  await saveSetting(name, value);
  res.json({ ok: true, value });
});

module.exports = router;
