// Rappel de retrait : la veille du mercredi (mardi à partir de midi, heure de la Martinique), un email aux clients
// qui ont une commande à retirer le lendemain. Une seule fois par commande (orders.pickup_reminded_at).
const { pickupDate, isPickupReminderTime } = require("./salesWindow.cjs");

// db : { query }, send : ({ to, name, orderNumber, total, fulfillment, pickupDate }) => Promise
async function sendPickupReminders(db, { send, now = new Date() }) {
  if (!isPickupReminderTime(now)) return 0;
  const day = pickupDate(now);

  // Réservation atomique : une autre instance ne peut pas reprendre les mêmes commandes.
  const claimed = await db.query(
    `UPDATE orders SET pickup_reminded_at = now()
     WHERE id IN (
       SELECT id FROM orders
       WHERE desired_date = $1 AND status IN ('nouvelle', 'confirmee', 'prete')
         AND COALESCE(email, '') <> '' AND pickup_reminded_at IS NULL
       FOR UPDATE SKIP LOCKED
     )
     RETURNING order_number, name, email, total, fulfillment`,
    [day]
  );

  let sent = 0;
  for (const order of claimed.rows || []) {
    try {
      await send({
        to: order.email,
        name: order.name,
        orderNumber: order.order_number,
        total: order.total,
        fulfillment: order.fulfillment,
        pickupDate: day
      });
      sent += 1;
    } catch (err) {
      console.error("[pickup-reminders] échec d'envoi:", err.message);
    }
  }
  return sent;
}

module.exports = { sendPickupReminders };
