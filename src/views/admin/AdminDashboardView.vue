<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import CartLineContents from "../../components/CartLineContents.vue";
import { api } from "../../api.js";
import { customerWhatsappLink } from "../../data/site.js";
import { useToast } from "../../stores/toast.js";

const toast = useToast();

// « À compléter » : ce qu'il manque avant d'annoncer le site (coordonnées, présentation, mentions légales…).
const todo = ref([]);

async function loadChecklist() {
  const res = await api("/api/admin/settings/all");
  if (!res.ok) return;
  const { contact, about, legal, checkout, socials } = res.data;
  const items = [];
  if (!Object.values(socials).some(Boolean)) items.push({ label: "Vos réseaux sociaux (Instagram, TikTok…)", hash: "#socials" });
  if (!contact.whatsapp) items.push({ label: "Votre numéro WhatsApp", hash: "#contact" });
  if (!contact.email) items.push({ label: "Votre email de contact", hash: "#contact" });
  if (!about.text) items.push({ label: "Le texte de la page « À propos »", hash: "#about" });
  if (!checkout.pickupInfo && !checkout.deliveryInfo) items.push({ label: "Les infos de retrait et de livraison", hash: "#checkout" });
  if (!legal.companyName || !legal.address) items.push({ label: "Les mentions légales (nom, adresse, SIRET)", hash: "#legal" });
  todo.value = items;
}

// ---------- Chiffres ----------
const stats = ref(null);

async function loadStats() {
  const res = await api("/api/admin/stats");
  if (res.ok) stats.value = res.data;
}

