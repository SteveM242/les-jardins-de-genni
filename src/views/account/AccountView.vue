<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../api.js";
import { useAuth } from "../../stores/auth.js";
import { useToast } from "../../stores/toast.js";
import PasswordField from "../../components/PasswordField.vue";
import BackLink from "../../components/BackLink.vue";
import LoadError from "../../components/LoadError.vue";
import CartLineContents from "../../components/CartLineContents.vue";

const router = useRouter();
const auth = useAuth();
const toast = useToast();
const orders = ref([]);

const profile = reactive({
  name: auth.state.customer?.name || "",
  phone: auth.state.customer?.phone || "",
  address: auth.state.customer?.address || ""
});
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
    res.data.alreadyYours ? "Cette commande est déjà dans votre compte." : `Commande ${res.data.orderNumber} ajoutée à votre compte.`
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

      <div v-if="auth.state.customer && !auth.state.customer.emailVerified" class="verify-banner" role="status">
        <p>
          <strong>Confirmez votre email.</strong> Cliquez sur le lien que nous vous avons envoyé : vos commandes passées sans
          compte avec l'adresse <em>{{ auth.state.customer.email }}</em> seront alors ajoutées ici automatiquement.
        </p>
        <button type="button" class="btn ghost" :disabled="verificationSending" @click="resendVerification">
          {{ verificationSending ? "Envoi…" : "Renvoyer le lien" }}
        </button>
      </div>

      <section class="settings" aria-label="Mes informations">
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
          <p class="muted">Email : {{ auth.state.customer?.email }}</p>
          <p v-if="profileError" class="form-error" role="alert">{{ profileError }}</p>
          <button type="submit" class="btn primary" :disabled="profileSaving">
            {{ profileSaving ? "Enregistrement…" : "Enregistrer" }}
          </button>
        </form>

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
      </section>

      <form class="claim-card" @submit.prevent="claimOrder">
        <h2>Retrouver une commande</h2>
        <p class="muted">
          Vous avez commandé sans compte, ou sans email ? Saisissez le numéro de commande reçu à la confirmation et le téléphone
          utilisé à ce moment-là.
        </p>
        <div class="claim-fields">
          <label>
            Numéro de commande
            <input v-model.trim="claim.orderNumber" type="text" placeholder="ex: A1B2C3D4" autocomplete="off" required />
          </label>
          <label>
            Téléphone de la commande
            <input v-model.trim="claim.phone" type="tel" autocomplete="tel" required />
          </label>
        </div>
        <p v-if="claimError" class="form-error" role="alert">{{ claimError }}</p>
        <button type="submit" class="btn ghost" :disabled="claiming">{{ claiming ? "Recherche…" : "Ajouter à mon compte" }}</button>
      </form>

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
          <div class="order-items">
            <div v-for="(item, index) in order.items" :key="index">
              {{ item.qty }} x {{ item.name }}
              <CartLineContents :line="item" />
            </div>
          </div>
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

.verify-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #e6c98f;
  background: #fff7e6;
  color: #6b4a0e;
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
  color: #a3372e;
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
  border-top-color: var(--green);
  color: var(--green-dark);
}

.status-nouvelle {
  background: #fcebd9;
  color: #8a4f12;
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
