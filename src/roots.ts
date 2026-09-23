import type { BiRoot, BiRule, IndexRoot } from './types';

export const ALPHABET = 'أبتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');

export const LETTER_NAMES: Record<string, string> = {
  'أ': 'الهمزة', 'ب': 'الباء', 'ت': 'التاء', 'ث': 'الثاء', 'ج': 'الجيم', 'ح': 'الحاء',
  'خ': 'الخاء', 'د': 'الدال', 'ذ': 'الذال', 'ر': 'الراء', 'ز': 'الزاي', 'س': 'السين',
  'ش': 'الشين', 'ص': 'الصاد', 'ض': 'الضاد', 'ط': 'الطاء', 'ظ': 'الظاء', 'ع': 'العين',
  'غ': 'الغين', 'ف': 'الفاء', 'ق': 'القاف', 'ك': 'الكاف', 'ل': 'اللام', 'م': 'الميم',
  'ن': 'النون', 'ه': 'الهاء', 'و': 'الواو', 'ي': 'الياء',
};

const WEAK = new Set(['و', 'ي']);

/** Normalise hamza carriers and alif so that every root is spelled with the 28 letters. */
export function normLetters(s: string): string {
  return s.replace(/[ؤئءإآ]/g, 'أ').replace(/ا/g, 'أ');
}

/** Strip vocalisation for searching. */
export function stripDiacritics(s: string): string {
  return s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا');
}

/**
 * The biliteral root of a corpus root.
 *  - 'first-two' : the first two radicals (الحرفان الأولان), the usual reading
 *                  of the biliteral theory.
 *  - 'strong'    : drop a single weak radical (و/ي) and geminations, so that
 *                  قول → قل, مدد → مد, but وعد → وع (two strong letters kept in order).
 */
export function biliteralOf(root: string, rule: BiRule): string {
  const r = normLetters(root);
  if (rule === 'strong' && r.length === 3) {
    if (r[1] === r[2]) return r.slice(0, 2);
    const strong = [...r].filter((c) => !WEAK.has(c));
    if (strong.length === 2) return strong.join('');
  }
  if (r.length === 4 && r.slice(0, 2) === r.slice(2, 4)) return r.slice(0, 2); // زلزل
  return r.slice(0, 2);
}

export function groupBiliteral(roots: IndexRoot[], rule: BiRule, meanings: Record<string, string> = {}): BiRoot[] {
  const map = new Map<string, BiRoot>();
  for (const root of roots) {
    const id = biliteralOf(root.r, rule);
    let b = map.get(id);
    if (!b) {
      b = { id, letters: [id[0], id[1]], roots: [], verbLemmas: 0, verbTokens: 0, nounLemmas: 0, nounTokens: 0, otherVerbs: 0, meaning: meanings[id] };
      map.set(id, b);
    }
    b.roots.push(root);
    b.verbLemmas += root.v;
    b.verbTokens += root.vo;
    b.nounLemmas += root.n;
    b.nounTokens += root.no;
    b.otherVerbs += root.x ?? 0;
  }
  const order = (c: string) => ALPHABET.indexOf(c);
  const out = [...map.values()];
  for (const b of out) b.roots.sort((a, c) => compareRoots(a.l, c.l));
  out.sort((a, b) => order(a.id[0]) - order(b.id[0]) || order(a.id[1]) - order(b.id[1]));
  return out;
}

export function compareRoots(a: string, b: string): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (ALPHABET.indexOf(a[i] ?? '') ) - (ALPHABET.indexOf(b[i] ?? ''));
    if (d !== 0) return d;
  }
  return 0;
}

/** Spaced letters with a tatweel-free separator for display: "ق ل ب" */
export function spaced(root: string): string {
  return [...normLetters(root)].join(' ');
}

/** Letters joined by a small dash for tree labels: "ق‑ل" (non-breaking hyphen) */
export function dashed(root: string): string {
  return [...normLetters(root)].join('‑');
}

/** Numbers are shown with the digits 0–9 (not 0–9); Eastern digits met in data are converted. */
export function arNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => String(d.charCodeAt(0) - 0x660));
}

