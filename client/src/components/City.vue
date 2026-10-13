<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { http } from '../api/http.js';
import WeatherOverview from './WeatherOverview.vue';

const destinations = ref([]);
const currentSlide = ref(0);
const searchQuery = ref('');
const weatherPlace = ref('');
const weatherResult = ref(null);
const weatherLoading = ref(false);
const weatherError = ref('');
const loading = ref(true);
const errorMessage = ref('');
const failedImages = ref(new Set());
let slideTimer;

const featuredDestination = computed(() => destinations.value[currentSlide.value] ?? null);
const weatherSuggestions = computed(() => destinations.value.slice(0, 5));

const filteredDestinations = computed(() => {
  const query = normalizeSearch(searchQuery.value);
  if (!query) return destinations.value;

  return destinations.value.filter((destination) => {
    const searchableText = [
      destination.name,
      destination.nameLocal,
      destination.country,
      destination.region,
      destination.tagline,
      ...(destination.tags ?? []),
    ].join(' ');

    return normalizeSearch(searchableText).includes(query);
  });
});

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .trim();
}

function hideFailedImage(id) {
  failedImages.value = new Set(failedImages.value).add(id);
}

function showSlide(index) {
  const slideCount = destinations.value.length;
  if (slideCount) currentSlide.value = (index + slideCount) % slideCount;
}

function nextSlide() {
  showSlide(currentSlide.value + 1);
}

function previousSlide() {
  showSlide(currentSlide.value - 1);
}

function stopSlideTimer() {
  if (slideTimer) {
    window.clearInterval(slideTimer);
    slideTimer = undefined;
  }
}

function startSlideTimer() {
  stopSlideTimer();
  if (destinations.value.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  slideTimer = window.setInterval(nextSlide, 3000);
}

function selectWeatherSuggestion(name) {
  weatherPlace.value = name;
  weatherResult.value = null;
  weatherError.value = '';
}

async function lookupWeather() {
  const place = weatherPlace.value.trim();
  if (!place) {
    weatherError.value = 'Nhập tên địa điểm để tra cứu thời tiết.';
    weatherResult.value = null;
    return;
  }

  weatherLoading.value = true;
  weatherError.value = '';
  weatherResult.value = null;

  try {
    const response = await http.get(`/weather/by-name/${encodeURIComponent(place)}`);
    weatherResult.value = response.data;
  } catch {
    weatherError.value = 'Chưa tìm được thời tiết cho địa điểm này.';
  } finally {
    weatherLoading.value = false;
  }
}

async function fetchDestinations() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await http.get('/city/list');
    destinations.value = Array.isArray(response.data) ? response.data : [];
  } catch {
    errorMessage.value = 'Chưa tải được danh sách điểm đến. Hãy thử lại sau.';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await fetchDestinations();
  startSlideTimer();
});

onUnmounted(stopSlideTimer);
</script>

