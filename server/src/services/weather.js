import axios from 'axios';
import { logger } from '../utils/logger.js';
import { cached } from '../utils/cache.js';
import { getCoordinatesByName } from './geo.js';
import weatherCodeMap from '../../data/weatherCodeMap.json' with { type: 'json' };

const OPEN_METEO_URL = process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast';
export const MIN_FORECAST_DAYS = 1;
export const MAX_FORECAST_DAYS = 7;
export const DEFAULT_FORECAST_DAYS = MAX_FORECAST_DAYS;

function normalizeForecastDays(days) {
  const value = Number(days);
  if (!Number.isFinite(value) || value === 0) return DEFAULT_FORECAST_DAYS;
  return Math.min(Math.max(Math.trunc(value), MIN_FORECAST_DAYS), MAX_FORECAST_DAYS);
}

// Dùng file JSON weatherCodeMap.json cho thời tiết hiện tại.
// Forecast 7 ngày giữ nguyên dạng đơn giản, không cần map meme.
function getCurrentWeatherInfo(code) {
  const value = weatherCodeMap[String(code)] || {
    description: 'Không xác định',
    meme: 'Chưa có mô tả',
    icon: 'bi bi-cloud',
  };

  return {
    description: value.description || 'Không xác định',
    meme: value.meme || 'Chưa có mô tả',
    icon: value.icon || 'bi bi-cloud',
  };
}

// Lấy thời tiết hiện tại theo lat/lon.
// Input: lat, lon
// Output: { latitude, longitude, current: {...}, days: [...] }
export async function getWeatherByCoordinates(lat, lon, days = DEFAULT_FORECAST_DAYS) {
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    logger.warn(`getWeatherByCoordinates: tọa độ không hợp lệ (${lat}, ${lon})`);
    return null;
  }

  const cacheKey = `weather:${latitude}:${longitude}:${days}`;

  return cached(cacheKey, 1000 * 60 * 5, async () => {
    logger.info(`getWeatherByCoordinates: gọi Open-Meteo cho (${latitude}, ${longitude})`);

    const response = await axios.get(OPEN_METEO_URL, {
      params: {
        latitude,
        longitude,
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        timezone: 'auto',
        forecast_days: days,
      },
    });

    const current = response.data?.current || {};
    const daily = response.data?.daily || {};

    const dailyForecast = (daily.time || []).map((date, index) => {
      const weatherInfo = getCurrentWeatherInfo(daily.weather_code?.[index] ?? 0);

      return {
        date,
        tempMax: Number(daily.temperature_2m_max?.[index] ?? 0),
        tempMin: Number(daily.temperature_2m_min?.[index] ?? 0),
        description: weatherInfo.description,
        icon: weatherInfo.icon,
      };
    });

    const currentWeatherCode = Number(current.weather_code ?? 0);
    const currentWeatherInfo = getCurrentWeatherInfo(currentWeatherCode);

    return {
      latitude,
      longitude,
      current: {
        temperature: Number(current.temperature_2m ?? 0),
        apparentTemperature: Number(current.apparent_temperature ?? 0),
        humidity: Number(current.relative_humidity_2m ?? 0),
        windSpeed: Number(current.wind_speed_10m ?? 0),
        precipitation: Number(current.precipitation ?? 0),
        weatherCode: currentWeatherCode,
        description: currentWeatherInfo.description,
        meme: currentWeatherInfo.meme,
        icon: currentWeatherInfo.icon,
      },
      days: dailyForecast,
    };
  });
}

export async function getWeatherByCityName(cityName, days = DEFAULT_FORECAST_DAYS) {
  const coordinates = await getCoordinatesByName(cityName);
  if (!coordinates) {
    logger.warn(`getWeatherByCityName: không tìm thấy tọa độ cho "${cityName}"`);
    return null;
  }

  const forecastDays = normalizeForecastDays(days);
  const weather = await getWeatherByCoordinates(coordinates.lat, coordinates.lon, forecastDays);
  return weather ? { cityName: String(cityName), ...weather } : null;
}

// Lấy thời tiết hiện tại theo tên thành phố.
// Input: "Thanh Hóa"
// Output: { cityName: "Thanh Hóa", temperature: 29, condition: "Clear sky", ... }
export async function getCurrentWeatherByCityName(cityName) {
  const coordinates = await getCoordinatesByName(cityName);
  if (!coordinates) {
    logger.warn(`getCurrentWeatherByCityName: không tìm thấy tọa độ cho "${cityName}"`);
    return null;
  }

  const weather = await getWeatherByCoordinates(coordinates.lat, coordinates.lon, 1);
  if (!weather) {
    return null;
  }
  
  logger.info(`getCurrentWeatherByCityName: thời tiết hiện tại cho "${cityName}" là ${weather.current.temperature}°C, ${weather.current.description}`);

  return {
    cityName: String(cityName),
    temperature: weather.current.temperature,
    condition: weather.current.description,
    meme: weather.current.meme,
    icon: weather.current.icon,
    humidity: weather.current.humidity,
    windSpeed: weather.current.windSpeed,
    precipitation: weather.current.precipitation,
  };
}

// Lấy dự báo 7 ngày theo tên thành phố.
// Input: "Hà Nội"
// Output: { cityName: "Hà Nội", days: [{ date, tempMax, tempMin, description }, ...] }
export async function getWeatherForecastByCityName(cityName, days = DEFAULT_FORECAST_DAYS) {
  const forecastDays = normalizeForecastDays(days);
  const coordinates = await getCoordinatesByName(cityName);
  if (!coordinates) {
    logger.warn(`getWeatherForecastByCityName: không tìm thấy tọa độ cho "${cityName}"`);
    return null;
  }

  const weather = await getWeatherByCoordinates(coordinates.lat, coordinates.lon, forecastDays);
  if (!weather) {
    return null;
  }

  return {
    cityName: String(cityName),
    days: weather.days,
  };
}
