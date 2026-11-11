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

// Adresse d'un profil à partir d'un simple pseudo : L'Héritage des Mornes peut écrire « @heritagedesmornes » ou « heritagedesmornes ».
const HANDLE_URLS = {
  instagram: (handle) => `https://www.instagram.com/${handle}`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  snapchat: (handle) => `https://www.snapchat.com/add/${handle}`,
  facebook: (handle) => `https://www.facebook.com/${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${handle}`
};

const MAX_GALLERY_IMAGES = 24;

class SocialLinkError extends Error {}

function hostMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

// Accepte une adresse complète, une adresse sans https:// (« instagram.com/heritagedesmornes »), ou un simple pseudo (« @heritagedesmornes »).
function toCandidateUrl(network, raw) {
  const lower = raw.toLowerCase();
  if (SOCIAL_DOMAINS[network].some((domain) => lower.includes(domain))) {
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  }
  if (/^@?[A-Za-z0-9._-]{1,60}$/.test(raw)) return HANDLE_URLS[network](raw.replace(/^@/, ""));
  return raw;
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
      url = new URL(toCandidateUrl(network, raw));
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