<template>
  <main class="destinations-page">
    <section
      v-if="featuredDestination"
      class="featured-hero"
      aria-labelledby="featured-title"
      @mouseenter="stopSlideTimer"
      @mouseleave="startSlideTimer"
    >
      <img
        v-if="featuredDestination.images?.cover && !failedImages.has(featuredDestination.id)"
        :key="featuredDestination.id"
        class="featured-image"
        :src="featuredDestination.images.cover"
        :alt="`Phong cảnh ${featuredDestination.name}`"
        fetchpriority="high"
        @error="hideFailedImage(featuredDestination.id)"
      />
      <div class="featured-shade" />
      <div class="featured-copy">
        <p class="hero-eyebrow">
          <i class="bi bi-geo-alt-fill" aria-hidden="true" />
          {{ featuredDestination.region }} · {{ featuredDestination.country }}
        </p>
        <h1 id="featured-title">{{ featuredDestination.name }}</h1>
        <p class="featured-tagline">{{ featuredDestination.tagline }}</p>
        <a class="hero-action" href="#destinations">
          Khám phá điểm đến
          <i class="bi bi-arrow-down-right" aria-hidden="true" />
        </a>
      </div>
      <div v-if="destinations.length > 1" class="hero-controls" aria-label="Điều khiển banner">
        <button type="button" aria-label="Banner trước" @click="previousSlide">
          <i class="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <span aria-live="polite">{{ currentSlide + 1 }} / {{ destinations.length }}</span>
        <button type="button" aria-label="Banner tiếp theo" @click="nextSlide">
          <i class="bi bi-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div class="featured-rating" aria-label="Đánh giá điểm đến nổi bật">
        <i class="bi bi-star-fill" aria-hidden="true" />
        <strong>{{ featuredDestination.rating?.toFixed(1) ?? '—' }}</strong>
        <span>{{ featuredDestination.reviewCount?.toLocaleString('vi-VN') ?? 0 }} đánh giá</span>
      </div>
      <span class="image-credit">Ảnh điểm đến · {{ featuredDestination.name }}</span>
    </section>

    <section id="destinations" class="destination-content" aria-labelledby="destinations-title">
      <div class="section-heading">
        <div>
          <p class="section-eyebrow">Gợi ý hành trình</p>
          <h2 id="destinations-title">Điểm đến đáng nhớ</h2>
          <p class="section-intro">Tìm cảm hứng cho chuyến đi tiếp theo của bạn.</p>
        </div>
        <label class="destination-search">
          <i class="bi bi-search" aria-hidden="true" />
          <span class="visually-hidden">Tìm điểm đến</span>
          <input v-model="searchQuery" type="search" placeholder="Tìm thành phố, vùng miền..." />
        </label>
      </div>

      <p v-if="loading" class="list-state" role="status">Đang tìm những miền đáng nhớ...</p>
      <div v-else-if="errorMessage" class="list-state list-error" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="retry-button" @click="fetchDestinations">Thử lại</button>
      </div>
      <div v-else-if="filteredDestinations.length" class="destination-grid">
        <article
          v-for="(destination, index) in filteredDestinations"
          :key="destination.id"
          class="destination-card"
          :style="{ '--card-index': index }"
        >
          <div class="card-image-wrap">
            <div class="image-placeholder" aria-hidden="true">
              <i class="bi bi-image" />
            </div>
            <img
              v-if="destination.images?.cover && !failedImages.has(destination.id)"
              class="destination-image"
              :src="destination.images.cover"
              :alt="`Phong cảnh ${destination.name}`"
              loading="lazy"
              @error="hideFailedImage(destination.id)"
            />
            <span class="destination-region">{{ destination.region }}</span>
          </div>

          <div class="card-copy">
            <div class="card-title-row">
              <div>
                <p class="destination-country">{{ destination.country }}</p>
                <RouterLink
                  :to="{ name: 'destination-detail', params: { id: destination.id } }"
                  class="destination-title-link"
                >
                  <h3>{{ destination.name }}</h3>
                </RouterLink>
              </div>
              <span class="card-rating" :aria-label="`Đánh giá ${destination.rating} trên 5`">
                <i class="bi bi-star-fill" aria-hidden="true" />
                {{ destination.rating?.toFixed(1) ?? '—' }}
              </span>
            </div>
            <p class="destination-description">{{ destination.description }}</p>
            <div class="destination-tags" aria-label="Đặc trưng">
              <span v-for="tag in destination.tags?.slice(0, 3)" :key="tag">{{ tag }}</span>
            </div>
            <div class="card-footer">
              <span>{{ destination.reviewCount?.toLocaleString('vi-VN') ?? 0 }} đánh giá</span>
              <div class="card-actions">
                <RouterLink
                  :to="{ name: 'destination-detail', params: { id: destination.id } }"
                  class="detail-cta"
                >
                  Chi tiết <i class="bi bi-arrow-right" aria-hidden="true" />
                </RouterLink>
                <RouterLink
                  :to="{ name: 'assistant', query: { place: destination.name } }"
                  class="assistant-cta"
                >
                  Hỏi trợ lý <i class="bi bi-stars" aria-hidden="true" />
                </RouterLink>
              </div>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="list-state" role="status">
        Không tìm thấy điểm đến phù hợp với “{{ searchQuery }}”.
      </div>
    </section>

    <section class="home-weather" aria-labelledby="home-weather-title">
      <div class="home-weather-heading">
        <div>
          <p class="section-eyebrow">Thời tiết điểm đến</p>
          <h2 id="home-weather-title">Lên kế hoạch theo bầu trời</h2>
          <p class="section-intro">Thời tiết hiện tại và dự báo 7 ngày theo địa điểm bạn chọn.</p>
        </div>
        <form class="weather-search" @submit.prevent="lookupWeather">
          <label class="visually-hidden" for="home-weather-place">Tên địa điểm</label>
          <i class="bi bi-search" aria-hidden="true" />
          <input
            id="home-weather-place"
            v-model="weatherPlace"
            type="search"
            placeholder="Nhập tên địa điểm..."
          />
          <button type="submit" :disabled="weatherLoading">
            <i class="bi bi-arrow-right" aria-hidden="true" />
            {{ weatherLoading ? 'Đang tra...' : 'Tra cứu' }}
          </button>
        </form>
      </div>

      <div v-if="weatherSuggestions.length" class="weather-suggestions" aria-label="Gợi ý địa điểm">
        <span>Gợi ý</span>
        <button
          v-for="destination in weatherSuggestions"
          :key="destination.id"
          type="button"
          :aria-pressed="weatherPlace === destination.name"
          @click="selectWeatherSuggestion(destination.name)"
        >
          {{ destination.name }}
        </button>
      </div>

      <p v-if="weatherLoading" class="weather-message" role="status">Đang lấy dữ liệu thời tiết...</p>
      <p v-else-if="weatherError" class="weather-message weather-error" role="alert">{{ weatherError }}</p>
      <div v-else-if="weatherResult" class="home-weather-result">
        <div class="weather-result-heading">
          <h3>{{ weatherResult.cityName }}</h3>
          <span>Hôm nay + 7 ngày tới</span>
        </div>
        <WeatherOverview :weather="weatherResult" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.destinations-page {
  padding: 26px 28px 76px;
}

