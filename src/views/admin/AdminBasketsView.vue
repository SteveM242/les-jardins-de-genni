<script setup>
import { onMounted, reactive, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import ImageUploader from "../../components/admin/ImageUploader.vue";
import LoadError from "../../components/LoadError.vue";
import { useAdminResource } from "../../composables/useAdminResource.js";
import { useToast } from "../../stores/toast.js";

const { items: baskets, loading, loadError, load, create, update, remove, applyUploaded } = useAdminResource({
  endpoint: "/api/admin/baskets",
  listKey: "baskets",
  itemKey: "basket"
});

const handleImageUploaded = applyUploaded;

const error = ref("");
const newBasket = reactive({ name: "", price: "", summary: "" });
const newItemDraft = reactive({});

const toast = useToast();

const MAX_PRICE = 1000;
const BIG_PRICE_CHANGE = 0.3; // au-delà de 30 % d'écart, on demande confirmation

// Dernières valeurs enregistrées : on y revient si une saisie est refusée ou annulée.
const saved = new Map();
function remember(basket) {
  saved.set(basket.id, {
    name: basket.name,
    price: basket.price,
    summary: basket.summary,
    details: basket.details,
    active: basket.active
  });
}
function restore(basket, field) {
  const before = saved.get(basket.id);
  if (before) basket[field] = before[field];
}

function formatEuros(value) {
  return `${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

// Enregistre un champ après contrôle ; remet l'ancienne valeur si c'est refusé, avec un retour visible.
async function saveField(basket, field) {
  const before = saved.get(basket.id);
  let value = basket[field];

  if (field === "name") {
    value = String(value || "").trim();
    if (!value) {
      toast.error("Le nom du panier ne peut pas être vide.");
      restore(basket, field);
      return;
    }
  }
  if (field === "price") {
    value = Number(value);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Le prix doit être supérieur à 0.");
      restore(basket, field);
      return;
    }
    if (value > MAX_PRICE) {
      toast.error(`Le prix semble trop élevé (maximum ${MAX_PRICE} €). Vérifiez la valeur saisie.`);
      restore(basket, field);
      return;
    }
    const old = Number(before?.price);
    if (old > 0 && Math.abs(value - old) / old > BIG_PRICE_CHANGE) {
      const ok = confirm(
        `Le prix de « ${basket.name} » passe de ${formatEuros(old)} à ${formatEuros(value)}.\n\nCe changement est important et sera visible tout de suite par vos client·e·s. Confirmer ?`
      );
      if (!ok) {
        restore(basket, field);
        return;
      }
    }
  }
  if (before && before[field] === value) return; // rien n'a changé

  const ok = await update(basket, { [field]: value });
  if (ok) {
    remember(basket);
    toast.success(`« ${basket.name} » enregistré.`);
  } else {
    restore(basket, field);
  }
}

async function toggleActive(basket, event) {
  const wanted = event.target.checked;
  if (!wanted && !confirm(`Retirer « ${basket.name} » de la vente ? Vos client·e·s ne pourront plus le commander.`)) {
    event.target.checked = true;
    return;
  }
  if (wanted && basket.items.length === 0) {
    toast.error("Ajoutez au moins un article au panier avant de le mettre en vente.");
    event.target.checked = false;
    return;
  }
  const ok = await update(basket, { active: wanted });
  if (ok) {
    remember(basket);
    toast.success(wanted ? `« ${basket.name} » est en vente.` : `« ${basket.name} » est retiré de la vente.`);
  } else {
    event.target.checked = !wanted;
  }
}

async function updateBasket(basket, patch, message) {
  const ok = await update(basket, patch);
  if (ok) toast.success(message || `« ${basket.name} » enregistré.`);
  return ok;
}

async function addBasket() {
  error.value = "";
  const price = Number(newBasket.price);
  if (!newBasket.name.trim()) {
    error.value = "Le nom du panier est obligatoire.";
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    error.value = "Le prix doit être supérieur à 0.";
    return;
  }
  if (price > MAX_PRICE) {
    error.value = `Le prix semble trop élevé (maximum ${MAX_PRICE} €). Vérifiez la valeur saisie.`;
    return;
  }
  const result = await create({ ...newBasket }, { prepend: true });
  if (!result.ok) {
    error.value = result.error;
    return;
  }
  remember(result.item);
  toast.success(`Panier « ${result.item.name} » créé. Ajoutez son contenu puis mettez-le en vente.`);
  newBasket.name = "";
  newBasket.price = "";
  newBasket.summary = "";
}

async function removeBasket(basket) {
  const ok = await remove(
    basket,
    `Supprimer définitivement « ${basket.name} » ?\n\nLe panier disparaît du site. Les commandes déjà passées gardent leur contenu. Cette action est irréversible.`
  );
  if (ok) toast.success(`« ${basket.name} » supprimé.`);
}

async function addItem(basket) {
  const text = (newItemDraft[basket.id] || "").trim();
  if (!text) return;
  if (text.length > 80) {
    toast.error("Un article ne peut pas dépasser 80 caractères.");
    return;
  }
  if (basket.items.some((item) => item.toLowerCase() === text.toLowerCase())) {
    toast.error(`« ${text} » est déjà dans ce panier.`);
    return;
  }
  if (basket.items.length >= 40) {
    toast.error("Un panier contient au plus 40 articles.");
    return;
  }
  if (await updateBasket(basket, { items: [...basket.items, text] }, `« ${text} » ajouté.`)) {
    newItemDraft[basket.id] = "";
  }
}

async function removeItem(basket, index) {
  const item = basket.items[index];
  // Retirer le dernier article d'un panier en vente le laisserait vide : on le retire aussi de la vente.
  const lastOnSale = basket.active && basket.items.length === 1;
  if (lastOnSale && !confirm(`C'est le dernier article : « ${basket.name} » sera aussi retiré de la vente. Continuer ?`)) return;
  const ok = await updateBasket(
    basket,
    { items: basket.items.filter((_, i) => i !== index), ...(lastOnSale ? { active: false } : {}) },
    `« ${item} » retiré.`
  );
  if (ok) remember(basket);
}

onMounted(async () => {
  await load();
  baskets.value.forEach(remember);
});
</script>

<template>
  <AdminNav>
    <h1>Paniers</h1>
    <p class="hint">
      Créez un panier, fixez son prix, ajoutez les articles qu'il contient et une photo. C'est ce
      que vos client·e·s verront et pourront commander.
    </p>

    <form class="new-basket" @submit.prevent="addBasket">
      <h2>Créer un panier</h2>
      <div class="new-basket-grid">
        <label>
          Nom
          <input v-model.trim="newBasket.name" maxlength="120" placeholder="ex: Panier du mois" />
        </label>
        <label>
          Prix (€)
          <input v-model.number="newBasket.price" type="number" step="0.01" min="0.01" :max="MAX_PRICE" placeholder="0.00" />
        </label>
        <label class="summary-field">
          Résumé (une phrase)
          <input v-model.trim="newBasket.summary" maxlength="500" placeholder="ex: Un panier de saison, pensé pour..." />
        </label>
        <button type="submit" class="btn primary">+ Créer le panier</button>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </form>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="load" />

    <div v-else class="baskets-grid">
      <div v-for="basket in baskets" :key="basket.id" class="basket-card">
        <div class="basket-card-head">
          <ImageUploader
            :image-url="basket.image"
            :upload-url="`/api/admin/baskets/${basket.id}/image`"
            @uploaded="(data) => handleImageUploaded(basket, data)"
          />
          <label class="active-toggle">
            <input
              type="checkbox"
              :checked="basket.active"
              @change="toggleActive(basket, $event)"
            />
            En vente
          </label>
        </div>

        <label>
          Nom
          <input v-model.trim="basket.name" maxlength="120" required @change="saveField(basket, 'name')" />
        </label>

        <label>
          Prix (€)
          <input
            v-model.number="basket.price"
            type="number"
            step="0.01"
            min="0.01"
            :max="MAX_PRICE"
            required
            @change="saveField(basket, 'price')"
          />
        </label>

        <label>
          Résumé
          <textarea v-model.trim="basket.summary" rows="2" maxlength="500" @change="saveField(basket, 'summary')"></textarea>
        </label>

        <label>
          Description
          <textarea v-model.trim="basket.details" rows="3" maxlength="2000" @change="saveField(basket, 'details')"></textarea>
        </label>

        <div class="items-field">
          <span class="items-label">Contenu du panier ({{ basket.items.length }} article{{ basket.items.length > 1 ? "s" : "" }})</span>
          <div class="items-tags">
            <span v-for="(item, index) in basket.items" :key="index" class="item-tag">
              {{ item }}
              <button type="button" @click="removeItem(basket, index)" aria-label="Retirer">×</button>
            </span>
            <span v-if="basket.items.length === 0" class="items-empty">Aucun article listé : le panier ne peut pas être mis en vente.</span>
          </div>
          <div class="item-add-row">
            <input
              v-model="newItemDraft[basket.id]"
              maxlength="80"
              placeholder="ex: Mangues"
              @keyup.enter="addItem(basket)"
            />
            <button type="button" class="btn ghost" @click="addItem(basket)">Ajouter</button>
          </div>
        </div>

        <div class="basket-footer">
          <button type="button" class="link-btn" @click="removeBasket(basket)">Supprimer ce panier</button>
        </div>
      </div>
    </div>
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
  max-width: 640px;
  margin: 0 0 24px;
}

