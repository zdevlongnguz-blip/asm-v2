import { logger } from '../utils/logger.js';

// Không có route nào khớp -> 404
export function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Not found' });
}

// Mọi lỗi (kể cả lỗi trong hàm async, Express 5 tự bắt) đều về đây
export function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`);
  res.status(err.status || 500).json({ success: false, message: err.message });
}
