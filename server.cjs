const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const { query } = require("./db.cjs");
const { migrate } = require("./migrate.cjs");
const { signToken, verifyToken, setAuthCookie, clearAuthCookie, requireRole } = require("./auth.cjs");

const app = express();
const distDir = path.join(__dirname, "dist");
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
const port = process.env.PORT || 4173;

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${ALLOWED_IMAGE_TYPES[file.mimetype] || ""}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, Boolean(ALLOWED_IMAGE_TYPES[file.mimetype]));
  }
});

function deleteUploadedFile(imagePath) {
  if (!imagePath || !imagePath.startsWith("/uploads/")) return;
  const filePath = path.join(uploadsDir, path.basename(imagePath));
  fs.unlink(filePath, () => {});
}

function attachCustomer(req, _res, next) {
  const token = req.cookies?.customer_token;
  const payload = token ? verifyToken(token) : null;
  req.customer = payload && payload.role === "customer" ? payload : null;
  next();
}

function publicCustomer(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, address: row.address };
}

function publicBasket(row) {
  return {
    type: "basket",
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    image: row.image,
    price: Number(row.price),
    summary: row.summary,
    details: row.details,
    origin: row.origin,
    itemCount: row.item_count,
    items: row.items
  };
}

function publicProduct(row) {
  return {
    type: "product",
    slug: row.slug,
    name: row.name,
    unit: row.unit,
    price: Number(row.price),
    category: row.category,
    image: row.image
  };
}

// ---------- Catalogue (public) ----------

app.get("/api/baskets", async (_req, res) => {
  const { rows } = await query("SELECT * FROM baskets WHERE active = true ORDER BY price DESC");
  res.json({ ok: true, baskets: rows.map(publicBasket) });
});

app.get("/api/products", async (_req, res) => {
  const { rows } = await query("SELECT * FROM products WHERE active = true ORDER BY category, name");
  res.json({ ok: true, products: rows.map(publicProduct) });
});

// ---------- Codes promo ----------

async function resolveDiscount(code, subtotal) {
  if (!code) return { discount: null, amount: 0 };
  const { rows } = await query(
    "SELECT * FROM discount_codes WHERE code = $1 AND active = true",
    [code.trim().toUpperCase()]
  );
  const discount = rows[0];
  if (!discount) throw new Error("Code promo invalide.");
  if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
    throw new Error("Ce code promo a expiré.");
  }
  if (discount.max_uses != null && discount.used_count >= discount.max_uses) {
    throw new Error("Ce code promo a atteint sa limite d'utilisation.");
  }
  const amount =
    discount.type === "percent"
      ? Math.round(subtotal * (Number(discount.value) / 100) * 100) / 100
      : Math.min(Number(discount.value), subtotal);
  return { discount, amount };
}