function formatEuros(value) {
  return `${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

// ---------- Alerte de nouvelle commande (son, notification, compteur dans l'onglet) ----------
const SOUND_KEY = "heritage-order-sound";

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

const soundOn = ref(readSound());
let audioContext = null;
let knownNew = null;

// Deux notes courtes. Le navigateur n'autorise le son qu'après un clic : d'où le bouton d'activation.
function beep() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((frequency, index) => {
      const start = audioContext.currentTime + index * 0.22;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
    });
  } catch {
    // audio indisponible : l'alerte visuelle suffit
  }
}

function toggleSound() {
  soundOn.value = !soundOn.value;
  try {
    localStorage.setItem(SOUND_KEY, soundOn.value ? "1" : "0");
  } catch {
    // sans importance
  }
  if (soundOn.value) beep();
}

function handleNewCount(count) {
  if (knownNew !== null && count > knownNew) {
    const added = count - knownNew;
    toast.success(`${added} nouvelle${added > 1 ? "s" : ""} commande${added > 1 ? "s" : ""} !`);
    if (soundOn.value) beep();
  }
  knownNew = count;
  document.title = count > 0 ? `(${count}) Commandes à traiter — Espace pro` : "Espace pro — L'Héritage des Mornes";
}

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
    handleNewCount(res.data.counts.nouvelle || 0);
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

function formatDay(day) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
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
  loadChecklist();
  loadStats();
  loadOrders();
  refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible") {
      loadOrders({ silent: true });
      loadStats();
    }
  }, 30000);
});

onBeforeUnmount(() => {
  clearInterval(refreshTimer);
  clearTimeout(searchTimer);
});
</script>

<template>
  <AdminNav>
    <div class="dash-head">
      <h1>Commandes</h1>
      <button type="button" class="sound-toggle" :aria-pressed="soundOn" @click="toggleSound">
        {{ soundOn ? "🔔 Alerte sonore activée" : "🔕 Activer l'alerte sonore" }}
      </button>
    </div>

    <aside v-if="todo.length" class="todo" aria-label="À compléter">
      <strong>À compléter avant d'annoncer le site :</strong>
      <ul>
        <li v-for="item in todo" :key="item.label">
          <RouterLink :to="{ path: '/admin/contenu', hash: item.hash }">{{ item.label }}</RouterLink>
        </li>
      </ul>
    </aside>

    <section v-if="stats" class="stats" aria-label="Chiffres clés">
      <div class="stat">
        <span class="stat-label">À traiter</span>
        <strong>{{ counts.nouvelle || 0 }}</strong>
        <span class="stat-sub">nouvelle{{ (counts.nouvelle || 0) > 1 ? "s" : "" }} commande{{ (counts.nouvelle || 0) > 1 ? "s" : "" }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">7 derniers jours</span>
        <strong>{{ formatEuros(stats.week.revenue) }}</strong>
        <span class="stat-sub">{{ stats.week.orders }} commande{{ stats.week.orders > 1 ? "s" : "" }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">30 derniers jours</span>
        <strong>{{ formatEuros(stats.month.revenue) }}</strong>
        <span class="stat-sub">{{ stats.month.orders }} commande{{ stats.month.orders > 1 ? "s" : "" }}</span>
      </div>
      <div class="stat stat-top">
        <span class="stat-label">Les plus commandés (30 jours)</span>
        <ol v-if="stats.top.length">
          <li v-for="item in stats.top.slice(0, 3)" :key="item.name">{{ item.qty }} × {{ item.name }}</li>
        </ol>
        <span v-else class="stat-sub">Pas encore de commande</span>
      </div>
    </section>

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
            <div v-for="(item, index) in order.items" :key="index" class="order-line">
              <p>
                <strong>{{ item.qty }} x {{ item.name }}</strong>
                <span v-if="item.type === 'custom'" class="line-tag">Sur mesure</span>
              </p>
              <CartLineContents :line="item" open />
            </div>
            <p v-if="order.discount_code" class="discount-note">
              Code {{ order.discount_code }} (-{{ order.discount_amount }} €)
            </p>
          </div>

          <div class="order-col">
            <p class="col-label">{{ order.fulfillment === "livraison" ? "Livraison" : "Retrait" }}</p>
            <p v-if="order.fulfillment === 'livraison' && order.address">{{ order.address }}</p>
            <p v-if="order.desired_date" class="desired">Jour souhaité : {{ formatDay(order.desired_date) }}</p>
            <p v-if="order.notes" class="notes">{{ order.notes }}</p>
          </div>

          <div class="order-col total-col">
            <p class="col-label">Total</p>
            <p class="total-amount">{{ order.total }} €</p>
          </div>
        </div>

        <div class="order-footer">
          <a
            :href="customerWhatsappLink(order.phone, `Bonjour ${order.name}, c'est L'Héritage des Mornes à propos de votre commande ${order.order_number}.`)"
            target="_blank"
            rel="noreferrer"
            class="btn ghost whatsapp-link"
          >
            Écrire sur WhatsApp
          </a>
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

.dash-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.dash-head h1 {
  margin: 0;
}

.sound-toggle {
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

.sound-toggle[aria-pressed="true"] {
  border-color: var(--green);
  background: var(--green-tint);
  color: var(--green-dark);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.stat {
  display: grid;
  gap: 2px;
  align-content: start;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
}

.stat-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.stat strong {
  font-family: "Fraunces", Georgia, serif;
  font-size: 28px;
  color: var(--green-dark);
}

.stat-sub {
  font-size: 13px;
  color: var(--muted);
}

.stat-top ol {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 14px;
}

.todo {
  margin-bottom: 20px;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid #f0d06a;
  background: #fff6d6;
  color: #664400;
  font-size: 14px;
}

.todo ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.todo a {
  color: inherit;
  font-weight: 600;
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

.order-line {
  margin-bottom: 8px;
}

.line-tag {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e4f2e7;
  color: var(--green-dark);
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
  background: #fdeec2;
  color: #6e4a00;
}

.status-badge.status-confirmee,
.filter-chip.status-confirmee:not(.active) {
  background: #d6eef2;
  color: #0b6072;
}

.status-badge.status-prete,
.filter-chip.status-prete:not(.active) {
  background: #def2d2;
  color: #2a6410;
}

.status-badge.status-livree,
.filter-chip.status-livree:not(.active) {
  background: #c6e8d0;
  color: var(--green-dark);
}

.status-badge.status-annulee,
.filter-chip.status-annulee:not(.active) {
  background: #fbe0e2;
  color: #a3202a;
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

.desired {
  font-weight: 700;
  color: var(--green-dark);
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

.order-footer .whatsapp-link {
  margin-right: auto;
}

@media (max-width: 760px) {
  .total-col {
    text-align: left;
  }
}
</style>
