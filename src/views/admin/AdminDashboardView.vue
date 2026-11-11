<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import CartLineContents from "../../components/CartLineContents.vue";
import { api } from "../../api.js";
import { customerWhatsappLink } from "../../data/site.js";
import { useToast } from "../../stores/toast.js";
import { useSiteContent } from "../../stores/siteContent.js";
import { formatOrderCode } from "../../utils/orderCode.js";

const toast = useToast();
const siteContent = useSiteContent();
// Session de vente en cours (réglable dans « Contenu du site »).
const sales = computed(() => siteContent.state.sales);

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

// ---------- À prévenir : commandes prêtes dont le client n'a pas encore été averti ----------
const toNotify = ref([]);

async function loadToNotify() {
  const res = await api("/api/admin/orders/to-notify");
  if (res.ok) toNotify.value = res.data.orders;
}

function readyMessage(order) {
  const day = order.desired_date ? ` le ${formatDay(String(order.desired_date).slice(0, 10))}` : "";
  return `Bonjour ${order.name}, votre commande est prête${day}. Code de retrait : ${formatOrderCode(order.order_number)}. Total à régler : ${order.total} €. L'Héritage des Mornes`;
}

// Le clic ouvre WhatsApp ; la commande est notée « prévenue » pour ne plus apparaître dans la liste.
async function markNotified(order) {
  const res = await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body: { notified: true } });
  if (res.ok) toNotify.value = toNotify.value.filter((entry) => entry.id !== order.id);
}

// ---------- Clôture de la semaine ----------
const closing = ref(false);

async function closeSession() {
  const summary = await api("/api/admin/orders/session-summary");
  if (!summary.ok) return toast.error(summary.error);
  const s = summary.data;
  const lines = [
    "Clôturer la semaine ?",
    "",
    `• ${s.notRetrieved} commande(s) « prête(s) » dont le retrait est passé seront marquées « Non retirées ».`,
    `• ${s.soldOutProducts} article(s) en rupture seront remis en stock (les ruptures des paniers aussi).`
  ];
  if (s.unfinished) lines.push("", `Attention : ${s.unfinished} commande(s) du retrait passé ne sont pas terminées (nouvelle ou confirmée) : elles ne changent pas.`);
  if (!confirm(lines.join(String.fromCharCode(10)))) return;
  closing.value = true;
  const res = await api("/api/admin/orders/close-session", { method: "POST" });
  closing.value = false;
  if (!res.ok) return toast.error(res.error);
  toast.success(`Semaine clôturée : ${res.data.notRetrieved} non retirée(s), ${res.data.restocked} article(s) remis en stock.`);
  await loadOrders({ silent: true });
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

// ---------- Retrait : servir une commande à partir de son code ----------
const pickupCode = ref("");
const pickupOrder = ref(null);
const pickupError = ref("");
const pickupLoading = ref(false);

async function findByCode() {
  const code = pickupCode.value.trim();
  if (!code) return;
  pickupLoading.value = true;
  pickupError.value = "";
  pickupOrder.value = null;
  collected.value = true;
  const res = await api(`/api/admin/orders/code/${encodeURIComponent(code)}`);
  pickupLoading.value = false;
  if (res.ok) pickupOrder.value = res.data.order;
  else pickupError.value = res.error || "Code introuvable.";
}

// Case « encaissé » cochée par défaut : la remise sert aussi à noter le paiement.
const collected = ref(true);

async function handOver() {
  const order = pickupOrder.value;
  const body = { status: "livree" };
  if (!order.paid && collected.value) body.paid = true;
  const res = await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body });
  if (!res.ok) {
    toast.error(res.error);
    return;
  }
  toast.success(`Commande ${formatOrderCode(order.order_number)} remise à ${order.name}.`);
  pickupOrder.value = res.data.order;
  await loadOrders({ silent: true });
}

function clearPickup() {
  pickupCode.value = "";
  pickupOrder.value = null;
  pickupError.value = "";
}

