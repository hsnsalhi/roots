import { memo } from 'react';
import { seeded } from '../roots';

interface Props {
  h: number;
  w: number;
  seed: number | string;
  shrub?: boolean;
  fruits?: number;
  /** 0..1 – how much of the canopy to draw (used for animations) */
  detail?: 'low' | 'high';
}

const CANOPY = ['var(--green)', 'var(--green-2)', 'var(--green-3)'];

/** A stylised tree standing at (0,0) (trunk base), growing upwards. */
function TreeShapeInner({ h, w, seed, shrub = false, fruits = 0, detail = 'high' }: Props) {
  const rand = seeded(String(seed));
  if (shrub) {
    const blobs = [0, 1, 2].map((i) => ({
      cx: (i - 1) * w * 0.28 + (rand() - 0.5) * 6,
      cy: -h * 0.42 + (rand() - 0.5) * 6,
      r: h * (0.42 + rand() * 0.16),
    }));
    return (
      <g>
        <ellipse cx="0" cy="2" rx={w * 0.55} ry={4} fill="rgba(0,0,0,0.12)" />
        {blobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={i === 1 ? 'var(--moss)' : 'var(--green-3)'} />
        ))}
      </g>
    );
  }
  const trunkH = h * 0.42;
  const w0 = Math.max(4, h * 0.11);
  const w1 = Math.max(2.5, h * 0.05);
  const lean = (rand() - 0.5) * h * 0.08;
  const trunk = `M ${-w0 / 2} 0 Q ${-w0 / 2 + lean / 2} ${-trunkH / 2} ${-w1 / 2 + lean} ${-trunkH} L ${w1 / 2 + lean} ${-trunkH} Q ${w0 / 2 + lean / 2} ${-trunkH / 2} ${w0 / 2} 0 Z`;
  const cy0 = -trunkH - h * 0.3;
  const n = detail === 'low' ? 3 : 4 + Math.floor(rand() * 3);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * w * 0.22;
    blobs.push({
      cx: lean + Math.cos(a) * d,
      cy: cy0 + Math.sin(a) * d * 0.7,
      r: h * (0.17 + rand() * 0.12),
    });
  }
  blobs.sort((a, b) => b.cy - a.cy); // lower blobs first (darker)
  const fr = [];
  const nf = Math.min(12, fruits);
  for (let i = 0; i < nf; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * w * 0.3;
    fr.push({ cx: lean + Math.cos(a) * d, cy: cy0 + Math.sin(a) * d * 0.8 });
  }
  return (
    <g>
      <ellipse cx="0" cy="2" rx={w * 0.45} ry={5} fill="rgba(0,0,0,0.14)" />
      <path d={trunk} fill="var(--bark)" />
      {blobs.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={CANOPY[Math.min(2, Math.floor((i / n) * 3))]} />
      ))}
      {detail === 'high' && <circle cx={lean - w * 0.12} cy={cy0 - h * 0.12} r={h * 0.1} fill="var(--green-4)" opacity="0.55" />}
      {fr.map((f, i) => (
        <circle key={'f' + i} cx={f.cx} cy={f.cy} r={Math.max(1.6, h * 0.028)} fill="var(--gold)" stroke="var(--gold-2)" strokeWidth="0.6" />
      ))}
    </g>
  );
}

export const TreeShape = memo(TreeShapeInner);
