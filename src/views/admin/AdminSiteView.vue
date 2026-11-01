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

const NETWORKS = [
  { key: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/votre_compte" },
  { key: "tiktok", label: "TikTok", placeholder: "https://www.tiktok.com/@votre_compte" },
  { key: "snapchat", label: "Snapchat", placeholder: "https://www.snapchat.com/add/votre_compte" },
  { key: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/votre_page" },
  { key: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/@votre_chaine" }
];

const socials = reactive({ instagram: "", tiktok: "", snapchat: "", facebook: "", youtube: "" });
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
  const [socialsRes, galleryRes] = await Promise.all([api("/api/admin/settings/socials"), api("/api/admin/gallery")]);
  if (!socialsRes.ok || !galleryRes.ok) {
    loadError.value = socialsRes.error || galleryRes.error;
  } else {
    Object.assign(socials, socialsRes.data.socials);
    images.value = galleryRes.data.images;
    maxImages.value = galleryRes.data.max;
  }
  loading.value = false;
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
    <h1>Galerie &amp; réseaux sociaux</h1>
    <p class="hint">
      Ce que vos client·e·s voient sur l'accueil : le diaporama de photos et les liens pour vous suivre.
    </p>

    <p v-if="loading">Chargement…</p>
    <LoadError v-else-if="loadError" :message="loadError" @retry="load" />

    <template v-else>
      <form class="card" @submit.prevent="saveSocials">
        <h2>Mes réseaux sociaux</h2>
        <p class="hint">Collez l'adresse de votre page. Laissez vide un réseau que vous n'utilisez pas : il ne sera pas affiché.</p>
        <div class="socials-grid">
          <label v-for="network in NETWORKS" :key="network.key">
            {{ network.label }}
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
            <h2>Galerie photos de l'accueil</h2>
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
