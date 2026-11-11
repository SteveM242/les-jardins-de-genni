<script setup>
import { onMounted, reactive, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import LoadError from "../../components/LoadError.vue";
import { api } from "../../api.js";
import { resizeImage } from "../../utils/resizeImage.js";
import { useToast } from "../../stores/toast.js";
import { useSiteContent } from "../../stores/siteContent.js";

const toast = useToast();
const content = useSiteContent();

// Sections de texte : un formulaire par section, enregistré indépendamment.
const SECTIONS = [
  {
    name: "sales",
    title: "Vente de la semaine",
    hint: "En mode automatique, la vente ouvre le samedi et ferme le lundi soir (heure de la Martinique), avec retrait le mercredi. Hors session, les commandes sont refusées. Vous pouvez forcer l'ouverture ou la fermeture, par exemple pour rouvrir exceptionnellement ou faire une pause.",
    fields: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        options: [
          { value: "auto", label: "Automatique (samedi → lundi soir)" },
          { value: "open", label: "Forcer : vente ouverte" },
          { value: "closed", label: "Forcer : vente fermée" }
        ]
      },
      { key: "closedMessage", label: "Message quand la vente est fermée (facultatif)", type: "text", placeholder: "ex: Pause cette semaine, retour samedi prochain !", maxlength: 200 }
    ]
  },
  {
    name: "announcement",
    title: "Annonce du moment",
    hint: "Un bandeau jaune tout en haut du site, par exemple « Commandes ouvertes jusqu'à jeudi 18h, retrait vendredi ». Les visiteurs peuvent le fermer.",
    fields: [
      { key: "text", label: "Message", type: "text", placeholder: "ex: Commandes ouvertes jusqu'à jeudi 18h, retrait vendredi", maxlength: 200 },
      { key: "active", label: "Afficher l'annonce sur le site", type: "checkbox" }
    ]
  },
  {
    name: "contact",
    title: "Coordonnées",
    hint: "Affichées sur la page Contact et en bas du site. Tant que le numéro WhatsApp est vide, aucun bouton WhatsApp n'apparaît ; même chose pour l'email.",
    fields: [
      { key: "whatsapp", label: "Numéro WhatsApp", type: "tel", placeholder: "ex: 0696 12 34 56" },
      { key: "email", label: "Email de contact", type: "email", placeholder: "ex: contact@heritagedesmornes.fr" },
      { key: "location", label: "Commune / zone", type: "text", placeholder: "ex: Ducos, Martinique", maxlength: 120 },
      { key: "hours", label: "Horaires", type: "text", placeholder: "ex: Du lundi au vendredi, 8h–18h", maxlength: 200 }
    ]
  },
  {
    name: "about",
    title: "Page « À propos »",
    hint: "Votre histoire, votre façon de cultiver. Laissez une ligne vide entre deux paragraphes. Vide = texte par défaut.",
    fields: [{ key: "text", label: "Texte de présentation", type: "textarea", rows: 8, maxlength: 4000 }]
  },
  {
    name: "checkout",
    title: "Retrait & livraison",
    hint: "Ces informations sont rappelées au client au moment de choisir son mode de réception.",
    fields: [
      { key: "pickupInfo", label: "Retrait", type: "textarea", rows: 3, placeholder: "ex: Retrait à Ducos le vendredi de 16h à 19h.", maxlength: 400 },
      { key: "deliveryInfo", label: "Livraison", type: "textarea", rows: 3, placeholder: "ex: Livraison à Fort-de-France et alentours, le samedi matin.", maxlength: 400 }
    ]
  },
  {
    name: "legal",
    title: "Mentions légales",
    hint: "Obligatoires pour un site qui vend. Elles alimentent la page « Mentions légales ». Renseignez ce qui concerne votre activité.",
    fields: [
      { key: "companyName", label: "Nom de l'exploitation / entreprise", type: "text", maxlength: 120 },
      { key: "legalForm", label: "Statut", type: "text", placeholder: "ex: Entreprise individuelle, EARL…", maxlength: 60 },
      { key: "siret", label: "SIRET (14 chiffres)", type: "text", maxlength: 20 },
      { key: "address", label: "Adresse", type: "text", maxlength: 300 },
      { key: "publisher", label: "Directeur·rice de la publication", type: "text", maxlength: 120 },
      { key: "phone", label: "Téléphone", type: "tel", maxlength: 40 },
      { key: "mediator", label: "Médiateur de la consommation (nom et coordonnées)", type: "textarea", rows: 2, maxlength: 300 }
    ]
  }
];

