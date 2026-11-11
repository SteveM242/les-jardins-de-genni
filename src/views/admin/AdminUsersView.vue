<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import PasswordField from "../../components/PasswordField.vue";
import { api } from "../../api.js";
import { useToast } from "../../stores/toast.js";

const toast = useToast();

// ---------- Clients ----------
const customers = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(25);
const search = ref("");
const loading = ref(true);
const loadError = ref("");

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

async function loadCustomers() {
  loading.value = true;
  loadError.value = "";
  const params = new URLSearchParams({ page: String(page.value) });
  if (search.value.trim()) params.set("q", search.value.trim());
  const res = await api(`/api/admin/users/customers?${params}`);
  if (res.ok) {
    customers.value = res.data.customers;
    total.value = res.data.total;
    pageSize.value = res.data.pageSize;
  } else {
    loadError.value = res.error;
  }
  loading.value = false;
}

let searchTimer = null;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadCustomers();
  }, 300);
});

function goToPage(next) {
  page.value = Math.min(Math.max(1, next), pageCount.value);
  loadCustomers();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Suppression : boîte de dialogue native (focus piégé, Échap pour annuler).
const dialog = ref(null);
const target = ref(null);
const anonymize = ref(false);
const deleting = ref(false);

function askDelete(customer) {
  target.value = customer;
  anonymize.value = false;
  dialog.value?.showModal();
}

function closeDialog() {
  dialog.value?.close();
  target.value = null;
}

async function confirmDelete() {
  if (!target.value) return;
  deleting.value = true;
  const res = await api(`/api/admin/users/customers/${target.value.id}`, {
    method: "DELETE",
    body: { anonymizeOrders: anonymize.value }
  });
  deleting.value = false;
  if (!res.ok) {
    toast.error(res.error);
    return;
  }
  toast.success(`Compte de ${target.value.name} supprimé.`);
  closeDialog();
  await loadCustomers();
}

// ---------- Administrateurs ----------
const admins = ref([]);
const adminError = ref("");
const adminSaving = ref(false);
const newAdmin = reactive({ email: "", password: "" });

async function loadAdmins() {
  const res = await api("/api/admin/users/admins");
  if (res.ok) admins.value = res.data.admins;
}

async function addAdmin() {
  adminError.value = "";
  adminSaving.value = true;
  const res = await api("/api/admin/users/admins", { method: "POST", body: { ...newAdmin } });
  adminSaving.value = false;
  if (!res.ok) {
    adminError.value = res.error;
    return;
  }
  admins.value.push(res.data.admin);
  newAdmin.email = "";
  newAdmin.password = "";
  toast.success("Administrateur ajouté. Transmettez-lui son mot de passe de façon sûre.");
}

async function removeAdmin(admin) {
  if (!confirm(`Retirer l'accès de ${admin.email} à l'espace pro ?`)) return;
  const res = await api(`/api/admin/users/admins/${admin.id}`, { method: "DELETE" });
  if (!res.ok) return toast.error(res.error);
  admins.value = admins.value.filter((entry) => entry.id !== admin.id);
  toast.success("Accès retiré.");
}

onMounted(() => {
  loadCustomers();
  loadAdmins();
});

onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<template>
  <AdminNav>
    <h1>Utilisateurs</h1>
    <p class="hint">Les comptes créés par vos client·e·s, et les personnes qui ont accès à cet espace pro.</p>

    <section class="card" aria-labelledby="customers-title">
      <div class="head">
        <h2 id="customers-title">Comptes clients ({{ total }})</h2>
        <label class="search">
          <span class="sr-only">Rechercher un compte</span>
          <input v-model="search" type="search" placeholder="Rechercher : nom, email, téléphone" />
        </label>
      </div>

      <p v-if="loading">Chargement…</p>
      <LoadError v-else-if="loadError" :message="loadError" @retry="loadCustomers" />
      <p v-else-if="customers.length === 0" class="muted">{{ search ? "Aucun compte ne correspond." : "Aucun compte client pour le moment." }}</p>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Inscrit le</th>
              <th>Commandes</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="customer in customers" :key="customer.id">
              <td><strong>{{ customer.name }}</strong></td>
              <td>
                {{ customer.email }}
                <span v-if="customer.email_verified" class="badge" title="Email confirmé">✓ confirmé</span>
              </td>
              <td>{{ customer.phone || "—" }}</td>
              <td>{{ formatDate(customer.created_at) }}</td>
              <td>{{ customer.orders }}</td>
              <td><button type="button" class="link-btn" @click="askDelete(customer)">Supprimer</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav v-if="!loading && !loadError && pageCount > 1" class="pagination" aria-label="Pagination des comptes">
        <button type="button" class="btn ghost" :disabled="page <= 1" @click="goToPage(page - 1)">← Précédents</button>
        <span>Page {{ page }} sur {{ pageCount }}</span>
        <button type="button" class="btn ghost" :disabled="page >= pageCount" @click="goToPage(page + 1)">Suivants →</button>
      </nav>
    </section>

    <section class="card" aria-labelledby="admins-title">
      <h2 id="admins-title">Administrateurs ({{ admins.length }})</h2>
      <p class="hint">Chaque personne a ses propres identifiants. Elle peut modifier son email et son mot de passe depuis « Mon compte ».</p>

      <ul class="admin-list">
        <li v-for="admin in admins" :key="admin.id">
          <span>{{ admin.email }} <span v-if="admin.isSelf" class="badge self">vous</span></span>
          <button v-if="!admin.isSelf" type="button" class="link-btn" @click="removeAdmin(admin)">Retirer l'accès</button>
        </li>
      </ul>

      <form class="add-admin" @submit.prevent="addAdmin">
        <h3>Ajouter un administrateur</h3>
        <div class="add-grid">
          <label>
            Email
            <input v-model.trim="newAdmin.email" type="email" autocomplete="off" required />
          </label>
          <label>
            Mot de passe provisoire (8 caractères min.)
            <PasswordField v-model="newAdmin.password" minlength="8" autocomplete="new-password" />
          </label>
        </div>
        <p v-if="adminError" class="form-error" role="alert">{{ adminError }}</p>
        <button type="submit" class="btn primary" :disabled="adminSaving">{{ adminSaving ? "Ajout…" : "Ajouter" }}</button>
      </form>
    </section>

    <dialog ref="dialog" class="dialog" aria-labelledby="delete-title" @close="target = null">
      <form v-if="target" method="dialog" @submit.prevent="confirmDelete">
        <h2 id="delete-title">Supprimer ce compte ?</h2>
        <p>
          Le compte de <strong>{{ target.name }}</strong> ({{ target.email }}) sera supprimé définitivement. Cette action est
          irréversible. Ses {{ target.orders }} commande{{ target.orders > 1 ? "s" : "" }} reste{{ target.orders > 1 ? "nt" : "" }} dans
          votre historique, mais ne {{ target.orders > 1 ? "sont" : "est" }} plus rattachée{{ target.orders > 1 ? "s" : "" }} à un compte.
        </p>
        <label class="check">
          <input v-model="anonymize" type="checkbox" />
          <span>
            <strong>Effacer aussi ses données personnelles</strong> dans ses commandes (nom, téléphone, email, adresse, remarques).
            À cocher pour une demande d'effacement (RGPD).
          </span>
        </label>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" @click="closeDialog">Annuler</button>
          <button type="submit" class="btn danger" :disabled="deleting">{{ deleting ? "Suppression…" : "Supprimer définitivement" }}</button>
        </div>
      </form>
    </dialog>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 6px;
}

