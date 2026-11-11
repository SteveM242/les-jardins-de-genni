const { query } = require("../db.cjs");
const { verifySignature } = require("../lib/payments.cjs");

// Webhook Stripe : appelé par Stripe (pas par un navigateur), corps brut indispensable pour vérifier la signature.
// Monté dans app.cjs AVANT express.json().
async function paymentsWebhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!verifySignature(raw, req.get("stripe-signature"), secret)) {
    return res.status(400).json({ ok: false, error: "Signature invalide." });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ ok: false, error: "Corps invalide." });
  }

  const session = event?.data?.object;
  if ((event?.type === "checkout.session.completed" || event?.type === "checkout.session.async_payment_succeeded") && session?.payment_status === "paid") {
    const orderNumber = session.client_reference_id || session.metadata?.order_number;
    // Le montant payé doit correspondre au total de la commande : sinon on ne la marque pas payée.
    const { rows } = await query("SELECT id, total FROM orders WHERE order_number = $1 AND payment_method = 'en_ligne'", [orderNumber]);
    const order = rows?.[0];
    if (order && Math.round(Number(order.total) * 100) === Number(session.amount_total)) {
      await query("UPDATE orders SET paid = true, paid_at = COALESCE(paid_at, now()), payment_ref = $1, updated_at = now() WHERE id = $2", [
        session.id,
        order.id
      ]);
    } else {
      console.error("[payments] paiement reçu mais commande introuvable ou montant différent:", orderNumber);
    }
  }
  // Toujours 200 pour un événement valide : Stripe ne doit pas le renvoyer en boucle.
  res.json({ received: true });
}

module.exports = paymentsWebhook;
