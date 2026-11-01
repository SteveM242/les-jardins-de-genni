const express = require("express");
const { query } = require("../../db.cjs");
const { startSession, clearAuthCookie, readSession, revokeSessions, requireRole } = require("../../auth.cjs");
const rateLimits = require("../../lib/rateLimits.cjs");
const { cleanText } = require("../../lib/text.cjs");
const { passwordMatches } = require("../../lib/passwords.cjs");

const router = express.Router();

router.post("/login", rateLimits.login, async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  const { rows } = await query("SELECT * FROM admins WHERE email = $1", [email]);
  const admin = rows[0];
  if (!(await passwordMatches(admin?.password_hash, password))) {
    // Indice "compte client" seulement si le mot de passe est bien celui du compte client (aucune fuite d'existence).
    const { rows: customerRows } = await query("SELECT password_hash FROM customers WHERE email = $1", [email]);
    if (await passwordMatches(customerRows[0]?.password_hash, password)) {
      return res.status(401).json({
        ok: false,
        error: "Cet email correspond à un compte client, pas à l'espace Genni. Utilisez la page de connexion client (/compte/connexion)."
      });
    }
    return res.status(401).json({ ok: false, error: "Email ou mot de passe incorrect." });
  }
  startSession(res, "admin", admin);
  res.json({ ok: true, admin: { email: admin.email } });
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res, "admin");
  res.json({ ok: true });
});

// Déconnecte tous les appareils (utile si un téléphone est perdu).
router.post("/logout-all", requireRole("admin"), async (req, res) => {
  await revokeSessions("admin", req.auth.sub);
  clearAuthCookie(res, "admin");
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const session = await readSession(req, "admin");
  res.json({ ok: true, admin: session ? { id: session.sub } : null });
});

module.exports = router;
