<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../../api.js";
import { useAuth } from "../../stores/auth.js";
import { useToast } from "../../stores/toast.js";
import PasswordField from "../../components/PasswordField.vue";
import LoadError from "../../components/LoadError.vue";
import CartLineContents from "../../components/CartLineContents.vue";
import { formatOrderCode } from "../../utils/orderCode.js";
import { useCart } from "../../stores/cart.js";
import { useSiteContent } from "../../stores/siteContent.js";
import PickupCode from "../../components/PickupCode.vue";
import { useCatalog } from "../../stores/catalog.js";

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const siteContent = useSiteContent();
const catalog = useCatalog();

// Trois onglets, mémorisés dans l'adresse (?onglet=…) : commandes, informations, sécurité et données.
const TABS = [
  { key: "commandes", label: "Mes commandes" },
  { key: "favoris", label: "Mes favoris" },
  { key: "informations", label: "Mes informations" },
  { key: "securite", label: "Sécurité et données" }
];
const tab = computed(() => (TABS.some((t) => t.key === route.query.onglet) ? route.query.onglet : "commandes"));
function goTab(key) {
  router.replace({ path: "/compte", query: { ...route.query, onglet: key, bienvenue: undefined } });
}
const welcome = ref(route.query.bienvenue === "1");

const sales = computed(() => siteContent.state.sales);
const toast = useToast();
const orders = ref([]);
const cart = useCart();

const profile = reactive({
  name: auth.state.customer?.name || "",
  phone: auth.state.customer?.phone || "",
  address: auth.state.customer?.address || "",
  defaultFulfillment: auth.state.customer?.defaultFulfillment || "retrait",
  reminder: Boolean(auth.state.customer?.reminder),
  addresses: (auth.state.customer?.addresses || []).map((entry) => ({ ...entry }))
});

function addAddress() {
  if (profile.addresses.length >= 5) return toast.error("5 adresses au plus.");
  profile.addresses.push({ label: "", address: "" });
}

// ---------- Favoris : paniers et articles marqués d'un cœur ----------
const favorites = computed(() =>
  (auth.state.customer?.favorites || [])
    .map((fav) => (fav.type === "basket" ? catalog.findBasketBySlug(fav.slug) : catalog.findProductBySlug(fav.slug)))
    .filter(Boolean)
);

function addFavoriteToCart(item) {
  if (item.soldOut) return toast.error("Cet article est en rupture cette semaine.");
  if (item.type === "basket" && item.composition) {
    router.push(`/panier/${item.slug}`);
    return;
  }
  cart.addItem(item, 1);
  toast.success(`« ${item.name} » ajouté au panier.`);
}

async function removeFavorite(item) {
  try {
    await auth.toggleFavorite({ type: item.type, slug: item.slug });
  } catch (err) {
    toast.error(err.message);
  }
}
const profileError = ref("");

// Email non confirmé : les commandes passées sans compte ne sont pas encore rattachées.
const verificationSending = ref(false);

async function resendVerification() {
  verificationSending.value = true;
  const res = await auth.resendVerification();
  verificationSending.value = false;
  if (!res.ok) return toast.error(res.error);
  if (res.data.alreadyVerified) {
    await auth.fetchMe();
    return toast.success("Votre email est déjà confirmé.");
  }
  toast.success(
    res.data.emailSent
      ? "Un nouveau lien vient de vous être envoyé. Pensez à vérifier vos courriers indésirables."
      : "L'envoi d'emails n'est pas disponible pour le moment. Utilisez « Retrouver une commande » ci-dessous."
  );
}

// Retrouver une commande passée sans compte (ou sans email) avec son numéro et son téléphone.
const claim = reactive({ orderNumber: "", phone: "" });
const claimError = ref("");
const claiming = ref(false);

async function claimOrder() {
  claimError.value = "";
  claiming.value = true;
  const res = await auth.claimOrder(claim);
  claiming.value = false;
  if (!res.ok) {
    claimError.value = res.error;
    return;
  }
  toast.success(
    res.data.alreadyYours ? "Cette commande est déjà dans votre compte." : `Commande ${formatOrderCode(res.data.orderNumber)} ajoutée à votre compte.`
  );
  claim.orderNumber = "";
  claim.phone = "";
  await loadOrders();
}
const profileSaving = ref(false);

