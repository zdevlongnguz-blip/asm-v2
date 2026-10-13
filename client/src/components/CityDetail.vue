<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { http } from '../api/http.js';
import WeatherOverview from './WeatherOverview.vue';

const route = useRoute();
const destination = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const failedImages = ref(new Set());
const weatherData = ref(null);
const weatherLoading = ref(false);
const weatherError = ref('');

const galleryImages = computed(() => {
  const urls = [destination.value?.images?.cover, ...(destination.value?.images?.gallery ?? [])];
  return [...new Set(urls.filter(Boolean))];
});

function hideFailedImage(url) {
  failedImages.value = new Set(failedImages.value).add(url);
}

async function fetchDestination(id) {
  loading.value = true;
  destination.value = null;
  errorMessage.value = '';
  failedImages.value = new Set();
  weatherData.value = null;
  weatherError.value = '';

  try {
    const response = await http.get(`/city/${encodeURIComponent(id)}`);
    destination.value = response.data;
  } catch (error) {
    errorMessage.value = error.response?.status === 404
      ? 'Không tìm thấy điểm đến này.'
      : 'Chưa tải được thông tin điểm đến. Hãy thử lại sau.';
  } finally {
    loading.value = false;
  }
}

async function loadWeather() {
  if (weatherData.value || weatherLoading.value) return;

  const coordinates = destination.value?.coordinates;
  if (!Number.isFinite(Number(coordinates?.lat)) || !Number.isFinite(Number(coordinates?.lng))) {
    weatherError.value = 'Điểm đến chưa có tọa độ hợp lệ để tra cứu thời tiết.';
    return;
  }

  weatherLoading.value = true;
  weatherError.value = '';

  try {
    const response = await http.get('/weather/by-coordinates', {
      params: { lat: coordinates.lat, lon: coordinates.lng },
    });
    weatherData.value = response.data;
  } catch {
    weatherError.value = 'Chưa tải được thời tiết cho điểm đến này.';
  } finally {
    weatherLoading.value = false;
  }
}

watch(() => route.params.id, fetchDestination, { immediate: true });
</script>

