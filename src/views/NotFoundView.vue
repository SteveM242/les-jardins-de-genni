<script setup>
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="not-found">
    <div class="container">
      <p class="eyebrow">Erreur 404</p>
      <h1>Cette page n'existe pas</h1>
      <p>La page que vous cherchez a peut-être été déplacée ou n'existe plus.</p>
      <RouterLink to="/" class="btn primary">Retour à l'accueil</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  padding: 120px 0;
  text-align: center;
}

.not-found h1 {
  font-size: 28px;
  margin: 0 0 12px;
}

.not-found p {
  color: var(--muted);
  margin: 0 0 28px;
}
</style>