app.post("/api/discounts/validate", async (req, res) => {
  try {
    const subtotal = Number(req.body.subtotal) || 0;
    const { discount, amount } = await resolveDiscount(req.body.code, subtotal);
    if (!discount) return res.json({ ok: true, amount: 0 });
    res.json({
      ok: true,
      amount,
      code: discount.code,
      type: discount.type,
      value: Number(discount.value)
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ---------- Commandes ----------

app.post("/api/orders", attachCustomer, async (req, res) => {
  try {
    if (req.body.website) {
      return res.json({ ok: true, orderId: "spam-ignored" });
    }

    const customerInfo = req.body.customer || {};
    const name = String(customerInfo.name || "").trim().slice(0, 120);
    const phone = String(customerInfo.phone || "").trim().slice(0, 40);
    const email = String(customerInfo.email || "").trim().slice(0, 160);
    const fulfillment = customerInfo.fulfillment === "livraison" ? "livraison" : "retrait";
    const address = String(customerInfo.address || "").trim().slice(0, 300);
    const notes = String(customerInfo.notes || "").trim().slice(0, 500);

    if (!name || !phone) {
      return res.status(400).json({ ok: false, error: "Nom et téléphone requis." });
    }

    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (requestedItems.length === 0) {
      return res.status(400).json({ ok: false, error: "Le panier est vide." });
    }

    const items = [];
    for (const requested of requestedItems) {
      const qty = Math.min(Math.max(Number(requested.qty) || 0, 1), 50);
      if (requested.type === "product") {
        const { rows } = await query("SELECT * FROM products WHERE slug = $1 AND active = true", [requested.slug]);
        if (rows[0]) items.push({ type: "product", slug: rows[0].slug, name: rows[0].name, price: Number(rows[0].price), qty });
      } else {
        const { rows } = await query("SELECT * FROM baskets WHERE slug = $1 AND active = true", [requested.slug]);
        if (rows[0]) items.push({ type: "basket", slug: rows[0].slug, name: rows[0].name, price: Number(rows[0].price), qty });
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ ok: false, error: "Aucun article reconnu dans le panier." });
    }

    const subtotal = Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100;

    let discountCode = null;
    let discountAmount = 0;
    if (req.body.discountCode) {
      const { discount, amount } = await resolveDiscount(req.body.discountCode, subtotal);
      if (discount) {
        discountCode = discount.code;
        discountAmount = amount;
        await query("UPDATE discount_codes SET used_count = used_count + 1 WHERE id = $1", [discount.id]);
      }
    }

    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    const orderNumber = crypto.randomUUID().slice(0, 8).toUpperCase();

    const { rows: inserted } = await query(
      `INSERT INTO orders
        (order_number, customer_id, name, phone, email, fulfillment, address, notes, items, discount_code, subtotal, discount_amount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, created_at`,
      [
        orderNumber, req.customer?.sub || null, name, phone, email, fulfillment, address, notes,
        JSON.stringify(items), discountCode, subtotal, discountAmount, total
      ]
    );

    await sendOrderEmail({
      orderNumber, name, phone, email, fulfillment, address, notes, items, subtotal, discountAmount, total
    }).catch((err) => console.error("[orders] échec envoi email:", err.message));

    res.json({ ok: true, orderId: orderNumber, subtotal, discountAmount, total, customer: { name } });
  } catch (err) {
    console.error("[orders] erreur:", err);
    res.status(500).json({ ok: false, error: "Erreur serveur." });
  }
});

async function sendOrderEmail(order) {
  if (!process.env.ORDER_SMTP_HOST || !process.env.ORDER_NOTIFY_EMAIL) {
    console.log("[orders] SMTP non configuré — commande enregistrée en base uniquement:", order.orderNumber);
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

  await transporter.sendMail({
    from: process.env.ORDER_FROM_EMAIL || process.env.ORDER_NOTIFY_EMAIL,
    to: process.env.ORDER_NOTIFY_EMAIL,
    subject: `Nouvelle commande ${order.orderNumber} — Les Jardins de Genni`,
    text
  });

  if (order.email) {
    await transporter.sendMail({
      from: process.env.ORDER_FROM_EMAIL || process.env.ORDER_NOTIFY_EMAIL,
      to: order.email,
      subject: `Votre commande ${order.orderNumber} — Les Jardins de Genni`,
      text: `Merci ${order.name} ! Votre commande a bien été reçue.\n\n${text}`
    });
  }
}

// ---------- Compte client ----------

app.post("/api/auth/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 120);
    const email = String(req.body.email || "").trim().toLowerCase().slice(0, 160);
    const phone = String(req.body.phone || "").trim().slice(0, 40);
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ ok: false, error: "Nom, email et mot de passe (6 caractères min.) requis." });
    }

    const { rows: existing } = await query("SELECT id FROM customers WHERE email = $1", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ ok: false, error: "Un compte existe déjà avec cet email." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      "INSERT INTO customers (name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, name, email, phone, address",
      [name, email, phone, passwordHash]
    );

    const token = signToken({ sub: rows[0].id, role: "customer" });
    setAuthCookie(res, "customer_token", token);
    res.json({ ok: true, customer: publicCustomer(rows[0]) });
  } catch (err) {
    console.error("[auth] signup error:", err);
    res.status(500).json({ ok: false, error: "Erreur serveur." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const { rows } = await query("SELECT * FROM customers WHERE email = $1", [email]);
    const customer = rows[0];
    if (!customer || !(await bcrypt.compare(password, customer.password_hash))) {
      const { rows: adminRows } = await query("SELECT id FROM admins WHERE email = $1", [email]);
      if (adminRows[0]) {
        return res.status(401).json({
          ok: false,
          error: "Cet email correspond à un compte Genni (espace pro), pas à un compte client. Utilisez le lien \"Espace Genni\" ci-dessus."
        });
      }
      return res.status(401).json({ ok: false, error: "Email ou mot de passe incorrect." });
    }
    const token = signToken({ sub: customer.id, role: "customer" });
    setAuthCookie(res, "customer_token", token);
    res.json({ ok: true, customer: publicCustomer(customer) });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(500).json({ ok: false, error: "Erreur serveur." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res, "customer_token");
  res.json({ ok: true });
});

app.get("/api/auth/me", attachCustomer, async (req, res) => {
  if (!req.customer) return res.json({ ok: true, customer: null });
  const { rows } = await query("SELECT * FROM customers WHERE id = $1", [req.customer.sub]);
  res.json({ ok: true, customer: rows[0] ? publicCustomer(rows[0]) : null });
});

app.get("/api/account/orders", requireRole("customer"), async (req, res) => {
  const { rows } = await query(
    "SELECT order_number, items, subtotal, discount_amount, total, status, fulfillment, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
    [req.auth.sub]
  );
  res.json({ ok: true, orders: rows });
});

// ---------- Espace Genni (admin) ----------

app.post("/api/admin/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const { rows } = await query("SELECT * FROM admins WHERE email = $1", [email]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      const { rows: customerRows } = await query("SELECT id FROM customers WHERE email = $1", [email]);
      if (customerRows[0]) {
        return res.status(401).json({
          ok: false,
          error: "Cet email correspond à un compte client, pas à l'espace Genni. Utilisez la page de connexion client (/compte/connexion)."
        });
      }
      return res.status(401).json({ ok: false, error: "Email ou mot de passe incorrect." });
    }
    const token = signToken({ sub: admin.id, role: "admin" });
    setAuthCookie(res, "admin_token", token);
    res.json({ ok: true, admin: { email: admin.email } });
  } catch (err) {
    console.error("[admin] login error:", err);
    res.status(500).json({ ok: false, error: "Erreur serveur." });
  }
});

app.post("/api/admin/logout", (_req, res) => {
  clearAuthCookie(res, "admin_token");
  res.json({ ok: true });
});

app.get("/api/admin/me", (req, res) => {
  const token = req.cookies?.admin_token;
  const payload = token ? verifyToken(token) : null;
  res.json({ ok: true, admin: payload && payload.role === "admin" ? { id: payload.sub } : null });
});

app.get("/api/admin/orders", requireRole("admin"), async (_req, res) => {
  const { rows } = await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");
  res.json({ ok: true, orders: rows });
});

const ORDER_STATUSES = ["nouvelle", "confirmee", "prete", "livree", "annulee"];

app.patch("/api/admin/orders/:id", requireRole("admin"), async (req, res) => {
  const status = req.body.status;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: "Statut invalide." });
  }
  const { rows } = await query("UPDATE orders SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Commande introuvable." });
  res.json({ ok: true, order: rows[0] });
});

