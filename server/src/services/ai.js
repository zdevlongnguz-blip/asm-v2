import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.js';
import { cached } from '../utils/cache.js';
import {
  DEFAULT_FORECAST_DAYS,
  MAX_FORECAST_DAYS,
  MIN_FORECAST_DAYS,
  getCurrentWeatherByCityName,
  getWeatherForecastByCityName,
} from './weather.js';
import { getWikiSummaryWithThumbnail } from './wiki.js';

// ---------- Cấu hình ----------
const MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_STEPS = 4; // số vòng gọi tool tối đa, tránh lặp vô hạn

// [ROUTING: tightened] Treat weather as opt-in based on explicit user intent.
const SYSTEM_PROMPT =
  'Bạn là trợ lý du lịch. Trả lời bằng tiếng Việt, ngắn gọn và dễ quét. ' +
  'Khi phù hợp, mở đầu bằng một câu kết luận ngắn rồi chia thông tin thành các ý gạch đầu dòng. ' +
  'Chỉ gọi tool thời tiết khi người dùng hỏi rõ về thời tiết, dự báo, nhiệt độ, mưa hoặc điều kiện thời tiết. ' +
  'Việc nhắc tên một địa điểm, hoặc yêu cầu giới thiệu/thông tin/lịch sử về nơi đó, không phải yêu cầu thời tiết; không gọi tool thời tiết trong các trường hợp này. ' +
  'Khi cần thông tin về địa điểm, gọi tool getWikiSummary. Chỉ gọi những tool cần thiết để trả lời đúng yêu cầu; nếu người dùng hỏi cả thời tiết và thông tin địa điểm thì gọi cả hai tool tương ứng. Không tự bịa dữ liệu. ' +
  'Dữ liệu thời tiết đã được hiển thị riêng; không lặp lại chi tiết nhiệt độ hay dự báo trong phần trả lời. ' +
  'Không tạo HTML hoặc bảng Markdown. Nếu một tool lỗi, vẫn trả lời phần còn lại và nói rõ phần nào thiếu.';

let ai;

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY trong .env');
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
}

// ---------- Tools ----------
// Muốn thêm tool mới: thêm 1 mục vào đây, không cần sửa chỗ nào khác.
const TOOLS = {
  getCurrentWeatherByCityName: {
    description: 'Lấy thời tiết hiện tại theo tên địa điểm',
    parameters: {
      type: 'object',
      properties: { cityName: { type: 'string', description: 'Tên thành phố' } },
      required: ['cityName'],
    },
    run: ({ cityName }) => getCurrentWeatherByCityName(cityName),
  },

  getWeatherForecastByCityName: {
    description: 'Lấy dự báo thời tiết theo tên địa điểm trong vài ngày tới',
    parameters: {
      type: 'object',
      properties: {
        cityName: { type: 'string', description: 'Tên thành phố' },
        days: {
          type: 'number',
          description: `Số ngày dự báo (${MIN_FORECAST_DAYS}-${MAX_FORECAST_DAYS}), mặc định ${DEFAULT_FORECAST_DAYS}`,
        },
      },
      required: ['cityName'],
    },
    run: ({ cityName, days }) =>
      getWeatherForecastByCityName(cityName, days ?? DEFAULT_FORECAST_DAYS),
  },

  getWikiSummary: {
    description: 'Lấy tóm tắt ngắn về một địa điểm du lịch',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string', description: 'Tên địa điểm' } },
      required: ['title'],
    },
    // [THUMBNAIL: new] Return metadata to the UI; send only summary text back to Gemini.
    run: ({ title }) => getWikiSummaryWithThumbnail(title),
    toModelResponse: (result) => result?.summary ?? result,
  },
};

const FUNCTION_DECLARATIONS = Object.entries(TOOLS).map(([name, t]) => ({
  name,
  description: t.description,
  parameters: t.parameters,
}));

// ---------- Helpers ----------
async function runToolCall({ name, args }) {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`Tool "${name}" không tồn tại`);
  logger.info(`tool ${name}: ${JSON.stringify(args)}`);
  return tool.run(args ?? {});
}

// ---------- Hỏi Gemini thường (không tool) ----------
export async function askGemini(prompt, systemInstruction = SYSTEM_PROMPT) {
  const cleanPrompt = String(prompt ?? '').trim();
  if (!cleanPrompt) throw new Error('askGemini: prompt không được rỗng');

  const res = await getAiClient().models.generateContent({
    model: MODEL,
    contents: cleanPrompt,
    config: { systemInstruction, temperature: 0.2 },
  });
  return res.text?.trim() || '';
}

