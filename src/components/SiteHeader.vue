<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import BrandLogo from "./BrandLogo.vue";
import { useCart } from "../stores/cart.js";
import { useAuth } from "../stores/auth.js";

const cart = useCart();
const auth = useAuth();
const route = useRoute();
const menuOpen = ref(false);

// Le tiroir du menu se referme à chaque changement de page, et avec la touche Échap.
watch(() => route.fullPath, () => {
  menuOpen.value = false;
});

function onKey(event) {
  if (event.key === "Escape") menuOpen.value = false;
}

// Quand le tiroir est ouvert, la page derrière ne défile plus.
watch(menuOpen, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
});

onMounted(() => {
  if (!auth.state.loaded) auth.fetchMe();
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  document.body.style.overflow = "";
});
</script>

<template>
  <header class="site-header">
    <div class="container site-header-inner">
      <BrandLogo />

      <nav class="main-nav" aria-label="Navigation principale">
        <RouterLink to="/#paniers" class="nav-anchor">Nos paniers</RouterLink>
        <RouterLink to="/produits">À la carte</RouterLink>
        <RouterLink to="/comment-ca-marche">Comment ça marche</RouterLink>
        <RouterLink to="/contact">Contact</RouterLink>
      </nav>

      <div class="header-actions">
        <RouterLink
          :to="auth.state.customer ? '/compte' : '/compte/connexion'"
          class="account-link"
          :aria-label="auth.state.customer ? `Mon compte (${auth.state.customer.name})` : 'Connexion / Mon compte'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
          </svg>
          <span class="account-label">{{ auth.state.customer ? auth.state.customer.name.split(" ")[0] : "Connexion" }}</span>
        </RouterLink>

        <RouterLink to="/commande" class="cart-link" aria-label="Mon panier">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 4h2.4l2.1 11h9.8l2-8H6.2" />
            <circle cx="9" cy="19.5" r="1.4" />
            <circle cx="17" cy="19.5" r="1.4" />
          </svg>
          <span class="cart-text">Panier</span>
          <span v-if="cart.totalItems.value" class="cart-badge" aria-label="articles dans le panier">{{ cart.totalItems.value }}</span>
        </RouterLink>

        <button
          type="button"
          class="menu-toggle"
          :aria-expanded="menuOpen"
          aria-controls="drawer"
          aria-label="Ouvrir le menu"
          @click="menuOpen = true"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Tiroir du menu (petits écrans) -->
    <div v-if="menuOpen" class="drawer-backdrop" @click="menuOpen = false"></div>
    <aside id="drawer" class="drawer" :class="{ open: menuOpen }" :aria-hidden="!menuOpen" aria-label="Menu">
      <div class="drawer-head">
        <strong>Menu</strong>
        <button type="button" class="drawer-close" aria-label="Fermer le menu" @click="menuOpen = false">✕</button>
      </div>
      <nav class="drawer-nav" aria-label="Menu mobile">
        <RouterLink to="/#paniers">Nos paniers</RouterLink>
        <RouterLink to="/produits">À la carte</RouterLink>
        <RouterLink to="/composer">Composer mon panier</RouterLink>
        <RouterLink to="/comment-ca-marche">Comment ça marche</RouterLink>
        <RouterLink to="/a-propos">À propos</RouterLink>
        <RouterLink to="/contact">Contact</RouterLink>
      </nav>
      <div class="drawer-foot">
        <RouterLink :to="auth.state.customer ? '/compte' : '/compte/connexion'" class="btn ghost">
          {{ auth.state.customer ? "Mon compte" : "Connexion / Créer un compte" }}
        </RouterLink>
        <RouterLink to="/commande" class="btn primary">
          Mon panier<template v-if="cart.totalItems.value"> ({{ cart.totalItems.value }})</template>
        </RouterLink>
      </div>
    </aside>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(250, 247, 242, 0.96);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
}

.site-header-inner {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 14px 0;
}

.site-header :deep(.brand-logo),
.main-nav a,
.account-link,
.cart-link {
  white-space: nowrap;
}

.main-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
}

.main-nav a {
  position: relative;
  padding: 8px 12px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  transition: color 150ms ease, background-color 150ms ease;
}

.main-nav a:hover {
  color: var(--brand);
  background: var(--brand-soft);
}

/* Page courante : soulignement discret. */
.main-nav a.router-link-exact-active:not(.nav-anchor)::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 2px;
  height: 2px;
  border-radius: 2px;
  background: var(--brand);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.account-link,
.cart-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  transition: background-color 150ms ease, color 150ms ease;
}

.account-link {
  color: var(--text);
}

.account-link:hover {
  background: var(--brand-soft);
  color: var(--brand);
}

.cart-link {
  background: var(--brand);
  color: #fff;
}

.cart-link:hover {
  background: var(--brand-dark);
}

.cart-badge {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--text);
  border: 2px solid var(--cream);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  color: var(--text);
  align-items: center;
  justify-content: center;
}

/* Tiroir : caché sur grand écran. */
.drawer,
.drawer-backdrop {
  display: none;
}

@media (max-width: 960px) {
  .main-nav {
    display: none;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .site-header-inner {
    gap: 12px;
  }

  /* Le prénom et le mot « Panier » disparaissent : les icônes suffisent. */
  .account-label,
  .cart-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .account-link {
    width: 40px;
    padding: 0;
    justify-content: center;
  }

  .cart-link {
    width: 40px;
    padding: 0;
    justify-content: center;
  }

  .drawer-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(42, 33, 25, 0.45);
    z-index: 60;
  }

  .drawer {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(340px, 86vw);
    z-index: 61;
    background: var(--cream);
    box-shadow: -12px 0 32px rgba(42, 33, 25, 0.2);
    transform: translateX(100%);
    visibility: hidden;
    transition: transform 220ms ease, visibility 220ms;
  }

  .drawer.open {
    transform: translateX(0);
    visibility: visible;
  }

  .drawer-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 20px;
    border-bottom: 1px solid var(--line);
    font-family: "Fraunces", Georgia, serif;
    font-size: 18px;
  }

  .drawer-close {
    width: 40px;
    height: 40px;
    border: 0;
    background: transparent;
    font-size: 20px;
    cursor: pointer;
    color: var(--text);
  }

  .drawer-nav {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    overflow-y: auto;
  }

  .drawer-nav a {
    padding: 16px 22px;
    font-size: 17px;
    font-weight: 600;
    text-decoration: none;
    color: var(--text);
    border-bottom: 1px solid var(--line);
  }

  .drawer-nav a.router-link-exact-active {
    color: var(--brand);
    background: var(--brand-soft);
  }

  .drawer-foot {
    margin-top: auto;
    display: grid;
    gap: 10px;
    padding: 18px 20px 24px;
  }

  .drawer-foot .btn {
    justify-content: center;
  }
}
</style>