app.get("/api/admin/products", requireRole("admin"), async (_req, res) => {
  const { rows } = await query("SELECT * FROM products ORDER BY category, name");
  res.json({ ok: true, products: rows });
});

app.post("/api/admin/products", requireRole("admin"), async (req, res) => {
  const { slug, name, unit, price, category } = req.body;
  if (!slug || !name || !price) return res.status(400).json({ ok: false, error: "slug, name et price requis." });
  const { rows } = await query(
    "INSERT INTO products (slug, name, unit, price, category) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [slug, name, unit || "pièce", price, category || null]
  );
  res.json({ ok: true, product: rows[0] });
});

app.patch("/api/admin/products/:id", requireRole("admin"), async (req, res) => {
  const { name, unit, price, category, active } = req.body;
  const { rows } = await query(
    `UPDATE products SET
       name = COALESCE($1, name), unit = COALESCE($2, unit), price = COALESCE($3, price),
       category = COALESCE($4, category), active = COALESCE($5, active)
     WHERE id = $6 RETURNING *`,
    [name, unit, price, category, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Article introuvable." });
  res.json({ ok: true, product: rows[0] });
});

app.delete("/api/admin/products/:id", requireRole("admin"), async (req, res) => {
  const { rows } = await query("DELETE FROM products WHERE id = $1 RETURNING image", [req.params.id]);
  if (rows[0]) deleteUploadedFile(rows[0].image);
  res.json({ ok: true });
});

app.post(
  "/api/admin/products/:id/image",
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: "Image invalide (jpg, png ou webp, 5 Mo max)." });
    const { rows: existing } = await query("SELECT image FROM products WHERE id = $1", [req.params.id]);
    if (!existing[0]) {
      deleteUploadedFile(`/uploads/${req.file.filename}`);
      return res.status(404).json({ ok: false, error: "Article introuvable." });
    }
    const imagePath = `/uploads/${req.file.filename}`;
    const { rows } = await query("UPDATE products SET image = $1 WHERE id = $2 RETURNING *", [imagePath, req.params.id]);
    deleteUploadedFile(existing[0].image);
    res.json({ ok: true, product: rows[0] });
  }
);