const orders = ref([]);
const counts = ref({ all: 0 });
const total = ref(0);
const pageSize = ref(20);
const page = ref(1);
const loading = ref(true);
const loadError = ref("");
const activeFilter = ref("all");
const unpaidOnly = ref(false);
const exportFrom = ref("");
const exportTo = ref("");
const search = ref("");

const statuses = [
  { value: "nouvelle", label: "Nouvelle" },
  { value: "confirmee", label: "Confirmée" },
  { value: "prete", label: "Prête" },
  { value: "livree", label: "Livrée" },
  { value: "non_retiree", label: "Non retirée" },
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
  if (unpaidOnly.value) params.set("paid", "0");

  const res = await api(`/api/admin/orders?${params}`);
  if (res.ok) {
    loadToNotify();
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
  toast.success(`Commande ${formatOrderCode(order.order_number)} : ${statusLabels[status].toLowerCase()}.`);
  // La commande peut sortir du filtre actif et les compteurs changent : on recharge.
  await loadOrders({ silent: true });
}

async function togglePaid(order) {
  const res = await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body: { paid: !order.paid } });
  if (!res.ok) {
    toast.error(res.error);
    return;
  }
  toast.success(res.data.order.paid ? `Commande ${formatOrderCode(order.order_number)} : payée.` : `Commande ${formatOrderCode(order.order_number)} : paiement retiré.`);
  await loadOrders({ silent: true });
}

// « Prête » mais le jour de retrait est passé : probablement non retirée.
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function isOverdue(order) {
  return order.status === "prete" && Boolean(order.desired_date) && String(order.desired_date).slice(0, 10) < todayIso();
}

