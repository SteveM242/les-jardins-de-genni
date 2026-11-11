<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  // [{ url, caption }]
  slides: { type: Array, required: true },
  autoplayMs: { type: Number, default: 5000 }
});

const track = ref(null);
const current = ref(0);
const hovering = ref(false);
const userPaused = ref(false);
const reduceMotion = ref(false);

const multiple = computed(() => props.slides.length > 1);
const playing = computed(() => multiple.value && !userPaused.value && !reduceMotion.value);

function stepWidth() {
  const items = track.value?.children;
  if (!items || items.length < 2) return track.value?.clientWidth || 1;
  return items[1].offsetLeft - items[0].offsetLeft || 1;
}

function goTo(index) {
  const items = track.value?.children;
  if (!items?.length) return;
  const target = (index + items.length) % items.length;
  track.value.scrollTo({ left: items[target].offsetLeft, behavior: reduceMotion.value ? "auto" : "smooth" });
  current.value = target;
}

// Le défilement tactile / à la molette met à jour la pastille active.
let frame = 0;
function onScroll() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const el = track.value;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    current.value = atEnd ? props.slides.length - 1 : Math.round(el.scrollLeft / stepWidth());
  });
}

let timer = null;
onMounted(() => {
  reduceMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  timer = setInterval(() => {
    if (playing.value && !hovering.value && document.visibilityState === "visible") goTo(current.value + 1);
  }, props.autoplayMs);
});

onBeforeUnmount(() => {
  clearInterval(timer);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <section class="carousel" aria-roledescription="carrousel" aria-label="Photos de la Fée des Mornes" @mouseenter="hovering = true" @mouseleave="hovering = false" @focusin="hovering = true" @focusout="hovering = false">
    <div ref="track" class="track" tabindex="0" aria-label="Photos, faites défiler horizontalement" @scroll.passive="onScroll" @keydown.left.prevent="goTo(current - 1)" @keydown.right.prevent="goTo(current + 1)">
      <figure v-for="(slide, index) in slides" :key="slide.url" class="slide" :aria-label="`Photo ${index + 1} sur ${slides.length}`">
        <img :src="slide.url" :alt="slide.caption || 'Photo de L’Héritage des Mornes'" :loading="index === 0 ? 'eager' : 'lazy'" draggable="false" />
        <figcaption v-if="slide.caption">{{ slide.caption }}</figcaption>
      </figure>
    </div>

    <template v-if="multiple">
      <button type="button" class="nav prev" aria-label="Photo précédente" @click="goTo(current - 1)">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button type="button" class="nav next" aria-label="Photo suivante" @click="goTo(current + 1)">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>

      <div class="controls">
        <div class="dots">
          <button v-for="(slide, index) in slides" :key="slide.url" type="button" class="dot" :class="{ active: index === current }" :aria-label="`Aller à la photo ${index + 1}`" :aria-current="index === current ? 'true' : undefined" @click="goTo(index)"></button>
        </div>
        <button v-if="!reduceMotion" type="button" class="pause" :aria-label="userPaused ? 'Relancer le défilement automatique' : 'Mettre en pause le défilement automatique'" @click="userPaused = !userPaused">
          {{ userPaused ? "▶ Lecture" : "❚❚ Pause" }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.carousel {
  position: relative;
}

.track {
  position: relative; /* référence des offsetLeft des diapositives */
  display: flex;
  gap: 20px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  border-radius: 20px;
  padding-bottom: 2px;
}

.track::-webkit-scrollbar {
  display: none;
}

.track:focus-visible {
  outline: 3px solid var(--sea-dark);
  outline-offset: 3px;
}

.slide {
  position: relative;
  flex: 0 0 min(820px, 88%);
  aspect-ratio: 16 / 9;
  margin: 0;
  border-radius: 20px;
  overflow: hidden;
  scroll-snap-align: start;
  background: var(--green-tint);
  box-shadow: 0 8px 28px rgba(19, 80, 43, 0.14);
}

.slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
}

.slide figcaption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 48px 24px 20px;
  background: linear-gradient(180deg, transparent, rgba(6, 30, 18, 0.78));
  color: #fff;
  font-family: "Fraunces", Georgia, serif;
  font-size: clamp(16px, 2.2vw, 22px);
  line-height: 1.25;
}

.nav {
  position: absolute;
  top: calc(50% - 20px);
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--green-dark);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  transition: transform 150ms ease;
}

.nav:hover {
  transform: scale(1.08);
}

.nav.prev {
  left: 12px;
}

.nav.next {
  right: 12px;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 16px;
}

.dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 10px;
  height: 10px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--line);
  cursor: pointer;
  transition: width 200ms ease, background-color 200ms ease;
}

.dot.active {
  width: 28px;
  background: var(--green);
}

.pause {
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 700px) {
  .nav {
    display: none; /* sur mobile on balaie du doigt */
  }

  .slide {
    flex-basis: 92%;
    aspect-ratio: 4 / 3;
  }
}
</style>
