import axios from 'axios';
import vietnamProvinces from '../../data/vietnamProvinces.json' with { type: 'json' };
import { logger } from '../utils/logger.js';

const coordinateCache = new Map();

// viết hàm lấy tất cả các tỉnh/thành phố Việt Nam từ file JSON vietnamProvinces.json
export function getAllVietnamProvinces() {
  return vietnamProvinces.map((province) => ({
    name: province.name,
    lat: Number(province.lat),
    lon: Number(province.lon),
  }));
}

// Chuẩn hóa tên địa điểm: bỏ dấu tiếng Việt, lowercase, bỏ ký tự đặc biệt.
// Ví dụ: "TP. Hồ Chí Minh" -> "ho chi minh"
export function normalizeLocationName(value) {
  if (value === null || value === undefined) {
    logger.warn('normalizeLocationName: giá trị đầu vào rỗng');
    return '';
  }

  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/^(tp|thanh pho)\s+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  logger.info(`normalizeLocationName: "${value}" -> "${normalized}"`);
  return normalized;
}

// Tìm tọa độ trong dữ liệu offline trước.
// Dùng khi không cần gọi API bên ngoài.
function findOfflineCoordinates(input) {
  const target = normalizeLocationName(input);
  if (!target) return null;

  const match = vietnamProvinces.find((province) =>
    [province.name, ...(province.aliases || [])].some(
      (name) => normalizeLocationName(name) === target
    )
  );

  if (!match) return null;

  return { lat: Number(match.lat), lon: Number(match.lon) };
}

// Lấy tọa độ theo tên địa điểm.
// Ưu tiên data offline, nếu không có thì gọi Nominatim.
export async function getCoordinatesByName(input) {
  const query = String(input ?? '').trim();
  if (!query) {
    logger.warn('getCoordinatesByName: query rỗng');
    return null;
  }

  const cacheKey = normalizeLocationName(query);
  if (coordinateCache.has(cacheKey)) {
    logger.info(`getCoordinatesByName: dùng cache cho "${query}"`);
    return coordinateCache.get(cacheKey);
  }

  const offline = findOfflineCoordinates(query);
  if (offline) {
    coordinateCache.set(cacheKey, offline);
    logger.info(`getCoordinatesByName: dùng offline data cho "${query}"`);
    return offline;
  }

  const nominatimUrl = process.env.OPEN_STREET_MAP_URL || 'https://nominatim.openstreetmap.org/search';
  logger.info(`getCoordinatesByName: gọi Nominatim cho "${query}"`);

  try {
    const response = await axios.get(nominatimUrl, {
      params: {
        q: query,
        countrycodes: 'vn',
        format: 'jsonv2',
        limit: 1,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': process.env.NOMINATIM_UA || 'my-asm-app',
        'Accept-Language': 'vi,en',
      },
    });

    const first = Array.isArray(response.data) ? response.data[0] : null;
    if (!first) {
      logger.warn(`getCoordinatesByName: không tìm được kết quả từ Nominatim cho "${query}"`);
      return null;
    }

    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      logger.warn(`getCoordinatesByName: dữ liệu tọa độ không hợp lệ cho "${query}"`);
      return null;
    }

    const result = { lat, lon };
    coordinateCache.set(cacheKey, result);
    logger.info(`getCoordinatesByName: lấy được tọa độ cho "${query}" -> ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.warn(`Không thể lấy tọa độ cho "${query}": ${error.message}`);
    return null;
  }
}

/*
  Ví dụ input/output:
  - Input: "Thanh Hóa"
  - Output: { lat: 19.8067, lon: 105.7852 }

  Hàm này hoạt động như sau:
  1. Chuẩn hóa tên: "Thanh Hóa" -> "thanh hoa"
  2. Tìm trong dữ liệu offline
  3. Nếu không tìm thấy, gọi OpenStreetMap Nominatim để lấy tọa độ
  4. Cache lại kết quả để gọi tiếp theo nhanh hơn
*/