// Message WhatsApp adapté à l'étape : « prête » donne le code, le jour et le montant.
function whatsappText(order) {
  const code = formatOrderCode(order.order_number);
  if (order.status === "prete") {
    const day = order.desired_date ? ` le ${formatDay(String(order.desired_date).slice(0, 10))}` : "";
    return `Bonjour ${order.name}, votre commande est prête${day}. Code de retrait : ${code}. Total à régler : ${order.total} €. L'Héritage des Mornes`;
  }
  if (order.status === "non_retiree") {
    return `Bonjour ${order.name}, votre commande (code ${code}) n'a pas été retirée. Pouvons-nous convenir d'un autre moment ? L'Héritage des Mornes`;
  }
  return `Bonjour ${order.name}, c'est L'Héritage des Mornes à propos de votre commande (code ${code}).`;
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

watch([activeFilter, unpaidOnly], () => {
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

    <p v-if="sales" class="sales-pill" :class="sales.open ? 'open' : 'closed'" role="status">
      <span class="dot" aria-hidden="true"></span>
      <strong>{{ sales.open ? "Vente ouverte" : "Vente fermée" }}</strong>
      <span v-if="sales.mode !== 'auto'"> (mode manuel)</span>
      · retrait le {{ formatDay(sales.pickupDate) }}
      <RouterLink :to="{ path: '/admin/contenu', hash: '#sales' }">Modifier</RouterLink>
      <button type="button" class="btn ghost compact-btn" :disabled="closing" @click="closeSession">Clôturer la semaine</button>
      <RouterLink to="/admin/preparation" class="pill-link">Liste de préparation →</RouterLink>
    </p>

    <section v-if="toNotify.length" class="notify" aria-labelledby="notify-title">
      <h2 id="notify-title">📣 À prévenir ({{ toNotify.length }})</h2>
      <p class="muted">Commandes prêtes dont le client n'a pas encore été averti. Un clic ouvre WhatsApp avec le message prêt à envoyer.</p>
      <ul>
        <li v-for="order in toNotify" :key="order.id">
          <span><strong>{{ order.name }}</strong> · {{ formatOrderCode(order.order_number) }} · {{ order.total }} €</span>
          <a
            :href="customerWhatsappLink(order.phone, readyMessage(order))"
            target="_blank"
            rel="noreferrer"
            class="btn ghost whatsapp-link"
            @click="markNotified(order)"
          >
            Prévenir sur WhatsApp
          </a>
        </li>
      </ul>
    </section>

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

    <section v-if="stats?.insights" class="insights" aria-label="Indicateurs sur 90 jours">
      <div class="stat">
        <span class="stat-label">Clients fidèles (90 j)</span>
        <strong>{{ stats.insights.returningRate ?? "–" }}{{ stats.insights.returningRate != null ? " %" : "" }}</strong>
        <span class="stat-sub">{{ stats.insights.returningCustomers }} sur {{ stats.insights.customers }} ont commandé 2 fois ou plus</span>
      </div>
      <div class="stat">
        <span class="stat-label">Retrait effectif</span>
        <strong>{{ stats.insights.pickupRate ?? "–" }}{{ stats.insights.pickupRate != null ? " %" : "" }}</strong>
        <span class="stat-sub">commandes retirées parmi celles terminées</span>
      </div>
      <div class="stat stat-top">
        <span class="stat-label">Paniers les plus vendus (30 j)</span>
        <ol v-if="stats.insights.topBaskets.length">
          <li v-for="basket in stats.insights.topBaskets.slice(0, 3)" :key="basket.name">{{ basket.qty }} × {{ basket.name }}</li>
        </ol>
        <span v-else class="stat-sub">Pas encore de panier vendu</span>
      </div>
      <div class="stat stat-top">
        <span class="stat-label">Dernières sessions</span>
        <ol v-if="stats.insights.sessions.length">
          <li v-for="session in stats.insights.sessions.slice(0, 4)" :key="session.day">
            {{ formatDay(session.day) }} : {{ session.orders }} cmd · {{ formatEuros(session.revenue) }}
          </li>
        </ol>
        <span v-else class="stat-sub">Pas encore de session</span>
      </div>
    </section>

    <section class="pickup" aria-labelledby="pickup-title">
      <h2 id="pickup-title">Servir une commande (retrait)</h2>
      <p class="pickup-help">Le client donne son code : tapez-le pour retrouver sa commande et le servir.</p>
      <form class="pickup-form" @submit.prevent="findByCode">
        <input
          v-model="pickupCode"
          type="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="Code : K7M-4QH"
          aria-label="Code de commande du client"
        />
        <button type="submit" class="btn primary" :disabled="pickupLoading || !pickupCode.trim()">Retrouver</button>
        <button v-if="pickupCode || pickupOrder" type="button" class="btn ghost" @click="clearPickup">Effacer</button>
      </form>
      <p v-if="pickupError" class="pickup-error" role="alert">{{ pickupError }}</p>

      <article v-if="pickupOrder" class="pickup-result" :class="`is-${pickupOrder.status}`">
        <div class="pickup-result-head">
          <div>
            <strong class="pickup-name">{{ pickupOrder.name }}</strong>
            <span class="pickup-code">Code {{ formatOrderCode(pickupOrder.order_number) }}</span>
          </div>
          <span class="status-badge" :class="`status-${pickupOrder.status}`">{{ statusLabels[pickupOrder.status] }}</span>
        </div>
        <p class="muted">
          <a :href="`tel:${pickupOrder.phone}`">{{ pickupOrder.phone }}</a>
          <template v-if="pickupOrder.email"> · {{ pickupOrder.email }}</template>
          · {{ pickupOrder.fulfillment === "livraison" ? "Livraison" : "Retrait" }}
        </p>
        <p v-if="pickupOrder.fulfillment === 'livraison' && pickupOrder.address" class="muted">{{ pickupOrder.address }}</p>
        <div v-for="(item, index) in pickupOrder.items" :key="index" class="order-line">
          <p><strong>{{ item.qty }} x {{ item.name }}</strong></p>
          <CartLineContents :line="item" open />
        </div>
        <p v-if="pickupOrder.notes" class="notes">{{ pickupOrder.notes }}</p>
        <p class="pickup-total">
          <template v-if="pickupOrder.paid">Déjà payée : <strong>{{ pickupOrder.total }} €</strong> ✓</template>
          <template v-else>À encaisser : <strong>{{ pickupOrder.total }} €</strong></template>
        </p>

        <p v-if="pickupOrder.status === 'livree'" class="pickup-warn">Cette commande a déjà été remise.</p>
        <p v-else-if="pickupOrder.status === 'annulee'" class="pickup-warn">Cette commande a été annulée : ne pas servir.</p>
        <template v-else>
          <p v-if="pickupOrder.status !== 'prete'" class="pickup-warn">
            Cette commande n'est pas encore marquée « Prête » (statut : {{ statusLabels[pickupOrder.status] }}).
          </p>
          <label v-if="!pickupOrder.paid" class="collect-check">
            <input v-model="collected" type="checkbox" /> J'ai encaissé {{ pickupOrder.total }} €
          </label>
          <p v-if="!pickupOrder.paid && !collected" class="pickup-warn">Le paiement restera noté « à encaisser ».</p>
          <button type="button" class="btn primary" @click="handOver">✓ Remettre la commande</button>
        </template>
      </article>
    </section>

    <label class="search-field">
      <span class="sr-only">Rechercher une commande</span>
      <input v-model="search" type="search" placeholder="Rechercher : code de commande, nom, téléphone, email" />
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
      <button type="button" class="filter-chip" :class="{ active: unpaidOnly }" :aria-pressed="unpaidOnly" @click="unpaidOnly = !unpaidOnly">
        💶 À encaisser
      </button>
    </div>

    <details class="export-box">
      <summary>Exporter les commandes (CSV pour la comptabilité)</summary>
      <form class="export-form" method="get" action="/api/admin/orders/export.csv">
        <label>Du <input v-model="exportFrom" type="date" name="from" /></label>
        <label>Au <input v-model="exportTo" type="date" name="to" /></label>
        <label>
          Statut
          <select name="status">
            <option value="">Tous</option>
            <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
        <button type="submit" class="btn ghost">Télécharger</button>
      </form>
    </details>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="loadOrders" />
    <p v-else-if="orders.length === 0" class="empty-filter">
      {{ search || activeFilter !== "all" || unpaidOnly ? "Aucune commande ne correspond à ce filtre." : "Aucune commande pour le moment." }}
    </p>

    <div v-else class="orders-list">
      <article v-for="order in orders" :key="order.id" class="order-card" :class="{ 'is-new': order.status === 'nouvelle', 'is-overdue': isOverdue(order) }">
        <div class="order-header">
          <div>
            <strong class="order-number">Code {{ formatOrderCode(order.order_number) }}</strong>
            <span class="order-date">{{ formatDate(order.created_at) }}</span>
          </div>
          <span class="badges">
            <span v-if="isOverdue(order)" class="status-badge status-overdue">Retrait passé : non retirée ?</span>
            <span class="status-badge" :class="order.paid ? 'paid' : 'unpaid'">{{ order.paid ? "Payée" : "À encaisser" }}</span>
            <span class="status-badge" :class="`status-${order.status}`">{{ statusLabels[order.status] }}</span>
          </span>
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
            <p v-if="order.desired_date" class="desired">{{ order.fulfillment === "livraison" ? "Livraison" : "Retrait" }} : {{ formatDay(order.desired_date) }}</p>
            <p v-if="order.notes" class="notes">{{ order.notes }}</p>
          </div>

          <div class="order-col total-col">
            <p class="col-label">Total</p>
            <p class="total-amount">{{ order.total }} €</p>
          </div>
        </div>

        <div class="order-footer">
          <a
            :href="customerWhatsappLink(order.phone, whatsappText(order))"
            target="_blank"
            rel="noreferrer"
            class="btn ghost whatsapp-link"
          >
            Écrire sur WhatsApp
          </a>
          <select
            :value="order.status"
            :aria-label="`Statut de la commande ${formatOrderCode(order.order_number)}`"
            @change="updateStatus(order, $event.target.value)"
          >
            <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <button type="button" class="btn ghost" @click="togglePaid(order)">
            {{ order.paid ? "Retirer le paiement" : "💶 Marquer payée" }}
          </button>
          <button v-if="isOverdue(order)" type="button" class="btn ghost" @click="updateStatus(order, 'non_retiree')">Marquer non retirée</button>
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
.pickup {
  background: #fff;
  border: 2px solid var(--brand);
  border-radius: 16px;
  padding: 18px 20px 20px;
  margin-bottom: 24px;
}

.pickup h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.pickup-help {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 14px;
}

.pickup-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pickup-form input {
  flex: 1 1 200px;
  font: inherit;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 10px 14px;
  border: 1.5px solid var(--line);
  border-radius: 12px;
}

.pickup-error {
  margin: 12px 0 0;
  color: var(--hibiscus);
  font-weight: 600;
}

.pickup-result {
  margin-top: 16px;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-tint);
}

.pickup-result.is-annulee {
  background: #fdecee;
  border-color: #f4c3c8;
}

.pickup-result-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 6px;
}

.pickup-name {
  display: block;
  font-size: 20px;
}

.pickup-code {
  color: var(--muted);
  font-size: 13px;
}

.pickup-total {
  margin: 12px 0;
  font-size: 18px;
}

.pickup-warn {
  margin: 0 0 12px;
  font-weight: 600;
  color: var(--clay-dark);
}
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
  border-color: var(--brand);
  background: var(--brand-tint);
  color: var(--brand-dark);
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
  color: var(--brand-dark);
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
  background: var(--brand-tint);
  color: var(--brand-dark);
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
  background: var(--brand);
  border-color: var(--brand);
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
  background: var(--ok-soft);
  color: var(--ok);
}