async function saveProfile() {
  profileError.value = "";
  profileSaving.value = true;
  try {
    await auth.updateProfile(profile);
    toast.success("Vos informations ont été enregistrées.");
  } catch (err) {
    profileError.value = err.message;
  } finally {
    profileSaving.value = false;
  }
}

const passwords = reactive({ current: "", next: "" });
const passwordError = ref("");
const passwordSaving = ref(false);

async function savePassword() {
  passwordError.value = "";
  passwordSaving.value = true;
  try {
    await auth.changePassword({ currentPassword: passwords.current, newPassword: passwords.next });
    passwords.current = "";
    passwords.next = "";
    toast.success("Mot de passe modifié. Vos autres appareils ont été déconnectés.");
  } catch (err) {
    passwordError.value = err.message;
  } finally {
    passwordSaving.value = false;
  }
}
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

// La page « Mon compte » relit le compte : le rappel du lundi et le mode par défaut viennent du serveur.
onMounted(async () => {
  siteContent.load();
  catalog.load();
  const customer = await auth.fetchMe();
  if (customer) {
    profile.defaultFulfillment = customer.defaultFulfillment || "retrait";
    profile.reminder = Boolean(customer.reminder);
    profile.addresses = (customer.addresses || []).map((entry) => ({ ...entry }));
  }
  await loadOrders();
});

// Commande en cours : la plus récente qui n'est pas encore remise, annulée ou non retirée.
const activeOrder = computed(() => orders.value.find((order) => ["nouvelle", "confirmee", "prete"].includes(order.status)) || null);
const lastOrder = computed(() => orders.value[0] || null);

