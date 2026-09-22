import type { IndexFile, RootFile, SuraFile } from './types';

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`;

const rootCache = new Map<string, Promise<RootFile>>();
const suraCache = new Map<number, Promise<SuraFile>>();
let indexPromise: Promise<IndexFile> | null = null;

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`تعذّر تحميل ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

export function loadIndex(): Promise<IndexFile> {
  if (!indexPromise) indexPromise = getJSON<IndexFile>(`${BASE}/index.json`);
  return indexPromise;
}

export function loadRoot(id: string): Promise<RootFile> {
  let p = rootCache.get(id);
  if (!p) {
    p = getJSON<RootFile>(`${BASE}/roots/${id}.json`);
    rootCache.set(id, p);
  }
  return p;
}

export function loadSura(n: number): Promise<SuraFile> {
  let p = suraCache.get(n);
  if (!p) {
    p = getJSON<SuraFile>(`${BASE}/quran/${n}.json`);
    suraCache.set(n, p);
  }
  return p;
}