.featured-hero {
  position: relative;
  display: flex;
  width: min(100%, 1376px);
  min-height: clamp(380px, 58vh, 570px);
  align-items: flex-end;
  overflow: hidden;
  margin: 0 auto;
  border-radius: 6px;
  background: #274e3d;
  color: #fff;
  isolation: isolate;
}

.featured-image,
.featured-shade {
  position: absolute;
  z-index: -1;
  inset: 0;
  width: 100%;
  height: 100%;
}

.featured-image {
  object-fit: cover;
  animation: hero-reveal 800ms ease-out both;
}

.featured-shade {
  background: linear-gradient(90deg, rgba(5, 30, 20, 0.76) 0%, rgba(5, 30, 20, 0.26) 66%, rgba(5, 30, 20, 0.12) 100%),
    linear-gradient(0deg, rgba(5, 30, 20, 0.44), transparent 44%);
}

.featured-copy {
  width: min(760px, 78%);
  padding: clamp(28px, 6vw, 78px);
  animation: content-reveal 600ms 100ms ease-out both;
}

.hero-controls {
  position: absolute;
  z-index: 4;
  top: 50%;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 9px;
  transform: translateY(-50%);
}

.hero-controls button {
  display: grid;
  width: 38px;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 50%;
  background: rgba(13, 35, 25, 0.55);
  color: #fff;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.hero-controls button:hover {
  background: var(--color-primary);
}

.hero-controls span {
  min-width: 34px;
  color: #fff;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.hero-eyebrow,
.section-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.hero-eyebrow {
  color: #e7d7b9;
}

.featured-copy h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(52px, 7vw, 96px);
  font-weight: 400;
  line-height: 0.98;
}

.featured-tagline {
  max-width: 540px;
  margin: 18px 0 24px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 16px;
  line-height: 1.7;
}

