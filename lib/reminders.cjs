// Rappel du lundi : un email aux personnes inscrites qui n'ont pas encore commandé pour la session en cours.
// Inscription volontaire (case à cocher au checkout), désinscription en un clic depuis chaque email.
const crypto = require("node:crypto");
const { salesStatus, sessionKey, isReminderTime } = require("./salesWindow.cjs");

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

async function subscribe(db, { email, name }) {
  const address = String(email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(address)) return false;
  await db.query(
    `INSERT INTO reminder_subscribers (email, name, token) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [address, String(name || "").slice(0, 120), crypto.randomBytes(16).toString("hex")]
  );
  return true;
}

async function unsubscribe(db, token) {
  const clean = String(token || "").trim();
  if (!/^[a-f0-9]{32}$/.test(clean)) return false;
  const res = await db.query("DELETE FROM reminder_subscribers WHERE token = $1", [clean]);
  return (res?.rowCount || 0) > 0;
}

// Envoie le rappel une seule fois par session de vente. Renvoie le nombre d'emails envoyés.
//   db : { query }, send : ({ to, name, token, pickupDate }) => Promise
async function sendClosingReminders(db, { send, now = new Date(), mode = "auto" }) {
  if (!isReminderTime(now)) return 0;
  const status = salesStatus(mode, now);
  if (!status.open) return 0;

  // Réservation atomique : si une autre instance a déjà envoyé le rappel de cette session, rien ne revient.
  const claim = await db.query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ('last_reminder', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     WHERE site_settings.value <> EXCLUDED.value
     RETURNING key`,
    [JSON.stringify({ session: sessionKey(now) })]
  );
  if (!claim.rows?.length) return 0;

  const { rows } = await db.query(
    `SELECT s.email, s.name, s.token FROM reminder_subscribers s
     WHERE NOT EXISTS (
       SELECT 1 FROM orders o
       WHERE lower(o.email) = s.email AND o.desired_date = $1 AND o.status <> 'annulee'
     )`,
    [status.pickupDate]
  );

  let sent = 0;
  for (const row of rows) {
    try {
      await send({ to: row.email, name: row.name, token: row.token, pickupDate: status.pickupDate });
      sent += 1;
    } catch (err) {
      console.error("[reminders] échec d'envoi:", err.message);
    }
  }
  return sent;
}

module.exports = { subscribe, unsubscribe, sendClosingReminders };
