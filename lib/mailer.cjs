let transporter = null;

function isConfigured() {
  return Boolean(process.env.ORDER_SMTP_HOST && process.env.ORDER_NOTIFY_EMAIL);
}

function getTransporter() {
  if (!transporter) {
    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport({
      host: process.env.ORDER_SMTP_HOST,
      port: Number(process.env.ORDER_SMTP_PORT || 587),
      secure: process.env.ORDER_SMTP_SECURE === "true",
      auth: process.env.ORDER_SMTP_USER
        ? { user: process.env.ORDER_SMTP_USER, pass: process.env.ORDER_SMTP_PASS }
        : undefined
    });
  }
  return transporter;
}

function sender() {
  return process.env.ORDER_FROM_EMAIL || process.env.ORDER_NOTIFY_EMAIL;
}

function orderSummary(order) {
  const lines = order.items.map((item) => `- ${item.qty} x ${item.name} (${item.price} € / unité)`);
  return [
    `Nouvelle commande ${order.orderNumber}`,
    `Client : ${order.name} — ${order.phone}`,
    order.email ? `Email : ${order.email}` : null,
    `Mode : ${order.fulfillment}`,
    order.address ? `Adresse : ${order.address}` : null,
    order.notes ? `Remarques : ${order.notes}` : null,
    "",
    "Articles :",
    ...lines,
    "",
    `Sous-total : ${order.subtotal} €`,
    order.discountAmount ? `Réduction : -${order.discountAmount} €` : null,
    `Total : ${order.total} €`
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendOrderEmail(order) {
  if (!isConfigured()) {
    console.log("[orders] SMTP non configuré — commande enregistrée en base uniquement:", order.orderNumber);
    return;
  }
  const text = orderSummary(order);

  await getTransporter().sendMail({
    from: sender(),
    to: process.env.ORDER_NOTIFY_EMAIL,
    subject: `Nouvelle commande ${order.orderNumber} — Les Jardins de Genni`,
    text
  });

  if (order.email) {
    await getTransporter().sendMail({
      from: sender(),
      to: order.email,
      subject: `Votre commande ${order.orderNumber} — Les Jardins de Genni`,
      text: `Merci ${order.name} ! Votre commande a bien été reçue.\n\n${text}`
    });
  }
}

const STATUS_MESSAGES = {
  confirmee: {
    subject: "est confirmée",
    body: "Bonne nouvelle : Genni a confirmé votre commande et prépare vos produits."
  },
  prete: {
    subject: "est prête",
    body: "Votre commande est prête. Genni vous contacte pour convenir du retrait ou de la livraison."
  },
  livree: {
    subject: "est terminée",
    body: "Votre commande a été remise. Merci pour votre confiance et à bientôt !"
  },
  annulee: {
    subject: "a été annulée",
    body: "Votre commande a été annulée. N'hésitez pas à nous contacter si vous avez une question."
  }
};

// Prévient le client quand le statut de sa commande change (aucun mail pour "nouvelle").
async function sendStatusEmail(order) {
  const message = STATUS_MESSAGES[order.status];
  if (!isConfigured() || !order.email || !message) return;
  await getTransporter().sendMail({
    from: sender(),
    to: order.email,
    subject: `Votre commande ${order.order_number} ${message.subject} — Les Jardins de Genni`,
    text: `Bonjour ${order.name},\n\n${message.body}\n\nCommande ${order.order_number} — total ${order.total} €.\n\nLes Jardins de Genni`
  });
}

module.exports = { sendOrderEmail, sendStatusEmail, orderSummary, STATUS_MESSAGES };
