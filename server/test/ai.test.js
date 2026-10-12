import test from 'node:test';
import assert from 'node:assert/strict';

import { askGemini, askTravelAssistant } from '../src/services/ai.js';

test('askGemini rejects empty prompt', async () => {
  await assert.rejects(() => askGemini('   '), /prompt không được rỗng/);
});

test('askTravelAssistant rejects empty prompt', async () => {
  await assert.rejects(() => askTravelAssistant('   '), /prompt không được rỗng/);
});