.status-badge.status-livree,
.filter-chip.status-livree:not(.active) {
  background: var(--ok-soft);
  color: var(--ok);
}

.status-badge.status-non_retiree,
.filter-chip.status-non_retiree:not(.active),
.status-badge.status-overdue {
  background: #fdebd0;
  color: #8a4b08;
}

.compact-btn {
  padding: 7px 14px;
  font-size: 13px;
}

.notify {
  margin: 0 0 20px;
  padding: 16px 18px;
  border-radius: 14px;
  background: #fff;
  border: 2px solid var(--clay);
}

.notify h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.notify .muted {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--muted);
}

.notify ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.notify li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
  font-size: 14px;
}

.insights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 0 0 20px;
}

.status-badge.paid {
  background: var(--ok-soft);
  color: var(--ok);
}

.status-badge.unpaid {
  background: #fdf0e6;
  color: #8a4b08;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.order-card.is-overdue {
  border-color: #e0a15a;
}

.sales-pill {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
}

.sales-pill.open {
  background: var(--ok-soft);
}

.sales-pill.closed {
  background: #fdf0e6;
}

.sales-pill .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
}

.pill-link {
  margin-left: auto;
  font-weight: 700;
}

.collect-check {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
  font-weight: 600;
}

.export-box {
  margin: 0 0 14px;
  font-size: 14px;
}

.export-box summary {
  cursor: pointer;
  font-weight: 600;
}

.export-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  margin-top: 8px;
}

.export-form label {
  display: grid;
  gap: 2px;
  font-size: 12px;
}

.export-form input,
.export-form select {
  font: inherit;
  padding: 6px 8px;
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
  color: var(--brand-dark);
  font-size: 12px;
  font-weight: 600;
  margin-top: 6px !important;
}

.desired {
  font-weight: 700;
  color: var(--brand-dark);
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