<template>
  <main class="detail-page">
    <div v-if="loading" class="detail-state" role="status">Đang tải hành trình...</div>
    <div v-else-if="errorMessage" class="detail-state detail-error" role="alert">
      <p>{{ errorMessage }}</p>
      <RouterLink to="/" class="back-link">
        <i class="bi bi-arrow-left" aria-hidden="true" /> Quay lại điểm đến
      </RouterLink>
    </div>

    <article v-else-if="destination" class="destination-detail">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <RouterLink to="/">Điểm đến</RouterLink>
        <i class="bi bi-chevron-right" aria-hidden="true" />
        <span aria-current="page">{{ destination.name }}</span>
      </nav>

      <header class="detail-hero">
        <img
          v-if="destination.images?.cover && !failedImages.has(destination.images.cover)"
          class="detail-cover"
          :src="destination.images.cover"
          :alt="`Toàn cảnh ${destination.name}`"
          fetchpriority="high"
          @error="hideFailedImage(destination.images.cover)"
        />
        <div class="detail-cover-fallback" />
        <div class="detail-cover-shade" />
        <div class="hero-copy">
          <p class="detail-eyebrow">
            <i class="bi bi-geo-alt-fill" aria-hidden="true" />
            {{ destination.region }} · {{ destination.country }}
          </p>
          <h1>{{ destination.name }}</h1>
          <p class="detail-tagline">{{ destination.tagline }}</p>
          <div class="hero-meta">
            <span><i class="bi bi-star-fill" aria-hidden="true" /> {{ destination.rating?.toFixed(1) ?? '—' }}</span>
            <span>{{ destination.reviewCount?.toLocaleString('vi-VN') ?? 0 }} đánh giá</span>
          </div>
        </div>
        <span class="photo-credit">Ảnh: {{ destination.name }}</span>
      </header>

      <div class="detail-layout">
        <div class="detail-main-column">
          <section class="intro-section" aria-labelledby="about-title">
            <p class="section-kicker">Câu chuyện điểm đến</p>
            <h2 id="about-title">Một miền đất, nhiều điều để nhớ</h2>
            <p class="destination-long-description">{{ destination.description }}</p>
          </section>

          <section v-if="galleryImages.length" class="gallery-section" aria-labelledby="gallery-title">
            <div class="detail-section-heading">
              <div>
                <p class="section-kicker">Khoảnh khắc</p>
                <h2 id="gallery-title">Góc nhìn {{ destination.name }}</h2>
              </div>
              <span>{{ galleryImages.length }} ảnh</span>
            </div>
            <div class="photo-gallery" :class="{ 'gallery-two': galleryImages.length === 2 }">
              <figure v-for="(image, index) in galleryImages" :key="image" class="gallery-item">
                <div class="gallery-placeholder" aria-hidden="true">
                  <i class="bi bi-image" />
                </div>
                <img
                  v-if="!failedImages.has(image)"
                  :src="image"
                  :alt="`${destination.name}, góc ảnh ${index + 1}`"
                  loading="lazy"
                  @error="hideFailedImage(image)"
                />
                <figcaption>{{ destination.name }} · 0{{ index + 1 }}</figcaption>
              </figure>
            </div>
          </section>

          <section v-if="destination.attractions?.length" class="content-section" aria-labelledby="attractions-title">
            <div class="detail-section-heading">
              <div>
                <p class="section-kicker">Nên ghé thăm</p>
                <h2 id="attractions-title">Điểm tham quan</h2>
              </div>
              <span>{{ destination.attractions.length }} địa điểm</span>
            </div>
            <div class="attraction-list">
              <article v-for="(attraction, index) in destination.attractions" :key="attraction.id" class="attraction-item">
                <span class="item-index">0{{ index + 1 }}</span>
                <div class="attraction-copy">
                  <div class="attraction-title-row">
                    <h3>{{ attraction.name }}</h3>
                    <span v-if="attraction.rating" class="item-rating">
                      <i class="bi bi-star-fill" aria-hidden="true" /> {{ attraction.rating.toFixed(1) }}
                    </span>
                  </div>
                  <p class="item-category">{{ attraction.category }}</p>
                  <p>{{ attraction.description }}</p>
                  <div class="attraction-facts">
                    <span v-if="attraction.address"><i class="bi bi-geo-alt" aria-hidden="true" /> {{ attraction.address }}</span>
                    <span v-if="attraction.openingHours"><i class="bi bi-clock" aria-hidden="true" /> {{ attraction.openingHours }}</span>
                    <span v-if="attraction.ticketPrice"><i class="bi bi-ticket-perforated" aria-hidden="true" /> {{ attraction.ticketPrice }}</span>
                    <span v-if="attraction.duration"><i class="bi bi-hourglass-split" aria-hidden="true" /> {{ attraction.duration }}</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section v-if="destination.food?.length" class="content-section" aria-labelledby="food-title">
            <div class="detail-section-heading">
              <div>
                <p class="section-kicker">Hương vị địa phương</p>
                <h2 id="food-title">Món ngon nên thử</h2>
              </div>
            </div>
            <div class="editorial-list food-list">
              <article v-for="food in destination.food" :key="food.name" class="editorial-item">
                <div>
                  <h3>{{ food.name }}</h3>
                  <p>{{ food.description }}</p>
                </div>
                <span v-if="food.priceRange" class="item-price">{{ food.priceRange }}</span>
              </article>
            </div>
          </section>

          <section v-if="destination.hotels?.length" class="content-section" aria-labelledby="stay-title">
            <div class="detail-section-heading">
              <div>
                <p class="section-kicker">Nơi dừng chân</p>
                <h2 id="stay-title">Gợi ý lưu trú</h2>
              </div>
            </div>
            <div class="stay-grid">
              <article v-for="hotel in destination.hotels" :key="hotel.name" class="stay-item">
                <p class="item-category">{{ hotel.category }}</p>
                <h3>{{ hotel.name }}</h3>
                <p class="stay-price">{{ hotel.pricePerNight }} <span>/ đêm</span></p>
                <span v-if="hotel.rating" class="item-rating">
                  <i class="bi bi-star-fill" aria-hidden="true" /> {{ hotel.rating.toFixed(1) }}
                </span>
              </article>
            </div>
          </section>
        </div>

        <aside class="detail-aside">
          <section class="facts-panel" aria-labelledby="trip-facts-title">
            <p class="section-kicker">Lên kế hoạch</p>
            <h2 id="trip-facts-title">Thông tin chuyến đi</h2>
            <dl class="trip-facts">
              <div>
                <dt><i class="bi bi-calendar3" aria-hidden="true" /> Thời điểm đẹp</dt>
                <dd>{{ destination.bestTimeToVisit }}</dd>
              </div>
              <div>
                <dt><i class="bi bi-cloud-sun" aria-hidden="true" /> Khí hậu</dt>
                <dd>{{ destination.climate }}</dd>
              </div>
              <div>
                <dt><i class="bi bi-cash-coin" aria-hidden="true" /> Chi phí/ngày</dt>
                <dd v-if="destination.averageDailyCost">
                  <span>Tiết kiệm: {{ destination.averageDailyCost.budget }}</span>
                  <span>Vừa phải: {{ destination.averageDailyCost.midRange }}</span>
                  <span>Cao cấp: {{ destination.averageDailyCost.luxury }}</span>
                </dd>
              </div>
              <div>
                <dt><i class="bi bi-translate" aria-hidden="true" /> Ngôn ngữ</dt>
                <dd>{{ destination.language?.join(', ') }}</dd>
              </div>
              <div>
                <dt><i class="bi bi-clock" aria-hidden="true" /> Múi giờ</dt>
                <dd>{{ destination.timezone }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="destination.transport" class="transport-panel" aria-labelledby="transport-title">
            <p class="section-kicker">Di chuyển</p>
            <h2 id="transport-title">Cách đến đây</h2>
            <ul>
              <li v-for="item in destination.transport.gettingThere" :key="item">{{ item }}</li>
            </ul>
            <h3>Đi lại tại {{ destination.name }}</h3>
            <ul>
              <li v-for="item in destination.transport.gettingAround" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section v-if="destination.tips?.length" class="tips-panel" aria-labelledby="tips-title">
            <p class="section-kicker">Ghi chú nhỏ</p>
            <h2 id="tips-title">Mẹo cho chuyến đi</h2>
            <ul>
              <li v-for="tip in destination.tips" :key="tip">{{ tip }}</li>
            </ul>
          </section>

          <RouterLink
            :to="{ name: 'assistant', query: { place: destination.name } }"
            class="detail-assistant-cta"
          >
            <span><i class="bi bi-stars" aria-hidden="true" /> Hỏi trợ lý du lịch</span>
            <i class="bi bi-arrow-up-right" aria-hidden="true" />
          </RouterLink>
        </aside>
      </div>

      <section class="detail-weather" aria-labelledby="detail-weather-title">
        <div class="detail-weather-heading">
          <div>
            <p class="section-kicker">Dự báo tại điểm đến</p>
            <h2 id="detail-weather-title">Thời tiết {{ destination.name }}</h2>
            <p>Thời tiết hiện tại và dự báo 7 ngày theo tọa độ của điểm đến.</p>
          </div>
          <button
            v-if="!weatherData"
            class="weather-load-button"
            type="button"
            :disabled="weatherLoading"
            @click="loadWeather"
          >
            <i class="bi bi-cloud-sun" aria-hidden="true" />
            {{ weatherLoading ? 'Đang tải...' : 'Xem thời tiết 7 ngày' }}
          </button>
        </div>
        <p v-if="weatherLoading" class="weather-state" role="status">Đang lấy dự báo...</p>
        <p v-else-if="weatherError" class="weather-state weather-state-error" role="alert">{{ weatherError }}</p>
        <WeatherOverview v-else-if="weatherData" :weather="weatherData" />
      </section>
    </article>
  </main>
</template>

<style scoped>
.detail-page {
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 24px 28px 80px;
}

.detail-state {
  display: grid;
  min-height: 50vh;
  place-content: center;
  gap: 14px;
  color: var(--color-muted);
  text-align: center;
}

.detail-error p {
  margin: 0;
}

.back-link,
.breadcrumbs a {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.destination-detail {
  animation: detail-arrive 420ms ease-out both;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  color: var(--color-muted);
  font-size: 11px;
}

.breadcrumbs i {
  color: #a4aaa4;
  font-size: 9px;
}

.detail-hero {
  position: relative;
  display: flex;
  min-height: clamp(360px, 48vw, 520px);
  align-items: flex-end;
  overflow: hidden;
  border-radius: 5px;
  background: #1b4332;
  color: #fff;
  isolation: isolate;
}

.detail-cover,
.detail-cover-fallback,
.detail-cover-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.detail-cover {
  z-index: 1;
  object-fit: cover;
}

.detail-cover-fallback {
  z-index: 0;
  background: linear-gradient(135deg, #012d1d, #527260);
}

.detail-cover-shade {
  z-index: 2;
  background: linear-gradient(90deg, rgba(5, 30, 20, 0.78), rgba(5, 30, 20, 0.16) 78%),
    linear-gradient(0deg, rgba(5, 30, 20, 0.5), transparent 55%);
}

.hero-copy {
  position: relative;
  z-index: 3;
  width: min(760px, 82%);
  padding: clamp(28px, 6vw, 72px);
}

.detail-eyebrow,
.section-kicker {
  margin: 0 0 9px;
  color: #e7d7b9;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.detail-eyebrow i {
  margin-right: 5px;
}

.hero-copy h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(54px, 7vw, 88px);
  font-weight: 400;
  line-height: 0.98;
}

.detail-tagline {
  max-width: 620px;
  margin: 16px 0 20px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 1.7;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 15px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 11px;
}

.hero-meta span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-weight: 700;
}

.hero-meta i {
  color: #e7bd72;
}

.photo-credit {
  position: absolute;
  z-index: 3;
  top: 13px;
  right: 15px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 9px;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  align-items: start;
  gap: 56px;
  padding-top: 52px;
}

.detail-main-column {
  min-width: 0;
}

.intro-section {
  max-width: 760px;
  padding-bottom: 38px;
}

.intro-section .section-kicker,
.detail-section-heading .section-kicker,
.detail-aside .section-kicker {
  color: var(--color-secondary);
}

.intro-section h2,
.detail-section-heading h2,
.detail-aside h2 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 400;
  line-height: 1.16;
}

