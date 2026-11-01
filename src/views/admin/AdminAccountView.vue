<script setup>
import { onMounted, reactive, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import PasswordField from "../../components/PasswordField.vue";
import { api } from "../../api.js";
import { useToast } from "../../stores/toast.js";

const toast = useToast();

const currentEmail = ref("");
const loading = ref(true);
const loadError = ref("");

const emailForm = reactive({ email: "", currentPassword: "" });
const emailError = ref("");
const emailSaving = ref(false);

const passwordForm = reactive({ currentPassword: "", newPassword: "", confirm: "" });
const passwordError = ref("");
const passwordSaving = ref(false);

async function load() {
  loading.value = true;
  loadError.value = "";
  const res = await api("/api/admin/account");
  if (res.ok) {
    currentEmail.value = res.data.admin.email;
    emailForm.email = res.data.admin.email;
  } else {
    loadError.value = res.error;
  }
  loading.value = false;
}

async function saveEmail() {
  emailError.value = "";
  emailSaving.value = true;
  const res = await api("/api/admin/account/email", { method: "PATCH", body: { ...emailForm } });
  emailSaving.value = false;
  if (!res.ok) {
    emailError.value = res.error;
    return;
  }
  currentEmail.value = res.data.admin.email;
  emailForm.currentPassword = "";
  toast.success("Email de connexion modifié : utilisez-le dès votre prochaine connexion.");
}

async function savePassword() {
  passwordError.value = "";
  if (passwordForm.newPassword !== passwordForm.confirm) {
    passwordError.value = "Les deux nouveaux mots de passe ne sont pas identiques.";
    return;
  }
  passwordSaving.value = true;
  const res = await api("/api/admin/account/password", {
    method: "POST",
    body: { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }
  });
  passwordSaving.value = false;
  if (!res.ok) {
    passwordError.value = res.error;
    return;
  }
  Object.assign(passwordForm, { currentPassword: "", newPassword: "", confirm: "" });
  toast.success("Mot de passe modifié. Vos autres appareils ont été déconnectés.");
}

onMounted(load);
</script>

<template>
  <AdminNav>
    <h1>Mon compte</h1>
    <p class="hint">Les identifiants avec lesquels vous vous connectez à l'espace pro.</p>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="load" />

    <div v-else class="grid">
      <form class="card" @submit.prevent="saveEmail">
        <h2>Email de connexion</h2>
        <p class="hint">Actuellement : <strong>{{ currentEmail }}</strong></p>
        <label>
          Nouvel email
          <input v-model.trim="emailForm.email" type="email" autocomplete="username" required />
        </label>
        <label>
          Mot de passe actuel (pour confirmer)
          <PasswordField v-model="emailForm.currentPassword" autocomplete="current-password" />
        </label>
        <p v-if="emailError" class="form-error" role="alert">{{ emailError }}</p>
        <button type="submit" class="btn primary" :disabled="emailSaving">{{ emailSaving ? "Enregistrement…" : "Changer l'email" }}</button>
      </form>

      <form class="card" @submit.prevent="savePassword">
        <h2>Mot de passe</h2>
        <p class="hint">Entre 8 et 72 caractères. Vos autres appareils seront déconnectés.</p>
        <label>
          Mot de passe actuel
          <PasswordField v-model="passwordForm.currentPassword" autocomplete="current-password" />
        </label>
        <label>
          Nouveau mot de passe
          <PasswordField v-model="passwordForm.newPassword" minlength="8" autocomplete="new-password" />
        </label>
        <label>
          Confirmer le nouveau mot de passe
          <PasswordField v-model="passwordForm.confirm" minlength="8" autocomplete="new-password" />
        </label>
        <p v-if="passwordError" class="form-error" role="alert">{{ passwordError }}</p>
        <button type="submit" class="btn primary" :disabled="passwordSaving">
          {{ passwordSaving ? "Enregistrement…" : "Changer le mot de passe" }}
        </button>
      </form>
    </div>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 6px;
}

h2 {
  font-size: 17px;
  margin: 0;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 20px;
}

.card .hint {
  margin: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  align-items: start;
}

.card {
  display: grid;
  gap: 14px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px;
}

.card label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.card input:not([type="password"]):not([type="text"]) {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  color: var(--text);
}

.card .btn {
  justify-self: start;
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 0;
}
</style>
