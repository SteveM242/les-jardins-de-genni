const express = require("express");
const { query } = require("../../db.cjs");
const { numericId } = require("../../lib/params.cjs");

const router = express.Router();
router.param("id", numericId);

router.get("/", async (_req, res) => {
  const { rows } = await query("SELECT * FROM discount_codes ORDER BY created_at DESC");
  res.json({ ok: true, discounts: rows });
});

router.post("/", async (req, res) => {
  const { code, type, value, maxUses, expiresAt } = req.body;
  const amount = Number(value);
  if (!code || !["percent", "fixed"].includes(type) || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: "code, type (percent/fixed) et value requis." });
  }
  if (type === "percent" && amount > 100) {
    return res.status(400).json({ ok: false, error: "Un pourcentage ne peut pas dépasser 100." });
  }
  const normalized = String(code).trim().toUpperCase();
  const { rows: existing } = await query("SELECT 1 FROM discount_codes WHERE code = $1", [normalized]);
  if (existing.length > 0) return res.status(409).json({ ok: false, error: "Ce code existe déjà." });

  const { rows } = await query(
    "INSERT INTO discount_codes (code, type, value, max_uses, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [normalized, type, amount, maxUses || null, expiresAt || null]
  );
  res.json({ ok: true, discount: rows[0] });
});

router.patch("/:id", async (req, res) => {
  const { rows } = await query("UPDATE discount_codes SET active = COALESCE($1, active) WHERE id = $2 RETURNING *", [
    req.body.active,
    req.params.id
  ]);
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Code introuvable." });
  res.json({ ok: true, discount: rows[0] });
});

router.delete("/:id", async (req, res) => {
  await query("DELETE FROM discount_codes WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