.destination-long-description {
  margin: 16px 0 0;
  color: #3f4740;
  font-size: 14px;
  line-height: 1.85;
}

.gallery-section,
.content-section {
  padding: 32px 0;
  border-top: 1px solid var(--color-border);
}

.detail-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 20px;
}

.detail-section-heading h2 {
  font-size: 30px;
}

.detail-section-heading > span {
  flex: none;
  padding-bottom: 3px;
  color: var(--color-muted);
  font-size: 10px;
}

.photo-gallery {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.gallery-item {
  position: relative;
  min-width: 0;
  aspect-ratio: 1.35;
  overflow: hidden;
  margin: 0;
  border-radius: 4px;
  background: #e6e2dd;
}

.gallery-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.gallery-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #829086;
  font-size: 22px;
}

.gallery-item img {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 240ms ease;
}

.gallery-item:hover img {
  transform: scale(1.035);
}

.gallery-item figcaption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 22px 10px 9px;
  background: linear-gradient(transparent, rgba(5, 30, 20, 0.6));
  color: #fff;
  font-size: 9px;
}

.attraction-list {
  border-top: 1px solid #e8e3da;
}

.attraction-item {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 12px;
  padding: 19px 0;
  border-bottom: 1px solid #e8e3da;
}

.item-index {
  padding-top: 3px;
  color: var(--color-secondary);
  font-family: var(--font-display);
  font-size: 18px;
}

