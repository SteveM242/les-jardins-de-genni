import { reactive } from "vue";
import { api } from "../api.js";
import { site } from "../data/site.js";

// Contenu éditorial géré par L'Héritage des Mornes : réseaux sociaux, galerie, annonce, coordonnées, présentation,
// infos de retrait/livraison et mentions légales.
const state = reactive({
  socials: {},
  gallery: [],
  announcement: null, // { text } ou null
  contact: { whatsapp: "", email: "", location: "", hours: "" },
  about: { text: "" },
  checkout: { pickupInfo: "", deliveryInfo: "" },
  legal: { companyName: "", legalForm: "", siret: "", address: "", publisher: "", phone: "", mediator: "" },
  // Session de vente : { mode, open, pickupDate, opensInDays, closedMessage } (null tant qu'inconnue : on n'affiche rien de faux).
  sales: null,
  payments: { online: false },
  loaded: false,
  loading: false
});

// Les coordonnées alimentent l'objet `site` utilisé par tout le front (liens WhatsApp, pied de page…).
function applyContact(contact) {
  site.whatsappNumber = contact.whatsapp || "";
  site.email = contact.email || "";
  site.location = contact.location || "Martinique";
  site.hours = contact.hours || "";
}

async function load({ force = false } = {}) {
  if ((state.loaded && !force) || state.loading) return;
  state.loading = true;
  const res = await api("/api/site");
  if (res.ok) {
    const data = res.data;
    state.socials = data.socials || {};
    state.gallery = data.gallery || [];
    state.announcement = data.announcement || null;
    Object.assign(state.contact, data.contact || {});
    Object.assign(state.about, data.about || {});
    Object.assign(state.checkout, data.checkout || {});
    Object.assign(state.legal, data.legal || {});
    state.sales = data.salesStatus || null;
    state.payments = data.payments || { online: false };
    applyContact(state.contact);
    state.loaded = true;
  }
  // En cas d'échec le site reste utilisable : pas de réseaux ni de WhatsApp, galerie par défaut.
  state.loading = false;
}

// Le serveur renvoie le statut de la vente avec la relecture du panier et le refus d'une commande hors session.
function setSales(sales) {
  if (sales) state.sales = sales;
}

export function useSiteContent() {
  return { state, load, setSales };
}
