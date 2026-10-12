<script setup>
import { computed, ref } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const prompt = ref('Dự báo thời tiết 3 ngày ở Hà Nội và giới thiệu về Hà Nội');
// [DEMO: new] Example prompts exercise zero, one, two, and three available tools.
const demoQuestionGroups = [
  {
    label: '0 tool · Hỏi đáp chung',
    questions: [
      { label: 'Vì sao bầu trời có màu xanh?', prompt: 'Giải thích ngắn gọn vì sao bầu trời có màu xanh.' },
    ],
  },
  {
    label: '1 tool · Thời tiết hiện tại',
    questions: [
      { label: 'Thời tiết hiện tại ở Hà Nội', prompt: 'Thời tiết hiện tại ở Hà Nội như thế nào?' },
    ],
  },
  {
    label: '2 tool · Thời tiết và địa điểm',
    questions: [
      {
        label: 'Thời tiết và giới thiệu Đà Nẵng',
        prompt: 'Cho biết thời tiết hiện tại ở Đà Nẵng và giới thiệu ngắn về thành phố này.',
      },
    ],
  },
  {
    label: '3 tool · Thời tiết, dự báo và địa điểm',
    questions: [
      {
        label: 'Hiện tại, dự báo 3 ngày và giới thiệu Hà Nội',
        prompt: 'Cho biết thời tiết hiện tại, dự báo 3 ngày tới ở Hà Nội và giới thiệu ngắn về Hà Nội.',
      },
    ],
  },
];
const selectedDemoPrompt = ref('');
const loading = ref(false);
const answer = ref('');
const error = ref('');
const statusMessage = ref('');
const toolSummary = ref([]);
const toolResults = ref([]);

const currentWeatherResults = computed(() =>
  toolResults.value.filter((item) => item.tool === 'getCurrentWeatherByCityName' && item.data)
);
const forecastResults = computed(() =>
  toolResults.value.filter((item) => item.tool === 'getWeatherForecastByCityName' && item.data?.days?.length)
);
// [THUMBNAIL: new] Show Wikipedia tool results separately from the assistant's text answer.
const wikiResults = computed(() =>
  toolResults.value.filter((item) => item.tool === 'getWikiSummary' && item.data?.summary)
);
// [MARKDOWN: new] Sanitize model output before inserting parsed Markdown into the DOM.
const renderedAnswer = computed(() =>
  DOMPurify.sanitize(marked.parse(answer.value, { breaks: true, gfm: true }))
);

// [DEMO: new] Selecting a sample fills the prompt but leaves submission under user control.
function useDemoPrompt() {
  if (selectedDemoPrompt.value) prompt.value = selectedDemoPrompt.value;
  selectedDemoPrompt.value = '';
}

function getToolLabel(tool) {
  const labels = {
    getCurrentWeatherByCityName: 'thời tiết hiện tại',
    getWeatherForecastByCityName: 'dự báo thời tiết',
    getWikiSummary: 'thông tin địa điểm',
  };
  return labels[tool] || tool;
}

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

