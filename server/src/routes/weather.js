import { Router } from 'express';
// import { cached } from '../utils/cache.js';
import { getCurrentWeatherByCityName } from '../services/weather.js';
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

export default router;