const forms = reactive(Object.fromEntries(SECTIONS.map((section) => [section.name, {}])));
const sectionErrors = reactive({});
const sectionSaving = reactive({});

const socials = reactive({ instagram: "", tiktok: "", snapchat: "", facebook: "", youtube: "" });
const SOCIAL_NETWORKS = [
  { key: "instagram", label: "Instagram", placeholder: "ex: @votre_compte" },
  { key: "tiktok", label: "TikTok", placeholder: "ex: @votre_compte" },
  { key: "snapchat", label: "Snapchat", placeholder: "ex: votre_pseudo" },
  { key: "facebook", label: "Facebook", placeholder: "ex: le nom de votre page" },
  { key: "youtube", label: "YouTube", placeholder: "ex: @votre_chaine" }
];
const socialsError = ref("");
const socialsSaving = ref(false);

const images = ref([]);
const maxImages = ref(24);
const loading = ref(true);
const loadError = ref("");
const uploading = ref(false);
const uploadStatus = ref("");
const fileInput = ref(null);

async function load() {
  loading.value = true;
  loadError.value = "";
  const [settingsRes, galleryRes] = await Promise.all([api("/api/admin/settings/all"), api("/api/admin/gallery")]);
  if (!settingsRes.ok || !galleryRes.ok) {
    loadError.value = settingsRes.error || galleryRes.error;
  } else {
    for (const section of SECTIONS) Object.assign(forms[section.name], settingsRes.data[section.name]);
    Object.assign(socials, settingsRes.data.socials);
    images.value = galleryRes.data.images;
    maxImages.value = galleryRes.data.max;
  }
  loading.value = false;
}

async function saveSection(section) {
  sectionErrors[section.name] = "";
  sectionSaving[section.name] = true;
  const res = await api(`/api/admin/settings/sections/${section.name}`, { method: "PUT", body: { value: forms[section.name] } });
  sectionSaving[section.name] = false;
  if (!res.ok) {
    sectionErrors[section.name] = res.error;
    return;
  }
  Object.assign(forms[section.name], res.data.value);
  await content.load({ force: true });
  toast.success("Enregistré : visible tout de suite sur le site.");
}

async function saveSocials() {
  socialsError.value = "";
  socialsSaving.value = true;
  const res = await api("/api/admin/settings/socials", { method: "PUT", body: { socials } });
  socialsSaving.value = false;
  if (!res.ok) {
    socialsError.value = res.error;
    return;
  }
  Object.assign(socials, res.data.socials);
  await content.load({ force: true });
  toast.success("Liens enregistrés : ils apparaissent maintenant sur le site.");
}

async function uploadFiles(event) {
  const files = [...(event.target.files || [])];
  event.target.value = "";
  if (files.length === 0) return;

  uploading.value = true;
  let done = 0;
  for (const file of files) {
    uploadStatus.value = `Envoi de la photo ${done + 1} sur ${files.length}…`;
    // Les photos de téléphone font plusieurs Mo : on les réduit avant l'envoi (limite serveur : 3 Mo).
    const resized = await resizeImage(file);
    const formData = new FormData();
    formData.append("image", resized);
    const res = await api("/api/admin/gallery", { method: "POST", formData });
    if (!res.ok) {
      toast.error(`${file.name} : ${res.error}`);
      if (res.status === 400 && /limitée/.test(res.error)) break;
      continue;
    }
    images.value.push(res.data.image);
    done += 1;
  }
  uploading.value = false;
  uploadStatus.value = "";
  if (done > 0) {
    await content.load({ force: true });
    toast.success(done === 1 ? "Photo ajoutée à la galerie." : `${done} photos ajoutées à la galerie.`);
  }
}

