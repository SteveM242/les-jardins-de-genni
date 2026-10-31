const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const multer = require("multer");

const { query } = require("./db.cjs");
const { requireSameOrigin } = require("./auth.cjs");
const { BASKET_COLUMNS, publicBasket } = require("./lib/catalogRows.cjs");
const seo = require("./lib/seo.cjs");
const rateLimits = require("./lib/rateLimits.cjs");

const distDir = path.join(__dirname, "dist");
const isProduction = process.env.NODE_ENV === "production";

let indexTemplate = null;

function readIndexTemplate() {
  if (!indexTemplate) indexTemplate = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
  return indexTemplate;
}

// SITE_URL (ex: https://lesjardinsdegenni.fr) fixe les URLs absolues du sitemap et des aperçus de partage.
function baseUrlFor(req) {
  return (process.env.SITE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
}

function createApp() {
  const app = express();

  // Railway place un proxy devant le serveur : sans ça, toutes les requêtes auraient la même IP (limitation de débit faussée).
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Polices Google (src/style.css) et photos uploadées (data: / même origine).
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:"],
          "upgrade-insecure-requests": isProduction ? [] : null
        }
      }
    })
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use("/api", rateLimits.api, requireSameOrigin);
  app.use("/api", require("./routes/catalog.cjs"));
  app.use("/api", require("./routes/orders.cjs"));
  app.use("/api", require("./routes/customer.cjs"));
  app.use("/api/admin", require("./routes/admin/index.cjs"));

  app.use("/api", (_req, res) => {
    res.status(404).json({ ok: false, error: "Route introuvable." });
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(seo.robotsTxt(baseUrlFor(req)));
  });

  app.get("/sitemap.xml", async (req, res) => {
    const { rows } = await query("SELECT slug FROM baskets WHERE active = true ORDER BY price DESC");
    res.type("application/xml").send(seo.sitemapXml(baseUrlFor(req), rows.map((row) => row.slug)));
  });

  // Les fichiers générés par Vite (assets/…) portent un hash dans leur nom : cache longue durée.
  app.use(
    express.static(distDir, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      }
    })
  );

  app.get(/.*/, async (req, res) => {
    if (path.extname(req.path)) {
      res.status(404).send("Not found");
      return;
    }

    let template;
    try {
      template = readIndexTemplate();
    } catch {
      // dist/ absent (développement) : on laisse le fichier tel quel.
      return res.sendFile(path.join(distDir, "index.html"));
    }

    let basket = null;
    const basketMatch = /^\/panier\/([^/]+)\/?$/.exec(req.path);
    if (basketMatch) {
      const { rows } = await query(`SELECT ${BASKET_COLUMNS} FROM baskets WHERE slug = $1 AND active = true`, [
        decodeURIComponent(basketMatch[1])
      ]);
      if (rows[0]) basket = publicBasket(rows[0]);
    }

    const html = seo.renderHtml(template, seo.metaFor(req.path, basket), { baseUrl: baseUrlFor(req), pathname: req.path });
    res.set("Cache-Control", "no-cache").type("html").send(html);
  });

  app.use((err, req, res, _next) => {
    if (err instanceof multer.MulterError || err?.message?.includes("image")) {
      return res.status(400).json({ ok: false, error: "Image invalide ou trop lourde (3 Mo max)." });
    }
    if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
      return res.status(400).json({ ok: false, error: "Requête invalide." });
    }
    console.error(`[server] ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ ok: false, error: "Erreur serveur." });
  });

  return app;
}

module.exports = { createApp };
