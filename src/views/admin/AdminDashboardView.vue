<script setup>
import { onMounted, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";

const orders = ref([]);
const loading = ref(true);

const statuses = [
  { value: "nouvelle", label: "Nouvelle" },
  { value: "confirmee", label: "Confirmée" },
  { value: "prete", label: "Prête" },
  { value: "livree", label: "Livrée" },
  { value: "annulee", label: "Annulée" }
];

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

onMounted(loadOrders);
</script>

<template>
  <AdminNav>
    <h1>Commandes</h1>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="orders.length === 0">Aucune commande pour le moment.</p>

    <table v-else class="orders-table">
      <thead>
        <tr>
          <th>N°</th>
          <th>Client</th>
          <th>Articles</th>
          <th>Mode</th>
          <th>Total</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in orders" :key="order.id">
          <td>{{ order.order_number }}</td>
          <td>
            <strong>{{ order.name }}</strong>
            <span class="muted">{{ order.phone }}</span>
          </td>
          <td>
            <span v-for="(item, index) in order.items" :key="item.slug">
              {{ item.qty }} x {{ item.name }}<span v-if="index < order.items.length - 1">, </span>
            </span>
          </td>
          <td>{{ order.fulfillment === "livraison" ? "Livraison" : "Retrait" }}</td>
          <td>{{ order.total }} €</td>
          <td>
            <select :value="order.status" @change="updateStatus(order, $event.target.value)">
              <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 24px;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}

.orders-table th,
.orders-table td {
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
  vertical-align: top;
}

.orders-table th {
  background: var(--cream-deep);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.muted {
  display: block;
  color: var(--muted);
  font-size: 12px;
}

select {
  font: inherit;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
}
</style>
