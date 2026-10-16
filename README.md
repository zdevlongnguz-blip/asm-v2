# Trợ lý du lịch

Ứng dụng Vue 3 + Express hiện đang là một dự án travel assistant hoạt động thực tế: khám phá điểm đến, xem thời tiết, và hỏi trợ lý du lịch bằng tiếng Việt. Đây không còn là dự án dạng base trống/scaffold; dữ liệu điểm đến được lưu trong JSON, thời tiết lấy từ Open-Meteo, nội dung địa điểm lấy từ Wikipedia và câu trả lời AI dùng Gemini.

## Tính năng

- Trang chủ `/`: banner điểm đến tự chuyển sau 3 giây, danh sách có tìm kiếm và thông tin từ `server/data/cities.json`.
- Tra cứu thời tiết ở cuối trang chủ: nhập tên hoặc chọn badge gợi ý; kết quả gồm hiện tại, bài thơ thời tiết và dự báo 7 ngày.
- Trang chi tiết `/destinations/:id`: ảnh, mô tả, điểm tham quan, món ăn, lưu trú, di chuyển và mẹo du lịch. Thời tiết dùng tọa độ của điểm đến trong JSON.
- Trang trợ lý `/assistant`: hội thoại SSE, câu hỏi mẫu dạng chip để điền vào prompt, kết quả tool thời tiết/Wikipedia và câu trả lời Markdown đã sanitize.
- Wikipedia summary có thumbnail nếu bài viết có ảnh đại diện.

## Yêu cầu

- Node.js 20 trở lên
- npm

## Cài đặt và cấu hình

```bash
npm run install:all
```

Mở `server/.env` (nếu chưa có thì sao chép `server/.env.example` thành file này). Giữ cấu hình đang có và thêm key Gemini nếu chưa có:

```env
GEMINI_API_KEY=điền_key_Gemini_thật_tại_máy_của_bạn
```

Không gửi key thật vào chat hoặc commit file `.env`/API key. `GEMINI_MODEL` là tùy chọn; nếu không khai báo, server dùng `gemini-3-flash-preview`.

### Cấu hình đường dẫn client và API

Client dùng `/api` trên cùng origin theo mặc định. Trong development, Vite proxy đường dẫn này tới `http://localhost:3000`. Nếu cần đổi mặc định, sao chép `client/.env.example` thành `client/.env` khi chạy local, hoặc `client/.env.production` trước khi build production. Có thể cấu hình:

- `VITE_BASE_PATH`: đường dẫn mount frontend; dùng `/` ở domain root hoặc ví dụ `/travel/` khi deploy dưới một path prefix. Vue Router và asset build cùng dùng base path này.
- `VITE_API_BASE_URL`: để trống để tự dùng `<base path>api` trên cùng origin; khi API ở domain riêng, đặt URL đầy đủ, ví dụ `https://api.example.com/api`.
- `VITE_API_PROXY_TARGET`: địa chỉ Express mà Vite proxy dùng trong development; production không dùng biến này.

Trong ứng dụng Vue/Vite này, `VITE_BASE_PATH` là cấu hình tương ứng để mount ứng dụng dưới một path prefix; `SCRIPT_NAME` thường là tên biến môi trường của ứng dụng WSGI/Python.

Cùng origin, phục vụ tại domain root:

```env
# client/.env hoặc client/.env.production
VITE_BASE_PATH=/
VITE_API_BASE_URL=
```

Khác origin:

```env
# client/.env.production
VITE_BASE_PATH=/
VITE_API_BASE_URL=https://api.example.com/api
```

```env
# server/.env
# Thay origin local trong server/.env bằng origin frontend production.
CLIENT_ORIGINS=https://app.example.com
```

Các biến `VITE_*` được đóng gói vào client lúc build; nếu đổi sau khi build thì cần build lại. Có thể liệt kê nhiều origin trong `CLIENT_ORIGINS` bằng dấu phẩy. Với cùng origin, production cần reverse proxy chuyển `<base path>api` tới `/api` của Express; host cũng cần fallback các route frontend về `index.html`. Với path prefix như `/travel/`, API mặc định sẽ là `/travel/api`.

## Chạy ứng dụng

Từ thư mục gốc:

```bash
npm run dev
```

Client: http://localhost:5173
Server: http://localhost:3000
Health check: http://localhost:3000/api/health

Chạy riêng:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

Client dùng Vue Router history mode; Vite dev server proxy `/api` tới Express. Nếu sửa `.env`, khởi động lại server.

## API chính

| Method | Endpoint | Nội dung |
| --- | --- | --- |
| `GET` | `/api/city/list` | Danh sách destination từ `cities.json`. |
| `GET` | `/api/city/:id` | Chi tiết destination; trả `404` nếu không có ID. |
| `GET` | `/api/weather/by-name/:city` | Thời tiết hiện tại và 7 ngày theo tên. |
| `GET` | `/api/weather/by-coordinates?lat=...&lon=...` | Thời tiết hiện tại và 7 ngày theo tọa độ. |
| `GET` | `/api/weather/current/:city` | Thời tiết hiện tại theo tên. |
| `GET` | `/api/weather/provinces` | Danh sách tỉnh/thành trong dữ liệu tọa độ Việt Nam. |
| `GET` | `/api/wiki/summary/:title` | Summary cùng thumbnail tùy chọn. |
| `GET` | `/api/wiki/article/:title` | Nội dung bài viết Wikipedia. |
| `POST` | `/api/ai` | Hỏi trợ lý, nhận JSON hoàn chỉnh. |
| `POST` | `/api/ai/stream` | Hỏi trợ lý và nhận tiến trình/kết quả qua SSE. |

## Kiểm thử và build

```bash
npm test --prefix server
npm run build --prefix client
```

## Dữ liệu và giới hạn

- `server/data/cities.json` là nguồn cho trang chủ và trang chi tiết; ảnh cover/gallery là URL bên ngoài nên phụ thuộc host ảnh.
- `server/data/vietnamProvinces.json` cung cấp tọa độ offline. Tọa độ destination trong `cities.json` cũng được ưu tiên cho tra cứu tên các điểm đến này.
- Open-Meteo cung cấp thời tiết; Nominatim là fallback geocoder và yêu cầu User-Agent phù hợp.
- Leaflet đã có trong dependencies nhưng chưa được dùng để render bản đồ. Route/service tin tức chưa phải luồng chức năng hoàn chỉnh.
- Cache hiện ở RAM và mất khi server khởi động lại.
