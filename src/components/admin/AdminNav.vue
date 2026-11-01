<script setup>
import { useRouter } from "vue-router";
import { useAdminAuth } from "../../stores/adminAuth.js";

const router = useRouter();
const adminAuth = useAdminAuth();

async function logout() {
  await adminAuth.logout();
  router.push("/admin/connexion");
}

async function logoutEverywhere() {
  if (!confirm("Déconnecter tous vos appareils (téléphone, ordinateur…) ?")) return;
  await adminAuth.logoutEverywhere();
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
        <button type="button" class="link-logout" @click="logoutEverywhere">Déconnecter tous les appareils</button>
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
  color: #cfe8d3;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

nav a.router-link-exact-active {
  color: #fff;
  text-decoration: underline;
}

.link-logout {
  background: none;
  border: 0;
  color: #cfe8d3;
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}

@media (max-width: 760px) {
  .admin-header-inner {
    gap: 12px;
  }

  nav {
    flex-basis: 100%;
    order: 3;
    flex-wrap: wrap;
  }
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