h2 {
  font-size: 17px;
  margin: 0;
}

h3 {
  font-size: 15px;
  margin: 0;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 20px;
}

.card {
  display: grid;
  gap: 14px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px;
  margin-bottom: 24px;
}

.card .hint {
  margin: 0;
}

.muted {
  color: var(--muted);
  margin: 0;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.search input {
  font: inherit;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  min-width: 260px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}

th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.badge {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--brand-tint);
  color: var(--brand-dark);
  font-size: 11px;
  font-weight: 700;
}

.badge.self {
  background: var(--cream-deep);
  color: var(--text);
}

.link-btn {
  background: none;
  border: 0;
  color: #a3202a;
  text-decoration: underline;
  cursor: pointer;
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--muted);
}

.pagination .btn {
  padding: 8px 14px;
  font-size: 13px;
}

.pagination .btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.admin-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.admin-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--brand-soft);
}

.add-admin {
  display: grid;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.add-grid label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.add-grid input:not([type="password"]):not([type="text"]) {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
}

.add-admin .btn {
  justify-self: start;
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 0;
}

.dialog {
  width: min(520px, calc(100% - 32px));
  padding: 24px;
  border: 0;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
  color: var(--text);
}

.dialog::backdrop {
  background: rgba(42, 33, 25, 0.55);
}

.dialog form {
  display: grid;
  gap: 16px;
}

.dialog p {
  margin: 0;
  font-size: 14px;
}

.check {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border-radius: 10px;
  background: var(--cream);
  border: 1px solid var(--line);
  font-size: 13px;
  cursor: pointer;
}

.check input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  flex-shrink: 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.btn.danger {
  background: #a3202a;
  color: #fff;
}

.btn.danger:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
