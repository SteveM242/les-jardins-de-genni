<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAdminAuth } from "../../stores/adminAuth.js";
import PasswordField from "../../components/PasswordField.vue";
import BackLink from "../../components/BackLink.vue";

const router = useRouter();
const adminAuth = useAdminAuth();
const form = reactive({ email: "", password: "" });
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await adminAuth.login(form);
    router.push("/admin");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="container narrow">
      <BackLink />
      <p class="eyebrow">Espace pro</p>
      <h1>Connexion pro</h1>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          Email
          <input v-model.trim="form.email" type="email" autocomplete="username" required />
        </label>
        <label>
          Mot de passe
          <PasswordField v-model="form.password" autocomplete="current-password" />
        </label>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn primary" :disabled="loading">
          {{ loading ? "Connexion…" : "Se connecter" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.admin-login {
  padding: 80px 0;
  min-height: 100vh;
  background: var(--cream);
}

.container.narrow {
  max-width: 400px;
}

h1 {
  font-size: 26px;
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
  color: #a3202a;
  font-size: 13px;
  margin: 0;
}
</style>
