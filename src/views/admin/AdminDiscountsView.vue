<script setup>
import { onMounted, reactive, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import { useAdminResource } from "../../composables/useAdminResource.js";

const { items: discounts, loading, loadError, load, create, update, remove } = useAdminResource({
  endpoint: "/api/admin/discounts",
  listKey: "discounts",
  itemKey: "discount"
});

const error = ref("");
const newDiscount = reactive({ code: "", type: "percent", value: "", maxUses: "" });

async function addDiscount() {
  error.value = "";
  if (!newDiscount.code || !newDiscount.value) {
    error.value = "Code et valeur requis.";
    return;
  }
  const result = await create(
    {
      code: newDiscount.code,
      type: newDiscount.type,
      value: newDiscount.value,
      maxUses: newDiscount.maxUses || null
    },
    { prepend: true }
  );
  if (!result.ok) {
    error.value = result.error;
    return;
  }
  newDiscount.code = "";
  newDiscount.value = "";
  newDiscount.maxUses = "";
}

function toggleActive(discount) {
  return update(discount, { active: !discount.active });
}

function removeDiscount(discount) {
  return remove(discount, `Supprimer le code "${discount.code}" ?`);
}

onMounted(load);
</script>

<template>
  <AdminNav>
    <h1>Codes promo</h1>

    <form class="new-discount" @submit.prevent="addDiscount">
      <input v-model.trim="newDiscount.code" placeholder="CODE (ex: BIENVENUE10)" />
      <select v-model="newDiscount.type">
        <option value="percent">% de réduction</option>
        <option value="fixed">Montant fixe (€)</option>
      </select>
      <input v-model.number="newDiscount.value" type="number" step="0.5" placeholder="valeur" />
      <input v-model.number="newDiscount.maxUses" type="number" placeholder="utilisations max (optionnel)" />
      <button type="submit" class="btn primary">Créer</button>
    </form>
    <p v-if="error" class="form-error">{{ error }}</p>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="load" />
    <p v-else-if="discounts.length === 0" class="empty-note">Aucun code promo pour le moment.</p>

    <div v-else class="table-scroll">
    <table class="discounts-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Type</th>
          <th>Valeur</th>
          <th>Utilisations</th>
          <th>Actif</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="discount in discounts" :key="discount.id">
          <td><strong>{{ discount.code }}</strong></td>
          <td>{{ discount.type === "percent" ? "%" : "€ fixe" }}</td>
          <td>{{ discount.value }}{{ discount.type === "percent" ? "%" : " €" }}</td>
          <td>{{ discount.used_count }}{{ discount.max_uses ? ` / ${discount.max_uses}` : "" }}</td>
          <td>
            <input type="checkbox" :checked="discount.active" @change="toggleActive(discount)" />
          </td>
          <td>
            <button type="button" class="link-btn" @click="removeDiscount(discount)">Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 24px;
}

.new-discount {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
}

.new-discount input,
.new-discount select {
  flex: 1;
  min-width: 140px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  font: inherit;
}

.form-error {
  color: #a3372e;
  font-size: 13px;
  margin: 8px 0 20px;
}

.empty-note {
  color: var(--muted);
}

.table-scroll {
  overflow-x: auto;
  margin-top: 20px;
}

.discounts-table {
  min-width: 560px;
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}

.discounts-table th,
.discounts-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}

.discounts-table th {
  background: var(--cream-deep);
  font-size: 12px;
  text-transform: uppercase;
}

.link-btn {
  background: none;
  border: 0;
  color: #a3372e;
  text-decoration: underline;
  cursor: pointer;
  font-size: 13px;
}
</style>
