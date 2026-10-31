<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../api.js";
import { useAuth } from "../../stores/auth.js";
import BackLink from "../../components/BackLink.vue";
import LoadError from "../../components/LoadError.vue";

const router = useRouter();
const auth = useAuth();
const orders = ref([]);
const loading = ref(true);
const loadError = ref("");

async function logout() {
  await auth.logout();
  router.push("/");
}

async function loadOrders() {
  loading.value = true;
  loadError.value = "";
  const res = await api("/api/account/orders");
  if (res.ok) orders.value = res.data.orders || [];
  else loadError.value = res.error;
  loading.value = false;
}

onMounted(loadOrders);

const statusLabels = {
  nouvelle: "Reçue",
  confirmee: "Confirmée",
  prete: "Prête",
  livree: "Terminée",
  annulee: "Annulée"
};

// Frise de suivi : les quatre étapes d'une commande qui se passe bien.
const progressSteps = ["nouvelle", "confirmee", "prete", "livree"];

function progressIndex(status) {
  return progressSteps.indexOf(status);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
</script>

<template>
  <div class="account-page">
    <div class="container">
      <BackLink />
      <div class="account-header">
        <div>
          <p class="eyebrow">Mon compte</p>
          <h1>Bonjour {{ auth.state.customer?.name }}</h1>
        </div>
        <button type="button" class="btn ghost" @click="logout">Se déconnecter</button>
      </div>

      <h2>Mes commandes</h2>

      <p v-if="loading" class="muted">Chargement…</p>
      <LoadError v-else-if="loadError" :message="loadError" @retry="loadOrders" />
      <div v-else-if="orders.length === 0" class="empty">
        <p class="muted">Vous n'avez pas encore passé de commande.</p>
        <RouterLink to="/#paniers" class="btn primary">Découvrir les paniers</RouterLink>
      </div>

      <div v-else class="orders-list">
        <div v-for="order in orders" :key="order.order_number" class="order-row">
          <div class="order-row-head">
            <div>
              <strong>Commande {{ order.order_number }}</strong>
              <span class="order-date">{{ formatDate(order.created_at) }}</span>
            </div>
            <span class="status-badge" :class="`status-${order.status}`">{{ statusLabels[order.status] || order.status }}</span>
          </div>
          <ol v-if="progressIndex(order.status) !== -1" class="progress" :aria-label="`Avancement : ${statusLabels[order.status]}`">
            <li
              v-for="(step, index) in progressSteps"
              :key="step"
              :class="{ reached: index <= progressIndex(order.status) }"
            >
              {{ statusLabels[step] }}
            </li>
          </ol>
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

.order-date {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.empty {
  display: grid;
  gap: 14px;
  justify-items: start;
}

.progress {
  list-style: none;
  display: flex;
  gap: 6px;
  padding: 0;
  margin: 0 0 12px;
}

.progress li {
  flex: 1;
  padding-top: 8px;
  border-top: 4px solid var(--line);
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}

.progress li.reached {
  border-top-color: var(--green);
  color: var(--green-dark);
}

.status-nouvelle {
  background: #fcebd9;
  color: #a3621b;
}

.status-confirmee {
  background: #dfe8f5;
  color: #2d5591;
}

.status-prete {
  background: #e6dff5;
  color: #5c3d91;
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
