<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../api.js";

const route = useRoute();
const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""));
const state = ref("ask"); // ask | sending | done | error
const error = ref("");

// Un clic de confirmation : un lien ouvert par erreur (ou prévisualisé par une messagerie) ne désinscrit personne.
async function unsubscribe() {
  state.value = "sending";
  const res = await api("/api/reminders/unsubscribe", { method: "POST", body: { token: token.value } });
  if (res.ok) {
    state.value = "done";
  } else {
    state.value = "error";
    error.value = res.error;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="container narrow">
      <p class="eyebrow">Rappel du lundi</p>
      <h1>Se désinscrire</h1>

      <div v-if="!token" class="box" role="alert">
        <p>Ce lien est incomplet. Utilisez le lien présent au bas du dernier email de rappel.</p>
      </div>

      <div v-else-if="state === 'done'" class="box" role="status">
        <p><strong>C'est fait : vous ne recevrez plus le rappel du lundi.</strong></p>
        <RouterLink to="/" class="btn ghost">Retour à l'accueil</RouterLink>
      </div>

      <div v-else-if="state === 'error'" class="box" role="alert">
        <p>{{ error }}</p>
        <RouterLink to="/" class="btn ghost">Retour à l'accueil</RouterLink>
      </div>

      <div v-else class="box">
        <p>Vous ne voulez plus recevoir l'email qui rappelle, le lundi, que la vente ferme le soir même ?</p>
        <button type="button" class="btn primary" :disabled="state === 'sending'" @click="unsubscribe">
          {{ state === "sending" ? "Désinscription…" : "Me désinscrire" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  padding: 56px 0 80px;
}

.container.narrow {
  max-width: 460px;
}

h1 {
  font-size: 28px;
  margin: 4px 0 20px;
}

.box {
  display: grid;
  gap: 14px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px;
}

.box p {
  margin: 0;
  font-size: 14px;
}
</style>
