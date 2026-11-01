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

// Le menu mobile se referme à chaque changement de page.
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
        <RouterLink to="/#paniers">Nos paniers</RouterLink>
        <RouterLink to="/composer">Composer mon panier</RouterLink>
        <RouterLink to="/produits">À la carte</RouterLink>
        <RouterLink to="/comment-ca-marche">Comment ça marche</RouterLink>
        <RouterLink to="/a-propos">À propos</RouterLink>
        <RouterLink to="/contact">Contact</RouterLink>
        <RouterLink :to="auth.state.customer ? '/compte' : '/compte/connexion'" class="nav-account">
          {{ auth.state.customer ? "Mon compte" : "Connexion / Mon compte" }}
        </RouterLink>
      </nav>

      <div class="header-actions">
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
        <RouterLink :to="auth.state.customer ? '/compte' : '/compte/connexion'" class="account-link">
          {{ auth.state.customer ? auth.state.customer.name.split(" ")[0] : "Mon compte" }}
        </RouterLink>
        <RouterLink to="/commande" class="btn primary compact cart-link">
          Panier
          <span v-if="cart.totalItems.value" class="cart-badge">{{ cart.totalItems.value }}</span>
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(250, 246, 238, 0.92);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
}

nav {
  display: flex;
  gap: 24px;
}

nav a {
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}

nav a:hover {
  color: var(--green);
}

.btn.compact {
  padding: 10px 18px;
  font-size: 13px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.account-link {
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}

.account-link:hover {
  color: var(--green);
}

.cart-link {
  position: relative;
}

.cart-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--clay-dark);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-account {
  display: none;
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

@media (max-width: 760px) {
  .menu-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .site-header-inner {
    position: relative;
    gap: 10px;
  }

  nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 0;
    background: var(--cream);
    border: 1px solid var(--line);
    border-radius: 0 0 12px 12px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
  }

  nav.open {
    display: flex;
  }

  nav a {
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
    font-size: 15px;
  }

  nav a:last-child {
    border-bottom: 0;
  }

  nav .nav-account {
    display: block;
  }

  .account-link {
    display: none;
  }
}
</style>
