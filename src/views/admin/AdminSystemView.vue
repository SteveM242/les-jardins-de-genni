<script setup>
import { computed, onMounted, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import { api } from "../../api.js";
import { useToast } from "../../stores/toast.js";

const toast = useToast();
const health = ref(null);
const loading = ref(true);
const loadError = ref("");
const testing = ref(false);
const withImages = ref(false);

async function load() {
  loading.value = true;
  const res = await api("/api/admin/system/health");
  if (res.ok) health.value = res.data;
  else loadError.value = res.error;
  loading.value = false;
}
onMounted(load);

// Ce qui doit être configuré dans Railway (Variables) pour que chaque fonction marche.
const checks = computed(() => {
  const h = health.value;
  if (!h) return [];
  return [
    { ok: h.smtp, label: "Envoi d'emails (confirmations, statuts)", help: "Variables ORDER_SMTP_HOST, ORDER_SMTP_USER, ORDER_SMTP_PASS et ORDER_NOTIFY_EMAIL." },
    { ok: h.siteUrl, label: "Adresse publique du site", help: "Variable SITE_URL (ex : https://votre-site.fr) : liens des emails, plan du site, partage WhatsApp." },
    { ok: h.reminders, label: "Rappels automatiques (lundi, veille du retrait)", help: "Demandent l'envoi d'emails ET SITE_URL." },
    { ok: h.onlinePayment, optional: true, label: "Paiement en ligne par carte (facultatif)", help: "Variables STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET ; webhook Stripe vers /api/payments/webhook." }
  ];
});

async function sendTest() {
  testing.value = true;
  const res = await api("/api/admin/system/test-email", { method: "POST" });
  testing.value = false;
  if (res.ok) toast.success(`Email de test envoyé à ${res.data.to}. Vérifiez la boîte de réception (et les indésirables).`);
  else toast.error(res.error);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

// Le téléchargement passe par un lien : la session admin (cookie) suffit.
const backupUrl = computed(() => `/api/admin/system/backup${withImages.value ? "?images=1" : ""}`);
</script>

<template>
  <AdminNav>
    <h1>Système et sauvegarde</h1>
    <p class="hint">Ce qui est branché, ce qu'il reste à configurer, et une sauvegarde de toutes vos données.</p>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="load" />

    <template v-else>
      <section class="card" aria-labelledby="config-title">
        <h2 id="config-title">Configuration</h2>
        <ul class="checks">
          <li v-for="check in checks" :key="check.label" :class="check.ok ? 'ok' : check.optional ? 'optional' : 'todo'">
            <span class="mark" aria-hidden="true">{{ check.ok ? "✓" : check.optional ? "–" : "!" }}</span>
            <div>
              <strong>{{ check.label }}</strong>
              <small>{{ check.ok ? "Actif." : check.help }}</small>
            </div>
          </li>
        </ul>
        <button type="button" class="btn primary" :disabled="testing || !health.smtp" @click="sendTest">
          {{ testing ? "Envoi…" : "Envoyer un email de test" }}
        </button>
        <small v-if="!health.smtp" class="muted">Disponible quand l'envoi d'emails est configuré.</small>
      </section>

      <section class="card" aria-labelledby="backup-title">
        <h2 id="backup-title">Sauvegarde</h2>
        <p>
          Télécharge un fichier avec les commandes, les clients (sans mots de passe), les articles, les paniers, les codes promo et le
          contenu du site. À faire régulièrement et à garder hors du site (ordinateur, cloud).
        </p>
        <p class="muted">
          Dernière sauvegarde téléchargée :
          <strong>{{ health.lastBackupAt ? formatDate(health.lastBackupAt) : "jamais" }}</strong>
        </p>
        <label class="check">
          <input v-model="withImages" type="checkbox" />
          Inclure les photos (fichier beaucoup plus lourd)
        </label>
        <a :href="backupUrl" class="btn primary" download>Télécharger la sauvegarde</a>
        <p class="muted">
          La base de données elle-même est aussi sauvegardée par Railway : vérifiez dans Railway › Postgres › Backups que les
          sauvegardes automatiques sont activées.
        </p>
      </section>
    </template>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 6px;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 22px;
}

.card {
  display: grid;
  gap: 12px;
  justify-items: start;
  margin-bottom: 20px;
  padding: 20px 22px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
}

.card h2 {
  margin: 0;
  font-size: 18px;
}

.card p {
  margin: 0;
  font-size: 14px;
}

.muted {
  color: var(--muted);
}

.checks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  width: 100%;
}

.checks li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
}

.checks li.ok {
  background: var(--ok-soft);
}

.checks li.todo {
  background: #fdebd0;
}

.checks li.optional {
  background: var(--cream);
}

.mark {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  font-weight: 700;
  flex: 0 0 auto;
}

.checks small {
  display: block;
  color: var(--muted);
}

.check {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}
</style>
