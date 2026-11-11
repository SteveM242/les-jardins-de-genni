<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAdminAuth } from "../../stores/adminAuth.js";

const router = useRouter();
const route = useRoute();
const adminAuth = useAdminAuth();
const open = ref(false);

// Sur petit écran, le menu latéral se referme quand on change de page.
watch(() => route.fullPath, () => {
  open.value = false;
});

// Regroupé par usage : le quotidien d'abord, la configuration ensuite.
const GROUPS = [
  {
    title: "Au quotidien",
    links: [
      { to: "/admin", label: "Commandes", icon: "🧾" },
      { to: "/admin/preparation", label: "Préparation", icon: "📋" }
    ]
  },
  {
    title: "Catalogue",
    links: [
      { to: "/admin/paniers", label: "Paniers", icon: "🧺" },
      { to: "/admin/articles", label: "Articles", icon: "🥭" },
      { to: "/admin/promos", label: "Codes promo", icon: "🏷️" }
    ]
  },
  {
    title: "Site et comptes",
    links: [
      { to: "/admin/contenu", label: "Contenu du site", icon: "✏️" },
      { to: "/admin/utilisateurs", label: "Utilisateurs", icon: "👥" },
      { to: "/admin/compte", label: "Mon compte", icon: "🔑" }
    ]
  }
];

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
    <header class="topbar">
      <button type="button" class="burger" :aria-expanded="open" aria-controls="admin-side" aria-label="Menu de l'espace pro" @click="open = !open">
        <span aria-hidden="true">{{ open ? "✕" : "☰" }}</span>
      </button>
      <strong>Espace pro</strong>
      <RouterLink to="/" class="topbar-site">Voir le site ↗</RouterLink>
    </header>

    <div v-if="open" class="backdrop" @click="open = false"></div>

    <aside id="admin-side" class="sidebar" :class="{ open }" aria-label="Menu de l'espace pro">
      <div class="side-brand">
        <span class="side-mark" aria-hidden="true">LM</span>
        <div>
          <strong>L'Héritage des Mornes</strong>
          <small>Espace pro</small>
        </div>
      </div>

      <nav class="side-nav">
        <div v-for="group in GROUPS" :key="group.title" class="side-group">
          <p class="side-title">{{ group.title }}</p>
          <RouterLink v-for="link in group.links" :key="link.to" :to="link.to">
            <span class="side-icon" aria-hidden="true">{{ link.icon }}</span>
            {{ link.label }}
          </RouterLink>
        </div>
      </nav>

      <div class="side-foot">
        <RouterLink to="/" class="side-site">↗ Voir le site</RouterLink>
        <button type="button" class="side-btn" @click="logout">Déconnexion</button>
        <button type="button" class="link-logout" @click="logoutEverywhere">Déconnecter tous les appareils</button>
      </div>
    </aside>

    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  background: var(--cream);
}

.topbar,
.backdrop {
  display: none;
}

.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 14px;
  background: #2a2119;
  color: #f3eadc;
  overflow-y: auto;
}

.side-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.side-brand strong {
  display: block;
  font-family: "Fraunces", Georgia, serif;
  font-size: 15px;
  line-height: 1.2;
}

.side-brand small {
  color: #b9a994;
  font-size: 12px;
}

.side-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--brand);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  flex: 0 0 auto;
}

.side-nav {
  display: grid;
  gap: 16px;
}

.side-title {
  margin: 0 8px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #a39380;
}

.side-group a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  color: #e6dac7;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.side-group a:hover {
  background: rgba(255, 255, 255, 0.07);
}

.side-group a.router-link-exact-active {
  background: var(--brand);
  color: #fff;
}

.side-icon {
  width: 22px;
  text-align: center;
}

.side-foot {
  margin-top: auto;
  display: grid;
  gap: 8px;
  padding: 14px 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.side-site {
  color: #e6dac7;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.side-btn {
  padding: 9px 12px;
  border-radius: 10px;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.side-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.link-logout {
  background: none;
  border: 0;
  padding: 0;
  text-align: left;
  color: #a39380;
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}

.admin-main {
  width: 100%;
  max-width: 1100px;
  padding: 32px 36px 60px;
}

/* Petits écrans : barre du haut + menu latéral en tiroir. */
@media (max-width: 900px) {
  .admin-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: #2a2119;
    color: #fff;
  }

  .burger {
    width: 40px;
    height: 40px;
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    border-radius: 10px;
    background: transparent;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
  }

  .topbar-site {
    margin-left: auto;
    color: #e6dac7;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 44;
    background: rgba(42, 33, 25, 0.5);
  }

  .sidebar {
    position: fixed;
    z-index: 45;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(290px, 84vw);
    transform: translateX(-100%);
    visibility: hidden;
    transition: transform 220ms ease, visibility 220ms;
  }

  .sidebar.open {
    transform: translateX(0);
    visibility: visible;
  }

  .admin-main {
    padding: 22px 16px 48px;
  }
}
</style>
