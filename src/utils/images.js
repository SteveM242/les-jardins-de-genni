// Les photos fournies avec le site existent en deux tailles (« -480 » pour les mobiles) :
// le navigateur choisit la plus légère qui suffit. Les photos envoyées depuis l'espace pro n'ont qu'une taille.
export function srcsetFor(url) {
  const match = /^(\/images\/(?:panier|about)-[a-z-]+?)\.webp$/.exec(url || "");
  if (!match || /-480$/.test(match[1])) return undefined;
  return `${match[1]}-480.webp 480w, ${url} 900w`;
}
