<script setup>
import { useSocialNetworks } from "../composables/useSocialNetworks.js";

const { links, loaded } = useSocialNetworks();
</script>

<template>
  <div class="socials-page">
    <div class="container">
      <p class="eyebrow">Suivre la Fée des Mornes</p>
      <h1>Découvrez La Fée des Mornes sur les réseaux</h1>
      <p class="intro">
        Photos du jardin, récoltes de la semaine, coulisses de la préparation des paniers : retrouvez La Fée des Mornes là où vous avez
        l'habitude de regarder.
      </p>

      <ul v-if="links.length" class="cards">
        <li v-for="link in links" :key="link.key">
          <a :href="link.url" target="_blank" rel="noopener noreferrer" class="card" :style="{ '--brand': link.color }" :aria-label="`Ouvrir ${link.label} (nouvel onglet)`">
            <span class="brand-bar" aria-hidden="true"></span>
            <h2>{{ link.label }}</h2>
            <p>{{ link.description }}</p>
            <span class="cta">Ouvrir {{ link.label }} →</span>
          </a>
        </li>
      </ul>

      <p v-else-if="loaded" class="empty">
        Les réseaux de la Fée des Mornes arrivent bientôt. En attendant, vous pouvez
        <RouterLink to="/#paniers">découvrir les paniers</RouterLink> ou <RouterLink to="/contact">nous écrire</RouterLink>.
      </p>
    </div>
  </div>
</template>

<style scoped>
.socials-page {
  padding: 56px 0 80px;
}

h1 {
  font-size: 30px;
  margin: 4px 0 14px;
  max-width: 640px;
}

.intro {
  color: var(--muted);
  max-width: 580px;
  margin: 0 0 36px;
}

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.card {
  position: relative;
  display: grid;
  gap: 8px;
  height: 100%;
  padding: 26px 22px 22px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(19, 80, 43, 0.06), 0 8px 24px rgba(19, 80, 43, 0.08);
  color: var(--text);
  text-decoration: none;
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.card:hover,
.card:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 2px 4px rgba(19, 80, 43, 0.08), 0 16px 36px rgba(19, 80, 43, 0.16);
}

/* Bandeau à la couleur du réseau (Snapchat est jaune : le texte reste sur fond blanc, donc lisible). */
.brand-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 6px;
  background: var(--brand);
}

.card h2 {
  font-size: 22px;
}

.card p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.cta {
  margin-top: 8px;
  font-weight: 700;
  font-size: 14px;
  color: var(--green-dark);
}

.empty {
  color: var(--muted);
}

.empty a {
  color: var(--clay-dark);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .card:hover,
  .card:focus-visible {
    transform: none;
  }
}
</style>
