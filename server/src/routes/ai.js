import Router from 'express';
import {
  askTravelAssistant,
  askTravelAssistantStream,
} from '../services/ai.js';

const router = Router();

router.post('/', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({ error: 'Thiếu prompt' });
  }

  const result = await askTravelAssistant(prompt);
  return res.json(result);
});

// STREAM: SSE endpoint for live status, tool results, and Gemini text chunks.
router.post('/stream', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({ error: 'Thiếu prompt' });
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const sendEvent = (type, data) => {
    if (res.destroyed || res.writableEnded) return;
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // STREAM: Send an initial event before waiting for Gemini.
  sendEvent('status', { message: 'Đã nhận yêu cầu, đang kết nối với trợ lý...' });

  try {
    const result = await askTravelAssistantStream(
      prompt,
      (event) => sendEvent(event.type, event),
      controller.signal
    );
    sendEvent('done', result);
  } catch (error) {
    sendEvent('error', { message: 'Không thể hoàn tất yêu cầu.' });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

export default router;