.attraction-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.attraction-copy h3,
.editorial-item h3,
.stay-item h3 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 500;
}

.item-category {
  margin: 4px 0 8px;
  color: var(--color-secondary);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.attraction-copy > p:not(.item-category),
.editorial-item p {
  margin: 0;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.7;
}

.item-rating {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  color: var(--color-ink);
  font-size: 10px;
  font-weight: 700;
}

.item-rating i {
  color: var(--color-secondary);
}

.attraction-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 14px;
  margin-top: 10px;
  color: #5f675f;
  font-size: 9px;
}

.attraction-facts span {
  display: inline-flex;
  align-items: flex-start;
  gap: 5px;
}

.attraction-facts i {
  flex: none;
  color: var(--color-primary-soft);
}

.editorial-list {
  border-top: 1px solid #e8e3da;
}

.editorial-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
  border-bottom: 1px solid #e8e3da;
}

.editorial-item h3 {
  margin-bottom: 5px;
}

.item-price {
  flex: none;
  padding-top: 3px;
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 700;
  text-align: right;
}

.stay-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stay-item {
  min-width: 0;
  padding: 15px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
}

.stay-item h3 {
  font-size: 18px;
}

.stay-price {
  margin: 10px 0;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
}

.stay-price span {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: 400;
}

.detail-aside {
  display: grid;
  gap: 18px;
}

