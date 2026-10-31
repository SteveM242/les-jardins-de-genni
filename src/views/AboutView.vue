<script setup>
import { RouterLink } from "vue-router";
import { site } from "../data/site.js";
</script>

<template>
  <div class="about">
    <div class="container about-grid">
      <div class="about-media">
        <img src="/images/about-martinique.jpg" alt="Culture de bananes et canne à sucre en Martinique" />
      </div>

      <div class="about-body">
        <p class="eyebrow">À propos</p>
        <h1>Genni, {{ site.location }}</h1>
        <p class="lead">{{ site.intro }}</p>

        <p>
          {{ site.brandName }}, c'est avant tout une histoire de patience : laisser le temps aux
          fruits et légumes de mûrir avant de les proposer. Pas de forçage, pas de stock permanent —
          chaque panier reflète ce qui est réellement prêt à être récolté la semaine de la commande.
        </p>

        <p>
          Les produits sont cultivés sur l'exploitation de Genni, récoltés le jour même de la
          préparation des paniers, pour une fraîcheur maximale entre le jardin et votre table.
        </p>

        <p class="note">
          ⚠️ Texte de présentation provisoire — à affiner avec Genni (parcours, méthode de culture,
          valeurs, photos de l'exploitation).
        </p>

        <RouterLink to="/#paniers" class="btn primary">Découvrir les paniers</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about {
  padding: 56px 0 80px;
}

.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}

.about-media img {
  width: 100%;
  height: 420px;
  object-fit: cover;
  border-radius: 16px;
  border: 1px solid var(--line);
}

h1 {
  font-size: 32px;
  margin: 4px 0 16px;
}

.lead {
  font-size: 17px;
  color: var(--text);
  margin: 0 0 20px;
}

.about-body p {
  color: var(--muted);
  margin: 0 0 16px;
}

.note {
  font-size: 13px;
  font-style: italic;
  background: var(--cream-deep);
  border-radius: 10px;
  padding: 12px 14px;
  margin: 20px 0 24px;
}

@media (max-width: 760px) {
  .about-grid {
    grid-template-columns: 1fr;
  }

  .about-media img {
    height: 260px;
  }
}
</style>
