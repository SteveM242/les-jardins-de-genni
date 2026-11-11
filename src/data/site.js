import { reactive } from "vue";

// Informations du site. Les coordonnées (WhatsApp, email, commune, horaires) sont saisies par L'Héritage des Mornes dans
// l'espace pro (« Contenu du site ») et injectées ici au chargement (voir stores/siteContent.js) :
// tant qu'elles ne sont pas renseignées, aucun faux numéro ni faux email n'est affiché.
export const site = reactive({
  brandName: "L'Héritage des Mornes",
  tagline: "Fruits et légumes péyi, cueillis avec soin.",
  intro:
    "L'Héritage des Mornes cultive ses fruits et légumes en Martinique, sans précipitation, au rythme des saisons. Chaque panier est préparé à la main, avec ce qui est bon à cueillir cette semaine-là.",

  // Renseignés depuis les réglages (vides = non configurés)
  whatsappNumber: "",
  email: "",
  location: "Martinique",
  hours: "",

  // Rythme hebdomadaire : une seule session de vente par semaine, retrait le mercredi.
  weeklyCycle: [
    {
      icon: "🛒",
      day: "Samedi",
      title: "La vente ouvre",
      text: "Découvrez les produits de la semaine et passez commande en ligne ou sur WhatsApp. Vous avez jusqu'à lundi soir pour choisir."
    },
    {
      icon: "⏰",
      day: "Lundi soir",
      title: "La vente ferme",
      text: "Dernier moment pour commander. Ensuite, les commandes sont préparées ; si vous avez raté la session, rendez-vous le samedi suivant."
    },
    {
      icon: "🧺",
      day: "Mercredi",
      title: "Retrait des commandes",
      text: "Venez récupérer votre commande préparée pour vous. L'Héritage des Mornes vous confirme l'heure et le lieu."
    }
  ],

  // Les étapes s'adaptent : pas de mention de WhatsApp tant que le numéro n'est pas configuré.
  get howItWorks() {
    return [
      {
        title: "1. Choisissez votre panier (du samedi au lundi soir)",
        text: "La vente de la semaine ouvre le samedi et ferme le lundi soir. Parcourez les paniers et leur contenu détaillé, ou composez le vôtre."
      },
      {
        title: this.whatsappNumber ? "2. Commandez en ligne ou sur WhatsApp" : "2. Commandez en ligne",
        text: this.whatsappNumber
          ? "Remplissez le formulaire de commande, ou envoyez un message pré-rempli sur WhatsApp si vous préférez."
          : "Remplissez le formulaire de commande : vous relisez tout avant de confirmer."
      },
      {
        title: "3. Récupérez votre commande le mercredi",
        text: "Les commandes sont préparées après la clôture et à récupérer le mercredi. L'Héritage des Mornes vous confirme l'heure et le lieu."
      }
    ];
  }
});

function whatsappLink(message) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function whatsappOrderLink(panierName) {
  return whatsappLink(`Bonjour L'Héritage des Mornes, je souhaite commander le ${panierName}. Est-il disponible cette semaine ?`);
}

export function whatsappGeneralLink() {
  return whatsappLink("Bonjour L'Héritage des Mornes, j'ai une question sur vos paniers.");
}

export function whatsappOrderConfirmLink(orderNumber, customerName) {
  return whatsappLink(`Bonjour L'Héritage des Mornes, c'est ${customerName || "un·e client·e"}. Je viens de passer la commande ${orderNumber} sur le site.`);
}

// Lien WhatsApp vers un·e client·e à partir du téléphone saisi à la commande.
// Un numéro local (0696…, 0596…) est converti avec l'indicatif de la Martinique (596).
export function customerWhatsappLink(phone, message) {
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) digits = `596${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function whatsappCartLink(items) {
  const lines = items.map((item) => `- ${item.qty} x ${item.name}`);
  return whatsappLink(`Bonjour L'Héritage des Mornes, je souhaite commander :\n${lines.join("\n")}\n\nEst-ce disponible cette semaine ?`);
}