function formatDay(day) {
  return new Date(`${String(day).slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// ---------- Email, suppression du compte ----------
const emailForm = reactive({ email: "", currentPassword: "" });
const emailError = ref("");
const emailSaving = ref(false);

async function saveEmail() {
  emailError.value = "";
  emailSaving.value = true;
  try {
    const { verificationEmailSent } = await auth.changeEmail(emailForm);
    emailForm.email = "";
    emailForm.currentPassword = "";
    profile.reminder = false;
    toast.success(
      verificationEmailSent
        ? "Email modifié. Un lien de confirmation vient d'être envoyé à la nouvelle adresse."
        : "Email modifié. Confirmez-le avec « Renvoyer le lien » quand l'envoi d'emails sera disponible."
    );
  } catch (err) {
    emailError.value = err.message;
  } finally {
    emailSaving.value = false;
  }
}

const deleteForm = reactive({ currentPassword: "", eraseOrders: false, confirm: false });
const deleteError = ref("");
const deleting = ref(false);

async function deleteAccount() {
  deleteError.value = "";
  if (!deleteForm.confirm) {
    deleteError.value = "Cochez la case pour confirmer la suppression.";
    return;
  }
  if (!confirm("Supprimer définitivement votre compte ? Cette action est irréversible.")) return;
  deleting.value = true;
  try {
    await auth.deleteAccount({ currentPassword: deleteForm.currentPassword, eraseOrders: deleteForm.eraseOrders });
    toast.success("Votre compte a été supprimé.");
    router.push("/");
  } catch (err) {
    deleteError.value = err.message;
  } finally {
    deleting.value = false;
  }
}

const statusLabels = {
  nouvelle: "Reçue",
  confirmee: "Confirmée",
  prete: "Prête",
  livree: "Terminée",
  non_retiree: "Non retirée",
  annulee: "Annulée"
};

// Frise de suivi : les quatre étapes d'une commande qui se passe bien.
const progressSteps = ["nouvelle", "confirmee", "prete", "livree"];

function progressIndex(status) {
  return progressSteps.indexOf(status);
}

// « Recommander » : remet les lignes d'une ancienne commande dans le panier, puis envoie au panier.
// Prix, disponibilité et composition sont revérifiés par le serveur à la relecture (rien n'est commandé ici).
function reorder(order) {
  for (const line of order.items || []) {
    const qty = Math.min(Math.max(Number(line.qty) || 1, 1), 50);
    if (line.type === "product") {
      cart.addItem({ type: "product", slug: line.slug, name: line.name, price: line.price, unit: line.unit }, qty);
    } else if (line.type === "custom") {
      cart.saveCustomBasket({ name: line.name, contents: line.contents || [], qty });
    } else if (line.type === "basket") {
      const chosen = (line.contents || []).filter((entry) => Number.isFinite(entry.qty));
      // Panier personnalisable : on reprend le choix exact ; sinon c'est un panier classique.
      if (chosen.length) cart.saveBasketSelection({ basket: { slug: line.slug, name: line.name, price: line.price }, selection: chosen, qty });
      else cart.addItem({ type: "basket", slug: line.slug, name: line.name, price: line.price }, qty);
    }
  }
  toast.success("Commande remise dans votre panier : vérifiez les prix et les disponibilités avant de confirmer.");
  router.push("/commande");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
</script>

<template>
  <div class="account-page">
    <div class="container">
      <div class="account-header">
        <div>
          <p class="eyebrow">Mon compte</p>
          <h1>Bonjour {{ auth.state.customer?.name }}</h1>
        </div>
        <div class="header-buttons">
          <RouterLink to="/commande" class="btn ghost">🛒 Mon panier<template v-if="cart.totalItems.value"> ({{ cart.totalItems.value }})</template></RouterLink>
          <button type="button" class="btn ghost" @click="logout">Se déconnecter</button>
        </div>
      </div>

      <section v-if="welcome" class="welcome" aria-labelledby="welcome-title">
        <button type="button" class="welcome-close" aria-label="Fermer ce message" @click="welcome = false">×</button>
        <h2 id="welcome-title">🎉 Bienvenue chez L'Héritage des Mornes !</h2>
        <p>Votre compte est créé. Voici comment ça marche :</p>
        <ol>
          <li><strong>Commandez</strong> du samedi au lundi soir : vos coordonnées sont déjà pré-remplies.</li>
          <li><strong>Gardez votre code de retrait</strong> : il apparaît ici, dans « Mes commandes », et par email.</li>
          <li><strong>Retirez le mercredi</strong> en donnant votre code. Vous pouvez aussi « Recommander » une ancienne commande en un clic.</li>
        </ol>
        <div class="welcome-actions">
          <RouterLink to="/#paniers" class="btn primary">Découvrir les paniers</RouterLink>
          <button type="button" class="btn ghost" @click="goTab('informations'); welcome = false">Compléter mes informations</button>
        </div>
      </section>

      <div v-if="auth.state.customer && !auth.state.customer.emailVerified" class="verify-banner" role="status">
        <p>
          <strong>Confirmez votre email.</strong> Cliquez sur le lien que nous vous avons envoyé : vos commandes passées sans
          compte avec l'adresse <em>{{ auth.state.customer.email }}</em> seront alors ajoutées ici automatiquement.
        </p>
        <button type="button" class="btn ghost" :disabled="verificationSending" @click="resendVerification">
          {{ verificationSending ? "Envoi…" : "Renvoyer le lien" }}
        </button>
      </div>

      <section class="overview" aria-label="En ce moment">
        <div v-if="sales" class="sales-card" :class="sales.open ? 'open' : 'closed'" role="status">
          <strong>{{ sales.open ? "🟢 La vente est ouverte" : "🟠 La vente est fermée" }}</strong>
          <span v-if="sales.open">Commandez jusqu'à lundi soir · retrait le {{ formatDay(sales.pickupDate) }}.</span>
          <span v-else-if="sales.mode === 'closed'">{{ sales.closedMessage || "Pause pour le moment." }}</span>
          <span v-else>Elle rouvre samedi. Prochain retrait : {{ formatDay(sales.pickupDate) }}.</span>
          <RouterLink v-if="sales.open" to="/#paniers" class="btn primary compact">Commander</RouterLink>
        </div>

        <div v-if="activeOrder" class="active-order">
          <PickupCode :code="activeOrder.order_number" title="Votre commande en cours" compact />
          <div class="active-info">
            <span class="status-badge" :class="`status-${activeOrder.status}`">{{ statusLabels[activeOrder.status] }}</span>
            <p v-if="activeOrder.desired_date">
              {{ activeOrder.fulfillment === "livraison" ? "Livraison" : "Retrait" }} le <strong>{{ formatDay(activeOrder.desired_date) }}</strong>
            </p>
            <p>Total à régler : <strong>{{ activeOrder.total }} €</strong></p>
            <p class="muted">Donnez ce code au retrait pour être servi·e tout de suite.</p>
          </div>
        </div>
        <div v-else-if="lastOrder" class="active-order quiet">
          <div class="active-info">
            <p><strong>Vous n'avez pas de commande en cours.</strong></p>
            <button type="button" class="btn primary" @click="reorder(lastOrder)">↻ Recommander ma dernière commande</button>
          </div>
        </div>
      </section>

      <div class="tabs" role="tablist" aria-label="Mon espace">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          role="tab"
          class="tab"
          :class="{ active: tab === t.key }"
          :aria-selected="tab === t.key"
          @click="goTab(t.key)"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Mes commandes -->
      <div v-if="tab === 'commandes'" role="tabpanel">
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
                <strong>Code {{ formatOrderCode(order.order_number) }}</strong>
                <span class="order-date">{{ formatDate(order.created_at) }}</span>
              </div>
              <span class="status-badge" :class="`status-${order.status}`">{{ statusLabels[order.status] || order.status }}</span>
            </div>
            <ol v-if="progressIndex(order.status) !== -1" class="progress" :aria-label="`Avancement : ${statusLabels[order.status]}`">
              <li v-for="(step, index) in progressSteps" :key="step" :class="{ reached: index <= progressIndex(order.status) }">
                {{ statusLabels[step] }}
              </li>
            </ol>
            <div class="order-items">
              <div v-for="(item, index) in order.items" :key="index">
                {{ item.qty }} x {{ item.name }}
                <CartLineContents :line="item" />
              </div>
            </div>
            <p class="order-meta">
              {{ order.fulfillment === "livraison" ? "Livraison" : "Retrait" }}
              <template v-if="order.desired_date"> le {{ formatDay(order.desired_date) }}</template>
              · Total {{ order.total }} €
            </p>
            <button type="button" class="btn ghost reorder-btn" @click="reorder(order)">↻ Recommander</button>
          </div>
        </div>

        <form class="claim-card" @submit.prevent="claimOrder">
          <h2>Retrouver une commande</h2>
          <p class="muted">
            Vous avez commandé sans compte, ou sans email ? Saisissez le code de commande reçu à la confirmation (ex : K7M-4QH) et le téléphone
            utilisé à ce moment-là.
          </p>
          <div class="claim-fields">
            <label>
              Code de commande
              <input v-model.trim="claim.orderNumber" type="text" placeholder="ex: K7M-4QH" autocomplete="off" required />
            </label>
            <label>
              Téléphone de la commande
              <input v-model.trim="claim.phone" type="tel" autocomplete="tel" required />
            </label>
          </div>
          <p v-if="claimError" class="form-error" role="alert">{{ claimError }}</p>
          <button type="submit" class="btn ghost" :disabled="claiming">{{ claiming ? "Recherche…" : "Ajouter à mon compte" }}</button>
        </form>
      </div>

      <!-- Mes favoris -->
      <section v-else-if="tab === 'favoris'" role="tabpanel" aria-label="Mes favoris">
        <h2>Mes favoris</h2>
        <p v-if="favorites.length === 0" class="muted">
          Vous n'avez pas encore de favori. Touchez le cœur ♡ sur un panier ou un article pour le retrouver ici.
        </p>
        <ul v-else class="fav-list">
          <li v-for="item in favorites" :key="item.type + item.slug">
            <div>
              <strong>{{ item.name }}</strong>
              <span class="muted">{{ item.type === "basket" ? "Panier" : "À la carte" }} · {{ item.price }} €</span>
              <span v-if="item.soldOut" class="fav-soldout">Rupture cette semaine</span>
            </div>
            <div class="fav-actions">
              <RouterLink v-if="item.type === 'basket'" :to="`/panier/${item.slug}`" class="btn ghost">Voir</RouterLink>
              <button type="button" class="btn primary" :disabled="item.soldOut" @click="addFavoriteToCart(item)">Ajouter au panier</button>
              <button type="button" class="link-btn" @click="removeFavorite(item)">Retirer</button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Mes informations -->
      <section v-else-if="tab === 'informations'" class="settings" role="tabpanel" aria-label="Mes informations">
        <form class="settings-card" @submit.prevent="saveProfile">
          <h2>Mes informations</h2>
          <p class="muted">Elles pré-remplissent automatiquement vos prochaines commandes.</p>
          <label>
            Nom et prénom
            <input v-model.trim="profile.name" type="text" autocomplete="name" required />
          </label>
          <label>
            Téléphone
            <input v-model.trim="profile.phone" type="tel" autocomplete="tel" />
          </label>
          <label>
            Adresse de livraison
            <textarea v-model.trim="profile.address" rows="2" autocomplete="street-address"></textarea>
          </label>

          <fieldset class="prefs addresses">
            <legend>Mes adresses de livraison</legend>
            <p v-if="!profile.addresses.length" class="muted">Aucune adresse enregistrée en plus de celle ci-dessus.</p>
            <div v-for="(entry, index) in profile.addresses" :key="index" class="address-row">
              <input v-model.trim="entry.label" type="text" maxlength="40" placeholder="Nom (Maison, Bureau…)" aria-label="Nom de l'adresse" />
              <input v-model.trim="entry.address" type="text" maxlength="300" placeholder="Adresse complète" aria-label="Adresse" />
              <button type="button" class="link-btn" :aria-label="`Supprimer l'adresse ${index + 1}`" @click="profile.addresses.splice(index, 1)">Supprimer</button>
            </div>
            <button type="button" class="btn ghost small" @click="addAddress">+ Ajouter une adresse</button>
          </fieldset>

          <fieldset class="prefs">
            <legend>Mode de réception habituel</legend>
            <label class="radio"><input v-model="profile.defaultFulfillment" type="radio" value="retrait" /> Retrait le mercredi</label>
            <label class="radio"><input v-model="profile.defaultFulfillment" type="radio" value="livraison" /> Livraison</label>
          </fieldset>

          <label class="check">
            <input v-model="profile.reminder" type="checkbox" :disabled="!auth.state.customer?.emailVerified" />
            <span>
              Me rappeler par email le lundi si je n'ai pas encore commandé
              <small v-if="!auth.state.customer?.emailVerified">Confirmez d'abord votre email pour activer ce rappel.</small>
            </span>
          </label>

          <p v-if="profileError" class="form-error" role="alert">{{ profileError }}</p>
          <button type="submit" class="btn primary" :disabled="profileSaving">
            {{ profileSaving ? "Enregistrement…" : "Enregistrer" }}
          </button>
        </form>

        <form class="settings-card" @submit.prevent="saveEmail">
          <h2>Mon adresse email</h2>
          <p class="muted">
            Actuelle : <strong>{{ auth.state.customer?.email }}</strong>
            <template v-if="auth.state.customer?.emailVerified"> (confirmée ✓)</template>
            <template v-else> (à confirmer)</template>
          </p>
          <label>
            Nouvelle adresse
            <input v-model.trim="emailForm.email" type="email" autocomplete="email" required />
          </label>
          <label>
            Mot de passe actuel
            <PasswordField v-model="emailForm.currentPassword" autocomplete="current-password" />
          </label>
          <p class="muted">La nouvelle adresse devra être confirmée par un lien. Le rappel du lundi sera désactivé jusque-là.</p>
          <p v-if="emailError" class="form-error" role="alert">{{ emailError }}</p>
          <button type="submit" class="btn primary" :disabled="emailSaving">
            {{ emailSaving ? "Enregistrement…" : "Changer d'email" }}
          </button>
        </form>
      </section>

      <!-- Sécurité et données -->
      <section v-else class="settings" role="tabpanel" aria-label="Sécurité et données">
        <form class="settings-card" @submit.prevent="savePassword">
          <h2>Changer mon mot de passe</h2>
          <label>
            Mot de passe actuel
            <PasswordField v-model="passwords.current" autocomplete="current-password" />
          </label>
          <label>
            Nouveau mot de passe (8 caractères min.)
            <PasswordField v-model="passwords.next" minlength="8" autocomplete="new-password" />
          </label>
          <p v-if="passwordError" class="form-error" role="alert">{{ passwordError }}</p>
          <button type="submit" class="btn primary" :disabled="passwordSaving">
            {{ passwordSaving ? "Enregistrement…" : "Changer le mot de passe" }}
          </button>
        </form>

        <form class="settings-card danger" @submit.prevent="deleteAccount">
          <h2>Supprimer mon compte</h2>
          <p class="muted">
            Votre compte et vos préférences sont supprimés. Vos commandes passées sont conservées (obligation comptable) mais ne sont plus
            rattachées à vous.
          </p>
          <label class="check">
            <input v-model="deleteForm.eraseOrders" type="checkbox" />
            <span>Effacer aussi mes données personnelles dans mes anciennes commandes (nom, téléphone, email, adresse).</span>
          </label>
          <label>
            Mot de passe
            <PasswordField v-model="deleteForm.currentPassword" autocomplete="current-password" />
          </label>
          <label class="check">
            <input v-model="deleteForm.confirm" type="checkbox" />
            <span>Je comprends que cette suppression est définitive.</span>
          </label>
          <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
          <button type="submit" class="btn danger-btn" :disabled="deleting">{{ deleting ? "Suppression…" : "Supprimer mon compte" }}</button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  position: relative;
  margin: 0 0 22px;
  padding: 22px 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%);
  color: #fff;
  display: grid;
  gap: 8px;
}

