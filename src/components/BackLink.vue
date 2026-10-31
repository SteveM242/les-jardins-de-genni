<script setup>
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

function goBack() {
  const startPath = route.fullPath;

  if (window.history.state?.back) {
    router.back();
    // Filet de sécurité : si l'historique du navigateur ne répond pas
    // (extension, webview, onglet sans historique réel), on force un
    // retour à l'accueil plutôt que de laisser le bouton ne rien faire.
    setTimeout(() => {
      if (router.currentRoute.value.fullPath === startPath) {
        router.push("/");
      }
    }, 250);
  } else {
    router.push("/");
  }
}
</script>

<template>
  <button type="button" class="back-link" @click="goBack">← Retour</button>
</template>

<style scoped>
.back-link {
  display: inline-block;
  margin-bottom: 20px;
  background: none;
  border: 0;
  padding: 0;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--muted);
  cursor: pointer;
  font-family: inherit;
}

.back-link:hover {
  color: var(--green);
}
</style>
