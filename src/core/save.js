import { serialize, deserialize } from './game.js';

const KEY = 'zm.save.v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(state)));
    return true;
  } catch (err) {
    console.warn('存档失败', err);
    return false;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return deserialize(JSON.parse(raw));
  } catch (err) {
    console.warn('读档失败', err);
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function exportSave(state) {
  const json = JSON.stringify(serialize(state));
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSave(text) {
  const bin = atob(text.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return deserialize(JSON.parse(json));
}
