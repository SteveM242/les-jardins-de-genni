const express = require("express");
const { requireRole } = require("../../auth.cjs");

const router = express.Router();

// Connexion / déconnexion : publiques. Tout le reste exige une session admin valide.
router.use(require("./auth.cjs"));
router.use(requireRole("admin"));
router.use("/orders", require("./orders.cjs"));
router.use("/stats", require("./stats.cjs"));
router.use("/products", require("./products.cjs"));
router.use("/baskets", require("./baskets.cjs"));
router.use("/discounts", require("./discounts.cjs"));
router.use("/settings", require("./settings.cjs"));
router.use("/gallery", require("./gallery.cjs"));

module.exports = router;
