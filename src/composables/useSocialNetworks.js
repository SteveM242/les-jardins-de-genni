import { computed, onMounted } from "vue";
import { site, whatsappGeneralLink } from "../data/site.js";
import { useSiteContent } from "../stores/siteContent.js";

const NETWORKS = [
  { key: "instagram", label: "Instagram", color: "#e1306c", description: "Photos du jardin et des récoltes de la semaine." },
  { key: "tiktok", label: "TikTok", color: "#111111", description: "Le quotidien au jardin en vidéos courtes." },
  { key: "snapchat", label: "Snapchat", color: "#fffc00", description: "Les coulisses, en direct et sans filtre." },
  { key: "facebook", label: "Facebook", color: "#1877f2", description: "Actualités, événements et paniers de la semaine." },
  { key: "youtube", label: "YouTube", color: "#ff0000", description: "Reportages et vidéos du jardin." }
];

// Réseaux que Genni a renseignés dans l'espace pro, plus WhatsApp dès que son numéro est configuré.
// Un réseau sans lien n'apparaît jamais : pas de bouton qui ne mène nulle part.
export function useSocialNetworks() {
  const content = useSiteContent();
  onMounted(() => content.load());

  const links = computed(() => {
    const configured = NETWORKS.filter((network) => content.state.socials[network.key]).map((network) => ({
      ...network,
      url: content.state.socials[network.key]
    }));
    if (site.whatsappNumber) {
      configured.push({
        key: "whatsapp",
        label: "WhatsApp",
        color: "#25d366",
        description: "Commander et poser vos questions, directement.",
        url: whatsappGeneralLink()
      });
    }
    return configured;
  });

  return { links, loaded: computed(() => content.state.loaded) };
}
