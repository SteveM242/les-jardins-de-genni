<script setup>
import { reactive, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useAuth } from "../../stores/auth.js";
import PasswordField from "../../components/PasswordField.vue";
import BackLink from "../../components/BackLink.vue";

const router = useRouter();
const auth = useAuth();
const form = reactive({ name: "", email: "", phone: "", password: "" });
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.signup(form);
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
      <BackLink />
      <p class="eyebrow">Espace client</p>
      <h1>Créer un compte</h1>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          Nom et prénom
          <input v-model.trim="form.name" type="text" autocomplete="name" required />
        </label>
        <label>
          Email
          <input v-model.trim="form.email" type="email" autocomplete="email" required />
        </label>
        <label>
          Téléphone
          <input v-model.trim="form.phone" type="tel" autocomplete="tel" />
        </label>
        <label>
          Mot de passe (8 caractères min.)
          <PasswordField v-model="form.password" minlength="8" autocomplete="new-password" />
        </label>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn primary" :disabled="loading">
          {{ loading ? "Création…" : "Créer mon compte" }}
        </button>
      </form>

      <p class="switch">
        Déjà un compte ? <RouterLink to="/compte/connexion">Se connecter</RouterLink>
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
  margin: 4px 0 28px;
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