.new-basket {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 32px;
}

.new-basket h2 {
  font-size: 15px;
  margin: 0 0 16px;
}

.new-basket-grid {
  display: grid;
  grid-template-columns: 1fr 140px 2fr auto;
  gap: 14px;
  align-items: end;
}

.new-basket-grid label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.new-basket-grid input {
  font: inherit;
  padding: 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
}

.new-basket-grid .btn {
  padding: 11px 16px;
  white-space: nowrap;
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 14px 0 0;
}

.baskets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.basket-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.basket-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.active-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.basket-card label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.basket-card input,
.basket-card textarea {
  font: inherit;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  color: var(--text);
}

.items-field {
  display: grid;
  gap: 8px;
}

.items-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.items-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
}

.item-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--cream-deep);
  border-radius: 999px;
  padding: 4px 6px 4px 10px;
  font-size: 12px;
}

.item-tag button {
  background: none;
  border: 0;
  cursor: pointer;
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
  padding: 2px;
}

.item-tag button:hover {
  color: #a3202a;
}

.items-empty {
  font-size: 12px;
  color: var(--muted);
  font-style: italic;
}

.item-add-row {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.item-add-row input {
  flex: 1;
  min-width: 0;
}

.item-add-row .btn {
  flex-shrink: 0;
}

.item-add-row .btn {
  padding: 8px 12px;
  font-size: 12px;
  white-space: nowrap;
}

.basket-footer {
  padding-top: 8px;
  border-top: 1px solid var(--line);
  text-align: right;
}

.link-btn {
  background: none;
  border: 0;
  color: #a3202a;
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
}

@media (max-width: 640px) {
  .new-basket-grid {
    grid-template-columns: 1fr;
  }
}
</style>
