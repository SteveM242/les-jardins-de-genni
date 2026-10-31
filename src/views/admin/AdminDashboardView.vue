<script setup>
import { computed, onMounted, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";

const orders = ref([]);
const loading = ref(true);
const activeFilter = ref("all");

const statuses = [
  { value: "nouvelle", label: "Nouvelle" },
  { value: "confirmee", label: "Confirmée" },
  { value: "prete", label: "Prête" },
  { value: "livree", label: "Livrée" },
  { value: "annulee", label: "Annulée" }
];

const statusLabels = Object.fromEntries(statuses.map((s) => [s.value, s.label]));

const nextStatus = {
  nouvelle: { value: "confirmee", label: "Confirmer" },
  confirmee: { value: "prete", label: "Marquer prête" },
  prete: { value: "livree", label: "Marquer livrée" }
};

async function loadOrders() {
  loading.value = true;
  const res = await fetch("/api/admin/orders");
  if (res.ok) {
    const data = await res.json();
    orders.value = data.orders || [];
  }
  loading.value = false;
}

async function updateStatus(order, status) {
  const res = await fetch(`/api/admin/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  if (res.ok) {
    const data = await res.json();
    order.status = data.order.status;
  }
}

const counts = computed(() => {
  const c = { all: orders.value.length };
  for (const s of statuses) c[s.value] = orders.value.filter((o) => o.status === s.value).length;
  return c;
});

const filteredOrders = computed(() => {
  if (activeFilter.value === "all") return orders.value;
  return orders.value.filter((o) => o.status === activeFilter.value);
});

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

onMounted(loadOrders);
</script>

<template>
  <AdminNav>
    <h1>Commandes</h1>

    <div class="filters">
      <button
        type="button"
        class="filter-chip"
        :class="{ active: activeFilter === 'all' }"
        @click="activeFilter = 'all'"
      >
        Toutes ({{ counts.all || 0 }})
      </button>
      <button
        v-for="s in statuses"
        :key="s.value"
        type="button"
        class="filter-chip"
        :class="[`status-${s.value}`, { active: activeFilter === s.value }]"
        @click="activeFilter = s.value"
      >
        {{ s.label }} ({{ counts[s.value] || 0 }})
      </button>
    </div>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="orders.length === 0">Aucune commande pour le moment.</p>
    <p v-else-if="filteredOrders.length === 0" class="empty-filter">Aucune commande avec ce statut.</p>

    <div v-else class="orders-list">
      <article v-for="order in filteredOrders" :key="order.id" class="order-card" :class="{ 'is-new': order.status === 'nouvelle' }">
        <div class="order-header">
          <div>
            <strong class="order-number">Commande {{ order.order_number }}</strong>
            <span class="order-date">{{ formatDate(order.created_at) }}</span>
          </div>
          <span class="status-badge" :class="`status-${order.status}`">{{ statusLabels[order.status] }}</span>
        </div>

        <div class="order-body">
          <div class="order-col">
            <p class="col-label">Client</p>
            <p>{{ order.name }}</p>
            <p class="muted">{{ order.phone }}</p>
            <p v-if="order.email" class="muted">{{ order.email }}</p>
          </div>

          <div class="order-col">
            <p class="col-label">Articles</p>
            <p v-for="item in order.items" :key="item.slug">{{ item.qty }} x {{ item.name }}</p>
            <p v-if="order.discount_code" class="discount-note">
              Code {{ order.discount_code }} (-{{ order.discount_amount }} €)
            </p>
          </div>

          <div class="order-col">
            <p class="col-label">{{ order.fulfillment === "livraison" ? "Livraison" : "Retrait" }}</p>
            <p v-if="order.fulfillment === 'livraison' && order.address">{{ order.address }}</p>
            <p v-if="order.notes" class="notes">{{ order.notes }}</p>
          </div>

          <div class="order-col total-col">
            <p class="col-label">Total</p>
            <p class="total-amount">{{ order.total }} €</p>
          </div>
        </div>

        <div class="order-footer">
          <select :value="order.status" @change="updateStatus(order, $event.target.value)">
            <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <button
            v-if="nextStatus[order.status]"
            type="button"
            class="btn primary"
            @click="updateStatus(order, nextStatus[order.status].value)"
          >
            {{ nextStatus[order.status].label }} →
          </button>
        </div>
      </article>
    </div>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 20px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.filter-chip {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  background: #fff;
  color: var(--text);
  cursor: pointer;
}

.filter-chip.active {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}

.empty-filter {
  color: var(--muted);
}

.orders-list {
  display: grid;
  gap: 14px;
}

.order-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
  border-left: 4px solid var(--line);
}

.order-card.is-new {
  border-left-color: var(--clay);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.order-number {
  font-size: 15px;
}

.order-date {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.status-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--cream-deep);
  color: var(--text);
  white-space: nowrap;
}

.status-badge.status-nouvelle,
.filter-chip.status-nouvelle:not(.active) {
  background: #fcebd9;
  color: #a3621b;
}

.status-badge.status-confirmee,
.filter-chip.status-confirmee:not(.active) {
  background: #dfe8f5;
  color: #2d5591;
}

.status-badge.status-prete,
.filter-chip.status-prete:not(.active) {
  background: #e6dff5;
  color: #5c3d91;
}

.status-badge.status-livree,
.filter-chip.status-livree:not(.active) {
  background: #dcebdc;
  color: var(--green-dark);
}

.status-badge.status-annulee,
.filter-chip.status-annulee:not(.active) {
  background: #f2dede;
  color: #a3372e;
}

.order-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.order-col p {
  margin: 0 0 2px;
  font-size: 14px;
}

.col-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 6px !important;
}

.muted {
  color: var(--muted);
  font-size: 13px;
}

.discount-note {
  color: var(--green-dark);
  font-size: 12px;
  font-weight: 600;
  margin-top: 6px !important;
}

.notes {
  font-style: italic;
  color: var(--muted);
  font-size: 13px;
}

.total-col {
  text-align: right;
}

.total-amount {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.order-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
}

.order-footer select {
  font: inherit;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
}

.order-footer .btn {
  padding: 9px 16px;
  font-size: 13px;
}

@media (max-width: 760px) {
  .total-col {
    text-align: left;
  }
}
</style>
