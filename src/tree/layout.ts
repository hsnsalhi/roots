import type { IndexRoot, LexVerb, RootFile, Verb } from '../types';
import { compareRoots } from '../roots';

export interface VerbNode {
  key: string;
  root: RootFile;
  lem: string;
  form: number;
  count: number;   // Quranic occurrences (0 for a verb of the lexica)
  extra: boolean;  // true: attested in the lexica only, not in the Quran
  verb?: Verb;
  lex?: LexVerb;
  angle: number;   // radians, 0 = straight up, positive = right (x > 0)
  x: number;
  y: number;
  lx: number;      // label position
  ly: number;
}

export interface RootNode {
  root: RootFile;
  idx: IndexRoot;
  angle: number;
  x: number;
  y: number;
  verbs: VerbNode[];
  tokens: number;
}

export interface TreeLayout {
  T: number;       // trunk height
  R1: number;
  R2: number;
  roots: RootNode[];
  maxTokens: number;
  maxVerb: number;
  extras: number;  // number of lexicon-only twigs drawn
  bbox: { x: number; y: number; width: number; height: number };
}

const DEG = Math.PI / 180;

interface Slot {
  lem: string;
  form: number;
  count: number;
  extra: boolean;
  verb?: Verb;
  lex?: LexVerb;
}

function slotsOf(f: RootFile, showExtra: boolean): Slot[] {
  const out: Slot[] = f.verbs.map((v) => ({ lem: v.lem, form: v.form, count: v.count, extra: false, verb: v }));
  if (showExtra) {
    for (const x of f.lexicon ?? []) {
      if (!x.q) out.push({ lem: x.v, form: x.form, count: 0, extra: true, lex: x });
    }
  }
  // by verb form, the Quranic verbs of a form first, then the most frequent
  return out.sort((a, b) => a.form - b.form || Number(a.extra) - Number(b.extra) || b.count - a.count || a.lem.localeCompare(b.lem, 'ar'));
}

export function layoutTree(files: RootFile[], idx: Map<string, IndexRoot>, showExtra = true): TreeLayout {
  const sorted = [...files].sort((a, b) => compareRoots(a.letters.join(''), b.letters.join('')));
  const slotLists = sorted.map((f) => slotsOf(f, showExtra));
  const slots = slotLists.map((l) => Math.max(1, l.length));
  const total = slots.reduce((s, n) => s + n, 0);
  const extras = slotLists.reduce((s, l) => s + l.filter((x) => x.extra).length, 0);
  const slot = Math.min(22 * DEG, (150 * DEG) / total);
  const span = slot * total;
  const spanRad = Math.max(span, 0.6);
  const T = 130;
  const n = sorted.length;
  const R1 = Math.min(440, Math.max(190, Math.max(170 + 10 * n, (58 * n) / spanRad)));
  // labels are staggered on 1–3 rings so that neighbours do not overlap
  const rows = total > 40 ? 3 : total > 12 ? 2 : 1;
  const perNode = rows === 3 ? 30 : rows === 2 ? 36 : 32;
  const R2 = Math.max(R1 + 150, (perNode * total) / spanRad);

  let a = -span / 2;
  let g = 0;
  const maxTokens = Math.max(1, ...sorted.map((f) => f.verbs.reduce((s, v) => s + v.count, 0)));
  const maxVerb = Math.max(1, ...sorted.flatMap((f) => f.verbs.map((v) => v.count)));
  const roots: RootNode[] = sorted.map((f, ri) => {
    const verbs: VerbNode[] = [];
    const list = slotLists[ri];
    const k = Math.max(1, list.length);
    const start = a;
    list.forEach((s, i) => {
      const ang = start + (i + 0.5) * slot;
      const ring = R2 + 30 + (g++ % rows) * 27;
      verbs.push({
        key: f.r + '|' + s.lem,
        root: f,
        lem: s.lem,
        form: s.form,
        count: s.count,
        extra: s.extra,
        verb: s.verb,
        lex: s.lex,
        angle: ang,
        x: R2 * Math.sin(ang),
        y: -T - R2 * Math.cos(ang),
        lx: ring * Math.sin(ang),
        ly: -T - ring * Math.cos(ang),
      });
    });
    const angle = start + (k * slot) / 2;
    a += k * slot;
    const r = list.length ? R1 : R1 * 0.78;
    return {
      root: f,
      idx: idx.get(f.r)!,
      angle,
      x: r * Math.sin(angle),
      y: -T - r * Math.cos(angle),
      verbs,
      tokens: f.verbs.reduce((s, v) => s + v.count, 0),
    };
  });
  const xs = roots.flatMap((r) => [r.x, ...r.verbs.map((v) => v.lx)]);
  const ys = roots.flatMap((r) => [r.y, ...r.verbs.map((v) => v.ly)]);
  const minX = Math.min(-120, ...xs) - 90;
  const maxX = Math.max(120, ...xs) + 90;
  const minY = Math.min(-T - 60, ...ys) - 60;
  return { T, R1, R2, roots, maxTokens, maxVerb, extras, bbox: { x: minX, y: minY, width: maxX - minX, height: 70 - minY } };
}
