<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../../stores/auth.js";

const router = useRouter();
const auth = useAuth();
const orders = ref([]);
const loading = ref(true);

async function logout() {
  await auth.logout();
  router.push("/");
}

onMounted(async () => {
  const res = await fetch("/api/account/orders");
  if (res.ok) {
    const data = await res.json();
    orders.value = data.orders || [];
  }
  loading.value = false;
});

const statusLabels = {
  nouvelle: "Nouvelle",
  confirmee: "Confirmée",
  prete: "Prête",
  livree: "Livrée",
  annulee: "Annulée"
};
</script>

<template>
  <div class="account-page">
    <div class="container">
      <div class="account-header">
        <div>
          <p class="eyebrow">Mon compte</p>
          <h1>Bonjour {{ auth.state.customer?.name }}</h1>
        </div>
        <button type="button" class="btn ghost" @click="logout">Se déconnecter</button>
      </div>

      <h2>Mes commandes</h2>

      <p v-if="loading" class="muted">Chargement…</p>
      <p v-else-if="orders.length === 0" class="muted">Vous n'avez pas encore passé de commande.</p>

      <div v-else class="orders-list">
        <div v-for="order in orders" :key="order.order_number" class="order-row">
          <div class="order-row-head">
            <strong>Commande {{ order.order_number }}</strong>
            <span class="status-badge" :class="`status-${order.status}`">{{ statusLabels[order.status] || order.status }}</span>
          </div>
          <p class="order-items">
            <span v-for="(item, index) in order.items" :key="item.slug">
              {{ item.qty }} x {{ item.name }}<span v-if="index < order.items.length - 1">, </span>
            </span>
          </p>
          <p class="order-meta">
            {{ order.fulfillment === "livraison" ? "Livraison" : "Retrait" }} · Total {{ order.total }} €
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  padding: 56px 0 80px;
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  flex-wrap: wrap;
  gap: 16px;
}

h1 {
  font-size: 28px;
  margin: 4px 0 0;
}

h2 {
  font-size: 18px;
  margin: 0 0 18px;
}

.muted {
  color: var(--muted);
}

.orders-list {
  display: grid;
  gap: 14px;
}

.order-row {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
}

.order-row-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--cream-deep);
  color: var(--text);
}

.status-livree {
  background: #dcebdc;
  color: var(--green-dark);
}

.status-annulee {
  background: #f2dede;
  color: #a3372e;
}

.order-items {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--text);
}

.order-meta {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
</style>
