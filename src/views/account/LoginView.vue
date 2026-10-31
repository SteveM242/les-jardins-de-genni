<script setup>
import { reactive, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useAuth } from "../../stores/auth.js";
import PasswordField from "../../components/PasswordField.vue";

const router = useRouter();
const auth = useAuth();
const form = reactive({ email: "", password: "" });
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.login(form);
    router.push("/compte");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="container narrow">
      <p class="eyebrow">Espace client</p>
      <h1>Connexion</h1>
      <p class="hint">Pour suivre vos commandes. Vous cherchez l'espace de gestion de Genni ? C'est par ici : <RouterLink to="/admin/connexion">Espace Genni</RouterLink>.</p>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          Email
          <input v-model.trim="form.email" type="email" required />
        </label>
        <label>
          Mot de passe
          <PasswordField v-model="form.password" />
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>

        <button type="submit" class="btn primary" :disabled="loading">
          {{ loading ? "Connexion…" : "Se connecter" }}
        </button>
      </form>

      <p class="switch">
        Pas encore de compte ? <RouterLink to="/compte/inscription">Créer un compte</RouterLink>
      </p>
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
  margin: 4px 0 12px;
}

.hint {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 24px;
}

.hint a {
  color: var(--clay-dark);
  font-weight: 600;
}

.auth-form {
  display: grid;
  gap: 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px;
}

.auth-form label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.auth-form input {
  font: inherit;
  padding: 11px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
}

.form-error {
  color: #a3372e;
  font-size: 13px;
  margin: 0;
}

.switch {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: var(--muted);
}

.switch a {
  color: var(--clay-dark);
  font-weight: 600;
}
</style>
