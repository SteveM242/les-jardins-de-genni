const express = require("express");
const { query } = require("../../db.cjs");
const { SocialLinkError, sanitizeSocials, normalizeStoredSocials } = require("../../lib/siteContent.cjs");

const router = express.Router();

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
  await query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ('socials', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(socials)]
  );
  res.json({ ok: true, socials });
});

module.exports = router;
