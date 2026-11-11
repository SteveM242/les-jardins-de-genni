const express = require("express");
const { query } = require("../../db.cjs");
const { computeStats, computeInsights } = require("../../lib/stats.cjs");

const router = express.Router();

router.get("/", async (_req, res) => {
  const { rows } = await query(
    "SELECT total, status, created_at, items, desired_date, email, phone FROM orders WHERE created_at >= now() - interval '90 days' ORDER BY created_at DESC LIMIT 5000"
  );
  res.json({ ok: true, ...computeStats(rows), insights: computeInsights(rows) });
});

module.exports = router;