export function plural(n: number, one: string, two: string, few: string, many: string): string {
  // Arabic agreement: 1 → one, 2 → two, 3-10 → few + number, 11+ → many
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${arNum(n)} ${few}`;
  return `${arNum(n)} ${many}`;
}

export const VERB_FORMS: Record<number, { pattern: string; name: string }> = {
  1: { pattern: 'فَعَلَ', name: 'المجرّد' },
  2: { pattern: 'فَعَّلَ', name: 'المزيد بالتضعيف' },
  3: { pattern: 'فَاعَلَ', name: 'المزيد بالألف' },
  4: { pattern: 'أَفْعَلَ', name: 'المزيد بالهمزة' },
  5: { pattern: 'تَفَعَّلَ', name: 'المزيد بالتاء والتضعيف' },
  6: { pattern: 'تَفَاعَلَ', name: 'المزيد بالتاء والألف' },
  7: { pattern: 'انْفَعَلَ', name: 'المزيد بالهمزة والنون' },
  8: { pattern: 'افْتَعَلَ', name: 'المزيد بالهمزة والتاء' },
  9: { pattern: 'افْعَلَّ', name: 'المزيد بالهمزة والتضعيف' },
  10: { pattern: 'اسْتَفْعَلَ', name: 'المزيد بالهمزة والسين والتاء' },
  11: { pattern: 'افْعَالَّ', name: 'المزيد بالهمزة والألف والتضعيف' },
  12: { pattern: 'افْعَوْعَلَ', name: 'المزيد بالهمزة والواو والتضعيف' },
};

/** lexical sources of the verbs (LexVerb.src codes) */
export const SOURCES: Record<string, { name: string; short: string; who: string }> = {
  ar: { name: 'معجم الرموز الوسيط', short: 'الرموز', who: 'طه زروقي (معجم حاسوبي مفتوح)' },
  wk: { name: 'ويكاموس الإنجليزي', short: 'ويكاموس', who: 'Wiktionary' },
  qm: { name: 'القاموس المحيط', short: 'القاموس', who: 'الفيروزآبادي (ت 817هـ)' },
  sh: { name: 'الصحاح', short: 'الصحاح', who: 'الجوهري (ت 393هـ)' },
  ls: { name: 'لسان العرب', short: 'اللسان', who: 'ابن منظور (ت 711هـ)' },
};
export const SOURCE_ORDER = ['ar', 'wk', 'sh', 'qm', 'ls'];
export const IMPF_VOWEL: Record<string, string> = { u: 'بالضمّ', i: 'بالكسر', a: 'بالفتح' };

export const QUAD_FORMS: Record<number, { pattern: string; name: string }> = {
  1: { pattern: 'فَعْلَلَ', name: 'الرباعي المجرّد' },
  2: { pattern: 'تَفَعْلَلَ', name: 'الرباعي المزيد بالتاء' },
  3: { pattern: 'افْعَنْلَلَ', name: 'الرباعي المزيد بالهمزة والنون' },
  4: { pattern: 'افْعَلَلَّ', name: 'الرباعي المزيد بالهمزة والتضعيف' },
};

/** Pattern and name of a verb form, for a triliteral or a quadriliteral root. */
export function verbFormOf(form: number, root: string): { pattern: string; name: string } {
  const quad = normLetters(root).length === 4;
  return (quad ? QUAD_FORMS[form] : VERB_FORMS[form]) ?? VERB_FORMS[form] ?? { pattern: arNum(form), name: '' };
}

export const TENSE: Record<string, string> = { PERF: 'ماضٍ', IMPF: 'مضارع', IMPV: 'أمر' };
export const VOICE: Record<string, string> = { ACT: 'مبني للمعلوم', PASS: 'مبني للمجهول' };
export const MOOD: Record<string, string> = { IND: 'مرفوع', SUBJ: 'منصوب', JUS: 'مجزوم' };
export const POS: Record<string, string> = {
  N: 'اسم', PN: 'اسم علم', ACT_PCPL: 'اسم فاعل', PASS_PCPL: 'اسم مفعول', VN: 'مصدر',
  ADJ: 'صفة', NV: 'اسم فعل', IMPN: 'اسم فعل أمر', T: 'ظرف زمان', LOC: 'ظرف مكان', P: 'حرف',
};

const PERSON: Record<string, string> = { '1': 'المتكلم', '2': 'المخاطب', '3': 'الغائب' };
const GENDER: Record<string, string> = { M: 'المذكر', F: 'المؤنث' };
const NUMBER: Record<string, string> = { S: 'المفرد', D: 'المثنى', P: 'الجمع' };

/** "3MS" → "الغائب المفرد المذكر" */
export function pgnLabel(p: string): string {
  if (!p) return '';
  const m = p.match(/^([123])([MF])?([SDP])$/);
  if (!m) return p;
  const parts = [PERSON[m[1]]];
  if (m[3]) parts.push(NUMBER[m[3]]);
  if (m[2]) parts.push(GENDER[m[2]]);
  return parts.join(' ');
}

/** Deterministic pseudo-random generator seeded by a string (for tree shapes). */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseLoc(loc: string): { s: number; a: number; w: number } {
  const [s, a, w] = loc.split(':').map(Number);
  return { s, a, w };
}