.welcome h2,
.welcome p {
  margin: 0;
}

.welcome ol {
  margin: 4px 0 6px;
  padding-left: 20px;
  display: grid;
  gap: 4px;
}

.welcome-close {
  position: absolute;
  top: 8px;
  right: 12px;
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.overview {
  display: grid;
  gap: 14px;
  margin-bottom: 26px;
}

.sales-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
}

.sales-card.open {
  background: var(--ok-soft);
}

.sales-card.closed {
  background: #fdf0e6;
}

.sales-card .btn {
  margin-left: auto;
}

.active-order {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  padding: 16px 18px;
  background: #fff;
  border: 2px solid var(--brand);
  border-radius: 16px;
}

.active-order.quiet {
  border: 1px solid var(--line);
}

.active-info {
  display: grid;
  gap: 4px;
  justify-items: start;
}

.active-info p {
  margin: 0;
  font-size: 14px;
}

.fav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.fav-list li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
}

.fav-list li > div:first-child {
  display: grid;
  gap: 2px;
}

.fav-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.fav-soldout {
  color: var(--hibiscus);
  font-size: 12px;
  font-weight: 700;
}

.address-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 8px;
  align-items: center;
}

.address-row input {
  min-width: 0;
}

.btn.small {
  padding: 8px 14px;
  font-size: 13px;
  justify-self: start;
}