async function updateImage(image, patch) {
  const res = await api(`/api/admin/gallery/${image.id}`, { method: "PATCH", body: patch });
  if (!res.ok) return toast.error(res.error);
  Object.assign(image, res.data.image);
  await content.load({ force: true });
}

async function removeImage(image) {
  if (!confirm("Supprimer définitivement cette photo de la galerie ?")) return;
  const res = await api(`/api/admin/gallery/${image.id}`, { method: "DELETE" });
  if (!res.ok) return toast.error(res.error);
  images.value = images.value.filter((entry) => entry.id !== image.id);
  await content.load({ force: true });
}

async function move(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= images.value.length) return;
  const reordered = [...images.value];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const res = await api("/api/admin/gallery/reorder", { method: "POST", body: { ids: reordered.map((image) => image.id) } });
  if (!res.ok) {
    toast.error(res.error);
    return load();
  }
  images.value = reordered;
  await content.load({ force: true });
}

onMounted(load);
</script>

<template>
  <AdminNav>
    <h1>Contenu du site</h1>
    <p class="hint">
      Tout ce que vos client·e·s lisent et voient, modifiable ici sans passer par un développeur : annonce, coordonnées,
      présentation, photos, réseaux sociaux, mentions légales.
    </p>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="load" />

    <template v-else>
      <form v-for="section in SECTIONS" :id="section.name" :key="section.name" class="card" @submit.prevent="saveSection(section)">
        <h2>{{ section.title }}</h2>
        <p class="hint">{{ section.hint }}</p>
        <div class="fields-grid">
          <template v-for="field in section.fields" :key="field.key">
            <label v-if="field.type === 'checkbox'" class="check-field">
              <input v-model="forms[section.name][field.key]" type="checkbox" />
              {{ field.label }}
            </label>
            <label v-else-if="field.type === 'select'">
              {{ field.label }}
              <select v-model="forms[section.name][field.key]">
                <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <label v-else-if="field.type === 'textarea'" class="wide">
              {{ field.label }}
              <textarea v-model="forms[section.name][field.key]" :rows="field.rows || 3" :maxlength="field.maxlength" :placeholder="field.placeholder"></textarea>
            </label>
            <label v-else>
              {{ field.label }}
              <input v-model.trim="forms[section.name][field.key]" :type="field.type" :maxlength="field.maxlength" :placeholder="field.placeholder" autocomplete="off" />
            </label>
          </template>
        </div>
        <p v-if="sectionErrors[section.name]" class="form-error" role="alert">{{ sectionErrors[section.name] }}</p>
        <button type="submit" class="btn primary" :disabled="sectionSaving[section.name]">
          {{ sectionSaving[section.name] ? "Enregistrement…" : "Enregistrer" }}
        </button>
      </form>

      <form id="socials" class="card" @submit.prevent="saveSocials">
        <h2>Mes réseaux sociaux</h2>
        <p class="hint">
          Écrivez simplement votre pseudo (ex : <strong>@heritagedesmornes</strong>) ou collez l'adresse de votre page. Après l'enregistrement, cliquez sur
          « Tester » pour vérifier que le lien ouvre le bon profil. Un réseau laissé vide n'est pas affiché ; WhatsApp apparaît tout seul dès que
          votre numéro est renseigné plus haut.
          Vos visiteurs retrouvent tout sur la page <RouterLink to="/reseaux">Suivre L'Héritage des Mornes</RouterLink>.
        </p>
        <div class="socials-grid">
          <label v-for="network in SOCIAL_NETWORKS" :key="network.key">
            <span class="label-row">
              {{ network.label }}
              <a v-if="socials[network.key] && socials[network.key].startsWith('https://')" :href="socials[network.key]" target="_blank" rel="noopener noreferrer" class="test-link">Tester le lien ↗</a>
            </span>
            <input v-model.trim="socials[network.key]" type="url" inputmode="url" :placeholder="network.placeholder" autocomplete="off" />
          </label>
        </div>
        <p v-if="socialsError" class="form-error" role="alert">{{ socialsError }}</p>
        <button type="submit" class="btn primary" :disabled="socialsSaving">
          {{ socialsSaving ? "Enregistrement…" : "Enregistrer les liens" }}
        </button>
      </form>

      <section class="card" aria-label="Galerie photos">
        <div class="gallery-head">
          <div>
            <h2 id="gallery">Galerie photos de l'accueil</h2>
            <p class="hint">
              {{ images.length }} / {{ maxImages }} photos. Elles défilent dans cet ordre. Sans photo ici, le site affiche deux
              photos par défaut.
            </p>
          </div>
          <div>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden @change="uploadFiles" />
            <button type="button" class="btn primary" :disabled="uploading || images.length >= maxImages" @click="fileInput.click()">
              + Ajouter des photos
            </button>
          </div>
        </div>
        <p v-if="uploading" class="upload-status" role="status">{{ uploadStatus }}</p>

        <p v-if="images.length === 0" class="empty">Aucune photo pour le moment. Ajoutez-en pour montrer la beauté de votre jardin.</p>

        <ul v-else class="gallery-list">
          <li v-for="(image, index) in images" :key="image.id" class="gallery-item" :class="{ hidden: !image.active }">
            <img :src="image.url" :alt="image.caption || `Photo ${index + 1}`" loading="lazy" />
            <div class="gallery-fields">
              <label>
                Légende (facultative)
                <input
                  v-model.trim="image.caption"
                  type="text"
                  maxlength="140"
                  placeholder="ex: Le vent dans les bananiers, au lever du jour"
                  @change="updateImage(image, { caption: image.caption })"
                />
              </label>
              <div class="gallery-actions">
                <button type="button" class="chip-btn" :disabled="index === 0" :aria-label="`Monter la photo ${index + 1}`" @click="move(index, -1)">↑ Monter</button>
                <button type="button" class="chip-btn" :disabled="index === images.length - 1" :aria-label="`Descendre la photo ${index + 1}`" @click="move(index, 1)">↓ Descendre</button>
                <label class="visible-toggle">
                  <input type="checkbox" :checked="image.active" @change="updateImage(image, { active: $event.target.checked })" />
                  Affichée
                </label>
                <button type="button" class="link-btn" @click="removeImage(image)">Supprimer</button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 6px;
}