.hero-action {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  gap: 18px;
  padding: 0 17px;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 3px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.hero-action:hover {
  background: #fff;
  color: var(--color-primary);
}

.featured-rating {
  position: absolute;
  right: 26px;
  bottom: 24px;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 7px;
  padding: 12px 15px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  background: rgba(13, 35, 25, 0.55);
  backdrop-filter: blur(10px);
}

.featured-rating > i,
.card-rating i {
  color: #e7bd72;
  font-size: 12px;
}

.featured-rating strong {
  font-size: 14px;
}

.featured-rating span {
  grid-column: 1 / -1;
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 10px;
}

.image-credit {
  position: absolute;
  right: 18px;
  top: 14px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 9px;
}

.destination-content {
  width: min(100%, 1280px);
  margin: 0 auto;
  padding-top: 62px;
}

.home-weather {
  width: min(100%, 1280px);
  margin: 58px auto 0;
  padding: clamp(22px, 4vw, 42px);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: #e8eee9;
}

.home-weather-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
}

.home-weather-heading h2 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 400;
  line-height: 1.12;
}

.weather-search {
  display: flex;
  width: min(100%, 390px);
  min-height: 46px;
  align-items: center;
  gap: 10px;
  padding: 4px 5px 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-surface);
  color: var(--color-muted);
}

.weather-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: 11px;
}

.weather-search button {
  display: inline-flex;
  min-height: 34px;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 2px;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

.weather-search button:hover:not(:disabled) {
  background: var(--color-primary-soft);
}

.weather-search button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.weather-suggestions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
}

.weather-suggestions > span {
  margin-right: 2px;
  color: var(--color-muted);
  font-size: 9px;
}

.weather-suggestions button {
  min-height: 27px;
  padding: 4px 9px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 9px;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.weather-suggestions button:hover,
.weather-suggestions button[aria-pressed='true'] {
  border-color: #c4d0c7;
  background: #e8eee9;
}

.weather-message {
  margin: 18px 0 0;
  color: var(--color-muted);
  font-size: 11px;
}

.weather-error {
  color: var(--color-secondary);
}

.home-weather-result {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e8e3da;
}

.weather-result-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.weather-result-heading h3 {
  margin: 0;
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 500;
}

.weather-result-heading span {
  color: var(--color-muted);
  font-size: 9px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 26px;
}

.section-eyebrow {
  margin-bottom: 8px;
  color: var(--color-secondary);
  font-size: 10px;
}

.section-heading h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 42px;
  font-weight: 400;
  line-height: 1.1;
}

.section-intro {
  margin: 9px 0 0;
  color: var(--color-muted);
  font-size: 13px;
}

.destination-search {
  display: flex;
  width: min(100%, 350px);
  min-height: 46px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-surface);
  color: var(--color-muted);
}

.destination-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: 12px;
}

.destination-search input::placeholder {
  color: #858982;
}

.destination-search:focus-within {
  border-color: var(--color-primary-soft);
  box-shadow: 0 0 0 3px rgba(27, 67, 50, 0.1);
}

.destination-search kbd {
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  color: var(--color-muted);
  font-size: 10px;
}

.destination-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.destination-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-surface);
  animation: content-reveal 480ms calc(var(--card-index) * 60ms) ease-out both;
}

.card-image-wrap {
  position: relative;
  aspect-ratio: 1.72;
  overflow: hidden;
  background: #e6e2dd;
}

.image-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #829086;
  font-size: 25px;
}

.destination-image {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 300ms ease;
}

.destination-card:hover .destination-image {
  transform: scale(1.035);
}

.destination-region {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 6px 9px;
  border-radius: 2px;
  background: rgba(1, 45, 29, 0.88);
  color: #fff;
  font-size: 10px;
}

.card-copy {
  padding: 17px;
}

.card-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.destination-country {
  margin: 0 0 4px;
  color: var(--color-secondary);
  font-size: 10px;
  font-weight: 600;
}

.card-title-row h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 500;
}

.destination-title-link {
  color: var(--color-ink);
  text-decoration: none;
}

