<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import BrandLogo from "./BrandLogo.vue";
import { useCart } from "../stores/cart.js";
import { useAuth } from "../stores/auth.js";

const cart = useCart();
const auth = useAuth();
const route = useRoute();
const menuOpen = ref(false);

// Le menu compact se referme à chaque changement de page.
watch(() => route.fullPath, () => {
  menuOpen.value = false;
});

onMounted(() => {
  if (!auth.state.loaded) auth.fetchMe();
});
</script>

<template>
  <header class="site-header">
    <div class="container site-header-inner">
      <BrandLogo />

      <nav id="main-nav" :class="{ open: menuOpen }" aria-label="Navigation principale">
        <RouterLink to="/#paniers" class="nav-anchor">Nos paniers</RouterLink>
        <RouterLink to="/produits">À la carte</RouterLink>
        <RouterLink to="/comment-ca-marche">Comment ça marche</RouterLink>
        <RouterLink to="/a-propos">À propos</RouterLink>
        <RouterLink to="/contact">Contact</RouterLink>
        <RouterLink to="/composer" class="nav-compose">Composer mon panier</RouterLink>
        <RouterLink :to="auth.state.customer ? '/compte' : '/compte/connexion'" class="nav-account">
          {{ auth.state.customer ? "Mon compte" : "Connexion / Mon compte" }}
        </RouterLink>
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
          <span class="account-label">{{ auth.state.customer ? auth.state.customer.name.split(" ")[0] : "Mon compte" }}</span>
        </RouterLink>

        <RouterLink to="/commande" class="cart-link" aria-label="Mon panier">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 4h2.4l2.1 11h9.8l2-8H6.2" />
            <circle cx="9" cy="19.5" r="1.4" />
            <circle cx="17" cy="19.5" r="1.4" />
          </svg>
          <span>Panier</span>
          <span v-if="cart.totalItems.value" class="cart-badge" aria-label="articles dans le panier">{{ cart.totalItems.value }}</span>
        </RouterLink>

        <button
          type="button"
          class="menu-toggle"
          :aria-expanded="menuOpen"
          aria-controls="main-nav"
          aria-label="Menu"
          @click="menuOpen = !menuOpen"
        >
          <span aria-hidden="true">{{ menuOpen ? "✕" : "☰" }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(250, 246, 238, 0.94);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
}

/* Jamais de libellé coupé sur deux lignes dans l'en-tête. */
.site-header :deep(.brand-logo),
nav a,
.account-link,
.cart-link {
  white-space: nowrap;
}

nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: auto;
}

nav a {
  position: relative;
  padding: 8px 9px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  transition: color 150ms ease, background-color 150ms ease;
}

nav a:hover {
  color: var(--green);
  background: rgba(60, 90, 62, 0.08);
}

/* Page courante : soulignement discret. */
nav a.router-link-exact-active:not(.nav-compose):not(.nav-anchor)::after {
  content: "";
  position: absolute;
  left: 9px;
  right: 9px;
  bottom: 2px;
  height: 2px;
  border-radius: 2px;
  background: var(--clay);
}

/* « Composer mon panier » : la fonction phare, mise en avant sans être un bouton plein. */
nav a.nav-compose {
  margin-left: 6px;
  border: 1.5px solid var(--green);
  color: var(--green-dark);
}

nav a.nav-compose:hover,
nav a.nav-compose.router-link-exact-active {
  background: var(--green);
  color: #fff;
}

.nav-account {
  display: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-link,
.cart-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  transition: background-color 150ms ease, color 150ms ease;
}

.account-link {
  width: 40px;
  padding: 0;
  justify-content: center;
  color: var(--text);
}

/* Le prénom n'est lu que par les lecteurs d'écran : l'icône suffit et gagne de la place. */
.account-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.account-link:hover {
  background: rgba(60, 90, 62, 0.08);
  color: var(--green);
}

.cart-link {
  background: var(--green);
  color: #fff;
}

.cart-link:hover {
  background: var(--green-dark);
}

.cart-badge {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--clay-dark);
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
  font-size: 18px;
  cursor: pointer;
  color: var(--text);
}

/* Écrans moyens : tout ne tient plus sur une ligne, on passe au menu déroulant. */
@media (max-width: 1200px) {
  .menu-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .site-header-inner {
    position: relative;
    gap: 12px;
  }

  nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    margin: 0;
    padding: 6px 0;
    background: var(--cream);
    border: 1px solid var(--line);
    border-radius: 0 0 14px 14px;
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.1);
  }

  nav.open {
    display: flex;
  }

  nav a {
    padding: 14px 20px;
    border-radius: 0;
    font-size: 15px;
  }

  nav a.router-link-exact-active:not(.nav-compose):not(.nav-anchor)::after {
    left: 20px;
    right: auto;
    width: 28px;
    bottom: 8px;
  }

  nav a.nav-compose {
    margin: 8px 16px;
    justify-content: center;
    text-align: center;
    border-radius: 10px;
  }

  nav .nav-account {
    display: block;
    border-top: 1px solid var(--line);
  }

  .account-link {
    display: none;
  }

  .header-actions {
    margin-left: auto;
  }
}

@media (max-width: 480px) {
  .cart-link span:not(.cart-badge) {
    display: none;
  }

  .cart-link {
    width: 40px;
    padding: 0;
    justify-content: center;
  }
}
</style>
