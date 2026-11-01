<script setup>
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { api } from "../../api.js";
import { useAuth } from "../../stores/auth.js";
import { useToast } from "../../stores/toast.js";
import PasswordField from "../../components/PasswordField.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const toast = useToast();

const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""));
const password = ref("");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  const res = await api("/api/auth/reset", { method: "POST", body: { token: token.value, password: password.value } });
  loading.value = false;
  if (!res.ok) {
    error.value = res.error;
    return;
  }
  auth.state.customer = res.data.customer;
  toast.success("Mot de passe modifié. Vous êtes connecté·e.");
  router.push("/compte");
}
</script>

<template>
  <div class="auth-page">
    <div class="container narrow">
      <p class="eyebrow">Espace client</p>
      <h1>Nouveau mot de passe</h1>

      <div v-if="!token" class="sent-box" role="alert">
        <p>Ce lien est incomplet. Refaites une demande de réinitialisation.</p>
        <RouterLink to="/compte/mot-de-passe-oublie" class="btn ghost">Demander un nouveau lien</RouterLink>
      </div>

      <form v-else class="auth-form" @submit.prevent="submit">
        <label>
          Nouveau mot de passe (8 caractères min.)
          <PasswordField v-model="password" minlength="8" autocomplete="new-password" />
        </label>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn primary" :disabled="loading">
          {{ loading ? "Enregistrement…" : "Enregistrer le mot de passe" }}
        </button>
        <RouterLink v-if="error" to="/compte/mot-de-passe-oublie" class="retry-link">Demander un nouveau lien</RouterLink>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  padding: 56px 0 80px;
}

.container.narrow {
  max-width: 420px;
}

h1 {
  font-size: 28px;
  margin: 4px 0 20px;
}

.auth-form,
.sent-box {
  display: grid;
  gap: 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px;
}

.sent-box p {
  margin: 0;
  font-size: 14px;
}

.auth-form label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 0;
}

.retry-link {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--clay-dark);
}
</style>