h2 {
  font-size: 17px;
  margin: 0 0 6px;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 18px;
  max-width: 640px;
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

.fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.fields-grid label,
.check-field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.fields-grid .wide {
  grid-column: 1 / -1;
}

.fields-grid input:not([type="checkbox"]),
.fields-grid textarea {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  color: var(--text);
  resize: vertical;
}

.fields-grid .check-field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text);
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.test-link {
  color: var(--clay-dark);
  font-weight: 700;
}

.socials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.socials-grid label,
.gallery-fields label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.socials-grid input,
.gallery-fields input[type="text"] {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  color: var(--text);
}

.card > .btn {
  justify-self: start;
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 0;
}

.gallery-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 14px;
}

.upload-status {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--green-dark);
}

.empty {
  color: var(--muted);
  margin: 0;
}

.gallery-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}

.gallery-item {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 16px;
  align-items: start;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--green-soft);
}

.gallery-item.hidden {
  opacity: 0.6;
  background: var(--cream);
}

.gallery-item img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

.gallery-fields {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.gallery-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.chip-btn {
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  background: #fff;
  color: var(--text);
  cursor: pointer;
}

.chip-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.visible-toggle {
  display: flex !important;
  align-items: center;
  gap: 6px !important;
  font-size: 13px !important;
  color: var(--text) !important;
}

.link-btn {
  background: none;
  border: 0;
  color: #a3202a;
  text-decoration: underline;
  cursor: pointer;
  font-size: 13px;
  margin-left: auto;
}

@media (max-width: 640px) {
  .gallery-item {
    grid-template-columns: 1fr;
  }
}
</style>
