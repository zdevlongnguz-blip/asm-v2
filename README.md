# My ASM

Ứng dụng bản đồ (OpenStreetMap) + thời tiết (Open-Meteo) + tin tức (News API).

- **client/**: Vue 3 + Vite (giao diện)
- **server/**: Express (proxy gọi API ngoài, cache RAM, giấu API key)
- Dữ liệu người dùng (yêu thích, lịch sử...) lưu ở **localStorage** phía client.

> Trạng thái hiện tại: **base trống**, mới có khung thư mục, chưa có logic.

## Yêu cầu

- Node.js **20.18+** (đã thử với 20.18; không cần cài nodemon hay dotenv)
- npm

## Cài đặt

```bash
# 1. Cài toàn bộ (root + server + client)
npm run install:all

# 2. Tạo file .env cho server (đã có sẵn bản mẫu .env, chỉ cần sửa)
#    Nếu chưa có: copy server/.env.example thành server/.env
#    Rồi điền NEWS_API_KEY, đổi email trong NOMINATIM_UA.
```

Lấy key News API miễn phí tại https://newsapi.org

## Chạy

Chạy cả 2 cùng lúc (từ thư mục gốc `my-asm/`):

```bash
npm run dev
```

Hoặc chạy riêng:

```bash
npm run dev --prefix server   # http://localhost:3000
npm run dev --prefix client   # http://localhost:5173
```

Kiểm tra server: mở http://localhost:3000/api/health, thấy `{"ok":true}` là được.
Giao diện: mở http://localhost:5173

> Sửa file `.env` xong phải **tắt và chạy lại** server (`--watch` chỉ theo dõi file `.js`).

## Cấu trúc thư mục

```
my-asm/
├── package.json          ← script chạy chung (npm run dev)
├── client/
│   ├── index.html
│   ├── vite.config.js    ← có proxy /api -> localhost:3000
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── api/          ← axios instance (http.js)
│       ├── components/   ← component Vue
│       └── composables/  ← hàm dùng chung (useLocalStorage...)
└── server/
    ├── .env              ← key thật, KHÔNG commit
    ├── .env.example      ← file mẫu
    ├── data/             ← file JSON lưu data nhẹ
    ├── logs/             ← error-YYYY-MM-DD.log (tự sinh, không commit)
    └── src/
        ├── server.js     ← chỉ listen
        ├── app.js        ← tạo app, gắn routes + error handler
        ├── routes/       ← khai báo URL (weather, news, geo)
        ├── services/     ← hàm gọi API ngoài
        ├── middlewares/  ← xử lý 404 + lỗi (có ghi log)
        └── utils/        ← cache.js, jsonFile.js, logger.js (winston)
```

Quy tắc:
- **routes**: nhận request, gọi service (kèm cache), trả JSON
- **services**: chỉ gọi API ngoài và trả dữ liệu
- **utils**: hàm dùng chung

## Ghi log lỗi (winston)

Mọi lỗi trong route (kể cả hàm async) tự chạy vào `middlewares/errorHandler.js`,
được in ra terminal và ghi vào `server/logs/error-YYYY-MM-DD.log` (mỗi ngày một file):

```
[2026-09-29T10:00:00.000Z] ERROR GET /api/weather?lat=1&lon=2 - Request failed with status code 500
```

- Giữ log 14 ngày, file cũ hơn tự xoá (chỉnh `maxFiles` trong `utils/logger.js`).
- Dùng ở chỗ khác:
  ```js
  import { logger } from '../utils/logger.js';
  logger.info('Khởi động xong');
  logger.error('Có lỗi: ' + err.message);
  ```
- Chỉ mức `error` được ghi vào file; `info`/`warn` chỉ hiện ở terminal.
- Thư viện có thể tạo thêm file `*-audit.json` trong `logs/` để theo dõi việc xoay file, cứ để nguyên (đã nằm trong `.gitignore`).

## Lưu ý

- Import file nội bộ trong server **bắt buộc có đuôi `.js`** (`'./app.js'`).
- Nominatim (OSM): tối đa 1 request/giây, bắt buộc có `User-Agent`.
- Client gọi API qua `/api/...` (proxy của Vite), không gọi thẳng `localhost:3000`.
