// Contenu de démonstration — à remplacer par les vrais paniers, prix,
// photos et disponibilités de Genni avant mise en ligne.

export const paniers = [
  {
    slug: "panier-peyi-classique",
    name: "Panier Péyi Classique",
    icon: "🧺",
    price: 20,
    summary:
      "Le mélange du jardin : légumes et fruits de saison, pour une semaine de cuisine péyi.",
    itemCount: 10,
    items: [
      "Christophines",
      "Ignames",
      "Bananes jaunes",
      "Bananes vertes (à cuire)",
      "Mangues",
      "Citrons verts",
      "Giraumon (citrouille péyi)",
      "Gombos",
      "Fruits de la passion",
      "Herbes fraîches (thym, persil péyi)"
    ],
    details:
      "Le panier qui change selon la récolte de la semaine : un équilibre entre légumes à cuire et fruits à croquer, pensé pour les repas de tous les jours. Idéal pour découvrir ou redécouvrir les produits péyi.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier."
  },
  {
    slug: "panier-fruits-tropicaux",
    name: "Panier Fruits Tropicaux",
    icon: "🥭",
    price: 18,
    summary:
      "Un concentré de douceur : mangues, ananas, bananes et fruits de la passion.",
    itemCount: 6,
    items: [
      "Mangues",
      "Ananas",
      "Bananes jaunes",
      "Fruits de la passion",
      "Papaye",
      "Corossol (selon saison)"
    ],
    details:
      "Pour les amateurs de fruits bien mûrs et parfumés. La composition varie légèrement selon les arrivages — le corossol n'est disponible que quelques semaines par an.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier."
  },
  {
    slug: "panier-legumes-jardin",
    name: "Panier Légumes Jardin",
    icon: "🥬",
    price: 17,
    summary:
      "Que des légumes : de quoi cuisiner toute la semaine sans repasser par le marché.",
    itemCount: 8,
    items: [
      "Christophines",
      "Ignames",
      "Patates douces",
      "Giraumon",
      "Choux péyi",
      "Épinards péyi (brèdes)",
      "Concombres",
      "Piments doux"
    ],
    details:
      "Pensé pour les familles qui cuisinent beaucoup : un panier 100% légumes, sans fruits, pour varier les plats du quotidien.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier."
  },
  {
    slug: "panier-decouverte",
    name: "Panier Découverte",
    icon: "🌱",
    price: 12,
    summary: "Un petit format pour découvrir, seul·e ou en couple.",
    itemCount: 6,
    items: [
      "Christophines",
      "Bananes jaunes",
      "Mangues",
      "Citrons verts",
      "Fruits de la passion",
      "Herbes fraîches"
    ],
    details:
      "La même qualité que les grands paniers, en quantité réduite — idéal pour tester avant de passer à un format plus grand.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier."
  }
];

export function findPanierBySlug(slug) {
  return paniers.find((panier) => panier.slug === slug) || null;
}