.facts-panel,
.transport-panel,
.tips-panel {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
}

.detail-weather {
  margin-top: 56px;
  padding: clamp(22px, 4vw, 42px);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: #e8eee9;
}

.detail-weather-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}

.detail-weather-heading .section-kicker {
  color: var(--color-secondary);
}

.detail-weather-heading h2 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 400;
}

.detail-weather-heading p:last-child {
  margin: 7px 0 0;
  color: var(--color-muted);
  font-size: 11px;
}

.weather-load-button {
  display: inline-flex;
  min-height: 44px;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 0 15px;
  border: 0;
  border-radius: 3px;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}

.weather-load-button:hover:not(:disabled) {
  background: var(--color-primary-soft);
}

.weather-load-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.weather-state {
  margin: 0;
  color: var(--color-muted);
  font-size: 11px;
}

.weather-state-error {
  color: var(--color-secondary);
}

.detail-aside h2 {
  font-size: 23px;
}

.trip-facts {
  display: grid;
  gap: 0;
  margin: 10px 0 0;
}

.trip-facts > div {
  padding: 12px 0;
  border-top: 1px solid #eeeae4;
}

.trip-facts dt {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 700;
}

.trip-facts dd {
  display: grid;
  gap: 4px;
  margin: 6px 0 0 20px;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.6;
}

.transport-panel h3 {
  margin: 16px 0 7px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
}

.transport-panel ul,
.tips-panel ul {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding-left: 17px;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.65;
}

.transport-panel li::marker,
.tips-panel li::marker {
  color: var(--color-secondary);
}

.detail-assistant-cta {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-radius: 3px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 150ms ease;
}

.detail-assistant-cta:hover {
  background: var(--color-primary-soft);
  color: #fff;
}

.detail-assistant-cta span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@keyframes detail-arrive {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 28px;
  }
}

@media (max-width: 700px) {
  .detail-page {
    padding: 16px 14px 56px;
  }

  .detail-hero {
    min-height: 430px;
  }

  .hero-copy {
    width: 100%;
    padding: 28px 22px 34px;
  }

  .hero-copy h1 {
    font-size: 58px;
  }

  .detail-tagline {
    font-size: 12px;
  }

  .detail-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    padding-top: 32px;
  }

  .detail-aside {
    grid-row: 1;
  }

  .intro-section h2,
  .detail-section-heading h2 {
    font-size: 27px;
  }

  .photo-gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .gallery-item:first-child {
    grid-column: 1 / -1;
    aspect-ratio: 1.7;
  }

  .gallery-two .gallery-item:first-child {
    grid-column: auto;
    aspect-ratio: 1.35;
  }

  .stay-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail-weather {
    margin-top: 36px;
    padding: 20px 16px;
  }

  .detail-weather-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }

  .detail-weather-heading h2 {
    font-size: 29px;
  }
}

@media (max-width: 420px) {
  .hero-copy h1 {
    font-size: 50px;
  }

  .hero-copy {
    padding-right: 16px;
    padding-left: 16px;
  }

  .attraction-item {
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 8px;
  }

  .attraction-title-row {
    align-items: flex-start;
  }

  .attraction-copy h3 {
    font-size: 19px;
  }

  .editorial-item {
    flex-direction: column;
    gap: 8px;
  }

  .item-price {
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>