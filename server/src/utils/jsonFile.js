import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// server/data/ (đi lên 2 cấp từ src/utils)
const DATA_DIR = path.join(import.meta.dirname, '..', '..', 'data');

export async function readJson(name) {
  const text = await readFile(path.join(DATA_DIR, name), 'utf-8');
  return JSON.parse(text);
}

export async function writeJson(name, data) {
  await writeFile(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}
