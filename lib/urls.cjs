// URL publique du site : SITE_URL (ex: https://heritagedesmornes.fr) sinon déduite de la requête.
function baseUrlFor(req) {
  return (process.env.SITE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
}

module.exports = { baseUrlFor };
