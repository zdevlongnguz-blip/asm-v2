import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'node:path';

// server/logs/ (đi lên 2 cấp từ src/utils)
const LOG_DIR = path.join(import.meta.dirname, '..', '..', 'logs');

const line = winston.format.printf(
  ({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} ${message}`
);

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), line),
  transports: [
    // In ra terminal
    new winston.transports.Console(),
    // Log mọi mức thông tin vào file, giữ 14 ngày
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxFiles: '14d',
    }),
    // Chỉ lỗi -> logs/error-2026-09-29.log, mỗi ngày 1 file, giữ 14 ngày
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
    }),
  ],
});
