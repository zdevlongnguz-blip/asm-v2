<script setup>
defineProps({
  weather: { type: Object, required: true },
});
</script>

<template>
  <div class="weather-overview">
    <section v-if="weather.current" class="weather-current" aria-label="Thời tiết hiện tại">
      <div class="current-summary">
        <span class="current-icon" aria-hidden="true">
          <i :class="weather.current.icon || 'bi bi-cloud-sun'" />
        </span>
        <div class="current-reading">
          <p class="weather-label">Hiện tại</p>
          <div class="current-line">
            <strong class="current-temperature">{{ weather.current.temperature }}°</strong>
            <span class="current-condition">{{ weather.current.description }}</span>
          </div>
        </div>
      </div>
      <p v-if="weather.current.meme" class="weather-poem">{{ weather.current.meme }}</p>
      <div class="current-details">
        <span v-if="weather.current.apparentTemperature != null">
          <i class="bi bi-thermometer-half" aria-hidden="true" /> Cảm giác {{ weather.current.apparentTemperature }}°C
        </span>
        <span v-if="weather.current.humidity != null">
          <i class="bi bi-droplet" aria-hidden="true" /> Độ ẩm {{ weather.current.humidity }}%
        </span>
        <span v-if="weather.current.windSpeed != null">
          <i class="bi bi-wind" aria-hidden="true" /> Gió {{ weather.current.windSpeed }} km/h
        </span>
        <span v-if="weather.current.precipitation != null">
          <i class="bi bi-cloud-rain" aria-hidden="true" /> Mưa {{ weather.current.precipitation }} mm
        </span>
      </div>
    </section>

    <section v-if="weather.days?.length" class="weather-forecast" aria-label="Dự báo thời tiết 7 ngày">
      <h3>Dự báo 7 ngày</h3>
      <div class="forecast-days">
        <article v-for="day in weather.days" :key="day.date" class="forecast-day">
          <strong class="forecast-date">{{ day.date }}</strong>
          <i :class="day.icon || 'bi bi-cloud'" aria-hidden="true" />
          <span class="forecast-condition">{{ day.description }}</span>
          <strong class="forecast-temperatures">{{ day.tempMax }}° <span>{{ day.tempMin }}°</span></strong>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.weather-overview {
  display: grid;
  gap: 24px;
  min-width: 0;
}

.weather-current {
  display: grid;
  grid-template-columns: minmax(190px, 0.8fr) minmax(220px, 1.2fr);
  align-items: center;
  gap: 14px 28px;
  padding: 0 0 22px;
  border-bottom: 1px solid var(--color-border);
}

.current-summary {
  display: flex;
  align-items: center;
  gap: 16px;
}

.current-icon {
  display: grid;
  width: 64px;
  aspect-ratio: 1;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: #e8eee9;
  color: var(--color-primary);
  font-size: 27px;
}

.current-reading {
  min-width: 0;
}

.weather-label {
  margin: 0 0 1px;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.current-temperature {
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: 52px;
  font-weight: 400;
  line-height: 1;
}

.current-condition {
  color: var(--color-ink);
  font-size: 14px;
}

.current-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 9px;
}

.weather-poem {
  margin: 0;
  padding-left: 18px;
  border-left: 2px solid #c4d0c7;
  color: var(--color-primary-soft);
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 1.55;
  white-space: pre-line;
}

.current-details {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 8px 20px;
  color: var(--color-muted);
  font-size: 11px;
}

.current-details span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.current-details i {
  color: var(--color-primary-soft);
}

.weather-forecast h3 {
  margin: 0 0 12px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
}

.forecast-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
}

.forecast-day {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 8px;
  padding: 16px 7px;
  text-align: center;
}

.forecast-day + .forecast-day {
  border-left: 1px solid #e8e3da;
}

.forecast-weekday {
  color: var(--color-primary);
  font-size: 11px;
}

.forecast-date {
  color: var(--color-muted);
  font-size: 10px;
}

.forecast-day > i {
  margin: 3px 0;
  color: var(--color-secondary);
  font-size: 22px;
}

.forecast-condition {
  min-height: 28px;
  color: var(--color-muted);
  font-size: 9px;
  line-height: 1.4;
}

.forecast-temperatures {
  color: var(--color-ink);
  font-size: 12px;
}

.forecast-temperatures span {
  color: var(--color-muted);
  font-weight: 400;
}

@media (max-width: 700px) {
  .weather-current {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .weather-poem {
    font-size: 14px;
  }

  .forecast-days {
    grid-template-columns: repeat(7, minmax(76px, 1fr));
    overflow-x: auto;
  }

  .forecast-day {
    padding: 13px 5px;
  }
}
</style>
