const { formatDay } = require("./dates.cjs");
const { formatOrderCode } = require("./orderCode.cjs");

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
  // Chaque panier est suivi de son contenu exact au moment de la commande.
  const lines = order.items.flatMap((item) => [
    `- ${item.qty} x ${item.name} (${item.price} € / unité)`,
    ...(item.contents || []).map((entry) => `    • ${entry.qty ? `${entry.qty} x ` : ""}${entry.name}${entry.unit ? ` (${entry.unit})` : ""}`)
  ]);
  return [
    `Nouvelle commande — code de retrait ${formatOrderCode(order.orderNumber)}`,
    `Client : ${order.name} — ${order.phone}`,
    order.email ? `Email : ${order.email}` : null,
    `Mode : ${order.fulfillment}`,
    order.desiredDate ? `Jour souhaité : ${formatDay(order.desiredDate)}` : null,
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
    subject: `Nouvelle commande ${formatOrderCode(order.orderNumber)} — L'Héritage des Mornes`,
    text
  });

  if (order.email) {
    await getTransporter().sendMail({
      from: sender(),
      to: order.email,
      subject: `Votre commande ${formatOrderCode(order.orderNumber)} — L'Héritage des Mornes`,
      text: `Merci ${order.name} ! Votre commande a bien été reçue.\n\nVotre code de retrait : ${formatOrderCode(order.orderNumber)}\nGardez-le : donnez-le (ou montrez-le) au moment de récupérer votre commande, le mercredi.\n\n${text}`
    });
  }
}

const STATUS_MESSAGES = {
  confirmee: {
    subject: "est confirmée",
    body: "Bonne nouvelle : L'Héritage des Mornes a confirmé votre commande et prépare vos produits."
  },
  prete: {
    subject: "est prête",
    body: "Votre commande est prête. L'Héritage des Mornes vous contacte pour convenir du retrait ou de la livraison."
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
    subject: `Votre commande ${formatOrderCode(order.order_number)} ${message.subject} — L'Héritage des Mornes`,
    text: `Bonjour ${order.name},\n\n${message.body}\n\nCode de retrait ${formatOrderCode(order.order_number)} — total ${order.total} €.\n\nL'Héritage des Mornes`
  });
}

async function sendVerificationEmail({ to, name, url }) {
  if (!isConfigured()) {
    console.warn("[auth] SMTP non configuré — impossible d'envoyer l'email de vérification à", to);
    return;
  }
  await getTransporter().sendMail({
    from: sender(),
    to,
    subject: "Confirmez votre email — L'Héritage des Mornes",
    text: `Bonjour ${name},\n\nPour confirmer votre adresse email et retrouver vos commandes passées avec elle, cliquez sur ce lien (valable 48 heures) :\n\n${url}\n\nSi vous n'avez pas créé de compte, ignorez simplement ce message.\n\nL'Héritage des Mornes`
  });
}

async function sendPasswordResetEmail({ to, name, url }) {
  if (!isConfigured()) {
    console.warn("[auth] SMTP non configuré — impossible d'envoyer l'email de réinitialisation à", to);
    return;
  }
  await getTransporter().sendMail({
    from: sender(),
    to,
    subject: "Réinitialisation de votre mot de passe — L'Héritage des Mornes",
    text: `Bonjour ${name},\n\nVous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure :\n\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : votre mot de passe reste inchangé.\n\nL'Héritage des Mornes`
  });
}

module.exports = {
  isConfigured,
  sendOrderEmail,
  sendStatusEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  orderSummary,
  STATUS_MESSAGES
};
