// Sections de contenu éditables par L'Héritage des Mornes (hors réseaux sociaux et galerie, voir siteContent.cjs) :
// annonce, coordonnées, présentation, infos de retrait/livraison, mentions légales.
const { cleanText } = require("./text.cjs");
const { toInternationalPhone } = require("./phone.cjs");

class SettingsError extends Error {}

const SECTION_NAMES = ["announcement", "contact", "about", "checkout", "legal", "sales"];

const DEFAULTS = {
  announcement: { text: "", active: false },
  contact: { whatsapp: "", email: "", location: "", hours: "" },
  about: { text: "" },
  checkout: { pickupInfo: "", deliveryInfo: "" },
  sales: { mode: "auto", closedMessage: "" },
  legal: { companyName: "", legalForm: "", siret: "", address: "", publisher: "", phone: "", mediator: "" }
};

// Texte multi-lignes : on garde les retours à la ligne mais pas les espaces superflus ni les caractères de contrôle.
function cleanMultiline(value, max) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

// Valide et nettoie une section. Lève SettingsError (message affichable) si une valeur est invalide.
function sanitizeSection(name, input) {
  const source = input && typeof input === "object" ? input : {};

  switch (name) {
    case "announcement": {
      const text = cleanText(source.text, 200);
      return { text, active: Boolean(source.active) && text !== "" };
    }
    case "contact": {
      const whatsappRaw = String(source.whatsapp ?? "").trim();
      const whatsapp = whatsappRaw ? toInternationalPhone(whatsappRaw) : "";
      if (whatsappRaw && !whatsapp) {
        throw new SettingsError("Le numéro WhatsApp n'est pas valide (ex: 0696 12 34 56 ou +596 696 12 34 56).");
      }
      const email = cleanText(source.email, 160);
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        throw new SettingsError("L'adresse email n'est pas valide.");
      }
      return { whatsapp, email, location: cleanText(source.location, 120), hours: cleanText(source.hours, 200) };
    }
    case "sales": {
      const mode = ["auto", "open", "closed"].includes(source.mode) ? source.mode : "auto";
      return { mode, closedMessage: cleanText(source.closedMessage, 200) };
    }
    case "about":
      return { text: cleanMultiline(source.text, 4000) };
    case "checkout":
      return {
        pickupInfo: cleanMultiline(source.pickupInfo, 400),
        deliveryInfo: cleanMultiline(source.deliveryInfo, 400)
      };
    case "legal": {
      const siret = String(source.siret ?? "").replace(/\s/g, "");
      if (siret && !/^\d{14}$/.test(siret)) {
        throw new SettingsError("Le SIRET doit contenir 14 chiffres.");
      }
      return {
        companyName: cleanText(source.companyName, 120),
        legalForm: cleanText(source.legalForm, 60),
        siret,
        address: cleanText(source.address, 300),
        publisher: cleanText(source.publisher, 120),
        phone: cleanText(source.phone, 40),
        mediator: cleanMultiline(source.mediator, 300)
      };
    }
    default:
      throw new SettingsError("Section inconnue.");
  }
}

// Valeur stockée -> objet complet avec les champs manquants à leur valeur par défaut.
function withDefaults(name, stored) {
  return { ...DEFAULTS[name], ...(stored && typeof stored === "object" ? stored : {}) };
}

// rows : lignes { key, value } de site_settings -> { announcement, contact, about, checkout, legal }
function sectionsFromRows(rows) {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(SECTION_NAMES.map((name) => [name, withDefaults(name, byKey.get(name))]));
}

// Ce que voient les visiteurs : l'annonce n'est publiée que si elle est active.
function publicSections(sections) {
  return {
    announcement: sections.announcement.active ? { text: sections.announcement.text } : null,
    contact: sections.contact,
    about: sections.about,
    checkout: sections.checkout,
    sales: sections.sales,
    legal: sections.legal
  };
}

module.exports = { SettingsError, SECTION_NAMES, DEFAULTS, sanitizeSection, withDefaults, sectionsFromRows, publicSections };