@media (max-width: 640px) {
  .address-row {
    grid-template-columns: 1fr;
  }
}

.header-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Onglets en « segments » : l'onglet actif est plein, impossible de se tromper d'endroit. */
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  padding: 5px;
  background: var(--cream-deep);
  border-radius: 14px;
  overflow-x: auto;
}

.tab {
  flex: 1 0 auto;
  border: 0;
  background: transparent;
  font: inherit;
  font-weight: 700;
  font-size: 14px;
  padding: 11px 18px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--muted);
  white-space: nowrap;
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  background: #fff;
  color: var(--brand-dark);
  box-shadow: 0 1px 3px rgba(42, 33, 25, 0.15);
}

.prefs {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  display: grid;
  gap: 6px;
}

.prefs legend {
  font-size: 13px;
  font-weight: 700;
  padding: 0 4px;
}

.settings-card label.radio,
.settings-card label.check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-weight: 500;
}

.settings-card label.check small {
  display: block;
  color: var(--muted);
}

.settings-card .radio input,
.settings-card .check input {
  width: auto;
  padding: 0;
  margin-top: 3px;
}

.settings-card.danger {
  border-color: #e3a6ab;
}

.danger-btn {
  background: #a3202a;
  color: #fff;
  border: 0;
}

.danger-btn:hover {
  background: #86171f;
}
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

