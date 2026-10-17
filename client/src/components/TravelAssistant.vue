<script setup>
import { computed, ref } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useRoute } from 'vue-router';
import { apiUrl } from '../api/http.js';

const route = useRoute();
const initialPrompt = route.query.place
  ? `Giới thiệu về ${String(route.query.place)}`
  : 'Dự báo thời tiết 3 ngày ở Hà Nội và giới thiệu về Hà Nội';
const prompt = ref(initialPrompt);
// Các câu hỏi mẫu minh họa những yêu cầu cần số lượng công cụ dữ liệu khác nhau.
const demoQuestions = [
  { label: 'Vì sao bầu trời có màu xanh?', toolCount: 0, prompt: 'Giải thích ngắn gọn vì sao bầu trời có màu xanh.' },
  { label: 'Thời tiết Hà Nội hôm nay', toolCount: 1, prompt: 'Thời tiết hiện tại ở Hà Nội như thế nào?' },
  {
    label: 'Thời tiết và giới thiệu Đà Nẵng',
    toolCount: 2,
    prompt: 'Cho biết thời tiết hiện tại ở Đà Nẵng và giới thiệu ngắn về thành phố này.',
  },
  {
    label: 'Hà Nội: hiện tại và dự báo 3 ngày',
    toolCount: 3,
    prompt: 'Cho biết thời tiết hiện tại, dự báo 3 ngày tới ở Hà Nội và giới thiệu ngắn về Hà Nội.',
  },
  {
    label: 'Du lịch Tà Xùa: thời tiết & kế hoạch',
    toolCount: 2,
    prompt: 'Tôi muốn đi du lịch Tà Xùa, thời tiết 3 ngày tới ở đây như nào, hãy lên kế hoạch cho tôi',
  },
];
const loading = ref(false);
const answer = ref('');
const error = ref('');
const statusMessage = ref('');
const toolSummary = ref([]);
const toolResults = ref([]);
// API trả danh sách công cụ đã dùng; gộp các tên trùng để phần nguồn dữ liệu gọn hơn.
const groupedToolSummary = computed(() => {
  const counts = new Map();
  for (const tool of toolSummary.value) {
    counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }
  return [...counts].map(([tool, count]) => ({ tool, count }));
});

// Kết quả công cụ được giữ chung, rồi lọc theo tên để mỗi khu vực giao diện chỉ nhận đúng loại dữ liệu.
const currentWeatherResults = computed(() =>
  toolResults.value.filter((item) => item.tool === 'getCurrentWeatherByCityName' && item.data)
);
const forecastResults = computed(() =>
  toolResults.value.filter((item) => item.tool === 'getWeatherForecastByCityName' && item.data?.days?.length)
);
// Tách nội dung Wikipedia khỏi câu trả lời để có thể hiển thị kèm ảnh và nguồn riêng.
const wikiResults = computed(() =>
  toolResults.value.filter((item) => item.tool === 'getWikiSummary' && item.data?.summary)
);
// Chuyển Markdown thành HTML rồi làm sạch trước khi dùng v-html để tránh chèn nội dung nguy hiểm.
const renderedAnswer = computed(() =>
  DOMPurify.sanitize(marked.parse(answer.value, { breaks: true, gfm: true }))
);

// Câu hỏi mẫu chỉ điền vào ô nhập; người dùng vẫn có thể sửa trước khi gửi.
function fillDemoQuestion(question) {
  prompt.value = question.prompt;
}

function getToolLabel(tool) {
  const labels = {
    getCurrentWeatherByCityName: 'thời tiết hiện tại',
    getWeatherForecastByCityName: 'dự báo thời tiết',
    getWikiSummary: 'thông tin địa điểm',
  };
  // Tên công cụ có thể được mở rộng ở backend; giữ tên gốc nếu chưa có nhãn thân thiện.
  return labels[tool] || tool;
}

