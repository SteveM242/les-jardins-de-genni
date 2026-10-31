import pages from "./data/pages.json";

const SITE_NAME = "Les Jardins de Genni";

export function setPageTitle(title) {
  document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
}

// Titre d'une URL de la SPA ; les paniers (/panier/:slug) le fixent eux-mêmes une fois chargés.
export function titleForPath(path) {
  if (path.startsWith("/admin")) return "Espace pro";
  return pages[path]?.title || "Page introuvable";
}
