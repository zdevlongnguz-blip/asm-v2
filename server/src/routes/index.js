import { Router } from 'express';
import weather from './weather.js';
import news from './news.js';
import geo from './geo.js';
import wiki from './wiki.js';
import ai from './ai.js';
import city from './city.js';

const router = Router();

// Kiểm tra server sống: GET /api/health
router.get('/health', (req, res) => res.json({ ok: true }));

router.use('/weather', weather);
router.use('/news', news);
router.use('/geo', geo);
router.use('/wiki', wiki);
router.use('/ai', ai);
router.use('/city', city);

export default router;
