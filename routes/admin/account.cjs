const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../../db.cjs");
const { startSession } = require("../../auth.cjs");
const rateLimits = require("../../lib/rateLimits.cjs");
const { cleanText } = require("../../lib/text.cjs");
const { passwordMatches, validPassword, PASSWORD_RULE } = require("../../lib/passwords.cjs");

// Compte de l'administrateur connecté : changer son email et son mot de passe.
const router = express.Router();

async function currentAdmin(req) {
  const { rows } = await query("SELECT * FROM admins WHERE id = $1", [req.auth.sub]);
  return rows[0];
}

router.get("/", async (req, res) => {
  const admin = await currentAdmin(req);
  if (!admin) return res.status(404).json({ ok: false, error: "Compte introuvable." });
  res.json({ ok: true, admin: { id: admin.id, email: admin.email } });
});

// Changer d'email exige le mot de passe actuel : une session laissée ouverte ne suffit pas à voler le compte.
router.patch("/email", rateLimits.reset, async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Cette adresse email n'est pas valide." });
  }
  const admin = await currentAdmin(req);
  if (!admin || !(await passwordMatches(admin.password_hash, String(req.body.currentPassword || "")))) {
    return res.status(400).json({ ok: false, error: "Votre mot de passe actuel est incorrect." });
  }
  const { rows: taken } = await query("SELECT id FROM admins WHERE email = $1 AND id <> $2", [email, admin.id]);
  if (taken.length > 0) {
    return res.status(409).json({ ok: false, error: "Cette adresse est déjà utilisée par un autre administrateur." });
  }
  const { rows } = await query("UPDATE admins SET email = $1 WHERE id = $2 RETURNING id, email", [email, admin.id]);
  res.json({ ok: true, admin: rows[0] });
});

// Les autres appareils sont déconnectés (token_version) ; celui-ci reçoit une nouvelle session.
router.post("/password", rateLimits.reset, async (req, res) => {
  const newPassword = String(req.body.newPassword || "");
  if (!validPassword(newPassword)) return res.status(400).json({ ok: false, error: PASSWORD_RULE });

  const admin = await currentAdmin(req);
  if (!admin || !(await passwordMatches(admin.password_hash, String(req.body.currentPassword || "")))) {
    return res.status(400).json({ ok: false, error: "Votre mot de passe actuel est incorrect." });
  }
  const { rows } = await query(
    "UPDATE admins SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING *",
    [await bcrypt.hash(newPassword, 10), admin.id]
  );
  startSession(res, "admin", rows[0]);
  res.json({ ok: true });
});

module.exports = router;
