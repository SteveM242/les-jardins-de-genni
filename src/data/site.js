// Coordonnées et textes à remplacer par les vraies informations de Genni
// avant mise en ligne — tout ce qui suit est un contenu de démonstration.

export const site = {
  brandName: "Les Jardins de Genni",
  tagline: "Fruits et légumes péyi, cueillis avec soin.",
  intro:
    "Genni cultive ses fruits et légumes en Martinique, sans précipitation, au rythme des saisons. Chaque panier est préparé à la main, avec ce qui est bon à cueillir cette semaine-là.",

  // ⚠️ Numéro de démonstration — à remplacer par le vrai numéro WhatsApp de Genni.
  whatsappNumber: "596696000000",

  // ⚠️ Adresse/commune de démonstration — à confirmer avec Genni.
  location: "Martinique",

  email: "contact@lesjardinsdegenni.example",

  socials: {
    instagram: "",
    facebook: ""
  },

  howItWorks: [
    {
      title: "1. Choisissez votre panier",
      text: "Parcourez les paniers disponibles cette semaine et leur contenu détaillé."
    },
    {
      title: "2. Commandez en ligne ou sur WhatsApp",
      text: "Remplissez le formulaire de commande, ou envoyez un message pré-rempli sur WhatsApp si vous préférez."
    },
    {
      title: "3. Récupérez ou faites-vous livrer",
      text: "Genni vous confirme le jour et le lieu de retrait ou de livraison."
    }
  ]
};

export function whatsappOrderLink(panierName) {
  const message = `Bonjour Genni, je souhaite commander le ${panierName}. Est-il disponible cette semaine ?`;
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function whatsappGeneralLink() {
  const message = "Bonjour Genni, j'ai une question sur vos paniers.";
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function whatsappOrderConfirmLink(orderNumber, customerName) {
  const message = `Bonjour Genni, c'est ${customerName || "un·e client·e"}. Je viens de passer la commande ${orderNumber} sur le site.`;
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
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
  const message = `Bonjour Genni, je souhaite commander :\n${lines.join("\n")}\n\nEst-ce disponible cette semaine ?`;
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
