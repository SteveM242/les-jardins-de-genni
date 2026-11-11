<script setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../../api.js";
import BackLink from "../../components/BackLink.vue";

const email = ref("");
const error = ref("");
const loading = ref(false);
const sent = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  const res = await api("/api/auth/forgot", { method: "POST", body: { email: email.value } });
  loading.value = false;
  if (res.ok) sent.value = true;
  else error.value = res.error;
}
</script>

<template>
  <div class="auth-page">
    <div class="container narrow">
      <BackLink />
      <p class="eyebrow">Espace client</p>
      <h1>Mot de passe oublié</h1>

      <div v-if="sent" class="sent-box" role="status">
        <p>
          Si un compte existe avec l'adresse <strong>{{ email }}</strong>, un email contenant un lien de réinitialisation vient
          d'être envoyé. Le lien est valable 1 heure.
        </p>
        <p class="hint">Rien reçu ? Vérifiez vos courriers indésirables, ou contactez La Fée des Mornes sur WhatsApp.</p>
        <RouterLink to="/compte/connexion" class="btn ghost">Retour à la connexion</RouterLink>
      </div>

      <form v-else class="auth-form" @submit.prevent="submit">
        <p class="hint">Saisissez l'email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
        <label>
          Email
          <input v-model.trim="email" type="email" autocomplete="email" required />
        </label>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn primary" :disabled="loading">
          {{ loading ? "Envoi…" : "Envoyer le lien" }}
        </button>
      </form>

      <p class="switch">
        <RouterLink to="/compte/connexion">← Retour à la connexion</RouterLink>
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
  margin: 4px 0 20px;
}

.hint {
  font-size: 13px;
  color: var(--muted);
  margin: 0;
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

.auth-form input {
  font: inherit;
  padding: 11px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 0;
}

.switch {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
}

.switch a {
  color: var(--clay-dark);
  font-weight: 600;
}
</style>