// STREAM: Read Gemini chunks while preserving the model parts needed for tool calls.
async function streamModelTurn(contents, step, onEvent, signal) {
  const responseStream = await getAiClient().models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.2,
      tools: step < MAX_STEPS
        ? [{ functionDeclarations: FUNCTION_DECLARATIONS }]
        : undefined,
      abortSignal: signal,
    },
  });

  let text = '';
  const parts = [];
  const functionCallIndexes = new Map();

  for await (const chunk of responseStream) {
    for (const [partIndex, part] of (chunk.candidates?.[0]?.content?.parts ?? []).entries()) {
      if (part.functionCall) {
        const key = part.functionCall.id || `${part.functionCall.name}:${partIndex}`;
        const previousIndex = functionCallIndexes.get(key);
        const previousPart = previousIndex === undefined ? null : parts[previousIndex];
        const functionCall = {
          ...previousPart?.functionCall,
          ...part.functionCall,
          args: { ...previousPart?.functionCall?.args, ...part.functionCall.args },
        };
        const mergedPart = { ...previousPart, ...part, functionCall };

        if (previousIndex === undefined) {
          functionCallIndexes.set(key, parts.length);
          parts.push(mergedPart);
        } else {
          parts[previousIndex] = mergedPart;
        }
      } else if (part.text) {
        const previousPart = parts.at(-1);
        if (previousPart?.text) {
          parts[parts.length - 1] = {
            ...previousPart,
            ...part,
            text: `${previousPart.text}${part.text}`,
          };
        } else {
          parts.push(part);
        }
      } else {
        parts.push(part);
      }
    }

    const token = String(chunk.text || '');
    if (token) {
      text += token;
      onEvent?.({ type: 'token', text: token });
    }
  }

  const calls = parts
    .filter((part) => part.functionCall)
    .map((part) => part.functionCall);

  return {
    text: text.trim(),
    calls,
    modelContent: { role: 'model', parts },
  };
}

// ---------- Trợ lý du lịch (có tool) ----------
// STREAM: Emit status, streamed text, and tool results for the SSE endpoint.
async function chatWithTools(prompt, onEvent, signal) {
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const usedTools = [];
  const toolErrors = [];
  const toolResults = [];

  for (let step = 0; step <= MAX_STEPS; step++) {
    onEvent?.({
      type: 'status',
      message: step === MAX_STEPS ? 'Đang tổng hợp câu trả lời...' : 'Đang phân tích yêu cầu...',
    });

    if (signal?.aborted) throw new Error('Yêu cầu đã bị hủy');
    const turn = await streamModelTurn(contents, step, onEvent, signal);
    const calls = turn.calls;
    if (calls.length === 0) {
      return { answer: turn.text, usedTools, toolResults, toolErrors };
    }
    if (step === MAX_STEPS) throw new Error('Model tiếp tục yêu cầu tool sau giới hạn');

    if (turn.text) onEvent?.({ type: 'reset' });
    contents.push(turn.modelContent);

    const executions = await Promise.all(
      calls.map(async (call) => {
        onEvent?.({ type: 'tool_start', tool: call.name, args: call.args ?? {} });
        try {
          const data = await runToolCall(call);
          const result = {
            tool: call.name,
            args: call.args ?? {},
            data,
          };
          onEvent?.({ type: 'tool_result', result });
          return {
            part: {
              functionResponse: {
                name: call.name,
                response: { result: TOOLS[call.name].toModelResponse?.(data) ?? data },
              },
            },
            tool: call.name,
            result,
          };
        } catch (error) {
          logger.warn(`tool ${call.name} lỗi: ${error.message}`);
          const toolError = { tool: call.name, error: error.message };
          const result = { tool: call.name, args: call.args ?? {}, error: error.message };
          onEvent?.({ type: 'tool_error', error: toolError });
          return {
            part: { functionResponse: { name: call.name, response: { error: error.message } } },
            error: toolError,
            result,
          };
        }
      })
    );

    for (const execution of executions) {
      toolResults.push(execution.result);
      if (execution.error) {
        toolErrors.push(execution.error);
      } else {
        usedTools.push(execution.tool);
      }
    }
    contents.push({ role: 'user', parts: executions.map(({ part }) => part) });
  }

  throw new Error('Vượt quá số vòng gọi tool cho phép');
}

export async function askTravelAssistant(prompt) {
  const cleanPrompt = String(prompt ?? '').trim();
  if (!cleanPrompt) throw new Error('askTravelAssistant: prompt không được rỗng');

  try {
    // Lỗi sẽ throw ra khỏi cached() nên không bị cache lại
    return await cached(`travel:${cleanPrompt.toLowerCase()}`, CACHE_TTL_MS, async () => {
      const result = await chatWithTools(cleanPrompt);
      if (!result.answer) throw new Error('Model không trả về nội dung');
      return result;
    });
  } catch (error) {
    logger.warn(`askTravelAssistant lỗi: ${error.message}`);
    return {
      answer: 'Mình chưa trả lời được ngay lúc này, bạn thử lại sau nhé.',
      usedTools: [],
      toolResults: [],
      toolErrors: [],
    };
  }
}

// STREAM: The SSE route uses this uncached wrapper so each request emits live events.
export async function askTravelAssistantStream(prompt, onEvent, signal) {
  const cleanPrompt = String(prompt ?? '').trim();
  if (!cleanPrompt) throw new Error('askTravelAssistantStream: prompt không được rỗng');

  try {
    const result = await chatWithTools(cleanPrompt, onEvent, signal);
    if (!result.answer) throw new Error('Model không trả về nội dung');
    return result;
  } catch (error) {
    logger.warn(`askTravelAssistantStream lỗi: ${error.message}`);
    onEvent?.({ type: 'error', message: 'AI chưa thể xử lý yêu cầu này lúc này.' });
    return {
      answer: 'Mình chưa trả lời được ngay lúc này, bạn thử lại sau nhé.',
      usedTools: [],
      toolResults: [],
      toolErrors: [],
    };
  }
}