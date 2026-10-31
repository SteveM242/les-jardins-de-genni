<script setup>
import { useRouter } from "vue-router";
import { useAdminAuth } from "../../stores/adminAuth.js";

const router = useRouter();
const adminAuth = useAdminAuth();

async function logout() {
  await adminAuth.logout();
  router.push("/admin/connexion");
}
</script>

<template>
  <div class="admin-shell">
    <header class="admin-header">
      <div class="admin-header-inner">
        <strong>Les Jardins de Genni — Espace pro</strong>
        <nav>
          <RouterLink to="/admin">Commandes</RouterLink>
          <RouterLink to="/admin/articles">Articles</RouterLink>
          <RouterLink to="/admin/paniers">Paniers</RouterLink>
          <RouterLink to="/admin/promos">Codes promo</RouterLink>
        </nav>
        <button type="button" class="btn ghost compact" @click="logout">Déconnexion</button>
      </div>
    </header>
    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: var(--cream);
}

.admin-header {
  background: var(--green-dark);
  color: #fff;
}

.admin-header-inner {
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 0;
  flex-wrap: wrap;
}

nav {
  display: flex;
  gap: 18px;
  flex: 1;
}

nav a {
  color: #d9e4d2;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

nav a.router-link-exact-active {
  color: #fff;
  text-decoration: underline;
}

.btn.ghost.compact {
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
  padding: 8px 16px;
  font-size: 13px;
}

.admin-main {
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto;
  padding: 32px 0 60px;
}
</style>
