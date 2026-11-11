<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useCatalog } from "../stores/catalog.js";

// Fil d'Ariane unique, affiché sous l'en-tête sur toutes les pages publiques (sauf l'accueil) :
// il remplace le lien « Retour », qui ne menait nulle part de prévisible. Chaque étape est un vrai lien.
const route = useRoute();
const catalog = useCatalog();

const HOME = { label: "Accueil", to: "/" };

const TRAILS = {
  "/produits": [{ label: "À la carte" }],
  "/composer": [{ label: "À la carte", to: "/produits" }, { label: "Composer mon panier" }],
  "/commande": [{ label: "Mon panier" }],
  "/comment-ca-marche": [{ label: "Comment ça marche" }],
  "/a-propos": [{ label: "À propos" }],
  "/contact": [{ label: "Contact" }],
  "/reseaux": [{ label: "Nous suivre" }],
  "/mentions-legales": [{ label: "Mentions légales" }],
  "/confidentialite": [{ label: "Confidentialité" }],
  "/conditions": [{ label: "Conditions de commande" }],
  "/compte": [{ label: "Mon compte" }],
  "/compte/connexion": [{ label: "Connexion" }],
  "/compte/inscription": [{ label: "Connexion", to: "/compte/connexion" }, { label: "Créer un compte" }],
  "/compte/mot-de-passe-oublie": [{ label: "Connexion", to: "/compte/connexion" }, { label: "Mot de passe oublié" }],
  "/compte/reinitialiser": [{ label: "Connexion", to: "/compte/connexion" }, { label: "Nouveau mot de passe" }],
  "/compte/verification": [{ label: "Mon compte", to: "/compte" }, { label: "Confirmation de l'email" }],
  "/rappel/desabonnement": [{ label: "Rappel du lundi" }]
};

const trail = computed(() => {
  const path = route.path.replace(/\/+$/, "") || "/";
  if (path === "/") return [];
  if (route.meta.bare) return [];
  if (path.startsWith("/panier/")) {
    const basket = catalog.findBasketBySlug(route.params.slug);
    return [HOME, { label: "Nos paniers", to: "/#paniers" }, { label: basket?.name || "Panier" }];
  }
  const items = TRAILS[path];
  return items ? [HOME, ...items] : [];
});

// Sur petit écran : un seul lien « ‹ étape précédente » (plus lisible qu'une longue file).
const parent = computed(() => (trail.value.length > 1 ? trail.value[trail.value.length - 2] : null));
</script>

<template>
  <nav v-if="trail.length" class="breadcrumbs" aria-label="Fil d'Ariane">
    <div class="container crumbs-inner">
      <RouterLink v-if="parent" :to="parent.to" class="crumb-back">‹ {{ parent.label }}</RouterLink>
      <ol>
        <li v-for="(item, index) in trail" :key="item.label + index">
          <RouterLink v-if="item.to" :to="item.to">{{ item.label }}</RouterLink>
          <span v-else aria-current="page">{{ item.label }}</span>
        </li>
      </ol>
    </div>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  border-bottom: 1px solid var(--line);
  background: #fff;
}

.crumbs-inner {
  padding: 10px 0;
  font-size: 13px;
}

ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
}

li + li::before {
  content: "›";
  color: var(--line);
  font-weight: 700;
  margin-right: 2px;
}

li a {
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
}

li a:hover {
  color: var(--brand);
  text-decoration: underline;
}

li span {
  color: var(--text);
  font-weight: 700;
}

.crumb-back {
  display: none;
  color: var(--brand-dark);
  font-weight: 700;
  text-decoration: none;
}

@media (max-width: 640px) {
  .crumb-back {
    display: inline-block;
    padding: 4px 0;
  }

  ol {
    display: none;
  }
}
</style>