app.get("/api/admin/baskets", requireRole("admin"), async (_req, res) => {
  const { rows } = await query("SELECT * FROM baskets ORDER BY price DESC");
  res.json({ ok: true, baskets: rows });
});

app.patch("/api/admin/baskets/:id", requireRole("admin"), async (req, res) => {
  const { name, price, summary, details, active } = req.body;
  const { rows } = await query(
    `UPDATE baskets SET
       name = COALESCE($1, name), price = COALESCE($2, price), summary = COALESCE($3, summary),
       details = COALESCE($4, details), active = COALESCE($5, active)
     WHERE id = $6 RETURNING *`,
    [name, price, summary, details, active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Panier introuvable." });
  res.json({ ok: true, basket: rows[0] });
});

app.post(
  "/api/admin/baskets/:id/image",
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: "Image invalide (jpg, png ou webp, 5 Mo max)." });
    const { rows: existing } = await query("SELECT image FROM baskets WHERE id = $1", [req.params.id]);
    if (!existing[0]) {
      deleteUploadedFile(`/uploads/${req.file.filename}`);
      return res.status(404).json({ ok: false, error: "Panier introuvable." });
    }
    const imagePath = `/uploads/${req.file.filename}`;
    const { rows } = await query("UPDATE baskets SET image = $1 WHERE id = $2 RETURNING *", [imagePath, req.params.id]);
    deleteUploadedFile(existing[0].image);
    res.json({ ok: true, basket: rows[0] });
  }
);

app.get("/api/admin/discounts", requireRole("admin"), async (_req, res) => {
  const { rows } = await query("SELECT * FROM discount_codes ORDER BY created_at DESC");
  res.json({ ok: true, discounts: rows });
});

app.post("/api/admin/discounts", requireRole("admin"), async (req, res) => {
  const { code, type, value, maxUses, expiresAt } = req.body;
  if (!code || !["percent", "fixed"].includes(type) || !value) {
    return res.status(400).json({ ok: false, error: "code, type (percent/fixed) et value requis." });
  }
  try {
    const { rows } = await query(
      "INSERT INTO discount_codes (code, type, value, max_uses, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [String(code).trim().toUpperCase(), type, value, maxUses || null, expiresAt || null]
    );
    res.json({ ok: true, discount: rows[0] });
  } catch (err) {
    res.status(409).json({ ok: false, error: "Ce code existe déjà." });
  }
});

app.patch("/api/admin/discounts/:id", requireRole("admin"), async (req, res) => {
  const { active } = req.body;
  const { rows } = await query(
    "UPDATE discount_codes SET active = COALESCE($1, active) WHERE id = $2 RETURNING *",
    [active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: "Code introuvable." });
  res.json({ ok: true, discount: rows[0] });
});

app.delete("/api/admin/discounts/:id", requireRole("admin"), async (req, res) => {
  await query("DELETE FROM discount_codes WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError || err?.message?.includes("image")) {
    res.status(400).json({ ok: false, error: "Image invalide ou trop lourde (5 Mo max)." });
    return;
  }
  next(err);
});

// ---------- Statique (SPA) ----------

app.use(express.static(distDir));

app.get(/.*/, (req, res) => {
  if (path.extname(req.path)) {
    res.status(404).send("Not found");
    return;
  }
  res.sendFile(path.join(distDir, "index.html"));
});

migrate()
  .then(() => {
    app.listen(port, () => {
      console.log(`Les Jardins de Genni — server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("[migrate] échec de la migration de la base:", err);
    process.exit(1);
  });
