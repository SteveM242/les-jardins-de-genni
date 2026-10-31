const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const distDir = path.join(__dirname, "dist");
const dataDir = path.join(__dirname, "data");
const ordersFile = path.join(dataDir, "orders.json");
const port = process.env.PORT || 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

let paniersCache = null;
async function getPaniers() {
  if (!paniersCache) {
    const mod = await import("./src/data/paniers.js");
    paniersCache = mod.paniers;
  }
  return paniersCache;
}

function readJsonBody(req, maxBytes = 20_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

async function sendOrderEmail(order) {
  if (!process.env.ORDER_SMTP_HOST || !process.env.ORDER_NOTIFY_EMAIL) {
    console.log("[orders] SMTP non configuré — commande enregistrée localement uniquement:", order.orderId);
    return;
  }

  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.ORDER_SMTP_HOST,
    port: Number(process.env.ORDER_SMTP_PORT || 587),
    secure: process.env.ORDER_SMTP_SECURE === "true",
    auth: process.env.ORDER_SMTP_USER
      ? { user: process.env.ORDER_SMTP_USER, pass: process.env.ORDER_SMTP_PASS }
      : undefined
  });

  const lines = order.items.map((item) => `- ${item.qty} x ${item.name} (${item.price} € / unité)`);
  const text = [
    `Nouvelle commande ${order.orderId}`,
    `Client : ${order.customer.name} — ${order.customer.phone}`,
    order.customer.email ? `Email : ${order.customer.email}` : null,
    `Mode : ${order.customer.fulfillment}`,
    order.customer.address ? `Adresse : ${order.customer.address}` : null,
    order.customer.notes ? `Remarques : ${order.customer.notes}` : null,
    "",
    "Articles :",
    ...lines,
    "",
    `Total : ${order.total} €`
  ]
    .filter(Boolean)
    .join("\n");

  await transporter.sendMail({
    from: process.env.ORDER_FROM_EMAIL || process.env.ORDER_NOTIFY_EMAIL,
    to: process.env.ORDER_NOTIFY_EMAIL,
    subject: `Nouvelle commande ${order.orderId} — Les Jardins de Genni`,
    text
  });

  if (order.customer.email) {
    await transporter.sendMail({
      from: process.env.ORDER_FROM_EMAIL || process.env.ORDER_NOTIFY_EMAIL,
      to: order.customer.email,
      subject: `Votre commande ${order.orderId} — Les Jardins de Genni`,
      text: `Merci ${order.customer.name} ! Votre commande a bien été reçue.\n\n${text}`
    });
  }
}

function appendOrder(order) {
  fs.mkdirSync(dataDir, { recursive: true });
  let orders = [];
  try {
    orders = JSON.parse(fs.readFileSync(ordersFile, "utf8"));
    if (!Array.isArray(orders)) orders = [];
  } catch {
    orders = [];
  }
  orders.push(order);
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
}

async function handleCreateOrder(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: "Requête invalide." });
    return;
  }

  // Honeypot anti-spam : un bot remplit ce champ, un humain ne le voit jamais.
  if (body.website) {
    sendJson(res, 200, { ok: true, orderId: "spam-ignored" });
    return;
  }

  const customer = body.customer || {};
  const name = String(customer.name || "").trim().slice(0, 120);
  const phone = String(customer.phone || "").trim().slice(0, 40);
  const email = String(customer.email || "").trim().slice(0, 160);
  const fulfillment = customer.fulfillment === "livraison" ? "livraison" : "retrait";
  const address = String(customer.address || "").trim().slice(0, 300);
  const notes = String(customer.notes || "").trim().slice(0, 500);

  if (!name || !phone) {
    sendJson(res, 400, { ok: false, error: "Nom et téléphone requis." });
    return;
  }

  const requestedItems = Array.isArray(body.items) ? body.items : [];
  if (requestedItems.length === 0) {
    sendJson(res, 400, { ok: false, error: "Le panier est vide." });
    return;
  }

  const paniers = await getPaniers();
  const items = [];
  for (const requested of requestedItems) {
    const panier = paniers.find((p) => p.slug === requested.slug);
    if (!panier) continue;
    const qty = Math.min(Math.max(Number(requested.qty) || 0, 1), 20);
    items.push({ slug: panier.slug, name: panier.name, price: panier.price, qty });
  }

  if (items.length === 0) {
    sendJson(res, 400, { ok: false, error: "Aucun article reconnu dans le panier." });
    return;
  }

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const order = {
    orderId: crypto.randomUUID().slice(0, 8).toUpperCase(),
    createdAt: new Date().toISOString(),
    customer: { name, phone, email, fulfillment, address, notes },
    items,
    total
  };

  appendOrder(order);

  try {
    await sendOrderEmail(order);
  } catch (err) {
    console.error("[orders] échec envoi email:", err.message);
  }

  sendJson(res, 200, {
    ok: true,
    orderId: order.orderId,
    total: order.total,
    customer: { name: order.customer.name }
  });
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    filePath = path.join(distDir, "index.html");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(distDir, "index.html"), (fallbackErr, fallbackData) => {
        if (fallbackErr) {
          res.writeHead(500);
          res.end("Internal server error");
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(fallbackData);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/orders") {
    handleCreateOrder(req, res).catch((err) => {
      console.error("[orders] erreur inattendue:", err);
      sendJson(res, 500, { ok: false, error: "Erreur serveur." });
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Les Jardins de Genni — server listening on port ${port}`);
});
