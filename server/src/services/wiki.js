import axios from 'axios';
import { cached } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

// Wikipedia API endpoint.
// Có thể override bằng biến môi trường WIKIPEDIA_URL nếu cần.
// Ví dụ:
// process.env.WIKIPEDIA_URL = 'https://en.wikipedia.org/w/api.php'
const DEFAULT_WIKIPEDIA_URL = 'https://en.wikipedia.org/w/api.php';
const VIETNAMESE_WIKIPEDIA_URL = 'https://vi.wikipedia.org/w/api.php';
const WIKIPEDIA_URL = process.env.WIKIPEDIA_URL || DEFAULT_WIKIPEDIA_URL;
const WIKIPEDIA_UA = process.env.WIKIPEDIA_UA || 'my-asm-app/1.0 (https://localhost)';
const WIKI_CACHE_TTL_MS = 1000 * 60 * 10; // cache 10 phút

function getWikipediaEndpoints() {
  const configured = (process.env.WIKIPEDIA_URL || '').trim();

  if (configured) {
    return [configured, DEFAULT_WIKIPEDIA_URL];
  }

  return [VIETNAMESE_WIKIPEDIA_URL, DEFAULT_WIKIPEDIA_URL];
}

// Hàm chung để lấy extract từ Wikipedia.
// Chỗ này có thể gây khó hiểu: bạn đang gọi `cached(...)` ở ngoài,
// và `cached` sẽ gọi callback bên trong khi cache miss.
// Tức là có 2 lớp return:
// 1) return cached(...) => hàm này trả kết quả từ cache helper
// 2) return page.extract.trim() => callback bên trong trả dữ liệu thực tế
//
// Input:
//   title: từ khóa cần tìm, ví dụ 'JavaScript', 'Hà Nội'
//   options.summaryOnly: true => lấy phần tóm tắt đầu bài (AI context)
//   options.summaryOnly: false => lấy toàn bộ extract bài viết (đầy đủ)
// Output:
//   - string: nội dung extract đã trim
//   - null: không tìm thấy bài / input rỗng
//
// Ví dụ thực tế:
//   getWikiSummary('JavaScript')
//   => 'JavaScript is a high-level, often just-in-time compiled language...'
//
//   getWikiArticle('JavaScript')
//   => 'JavaScript is a programming language... [nội dung dài hơn]'
async function fetchWikipediaExtract(title, { summaryOnly = false, includeThumbnail = false } = {}) {
  const cleanTitle = String(title || '').trim();

  if (!cleanTitle) {
    logger.warn('fetchWikipediaExtract: title rỗng');
    return null;
  }

  const cacheKey = `wiki:${summaryOnly ? 'summary' : 'article'}${includeThumbnail ? ':thumbnail' : ''}:${cleanTitle.toLowerCase()}`;

  return cached(cacheKey, WIKI_CACHE_TTL_MS, async () => {
    const endpoints = getWikipediaEndpoints();

    for (const wikiUrl of endpoints) {
      try {
        logger.info(`fetchWikipediaExtract: gọi Wikipedia cho "${cleanTitle}" qua ${wikiUrl} (summaryOnly=${summaryOnly})`);

        const response = await axios.get(wikiUrl, {
          headers: {
            'User-Agent': WIKIPEDIA_UA,
            'Accept-Language': 'vi,en',
          },
          params: {
            action: 'query',
            format: 'json',
            prop: includeThumbnail ? 'extracts|pageimages' : 'extracts',
            explaintext: 1,
            redirects: 1,
            titles: cleanTitle,
            ...(summaryOnly ? { exintro: 1 } : {}),
            ...(includeThumbnail ? { pithumbsize: 500 } : {}),
          },
        });

        const pages = response.data?.query?.pages ?? {};
        const page = Object.values(pages).find((item) => item && item.title);

        if (!page || !page.extract) {
          logger.warn(`fetchWikipediaExtract: không tìm thấy nội dung cho "${cleanTitle}" trên ${wikiUrl}`);
          continue;
        }

        const result = page.extract.trim();
        logger.info(`fetchWikipediaExtract: lấy được dữ liệu cho "${cleanTitle}" (${result.length} ký tự) từ ${wikiUrl}`);
        // [THUMBNAIL: new] Return page image metadata only for callers that request it.
        if (includeThumbnail) {
          return {
            title: page.title,
            summary: result,
            thumbnail: page.thumbnail ?? null,
          };
        }

        return result;
      } catch (error) {
        logger.warn(`fetchWikipediaExtract: lỗi khi gọi Wikipedia cho "${cleanTitle}" trên ${wikiUrl}: ${error.message}`);
      }
    }

    return null;
  });
}

// Hàm lấy tóm tắt ngắn cho AI context / UI preview.
// Dùng `exintro: 1` để chỉ lấy phần mở đầu, ngắn gọn hơn.
// Input:
//   title: 'JavaScript'
// Output:
//   'JavaScript is a high-level, often just-in-time compiled language...'
export async function getWikiSummary(title) {
  return fetchWikipediaExtract(title, { summaryOnly: true });
}

// [THUMBNAIL: new] Fetch summary and image metadata together without changing getWikiSummary's string contract.
export async function getWikiSummaryWithThumbnail(title) {
  return fetchWikipediaExtract(title, { summaryOnly: true, includeThumbnail: true });
}

// Hàm lấy nội dung đầy đủ của bài Wikipedia.
// Dùng cho các trường hợp cần chi tiết, phân tích sâu, hoặc làm nguồn tham khảo.
// Input:
//   title: 'JavaScript'
// Output:
//   'JavaScript is a programming language ... [cả bài, dài hơn summary]'
export async function getWikiArticle(title) {
  return fetchWikipediaExtract(title, { summaryOnly: false });
}