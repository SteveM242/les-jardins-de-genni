// Balises <head> (titre, description, Open Graph) injectées côté serveur dans index.html :
// les robots de prévisualisation (WhatsApp, Facebook, Google…) n'exécutent pas le JavaScript de la SPA.
const pages = require("../src/data/pages.json");

const SITE_NAME = "L'Héritage des Mornes";
const DEFAULT_IMAGE = "/images/hero-jardin.webp";
const PRIVATE_PREFIXES = ["/admin", "/compte", "/commande"];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function absolute(baseUrl, url) {
  return /^https?:\/\//.test(url) ? url : `${baseUrl}${url}`;
}

// Métadonnées d'une URL ; `basket` (ligne publique du panier) pour /panier/:slug.
function metaFor(pathname, basket) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const page = pages[normalized];
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));

  if (basket) {
    return {
      title: basket.name,
      description: basket.summary || `${basket.name} — ${basket.price} €`,
      image: basket.image || DEFAULT_IMAGE,
      noindex: false
    };
  }
  return {
    title: page?.title || (isPrivate ? "Espace privé" : "Page introuvable"),
    description: page?.description || pages["/"].description,
    image: DEFAULT_IMAGE,
    noindex: Boolean(page?.noindex) || isPrivate || !page
  };
}

function renderMetaTags(meta, { baseUrl, pathname }) {
  const title = `${meta.title} — ${SITE_NAME}`;
  const url = `${baseUrl}${pathname}`;
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    meta.noindex ? `<meta name="robots" content="noindex, nofollow" />` : `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(absolute(baseUrl, meta.image))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`
  ].join("\n    ");
}

// Remplace le titre/description par défaut et le marqueur <!--app-meta--> de index.html.
function renderHtml(template, meta, context) {
  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/, "")
    .replace("<!--app-meta-->", renderMetaTags(meta, context));
}

function robotsTxt(baseUrl) {
  return ["User-agent: *", "Disallow: /admin", "Disallow: /api/", "Disallow: /compte", "Disallow: /commande", "", `Sitemap: ${baseUrl}/sitemap.xml`, ""].join("\n");
}

function sitemapXml(baseUrl, basketSlugs) {
  const paths = [
    ...Object.entries(pages)
      .filter(([, page]) => !page.noindex)
      .map(([path]) => path),
    ...basketSlugs.map((slug) => `/panier/${encodeURIComponent(slug)}`)
  ];
  const urls = paths.map((path) => `  <url><loc>${escapeHtml(baseUrl + path)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

module.exports = { metaFor, renderHtml, renderMetaTags, robotsTxt, sitemapXml, escapeHtml };
