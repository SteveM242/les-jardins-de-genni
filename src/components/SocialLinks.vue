<script setup>
import { computed, onMounted } from "vue";
import { useSiteContent } from "../stores/siteContent.js";

const props = defineProps({
  // "pills" : boutons colorés (accueil, contact) ; "footer" : liens sobres sur fond sombre
  variant: { type: String, default: "pills" }
});

const NETWORKS = [
  { key: "instagram", label: "Instagram", color: "#e1306c" },
  { key: "tiktok", label: "TikTok", color: "#111111" },
  { key: "snapchat", label: "Snapchat", color: "#fffc00" },
  { key: "facebook", label: "Facebook", color: "#1877f2" },
  { key: "youtube", label: "YouTube", color: "#ff0000" }
];

const content = useSiteContent();
onMounted(() => content.load());

// Seuls les réseaux dont Genni a renseigné le lien s'affichent.
const links = computed(() => NETWORKS.filter((network) => content.state.socials[network.key]).map((network) => ({ ...network, url: content.state.socials[network.key] })));
</script>

<template>
  <ul v-if="links.length" class="social-links" :class="props.variant" aria-label="Réseaux sociaux">
    <li v-for="link in links" :key="link.key">
      <a :href="link.url" target="_blank" rel="noopener noreferrer" :aria-label="`Genni sur ${link.label} (nouvel onglet)`">
        <span class="dot" :style="{ background: link.color }" aria-hidden="true"></span>
        {{ link.label }}
      </a>
    </li>
  </ul>
</template>

<style scoped>
.social-links {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
}

a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9), 0 0 0 2.5px rgba(0, 0, 0, 0.12);
}

.pills a {
  padding: 10px 18px;
  border-radius: 999px;
  background: #fff;
  border: 1.5px solid var(--line);
  color: var(--text);
  transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.pills a:hover {
  transform: translateY(-2px);
  border-color: var(--green);
  box-shadow: 0 6px 16px rgba(19, 80, 43, 0.12);
}

.footer {
  flex-direction: column;
  gap: 6px;
}

.footer a {
  color: inherit;
  font-weight: 500;
}

.footer a:hover {
  text-decoration: underline;
}
</style>
