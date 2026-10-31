<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import { api } from "../../api.js";
import { useToast } from "../../stores/toast.js";

const toast = useToast();

const orders = ref([]);
const counts = ref({ all: 0 });
const total = ref(0);
const pageSize = ref(20);
const page = ref(1);
const loading = ref(true);
const loadError = ref("");
const activeFilter = ref("all");
const search = ref("");

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

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

// silent : rafraîchissement en arrière-plan, sans écran de chargement ni message d'erreur.
async function loadOrders({ silent = false } = {}) {
  if (!silent) loading.value = true;
  const params = new URLSearchParams({ page: String(page.value) });
  if (activeFilter.value !== "all") params.set("status", activeFilter.value);
  if (search.value.trim()) params.set("q", search.value.trim());

  const res = await api(`/api/admin/orders?${params}`);
  if (res.ok) {
    orders.value = res.data.orders;
    counts.value = res.data.counts;
    total.value = res.data.total;
    pageSize.value = res.data.pageSize;
    loadError.value = "";
  } else if (!silent) {
    loadError.value = res.error;
  }
  loading.value = false;
}

async function updateStatus(order, status) {
  if (status === order.status) return;
  const res = await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body: { status } });
  if (!res.ok) {
    toast.error(res.error);
    await loadOrders({ silent: true });
    return;
  }
  toast.success(`Commande ${order.order_number} : ${statusLabels[status].toLowerCase()}.`);
  // La commande peut sortir du filtre actif et les compteurs changent : on recharge.
  await loadOrders({ silent: true });
}

function goToPage(next) {
  page.value = Math.min(Math.max(1, next), pageCount.value);
  loadOrders();
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

watch(activeFilter, () => {
  page.value = 1;
  loadOrders();
});

let searchTimer = null;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadOrders();
  }, 300);
});

// Les nouvelles commandes apparaissent seules : rafraîchissement discret toutes les minutes.
let refreshTimer = null;
onMounted(() => {
  loadOrders();
  refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible") loadOrders({ silent: true });
  }, 60000);
});

onBeforeUnmount(() => {
  clearInterval(refreshTimer);
  clearTimeout(searchTimer);
});
</script>

<template>
  <AdminNav>
    <h1>Commandes</h1>

    <label class="search-field">
      <span class="sr-only">Rechercher une commande</span>
      <input v-model="search" type="search" placeholder="Rechercher : n° de commande, nom, téléphone, email" />
    </label>

    <div class="filters" role="group" aria-label="Filtrer par statut">
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
    <LoadError v-else-if="loadError" :message="loadError" @retry="loadOrders" />
    <p v-else-if="orders.length === 0" class="empty-filter">
      {{ search || activeFilter !== "all" ? "Aucune commande ne correspond à ce filtre." : "Aucune commande pour le moment." }}
    </p>

    <div v-else class="orders-list">
      <article v-for="order in orders" :key="order.id" class="order-card" :class="{ 'is-new': order.status === 'nouvelle' }">
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
            <p class="muted"><a :href="`tel:${order.phone}`">{{ order.phone }}</a></p>
            <p v-if="order.email" class="muted"><a :href="`mailto:${order.email}`">{{ order.email }}</a></p>
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
          <select
            :value="order.status"
            :aria-label="`Statut de la commande ${order.order_number}`"
            @change="updateStatus(order, $event.target.value)"
          >
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

    <nav v-if="!loading && !loadError && pageCount > 1" class="pagination" aria-label="Pagination des commandes">
      <button type="button" class="btn ghost" :disabled="page <= 1" @click="goToPage(page - 1)">← Précédentes</button>
      <span>Page {{ page }} sur {{ pageCount }} ({{ total }} commandes)</span>
      <button type="button" class="btn ghost" :disabled="page >= pageCount" @click="goToPage(page + 1)">Suivantes →</button>
    </nav>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 20px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.search-field {
  display: block;
  margin-bottom: 14px;
}

.search-field input {
  width: 100%;
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  background: #fff;
}

.muted a {
  color: inherit;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  font-size: 13px;
  color: var(--muted);
}

.pagination .btn {
  padding: 9px 14px;
  font-size: 13px;
}

.pagination .btn:disabled {
  opacity: 0.45;
  cursor: default;
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
  color: #8a4f12;
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
