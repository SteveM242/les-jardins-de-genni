const express = require("express");
const { query } = require("../../db.cjs");
const { isConfigured, sendTestEmail } = require("../../lib/mailer.cjs");
const payments = require("../../lib/payments.cjs");

const router = express.Router();

async function lastBackupAt() {
  const res = await query("SELECT value FROM site_settings WHERE key = 'last_backup'");
  return res?.rows?.[0]?.value?.at || null;
}

// État de la configuration, sans jamais renvoyer un secret : de quoi savoir ce qui manque avant d'annoncer le site.
router.get("/health", async (_req, res) => {
  const smtp = isConfigured();
  const siteUrl = Boolean(process.env.SITE_URL);
  res.json({
    ok: true,
    smtp,
    siteUrl,
    notifyEmail: Boolean(process.env.ORDER_NOTIFY_EMAIL),
    reminders: smtp && siteUrl,
    onlinePayment: payments.isEnabled(),
    lastBackupAt: await lastBackupAt()
  });
});

// Envoie un vrai email de test à l'adresse de notification : renvoie l'erreur du serveur mail en clair si ça échoue.
router.post("/test-email", async (_req, res) => {
  try {
    const to = await sendTestEmail();
    res.json({ ok: true, to });
  } catch (err) {
    res.status(502).json({ ok: false, error: `Envoi impossible : ${err.message}` });
  }
});

// Sauvegarde : tout ce qui compte, en JSON (sans mots de passe ni jetons). ?images=1 inclut les photos (fichier plus lourd).
router.get("/backup", async (req, res) => {
  const withImages = req.query.images === "1";
  const imageColumns = withImages ? ", image" : "";
  const [products, baskets, orders, customers, discounts, settings, gallery, subscribers] = await Promise.all([
    query(`SELECT id, slug, name, unit, price, category, active, sold_out, stock, created_at${imageColumns} FROM products ORDER BY id`),
    query(`SELECT id, slug, name, icon, price, summary, details, origin, item_count, items, composition, active, created_at${imageColumns} FROM baskets ORDER BY id`),
    query("SELECT * FROM orders ORDER BY id"),
    query("SELECT id, name, email, phone, address, addresses, favorites, default_fulfillment, email_verified_at, created_at FROM customers ORDER BY id"),
    query("SELECT * FROM discount_codes ORDER BY id"),
    query("SELECT key, value FROM site_settings ORDER BY key"),
    query(`SELECT id, caption, position, active${imageColumns} FROM gallery_images ORDER BY position, id`),
    query("SELECT email, name, created_at FROM reminder_subscribers ORDER BY id")
  ]);
  const at = new Date().toISOString();
  await query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ('last_backup', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify({ at })]
  );
  const rows = (result) => result?.rows || [];
  res.set("Content-Type", "application/json; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="sauvegarde-heritage-${at.slice(0, 10)}.json"`);
  res.send(
    JSON.stringify(
      {
        generatedAt: at,
        withImages,
        products: rows(products),
        baskets: rows(baskets),
        orders: rows(orders),
        customers: rows(customers),
        discountCodes: rows(discounts),
        settings: rows(settings),
        gallery: rows(gallery),
        reminderSubscribers: rows(subscribers)
      },
      null,
      2
    )
  );
});

module.exports = router;
