import { ALPHABET, seeded } from '../roots';
import type { BiRoot } from '../types';

export interface TreeNode {
  bi: BiRoot;
  x: number;        // trunk base x (world coords, RTL already applied)
  y: number;        // trunk base y
  h: number;        // tree height
  w: number;        // canopy width
  shrub: boolean;   // no verbs at all
  row: number;
  seed: number;
}

export interface Grove {
  letter: string;
  row: number;
  x0: number;       // left edge (world)
  x1: number;       // right edge (world)
  y: number;        // ground line
  trees: TreeNode[];
}

export interface ForestLayout {
  width: number;
  height: number;
  rowH: number;
  rows: number;
  groves: Grove[];
  trees: TreeNode[];
}

const ROW_H = 300;
const SIGN_W = 70;
const GROVE_GAP = 60;

export function treeSize(verbTokens: number, maxTokens: number): { h: number; w: number; shrub: boolean } {
  if (verbTokens <= 0) return { h: 30, w: 44, shrub: true };
  const r = Math.log(1 + verbTokens) / Math.log(1 + maxTokens);
  const h = 60 + 150 * Math.pow(r, 0.9);
  return { h, w: h * 0.62 + 12, shrub: false };
}

export function layoutForest(bis: BiRoot[]): ForestLayout {
  const maxTokens = Math.max(1, ...bis.map((b) => b.verbTokens));
  // group by first letter in alphabet order
  const byLetter = new Map<string, BiRoot[]>();
  for (const b of bis) {
    const l = b.id[0];
    if (!byLetter.has(l)) byLetter.set(l, []);
    byLetter.get(l)!.push(b);
  }
  const letters = ALPHABET.filter((l) => byLetter.has(l));

  // measure groves (logical left-to-right, mirrored later)
  const measured = letters.map((letter) => {
    const items = byLetter.get(letter)!;
    let x = SIGN_W;
    const placed = items.map((bi) => {
      const size = treeSize(bi.verbTokens, maxTokens);
      const pitch = size.w * 0.72;
      const node = { bi, dx: x + size.w / 2, ...size };
      x += pitch;
      return node;
    });
    const width = x + 24;
    return { letter, width, placed };
  });

  const total = measured.reduce((s, g) => s + g.width + GROVE_GAP, 0);
  const rows = Math.max(1, Math.min(8, Math.round(Math.sqrt(total / ROW_H / 4.2))));
  const target = total / rows;

  // distribute groves into rows greedily
  const rowsArr: typeof measured[] = [[]];
  let acc = 0;
  for (const g of measured) {
    const cur = rowsArr[rowsArr.length - 1];
    if (cur.length && acc + g.width > target * 1.08 && rowsArr.length < rows) {
      rowsArr.push([g]);
      acc = g.width + GROVE_GAP;
    } else {
      cur.push(g);
      acc += g.width + GROVE_GAP;
    }
  }
  const width = Math.max(...rowsArr.map((r) => r.reduce((s, g) => s + g.width + GROVE_GAP, 0))) + 80;
  const height = rowsArr.length * ROW_H + 60;

  const groves: Grove[] = [];
  const trees: TreeNode[] = [];
  rowsArr.forEach((rowGroves, row) => {
    let cursor = 40; // logical x from the right edge
    const ground = row * ROW_H + ROW_H * 0.8 + 40;
    for (const g of rowGroves) {
      const rand = seeded('grove' + g.letter);
      const x1 = width - cursor;        // right edge in world coords
      const x0 = x1 - g.width;
      const nodes: TreeNode[] = g.placed.map((p, i) => {
        const depth = (i % 3) - 1;            // -1 back, 0 middle, 1 front
        const y = ground - depth * 16 - rand() * 6;
        const scale = 1 - (depth === -1 ? 0.12 : depth === 1 ? -0.04 : 0);
        return {
          bi: p.bi,
          x: x1 - p.dx,
          y,
          h: p.h * scale,
          w: p.w * scale,
          shrub: p.shrub,
          row,
          seed: Math.floor(rand() * 1e9),
        };
      });
      groves.push({ letter: g.letter, row, x0, x1, y: ground, trees: nodes });
      trees.push(...nodes);
      cursor += g.width + GROVE_GAP;
    }
  });
  trees.sort((a, b) => a.y - b.y); // painter's order: back first
  return { width, height, rowH: ROW_H, rows: rowsArr.length, groves, trees };
}