// STREAM: Parse SSE frames from the POST response and update the UI as events arrive.
async function readEventStream(response) {
  if (!response.body) throw new Error('Trình duyệt không hỗ trợ đọc luồng phản hồi.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function dispatchFrame(frame) {
    const lines = frame.split(/\r?\n/);
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');

    if (event && data) handleStreamEvent(event, JSON.parse(data));
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let frameEnd = buffer.indexOf('\n\n');
    while (frameEnd !== -1) {
      dispatchFrame(buffer.slice(0, frameEnd));
      buffer = buffer.slice(frameEnd + 2);
      frameEnd = buffer.indexOf('\n\n');
    }

    if (done) {
      if (buffer.trim()) dispatchFrame(buffer);
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

  loading.value = true;
  error.value = '';
  answer.value = '';
  statusMessage.value = 'Đang kết nối...';
  toolSummary.value = [];
  toolResults.value = [];

  try {
    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.value.trim() }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Request thất bại (${response.status})`);
    }

    await readEventStream(response);
  } catch (err) {
    error.value = err?.response?.data?.error || err?.message || 'Có lỗi khi gọi API';
  } finally {
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

        <!-- [DEMO: new] Group sample questions by the number of tools they are intended to exercise. -->
        <label for="demo-question">Câu hỏi mẫu cho demo</label>
        <select
          id="demo-question"
          v-model="selectedDemoPrompt"
          class="form-control demo-question-select"
          :disabled="loading"
          @change="useDemoPrompt"
        >
          <option disabled value="">Chọn câu hỏi mẫu...</option>
          <optgroup v-for="group in demoQuestionGroups" :key="group.label" :label="group.label">
            <option v-for="question in group.questions" :key="question.prompt" :value="question.prompt">
              {{ question.label }}
            </option>
          </optgroup>
        </select>

        <button class="btn btn-primary assistant-submit" :disabled="loading" type="submit">
          {{ loading ? 'Đang xử lý...' : 'Gửi câu hỏi' }}
        </button>
      </form>

      <!-- STREAM: Show live analysis and tool progress from the SSE endpoint. -->
      <div v-if="statusMessage" class="progress" role="status" aria-live="polite">
        <span class="progress-dot" :class="{ active: loading }" aria-hidden="true" />
        <span>{{ statusMessage }}</span>
      </div>

      <div v-if="error" class="error" role="alert">{{ error }}</div>

      <section v-if="answer || wikiResults.length" class="result-box" aria-live="polite">
        <h2>Thông tin</h2>
        <!-- [THUMBNAIL: new] Keep the AI answer and its Wikipedia context in one result panel. -->
        <div class="answer-layout" :class="{ 'has-answer': answer }">
          <!-- [MARKDOWN: new] Render sanitized Markdown for readable headings, lists, and code. -->
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

      <div v-if="toolSummary.length" class="tools-box">
        <h3>Nguồn dữ liệu</h3>
        <ul>
          <li v-for="tool in toolSummary" :key="tool"><code>{{ tool }}</code></li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: #f3f4f6;
}

.assistant-page {
  box-sizing: border-box;
  width: 100%;
  min-height: 100vh;
  padding: 20px;
}

.assistant-shell {
  width: 100%;
  min-height: calc(100vh - 40px);
  padding: 24px;
  border-radius: 16px;
  background: white;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
}

.assistant-header {
  margin-bottom: 22px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.subtitle {
  margin: 0;
  color: #666;
}

.question-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.assistant-input {
  min-height: 112px;
  padding: 12px;
  border-color: #d4d4d8;
  border-radius: 10px;
  resize: vertical;
  font: inherit;
}

.demo-question-select {
  margin-bottom: 2px;
}

.assistant-submit {
  width: 100%;
  margin-top: 14px;
  padding: 12px 16px;
  border: 0;
  border-radius: 10px;
  background: #2563eb;
  font-weight: 700;
}

.assistant-submit:hover:not(:disabled) {
  background: #1d4ed8;
}

.progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  color: #475569;
  font-size: 14px;
}

.progress-dot {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  background: #94a3b8;
}

.progress-dot.active {
  background: #2563eb;
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
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #991b1b;
}

.result-box,
.tools-box {
  margin-top: 20px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.result-box h2,
.weather-section > h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.markdown-answer {
  min-width: 0;
  color: #111827;
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
  color: #111827;
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
  border-left: 3px solid #94a3b8;
  color: #475569;
}

.markdown-answer :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #e2e8f0;
  font-size: 0.9em;
}

.markdown-answer :deep(pre) {
  overflow-x: auto;
  padding: 12px;
  border-radius: 6px;
  background: #e2e8f0;
}

.markdown-answer :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-answer :deep(a) {
  color: #1d4ed8;
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
  border: 1px solid #cbd5e1;
  text-align: left;
}

.markdown-answer :deep(th) {
  background: #e2e8f0;
}

.markdown-answer :deep(hr) {
  border: 0;
  border-top: 1px solid #cbd5e1;
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
  border-radius: 6px;
  background: #e2e8f0;
  object-fit: contain;
}

.wiki-context figcaption {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}

.wiki-context figcaption strong {
  color: #111827;
  font-size: 14px;
}

.wiki-context figcaption span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}

.wiki-context figcaption small {
  color: #64748b;
}

.weather-card {
  min-width: 0;
  height: 100%;
  padding: 16px;
  border: 1px solid #dbe3ec;
  border-radius: 8px;
  background: #f8fafc;
}

.current-weather {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.weather-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.weather-card h3 {
  margin: 0;
  font-size: 18px;
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
  color: #2563eb;
  font-size: 28px;
}

.condition {
  margin: 12px 0;
  font-weight: 600;
}

.weather-meme {
  margin: -4px 0 12px;
  color: #475569;
  font-style: italic;
  white-space: pre-line;
}

.weather-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: #475569;
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
  border-top: 1px solid #e2e8f0;
  font-size: 13px;
}

.forecast-date {
  color: #475569;
  white-space: nowrap;
}

.forecast-condition {
  min-width: 0;
  color: #475569;
}

.forecast-icon {
  color: #2563eb;
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
    min-height: calc(100vh - 20px);
    padding: 16px;
    border-radius: 12px;
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
