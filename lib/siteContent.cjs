// Contenu éditorial du site (réseaux sociaux, galerie) : validation et mise en forme.

const SOCIAL_NETWORKS = ["instagram", "tiktok", "snapchat", "facebook", "youtube"];

const SOCIAL_LABELS = {
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  facebook: "Facebook",
  youtube: "YouTube"
};

// Domaines acceptés par réseau : évite d'enregistrer un lien sans rapport (ou piégé) sous une icône de confiance.
const SOCIAL_DOMAINS = {
  instagram: ["instagram.com", "instagr.am"],
  tiktok: ["tiktok.com"],
  snapchat: ["snapchat.com"],
  facebook: ["facebook.com", "fb.com", "fb.me"],
  youtube: ["youtube.com", "youtu.be"]
};

const MAX_GALLERY_IMAGES = 24;

class SocialLinkError extends Error {}

function hostMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

// input : { instagram: "https://…", tiktok: "", … } -> { instagram, tiktok, snapchat, facebook, youtube }
// Lève SocialLinkError (message affichable) au premier lien invalide.
function sanitizeSocials(input) {
  const source = input && typeof input === "object" ? input : {};
  const result = {};
  for (const network of SOCIAL_NETWORKS) {
    const raw = String(source[network] ?? "").trim();
    if (!raw) {
      result[network] = "";
      continue;
    }
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new SocialLinkError(`Le lien ${SOCIAL_LABELS[network]} n'est pas une adresse valide (ex: https://www.${SOCIAL_DOMAINS[network][0]}/…).`);
    }
    if (url.protocol !== "https:") {
      throw new SocialLinkError(`Le lien ${SOCIAL_LABELS[network]} doit commencer par https://.`);
    }
    if (!SOCIAL_DOMAINS[network].some((domain) => hostMatches(url.hostname.toLowerCase(), domain))) {
      throw new SocialLinkError(`Le lien ${SOCIAL_LABELS[network]} doit pointer vers ${SOCIAL_DOMAINS[network][0]}.`);
    }
    result[network] = url.toString().slice(0, 300);
  }
  return result;
}

function emptySocials() {
  return Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, ""]));
}

// Valeur stockée -> objet complet (réseaux manquants = chaîne vide).
function normalizeStoredSocials(stored) {
  return { ...emptySocials(), ...(stored && typeof stored === "object" ? stored : {}) };
}

function galleryImageUrl(row) {
  const version = row.image_updated_at ? new Date(row.image_updated_at).getTime() : 0;
  return `/api/gallery/${row.id}/image?v=${version}`;
}

module.exports = {
  SOCIAL_NETWORKS,
  SOCIAL_LABELS,
  MAX_GALLERY_IMAGES,
  SocialLinkError,
  sanitizeSocials,
  emptySocials,
  normalizeStoredSocials,
  galleryImageUrl
};
