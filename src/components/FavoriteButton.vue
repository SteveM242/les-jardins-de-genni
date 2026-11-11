<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../stores/auth.js";
import { useToast } from "../stores/toast.js";

// Cœur « favori » : réservé aux clients connectés (les favoris sont enregistrés dans le compte).
const props = defineProps({
  type: { type: String, required: true }, // "basket" | "product"
  slug: { type: String, required: true },
  name: { type: String, default: "" }
});

const auth = useAuth();
const router = useRouter();
const toast = useToast();

const active = computed(() => (auth.state.customer?.favorites || []).some((fav) => fav.type === props.type && fav.slug === props.slug));

async function toggle() {
  if (!auth.state.customer) {
    toast.show("Connectez-vous pour garder vos favoris.");
    router.push("/compte/connexion");
    return;
  }
  try {
    const nowActive = await auth.toggleFavorite({ type: props.type, slug: props.slug });
    toast.success(nowActive ? `« ${props.name || "Article"} » ajouté à vos favoris.` : "Retiré de vos favoris.");
  } catch (err) {
    toast.error(err.message);
  }
}
</script>

<template>
  <button
    type="button"
    class="fav"
    :class="{ active }"
    :aria-pressed="active"
    :aria-label="active ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`"
    @click.stop.prevent="toggle"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        :fill="active ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped>
.fav {
  position: relative;
  z-index: 2;
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--muted);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(42, 33, 25, 0.2);
}

.fav:hover {
  color: var(--hibiscus);
}

.fav.active {
  color: var(--hibiscus);
}
</style>