.destination-title-link:hover {
  color: var(--color-primary-soft);
}

.card-rating {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding-top: 3px;
  color: var(--color-ink);
  font-size: 11px;
  font-weight: 700;
}

.card-rating i {
  color: var(--color-secondary);
  font-size: 10px;
}

.destination-description {
  margin: 11px 0 13px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.65;
}

.destination-tags {
  display: flex;
  min-height: 26px;
  flex-wrap: wrap;
  gap: 6px;
}

.destination-tags span {
  padding: 5px 8px;
  border-radius: 2px;
  background: #f1ede8;
  color: #515950;
  font-size: 9px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid #eeeae4;
  color: var(--color-muted);
  font-size: 9px;
}

.assistant-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 700;
  text-decoration: none;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 13px;
}

.detail-cta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-secondary);
  font-size: 10px;
  font-weight: 700;
  text-decoration: none;
}

.detail-cta:hover {
  color: var(--color-primary);
}

.assistant-cta:hover {
  color: var(--color-secondary);
}

.list-state {
  display: flex;
  min-height: 140px;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--color-muted);
  font-size: 13px;
  text-align: center;
}

.list-error {
  flex-direction: column;
}

.retry-button {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--color-primary);
  border-radius: 3px;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 11px;
}

@keyframes hero-reveal {
  from { transform: scale(1.025); opacity: 0.65; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes content-reveal {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 900px) {
  .destination-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .featured-rating {
    right: 18px;
    bottom: 18px;
  }
}

@media (max-width: 760px) {
  .home-weather-heading {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
  }

  .weather-search {
    width: 100%;
  }
}

@media (max-width: 620px) {
  .destinations-page {
    padding: 14px 14px 48px;
  }

  .featured-hero {
    min-height: 460px;
    align-items: flex-end;
    border-radius: 4px;
  }

  .featured-shade {
    background: linear-gradient(0deg, rgba(5, 30, 20, 0.82), rgba(5, 30, 20, 0.03) 86%);
  }

  .featured-copy {
    width: 100%;
    padding: 28px 22px 112px;
  }

  .featured-copy h1 {
    font-size: 56px;
  }

  .featured-tagline {
    margin: 12px 0 18px;
    font-size: 13px;
  }

  .featured-rating {
    right: 16px;
    bottom: 16px;
  }

  .hero-controls {
    top: auto;
    right: 16px;
    bottom: 78px;
    transform: none;
  }

  .hero-controls button {
    width: 34px;
  }

  .image-credit {
    right: 12px;
    top: 10px;
    font-size: 8px;
  }

  .destination-content {
    padding-top: 42px;
  }

  .home-weather {
    margin-top: 38px;
    padding: 20px 15px;
  }

  .home-weather-heading h2 {
    font-size: 29px;
  }

  .section-heading {
    align-items: stretch;
    flex-direction: column;
    gap: 18px;
    margin-bottom: 20px;
  }

  .section-heading h2 {
    font-size: 36px;
  }

  .destination-search {
    width: 100%;
  }

  .destination-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  .destination-card {
    display: grid;
    grid-template-columns: 38% minmax(0, 1fr);
  }

  .card-image-wrap {
    min-height: 100%;
    aspect-ratio: auto;
  }

  .destination-region {
    left: 7px;
    bottom: 7px;
    max-width: calc(100% - 14px);
    font-size: 8px;
  }

  .card-copy {
    padding: 12px;
  }

  .card-title-row h3 {
    font-size: 22px;
  }

  .destination-description {
    margin: 7px 0 9px;
    font-size: 10px;
  }

  .destination-tags {
    gap: 4px;
  }

  .destination-tags span {
    padding: 4px 6px;
    font-size: 8px;
  }

  .card-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
    margin-top: 10px;
  }
}

@media (max-width: 390px) {
  .destination-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .card-image-wrap {
    aspect-ratio: 1.72;
  }

  .card-copy {
    padding: 14px;
  }

  .card-footer {
    align-items: center;
    flex-direction: row;
  }

  .card-actions {
    gap: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>