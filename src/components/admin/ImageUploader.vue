<script setup>
import { ref } from "vue";
import { api } from "../../api.js";

const props = defineProps({
  imageUrl: { type: String, default: null },
  uploadUrl: { type: String, required: true }
});
const emit = defineEmits(["uploaded"]);

const fileInput = ref(null);
const uploading = ref(false);
const error = ref("");

function pickFile() {
  fileInput.value?.click();
}

async function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  error.value = "";
  uploading.value = true;

  const formData = new FormData();
  formData.append("image", file);
  const res = await api(props.uploadUrl, { method: "POST", formData });
  if (res.ok) emit("uploaded", res.data);
  else error.value = res.error || "Échec de l'envoi.";
  uploading.value = false;
  event.target.value = "";
}
</script>

<template>
  <div class="image-uploader">
    <div class="thumb" role="button" tabindex="0" aria-label="Choisir une photo" @click="pickFile" @keydown.enter.prevent="pickFile" @keydown.space.prevent="pickFile">
      <img v-if="imageUrl" :src="imageUrl" alt="Photo actuelle" />
      <span v-else class="placeholder">📷</span>
      <div v-if="uploading" class="overlay">…</div>
    </div>
    <button type="button" class="link-btn" @click="pickFile">
      {{ imageUrl ? "Changer la photo" : "Ajouter une photo" }}
    </button>
    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="handleFile" />
    <p v-if="error" class="upload-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.image-uploader {
  display: grid;
  gap: 6px;
  justify-items: center;
  text-align: center;
}

.thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--cream-deep);
  border: 1.5px dashed var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  font-size: 22px;
  opacity: 0.6;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.link-btn {
  background: none;
  border: 0;
  color: var(--clay-dark);
  font-size: 11px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}

.upload-error {
  color: #a3202a;
  font-size: 11px;
  margin: 0;
  max-width: 140px;
}
</style>
