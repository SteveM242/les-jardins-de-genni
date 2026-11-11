// Paiement en ligne par carte (Stripe Checkout), facultatif : actif seulement si STRIPE_SECRET_KEY est défini.
// Sans clé, le site fonctionne comme avant (paiement au retrait). Aucun SDK : appels HTTP directs.
//   STRIPE_SECRET_KEY      clé secrète (sk_live_… / sk_test_…)
//   STRIPE_WEBHOOK_SECRET  secret de signature du webhook (whsec_…), obligatoire pour valider les paiements
const crypto = require("node:crypto");

// Remplaçable dans les tests.
const http = { fetch: (...args) => fetch(...args) };

function isEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

function form(entries) {
  const body = new URLSearchParams();
  for (const [key, value] of entries) body.append(key, String(value));
  return body;
}

// Crée une session de paiement pour toute la commande (un seul montant, réduction déjà appliquée).
async function createCheckoutSession({ orderNumber, total, email, name, baseUrl }) {
  const cents = Math.round(Number(total) * 100);
  if (!Number.isInteger(cents) || cents < 50) throw new Error("Montant invalide pour un paiement en ligne.");
  const code = encodeURIComponent(orderNumber);
  const entries = [
    ["mode", "payment"],
    ["payment_method_types[]", "card"],
    ["client_reference_id", orderNumber],
    ["metadata[order_number]", orderNumber],
    ["line_items[0][quantity]", 1],
    ["line_items[0][price_data][currency]", "eur"],
    ["line_items[0][price_data][unit_amount]", cents],
    ["line_items[0][price_data][product_data][name]", `Commande ${orderNumber} — L'Héritage des Mornes`],
    ["success_url", `${baseUrl}/commande?paiement=ok&code=${code}`],
    ["cancel_url", `${baseUrl}/commande?paiement=annule&code=${code}`]
  ];
  if (email) entries.push(["customer_email", email]);
  if (name) entries.push(["metadata[customer]", String(name).slice(0, 100)]);

  const res = await http.fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form(entries)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data?.error?.message || `Stripe a répondu ${res.status}.`);
  return { id: data.id, url: data.url };
}

// Vérifie la signature d'un webhook Stripe : en-tête « t=…,v1=… », HMAC-SHA256 de « t.corps », 5 minutes de tolérance.
function verifySignature(rawBody, header, secret, { now = Date.now(), toleranceSeconds = 300 } = {}) {
  if (!rawBody || !header || !secret) return false;
  const parts = Object.fromEntries(
    String(header)
      .split(",")
      .map((piece) => piece.split("=", 2))
      .filter(([k, v]) => k && v)
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const given = String(parts.v1 || "");
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

module.exports = { http, isEnabled, createCheckoutSession, verifySignature };
