import { Router } from 'express';
import { getWikiSummaryWithThumbnail, getWikiArticle } from '../services/wiki.js';

const router = Router();

function normalizeWikiTitle(rawTitle) {
  const decoded = decodeURIComponent(rawTitle || '');
  return decoded.replace(/_/g, ' ').trim();
}

router.get('/summary/:title', async (req, res) => {
  const title = normalizeWikiTitle(req.params.title);

  if (!title) {
    return res.status(400).json({ error: 'Thiếu title' });
  }

  // [THUMBNAIL: new] Keep the existing summary field and add optional page image metadata.
  const result = await getWikiSummaryWithThumbnail(title);
  return res.json({
    title,
    summary: result?.summary ?? null,
    thumbnail: result?.thumbnail ?? null,
  });
});

router.get('/article/:title', async (req, res) => {
  const title = normalizeWikiTitle(req.params.title);

  if (!title) {
    return res.status(400).json({ error: 'Thiếu title' });
  }

  const article = await getWikiArticle(title);
  return res.json({ title, article });
});

export default router;