// Mỗi SSE event cập nhật một phần trạng thái giao diện; dữ liệu cụ thể phụ thuộc vào loại event.
function handleStreamEvent(type, data) {
  switch (type) {
    case 'status':
      statusMessage.value = data.message || 'Đang xử lý...';
      break;
    case 'token':
      answer.value += data.text || '';
      break;
    case 'reset':
      answer.value = '';
      break;
    case 'tool_start':
      statusMessage.value = `Đang lấy ${getToolLabel(data.tool)}...`;
      break;
    case 'tool_result':
      toolResults.value.push(data.result);
      statusMessage.value = `Đã nhận ${getToolLabel(data.result.tool)}.`;
      break;
    case 'tool_error':
      error.value = `${getToolLabel(data.error.tool)}: ${data.error.error}`;
      break;
    case 'error':
      error.value = data.message || 'AI chưa thể xử lý yêu cầu này.';
      break;
    case 'done':
      if (!answer.value) answer.value = data.answer || '';
      toolSummary.value = Array.isArray(data.usedTools) ? data.usedTools : [];
      toolResults.value = Array.isArray(data.toolResults) ? data.toolResults : toolResults.value;
      if (data.toolErrors?.length) {
        error.value = data.toolErrors
          .map((item) => `${getToolLabel(item.tool)}: ${item.error}`)
          .join('; ');
      }
      statusMessage.value = 'Hoàn tất';
      break;
  }
}

