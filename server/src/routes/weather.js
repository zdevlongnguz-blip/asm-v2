import { Router } from 'express';
import {
  DEFAULT_FORECAST_DAYS,
  getCurrentWeatherByCityName,
  getWeatherByCityName,
  getWeatherByCoordinates,
} from '../services/weather.js';
import { getAllVietnamProvinces } from '../services/geo.js';
const router = Router();

// TODO: khai báo route ở đây

router.get('/provinces', (req, res) => {
  const provinces = getAllVietnamProvinces();
  res.json(provinces);
});

router.get('/current/:city', async (req, res) => {
  const city = req.params.city;
  //Gọi service để lấy dữ liệu thời tiết hiện tại
  const data = await getCurrentWeatherByCityName(city);
  res.json(data);
});

router.get('/by-name/:city', async (req, res) => {
  const data = await getWeatherByCityName(req.params.city, DEFAULT_FORECAST_DAYS);
  if (!data) return res.status(404).json({ error: 'Không tìm thấy thời tiết cho địa điểm này' });
  return res.json(data);
});

router.get('/by-coordinates', async (req, res) => {
  const { lat, lon } = req.query;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return res.status(400).json({ error: 'lat và lon phải là tọa độ hợp lệ' });
  }

  const data = await getWeatherByCoordinates(lat, lon, DEFAULT_FORECAST_DAYS);
  if (!data) return res.status(400).json({ error: 'Không thể tra cứu tọa độ này' });
  return res.json(data);
});

export default router;
