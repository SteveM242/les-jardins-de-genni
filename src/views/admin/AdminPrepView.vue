<script setup>
import { computed, onMounted, ref, watch } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import { api } from "../../api.js";
import { useSiteContent } from "../../stores/siteContent.js";

const siteContent = useSiteContent();

// Par défaut : les commandes à retirer le prochain mercredi ; « toutes » = tout ce qui reste à préparer ou à remettre.
const scope = ref("pickup"); // pickup | all
const pickupDate = computed(() => siteContent.state.sales?.pickupDate || "");
const prep = ref(null);
const loading = ref(true);
const loadError = ref("");

function formatDay(day) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

async function load() {
  loading.value = true;
  loadError.value = "";
  const useDate = scope.value === "pickup" && pickupDate.value;
  const res = await api(`/api/admin/orders/prep${useDate ? `?date=${pickupDate.value}` : ""}`);
  if (res.ok) prep.value = res.data;
  else loadError.value = res.error;
  loading.value = false;
}

onMounted(async () => {
  await siteContent.load();
  await load();
});
watch([scope, pickupDate], load);

function print() {
  window.print();
}

function quantity(line) {
  return line.unit ? `${line.qty} ${line.unit}` : String(line.qty);
}
</script>

<template>
  <AdminNav>
    <div class="prep-head no-print">
      <h1>Liste de préparation</h1>
      <button type="button" class="btn primary" @click="print">🖨 Imprimer</button>
    </div>
    <p class="hint no-print">
      Quantités à préparer pour les commandes <strong>nouvelles, confirmées ou prêtes</strong> (paniers personnalisés et paniers sur
      mesure compris). Les commandes remises, non retirées ou annulées n'y figurent pas.
    </p>

    <div class="scope no-print" role="group" aria-label="Commandes concernées">
      <button type="button" class="filter-chip" :class="{ active: scope === 'pickup' }" :disabled="!pickupDate" @click="scope = 'pickup'">
        Retrait du {{ pickupDate ? formatDay(pickupDate) : "…" }}
      </button>
      <button type="button" class="filter-chip" :class="{ active: scope === 'all' }" @click="scope = 'all'">Toutes les commandes en cours</button>
    </div>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="load" />

    <template v-else-if="prep">
      <p class="print-title">
        Préparation — {{ scope === "pickup" && pickupDate ? `retrait du ${formatDay(pickupDate)}` : "toutes les commandes en cours" }}
      </p>
      <p v-if="prep.orders === 0" class="empty">Aucune commande à préparer pour le moment.</p>

      <template v-else>
        <section class="summary">
          <p>
            <strong>{{ prep.orders }}</strong> commande{{ prep.orders > 1 ? "s" : "" }}
            <template v-if="prep.baskets.length"> · </template>
            <span v-for="(basket, index) in prep.baskets" :key="basket.name">
              {{ index ? " · " : "" }}{{ basket.qty }} × {{ basket.name }}
            </span>
          </p>
        </section>

        <table class="prep-table">
          <thead>
            <tr>
              <th scope="col">À préparer</th>
              <th scope="col" class="num">Total</th>
              <th scope="col" class="num">Dans les paniers</th>
              <th scope="col" class="num">À l'unité</th>
              <th scope="col" class="check no-print-cell">Prêt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in prep.lines" :key="line.name + line.unit">
              <th scope="row">{{ line.name }}</th>
              <td class="num"><strong>{{ quantity(line) }}</strong></td>
              <td class="num">{{ line.fromBaskets || "–" }}</td>
              <td class="num">{{ line.loose || "–" }}</td>
              <td class="check"><input type="checkbox" :aria-label="`${line.name} préparé`" /></td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0;
}

.prep-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 16px;
}

.scope {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.summary {
  margin-bottom: 14px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--green-soft);
}

.summary p {
  margin: 0;
}

.empty {
  color: var(--muted);
}

.prep-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}

.prep-table th,
.prep-table td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  font-size: 14px;
}

.prep-table thead th {
  background: #f6f4ef;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--muted);
}

.prep-table .num {
  text-align: right;
}

.prep-table .check {
  text-align: center;
  width: 60px;
}

.prep-table tbody th {
  font-weight: 600;
}

.print-title {
  display: none;
  font-weight: 700;
  font-size: 18px;
}

@media print {
  .no-print,
  .no-print-cell {
    display: none !important;
  }

  .print-title {
    display: block;
  }
}
</style>
