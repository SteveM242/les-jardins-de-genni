const { createApp } = require("./app.cjs");
const { migrate } = require("./migrate.cjs");
const db = require("./db.cjs");
const { isConfigured, sendReminderEmail } = require("./lib/mailer.cjs");
const { sendClosingReminders } = require("./lib/reminders.cjs");

const port = process.env.PORT || 4173;

// Toutes les 15 minutes : le rappel du lundi n'est envoyé qu'une fois par session (voir lib/reminders.cjs).
function startReminderScheduler() {
  if (!isConfigured()) return;
  const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");
  if (!siteUrl) {
    console.warn("[reminders] SITE_URL absent : rappels du lundi désactivés (les liens seraient inutilisables).");
    return;
  }
  const tick = async () => {
    try {
      const { rows } = await db.query("SELECT value FROM site_settings WHERE key = 'sales'");
      await sendClosingReminders(db, {
        mode: rows[0]?.value?.mode,
        send: ({ to, name, token, pickupDate }) =>
          sendReminderEmail({
            to,
            name,
            pickupDate,
            url: `${siteUrl}/commande`,
            unsubscribeUrl: `${siteUrl}/rappel/desabonnement?token=${token}`
          })
      });
    } catch (err) {
      console.error("[reminders] échec:", err.message);
    }
  };
  setInterval(tick, 15 * 60 * 1000).unref();
}

migrate()
  .then(() => {
    createApp().listen(port, () => {
      console.log(`L'Héritage des Mornes — server listening on port ${port}`);
    });
    startReminderScheduler();
  })
  .catch((err) => {
    console.error("[migrate] échec de la migration de la base:", err);
    process.exit(1);
  });