// Đọc response dạng SSE: cập nhật giao diện theo từng event, không đợi toàn bộ câu trả lời mới hiển thị.
async function readEventStream(response) {
  if (!response.body) throw new Error('Trình duyệt không hỗ trợ đọc luồng phản hồi.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // Một lần reader.read() có thể trả một phần event hoặc nhiều event cùng lúc, nên cần buffer.
  let buffer = '';
  // Lưu event đã parse để DevTools có thể hiển thị toàn bộ nội dung backend gửi khi stream kết thúc.
  const streamEvents = [];

  function dispatchFrame(frame) {
    // Mỗi frame SSE gồm các dòng event:/data:; data có thể gồm nhiều dòng nên cần ghép lại.
    const lines = frame.split(/\r?\n/);
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');

    if (event && data) {
      const parsedData = JSON.parse(data);
      streamEvents.push({ event, data: parsedData });
      // Log cả payload đã parse (dễ đọc) rồi mới áp dụng event vào state Vue.
      console.debug('[AI stream] SSE event', { event, data: parsedData });
      handleStreamEvent(event, parsedData);
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    // stream:true giữ lại byte UTF-8 chưa hoàn chỉnh để ký tự tiếng Việt không bị lỗi giữa hai chunk.
    const chunk = decoder.decode(value, { stream: !done });
    console.debug('[AI stream] raw chunk', { done, chunk });
    buffer += chunk;

    // SSE phân cách frame bằng dòng trống; chỉ parse frame hoàn chỉnh, giữ phần dở dang cho lần đọc sau.
    let frameEnd = buffer.indexOf('\n\n');
    while (frameEnd !== -1) {
      dispatchFrame(buffer.slice(0, frameEnd));
      buffer = buffer.slice(frameEnd + 2);
      frameEnd = buffer.indexOf('\n\n');
    }

    if (done) {
      // Backend có thể đóng stream khi buffer còn frame cuối chưa kết thúc bằng dòng trống.
      if (buffer.trim()) dispatchFrame(buffer);
      // Snapshot trạng thái cuối cùng để đối chiếu payload backend với nội dung đã render.
      console.info('[AI stream] complete response', {
        events: streamEvents,
        answer: answer.value,
        toolSummary: toolSummary.value,
        toolResults: toolResults.value,
        error: error.value,
      });
      break;
    }
  }
}

async function askAssistant() {
  if (!prompt.value.trim()) {
    error.value = 'Nhập câu hỏi trước khi gửi.';
    answer.value = '';
    return;
  }

  // Xóa kết quả lượt trước để event mới không trộn với câu trả lời cũ.
  loading.value = true;
  error.value = '';
  answer.value = '';
  statusMessage.value = 'Đang kết nối...';
  toolSummary.value = [];
  toolResults.value = [];

  try {
    // Endpoint trả SSE qua POST vì nội dung câu hỏi được gửi trong JSON body.
    const response = await fetch(apiUrl('/ai/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.value.trim() }),
    });

    if (!response.ok) {
      // Khi HTTP lỗi, endpoint thường trả JSON thay vì mở một luồng SSE.
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Request thất bại (${response.status})`);
    }

    await readEventStream(response);
  } catch (err) {
    error.value = err?.response?.data?.error || err?.message || 'Có lỗi khi gọi API';
  } finally {
    // Dù thành công hay lỗi, mở lại nút gửi sau khi request kết thúc.
    loading.value = false;
  }
}
</script>

<template>
  <main class="assistant-page">
    <section class="assistant-shell">
      <header class="assistant-header">
        <h1>Trợ lý du lịch</h1>
        <p class="subtitle">Thời tiết và khám phá điểm đến</p>
      </header>

      <form class="question-form" @submit.prevent="askAssistant">
        <label for="question">Bạn muốn tìm hiểu điều gì?</label>
        <textarea
          id="question"
          v-model="prompt"
          class="form-control assistant-input"
          rows="4"
          placeholder="Ví dụ: Dự báo thời tiết 3 ngày ở Hà Nội và giới thiệu về nơi này"
        />

        <!-- Câu hỏi nhanh điền nội dung vào ô nhập; thao tác gửi vẫn dùng cùng luồng với câu hỏi tự nhập. -->
        <div class="quick-prompts" aria-label="Gợi ý câu hỏi nhanh">
          <div class="quick-prompts-heading">
            <strong>Gợi ý nhanh</strong>
            <span>Chọn để điền vào ô hỏi</span>
          </div>
          <div class="quick-prompt-list">
            <button
              v-for="question in demoQuestions"
              :key="question.prompt"
              class="quick-prompt-chip"
              type="button"
              :disabled="loading"
              :aria-label="`${question.prompt} Mẫu ${question.toolCount} tool`"
              @click="fillDemoQuestion(question)"
            >
              <span>{{ question.label }}</span>
              <small>{{ question.toolCount }} tool</small>
            </button>
          </div>
        </div>

        <button class="btn btn-primary assistant-submit" :disabled="loading" type="submit">
          {{ loading ? 'Đang xử lý...' : 'Gửi câu hỏi' }}
        </button>
      </form>

      <!-- Trạng thái được cập nhật bởi các event status/tool_start/tool_result trong luồng SSE. -->
      <div v-if="statusMessage" class="progress" role="status" aria-live="polite">
        <span class="progress-dot" :class="{ active: loading }" aria-hidden="true" />
        <span>{{ statusMessage }}</span>
      </div>

      <div v-if="error" class="error" role="alert">{{ error }}</div>

      <section v-if="answer || wikiResults.length" class="result-box" aria-live="polite">
        <h2>Thông tin</h2>
        <!-- Câu trả lời và ngữ cảnh Wikipedia cùng nằm trong khu vực thông tin nhưng được render riêng. -->
        <div class="answer-layout" :class="{ 'has-answer': answer }">
          <!-- Nội dung Markdown đã được làm sạch ở renderedAnswer trước khi đưa vào DOM. -->
          <div v-if="answer" class="markdown-answer" v-html="renderedAnswer" />
          <div v-if="wikiResults.length" class="wiki-context-list">
            <figure v-for="(item, index) in wikiResults" :key="`wiki-${index}`" class="wiki-context">
              <img
                v-if="item.data.thumbnail?.source"
                class="wiki-thumbnail"
                :src="item.data.thumbnail.source"
                :alt="`Ảnh minh họa ${item.data.title || item.args?.title || 'địa điểm'}`"
                loading="lazy"
              />
              <figcaption>
                <strong>{{ item.data.title || item.args?.title }}</strong>
                <span>{{ item.data.summary }}</span>
                <small>Nguồn: Wikipedia</small>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section v-if="currentWeatherResults.length || forecastResults.length" class="weather-section">
        <!-- Dữ liệu thời tiết hiện tại và dự báo đến từ hai tool khác nhau, được lọc ở các computed phía trên. -->
        <h2>Thời tiết</h2>

        <div class="row g-3">
          <article
            v-for="(item, index) in currentWeatherResults"
            :key="`current-${index}`"
            class="col-12 col-xl-6"
          >
            <div class="weather-card current-weather h-100">
              <div class="weather-heading">
                <div>
                  <p class="eyebrow">Hiện tại</p>
                  <h3>{{ item.data.cityName || item.args?.cityName }}</h3>
                </div>
                <div class="current-weather-reading">
                  <i
                    v-if="item.data.icon"
                    :class="['current-weather-icon', item.data.icon]"
                    aria-hidden="true"
                  />
                  <strong class="temperature">{{ item.data.temperature }}°C</strong>
                </div>
              </div>
              <p class="condition">{{ item.data.condition }}</p>
              <p v-if="item.data.meme" class="weather-meme">"{{ item.data.meme }}"</p>
              <div class="weather-details">
                <span v-if="item.data.humidity != null">Độ ẩm {{ item.data.humidity }}%</span>
                <span v-if="item.data.windSpeed != null">Gió {{ item.data.windSpeed }} km/h</span>
                <span v-if="item.data.precipitation != null">Mưa {{ item.data.precipitation }} mm</span>
              </div>
            </div>
          </article>

          <article
            v-for="(item, index) in forecastResults"
            :key="`forecast-${index}`"
            class="col-12 col-xl-6"
          >
            <div class="weather-card h-100">
              <p class="eyebrow">Dự báo</p>
              <h3>{{ item.data.cityName || item.args?.cityName }}</h3>
              <div class="forecast-list">
                <div v-for="day in item.data.days" :key="day.date" class="forecast-day">
                  <span class="forecast-date">{{ day.date }}</span>
                  <i v-if="day.icon" :class="['forecast-icon', day.icon]" aria-hidden="true" />
                  <span class="forecast-condition">{{ day.description }}</span>
                  <strong>{{ day.tempMax }}° / {{ day.tempMin }}°</strong>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div v-if="groupedToolSummary.length" class="tools-box">
        <!-- Danh sách này là tổng kết tool backend báo đã dùng, không phải nội dung trả về của từng tool. -->
        <h3>Nguồn dữ liệu</h3>
        <ul>
          <li v-for="item in groupedToolSummary" :key="item.tool">
            <code>{{ item.tool }}</code>
            <small v-if="item.count > 1">({{ item.count }} lượt)</small>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
.assistant-page {
  box-sizing: border-box;
  width: 100%;
  min-height: calc(100vh - 76px);
  padding: 28px;
}

.assistant-shell {
  width: min(100%, 1120px);
  min-height: calc(100vh - 132px);
  margin: 0 auto;
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-surface);
}

.assistant-header {
  margin-bottom: 22px;
}

h1 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 400;
}

.subtitle {
  margin: 0;
  color: var(--color-muted);
}

.question-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.assistant-input {
  min-height: 112px;
  padding: 12px;
  border-color: var(--color-border);
  border-radius: 3px;
  resize: vertical;
  font: inherit;
}

.assistant-input:focus,
.assistant-input:focus-visible {
  border-color: var(--color-primary-soft);
  box-shadow: 0 0 0 3px rgba(27, 67, 50, 0.1);
}

.quick-prompts {
  margin-top: 14px;
}

.quick-prompts-heading {
  display: flex;
  align-items: baseline;
  gap: 9px;
  margin-bottom: 8px;
}

.quick-prompts-heading strong {
  color: var(--color-ink);
  font-size: 11px;
}

.quick-prompts-heading span {
  color: var(--color-muted);
  font-size: 10px;
}

.quick-prompt-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.quick-prompt-chip {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
  font-size: 10px;
  text-align: left;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.quick-prompt-chip:hover:not(:disabled),
.quick-prompt-chip:focus-visible {
  border-color: var(--color-primary-soft);
  background: #f1f5f1;
  outline: none;
}

.quick-prompt-chip:disabled {
  cursor: wait;
  opacity: 0.6;
}

.quick-prompt-chip small {
  flex: none;
  padding: 3px 5px;
  border-radius: 2px;
  background: #e8eee9;
  color: var(--color-primary);
  font-size: 8px;
  font-weight: 700;
}

.assistant-submit {
  width: 100%;
  margin-top: 14px;
  padding: 12px 16px;
  border: 0;
  border-radius: 3px;
  background: var(--color-primary);
  font-weight: 700;
}

.assistant-submit:hover:not(:disabled) {
  background: var(--color-primary-soft);
}

.progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  color: var(--color-muted);
  font-size: 14px;
}

.progress-dot {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  background: #c1c8c2;
}

.progress-dot.active {
  background: var(--color-primary-soft);
  animation: progress-pulse 1.1s ease-in-out infinite;
}

@keyframes progress-pulse {
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}

.error {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #e9c5b9;
  border-radius: 4px;
  background: #fff4ee;
  color: #772f18;
}

.result-box,
.tools-box {
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #f7f3ee;
}

.result-box h2,
.weather-section > h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.markdown-answer {
  min-width: 0;
  color: var(--color-ink);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.markdown-answer :deep(:first-child) {
  margin-top: 0;
}

.markdown-answer :deep(:last-child) {
  margin-bottom: 0;
}

.markdown-answer :deep(p),
.markdown-answer :deep(ul),
.markdown-answer :deep(ol),
.markdown-answer :deep(blockquote),
.markdown-answer :deep(pre),
.markdown-answer :deep(table),
.markdown-answer :deep(hr) {
  margin-top: 0;
  margin-bottom: 12px;
}

.markdown-answer :deep(h1),
.markdown-answer :deep(h2),
.markdown-answer :deep(h3),
.markdown-answer :deep(h4) {
  margin: 18px 0 8px;
  color: var(--color-primary);
  line-height: 1.35;
}

.markdown-answer :deep(h1) {
  font-size: 23px;
}

.markdown-answer :deep(h2) {
  font-size: 20px;
}

.markdown-answer :deep(h3),
.markdown-answer :deep(h4) {
  font-size: 17px;
}

.markdown-answer :deep(ul),
.markdown-answer :deep(ol) {
  padding-left: 22px;
}

.markdown-answer :deep(li + li) {
  margin-top: 4px;
}

.markdown-answer :deep(blockquote) {
  padding: 2px 0 2px 12px;
  border-left: 3px solid #c1c8c2;
  color: var(--color-muted);
}

.markdown-answer :deep(code) {
  padding: 2px 5px;
  border-radius: 3px;
  background: #f1ede8;
  font-size: 0.9em;
}

.markdown-answer :deep(pre) {
  overflow-x: auto;
  padding: 12px;
  border-radius: 3px;
  background: #f1ede8;
}

.markdown-answer :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-answer :deep(a) {
  color: var(--color-secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-answer :deep(table) {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
}

.markdown-answer :deep(th),
.markdown-answer :deep(td) {
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  text-align: left;
}

.markdown-answer :deep(th) {
  background: #e8eee9;
}

.markdown-answer :deep(hr) {
  border: 0;
  border-top: 1px solid var(--color-border);
}

.markdown-answer :deep(img) {
  max-width: 100%;
  height: auto;
}

.answer-layout .markdown-answer {
  margin: 0;
}

.weather-section {
  margin-top: 24px;
}

/* [THUMBNAIL: new] Present Wikipedia context as part of the AI answer, not a detached section. */
.answer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 20px;
}

.answer-layout.has-answer {
  grid-template-columns: minmax(0, 1fr) minmax(200px, 28%);
}

.answer-layout pre {
  min-width: 0;
}

.wiki-context-list {
  display: grid;
  gap: 18px;
}

.wiki-context {
  min-width: 0;
  margin: 0;
}

.wiki-thumbnail {
  display: block;
  width: 100%;
  max-height: 260px;
  border-radius: 4px;
  background: #f1ede8;
  object-fit: contain;
}

.wiki-context figcaption {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.5;
}

.wiki-context figcaption strong {
  color: var(--color-ink);
  font-size: 14px;
}

.wiki-context figcaption span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}

.wiki-context figcaption small {
  color: var(--color-muted);
}

.weather-card {
  min-width: 0;
  height: 100%;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #f7f3ee;
}

.current-weather {
  border-color: #c4d0c7;
  background: #e8eee9;
}

.weather-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.weather-card h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
}

.temperature {
  flex: none;
  font-size: 26px;
}

.current-weather-reading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.current-weather-icon {
  color: var(--color-primary-soft);
  font-size: 28px;
}

.condition {
  margin: 12px 0;
  font-weight: 600;
}

.weather-meme {
  margin: -4px 0 12px;
  color: var(--color-muted);
  font-style: italic;
  white-space: pre-line;
}

.weather-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--color-muted);
  font-size: 13px;
}

.forecast-list {
  margin-top: 10px;
}

.forecast-day {
  display: grid;
  grid-template-columns: minmax(72px, auto) 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 9px 0;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
}

.forecast-date {
  color: var(--color-muted);
  white-space: nowrap;
}

.forecast-condition {
  min-width: 0;
  color: var(--color-muted);
}

.forecast-icon {
  color: var(--color-primary-soft);
  font-size: 18px;
  text-align: center;
}

.tools-box h3 {
  margin-top: 0;
  font-size: 16px;
}

.tools-box ul {
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 480px) {
  .assistant-page {
    padding: 10px;
  }

  .assistant-shell {
    min-height: calc(100vh - 88px);
    padding: 16px;
    border-radius: 4px;
  }

  .forecast-day {
    grid-template-columns: minmax(72px, 1fr) 28px auto;
  }

  /* [THUMBNAIL: new] Stack the source context below the answer on narrow screens. */
  .answer-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .wiki-thumbnail {
    max-height: 240px;
  }

  .forecast-condition {
    grid-column: 1 / 3;
    grid-row: 2;
  }

  .forecast-day strong {
    grid-column: 3;
    grid-row: 1 / 3;
  }
}
</style>
