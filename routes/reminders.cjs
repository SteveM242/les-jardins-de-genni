const express = require("express");
const { query } = require("../db.cjs");
const rateLimits = require("../lib/rateLimits.cjs");
const { unsubscribe } = require("../lib/reminders.cjs");

const router = express.Router();

// Désinscription du rappel du lundi, depuis le lien de l'email (jeton aléatoire, sans compte).
router.post("/reminders/unsubscribe", rateLimits.reset, async (req, res) => {
  const done = await unsubscribe({ query }, req.body.token);
  if (!done) return res.status(404).json({ ok: false, error: "Ce lien n'est plus valable : vous êtes peut-être déjà désinscrit·e." });
  res.json({ ok: true });
});

module.exports = router;
