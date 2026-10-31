<script setup>
import { onMounted } from "vue";
import { RouterLink } from "vue-router";
import { site } from "../data/site.js";
import { useCatalog } from "../stores/catalog.js";
import PanierCard from "../components/PanierCard.vue";
import LoadError from "../components/LoadError.vue";

const previewSteps = site.howItWorks.slice(0, 3);
const catalog = useCatalog();
onMounted(catalog.load);
</script>

<template>
  <div class="home">
    <section class="hero">
      <div class="container hero-inner">
        <p class="eyebrow">Martinique · Fait main · Saison après saison</p>
        <h1>{{ site.tagline }}</h1>
        <p class="hero-intro">{{ site.intro }}</p>
        <div class="hero-actions">
          <a href="#paniers" class="btn primary">Voir les paniers</a>
          <RouterLink to="/a-propos" class="btn ghost light">Découvrir Genni</RouterLink>
        </div>
      </div>
    </section>

    <section id="paniers" class="paniers-section">
      <div class="container">
        <p class="eyebrow">Nos paniers</p>
        <h2>Cueillis cette semaine</h2>
        <p class="section-intro">
          Chaque panier est composé selon ce qui est mûr et disponible chez Genni. La liste
          exacte peut varier légèrement d'une semaine à l'autre.
        </p>

        <p v-if="catalog.state.loading" class="loading-note">Chargement des paniers…</p>
        <LoadError v-else-if="catalog.state.error" :message="catalog.state.error" @retry="catalog.load" />
        <div v-else class="paniers-grid">
          <PanierCard v-for="panier in catalog.state.baskets" :key="panier.slug" :panier="panier" />
        </div>

        <p class="catalog-link">
          <RouterLink to="/produits">Envie de composer votre propre panier ? Voir les articles à l'unité →</RouterLink>
        </p>
      </div>
    </section>

    <section class="steps-section">
      <div class="container">
        <p class="eyebrow">Comment ça marche</p>
        <h2>Trois étapes, c'est tout</h2>

        <ol class="steps-list">
          <li v-for="(step, index) in previewSteps" :key="step.title">
            <span class="step-number">{{ index + 1 }}</span>
            <div>
              <h3>{{ step.title }}</h3>
              <p>{{ step.text }}</p>
            </div>
          </li>
        </ol>

        <RouterLink to="/comment-ca-marche" class="btn ghost">En savoir plus</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  padding: 100px 0 80px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(43, 36, 32, 0.6) 0%, rgba(43, 36, 32, 0.78) 100%),
    url("/images/hero-jardin.jpg") center/cover no-repeat;
  color: #fff;
}

.hero-inner {
  max-width: 640px;
}

.hero .eyebrow {
  color: #f0d9bf;
}

.hero h1 {
  font-size: 40px;
  margin: 0 0 18px;
  color: #fff;
}

.hero-intro {
  color: #ece4d6;
  font-size: 16px;
  margin: 0 0 28px;
}

.hero-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.btn.ghost.light {
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

.paniers-section,
.steps-section {
  padding: 64px 0;
}

.section-intro {
  color: var(--muted);
  max-width: 560px;
  margin: 12px 0 36px;
}

.paniers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}

.loading-note {
  color: var(--muted);
}

.catalog-link {
  margin: 28px 0 0;
  text-align: center;
}

.catalog-link a {
  color: var(--clay-dark);
  font-weight: 600;
  text-decoration: underline;
}

.steps-section {
  background: var(--cream-deep);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.steps-list {
  list-style: none;
  margin: 36px 0 32px;
  padding: 0;
  display: grid;
  gap: 28px;
  max-width: 640px;
}

.steps-list li {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.step-number {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--green);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-family: "Fraunces", Georgia, serif;
}

.steps-list h3 {
  font-size: 17px;
  margin: 0 0 6px;
}

.steps-list p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

@media (max-width: 700px) {
  .hero {
    padding: 72px 0 56px;
  }

  .hero h1 {
    font-size: 30px;
  }
}
</style>
