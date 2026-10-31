<script setup>
import { RouterLink } from "vue-router";
import { site } from "../data/site.js";
import { paniers } from "../data/paniers.js";
import PanierCard from "../components/PanierCard.vue";

const previewSteps = site.howItWorks.slice(0, 3);
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

        <div class="paniers-grid">
          <PanierCard v-for="panier in paniers" :key="panier.slug" :panier="panier" />
        </div>
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
