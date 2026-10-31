<script setup>
import { site } from "../data/site.js";
import { paniers } from "../data/paniers.js";
import PanierCard from "../components/PanierCard.vue";
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
          <a href="#comment-ca-marche" class="btn ghost">Comment ça marche</a>
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

    <section id="comment-ca-marche" class="steps-section">
      <div class="container">
        <p class="eyebrow">Comment ça marche</p>
        <h2>Trois étapes, c'est tout</h2>

        <ol class="steps-list">
          <li v-for="(step, index) in site.howItWorks" :key="step.title">
            <span class="step-number">{{ index + 1 }}</span>
            <div>
              <h3>{{ step.title }}</h3>
              <p>{{ step.text }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  background: linear-gradient(180deg, var(--cream-deep) 0%, var(--cream) 100%);
  padding: 72px 0 56px;
  border-bottom: 1px solid var(--line);
}

.hero-inner {
  max-width: 640px;
}

.hero h1 {
  font-size: 40px;
  margin: 0 0 18px;
}

.hero-intro {
  color: var(--muted);
  font-size: 16px;
  margin: 0 0 28px;
}

.hero-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
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
  margin: 36px 0 0;
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
    padding: 56px 0 40px;
  }

  .hero h1 {
    font-size: 30px;
  }
}
</style>