.verify-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #f0d06a;
  background: #fff6d6;
  color: #664400;
  font-size: 14px;
}

.verify-banner p {
  margin: 0;
  max-width: 640px;
}

.claim-card {
  display: grid;
  gap: 14px;
  margin-bottom: 40px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px;
}

.claim-card h2 {
  margin: 0;
}

.claim-card .muted {
  margin: 0;
  font-size: 13px;
}

.claim-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.claim-card label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.claim-card input {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
}

.claim-card .btn {
  justify-self: start;
}

.settings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.settings-card {
  display: grid;
  gap: 14px;
  align-content: start;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px;
}

.settings-card h2 {
  margin: 0;
}

.settings-card .muted {
  margin: 0;
  font-size: 13px;
}

.settings-card label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.settings-card input,
.settings-card textarea {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 0;
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
  border-top-color: var(--brand);
  color: var(--brand-dark);
}

.status-nouvelle {
  background: #fdeec2;
  color: #6e4a00;
}

.status-confirmee {
  background: #d6eef2;
  color: #0b6072;
}

.status-prete {
  background: var(--ok-soft);
  color: var(--ok);
}

.status-livree {
  background: var(--ok-soft);
  color: var(--ok);
}

.status-non_retiree {
  background: #fdebd0;
  color: #8a4b08;
}

.reorder-btn {
  margin-top: 8px;
}

.status-annulee {
  background: #fbe0e2;
  color: #a3202a;
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
