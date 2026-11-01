<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useAuth } from "../../stores/auth.js";

const route = useRoute();
const auth = useAuth();

const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""));
const state = ref("loading"); // loading | done | error
const linked = ref(0);
const error = ref("");

onMounted(async () => {
  if (!token.value) {
    state.value = "error";
    error.value = "Ce lien est incomplet.";
    return;
  }
  if (!auth.state.loaded) await auth.fetchMe();
  const res = await auth.verifyEmail(token.value);
  if (res.ok) {
    linked.value = res.data.linked || 0;
    state.value = "done";
  } else {
    state.value = "error";
    error.value = res.error;
  }
});
</script>

<template>
  <div class="auth-page">
    <div class="container narrow">
      <p class="eyebrow">Espace client</p>
      <h1>Confirmation de l'email</h1>

      <p v-if="state === 'loading'" role="status">Vérification en cours…</p>

      <div v-else-if="state === 'done'" class="box" role="status">
        <p><strong>Votre email est confirmé.</strong></p>
        <p v-if="linked > 0">
          {{ linked }} commande{{ linked > 1 ? "s" : "" }} passée{{ linked > 1 ? "s" : "" }} avec cette adresse
          {{ linked > 1 ? "ont été ajoutées" : "a été ajoutée" }} à votre compte.
        </p>
        <p v-else>Les prochaines commandes passées en étant connecté·e apparaîtront directement dans votre compte.</p>
        <RouterLink :to="auth.state.customer ? '/compte' : '/compte/connexion'" class="btn primary">
          {{ auth.state.customer ? "Voir mon compte" : "Me connecter" }}
        </RouterLink>
      </div>

      <div v-else class="box" role="alert">
        <p>{{ error }}</p>
        <RouterLink :to="auth.state.customer ? '/compte' : '/compte/connexion'" class="btn ghost">
          {{ auth.state.customer ? "Aller à mon compte" : "Me connecter" }}
        </RouterLink>
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
