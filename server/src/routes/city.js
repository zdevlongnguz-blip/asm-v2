import { Router } from 'express';
import cityData from '../../data/cities.json' with { type: 'json' };

const router = Router();

router.get('/list', (req, res) => {
  res.json(cityData.destinations);
});

router.get('/:id', (req, res) => {
  const destination = cityData.destinations.find((item) => item.id === req.params.id);

  if (!destination) {
    return res.status(404).json({ error: 'Không tìm thấy điểm đến' });
  }

  return res.json(destination);
});

export default router;
