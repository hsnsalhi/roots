import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { loadRoot } from '../data';
import { usePanZoom } from '../hooks/usePanZoom';
import { arNum, dashed, plural, seeded } from '../roots';
import { hrefTree, navigate, type Route } from '../router';
import { useSettings } from '../settings';
import type { BiRoot, IndexFile, RootFile } from '../types';
import { layoutTree, type RootNode, type VerbNode } from './layout';
import Panel from './Panel';

interface Props {
  bi: BiRoot;
  index: IndexFile;
  route: Extract<Route, { view: 'tree' }>;
}

export default function TreeView({ bi, index, route }: Props) {
  const { settings } = useSettings();
  const [files, setFiles] = useState<RootFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(bi.roots.map((r) => loadRoot(r.id)))
      .then((fs) => alive && setFiles(fs))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [bi]);

  const idxMap = useMemo(() => new Map(bi.roots.map((r) => [r.r, r])), [bi]);
  const layout = useMemo(() => (files ? layoutTree(files, idxMap, settings.showLexicon) : null), [files, idxMap, settings.showLexicon]);
  const fileMap = useMemo(() => new Map((files ?? []).map((f) => [f.r, f])), [files]);

  const selectRoot = (r?: string) => navigate(hrefTree(bi.id, r));
  const selectVerb = (r: string, lem: string) => navigate(hrefTree(bi.id, r, lem));

  return (
    <div className="treeview">
      <div style={{ position: 'relative', minHeight: 0 }}>
        {error && <div className="error">تعذّر تحميل بيانات الشجرة: {error}</div>}
        {!error && !layout && <div className="loading"><div><div className="spinner" />تنمو الشجرة…</div></div>}
        {layout && <TreeStage key={bi.id} bi={bi} layout={layout} route={route} onRoot={selectRoot} onVerb={selectVerb} />}
      </div>
      <aside className="panel" aria-live="polite">
        <Panel bi={bi} index={index} files={fileMap} route={route} onRoot={selectRoot} onVerb={selectVerb} />
      </aside>
    </div>
  );
}

function TreeStage({ bi, layout, route, onRoot, onVerb }: { bi: BiRoot; layout: ReturnType<typeof layoutTree>; route: Props['route']; onRoot: (r?: string) => void; onVerb: (r: string, l: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { t, fitRect, flyTo, zoomBy, wasDrag } = usePanZoom(stageRef, {
    minScale: 0.15,
    maxScale: 4,
    world: layout.bbox,
    initial: (vp) => {
      const b = layout.bbox;
      const k = Math.min(3, Math.min((vp.width - 40) / b.width, (vp.height - 40) / b.height));
      return { k, x: (vp.width - b.width * k) / 2 - b.x * k, y: (vp.height - b.height * k) / 2 - b.y * k };
    },
  });

  // when a root or verb gets selected, glide towards it
  useEffect(() => {
    if (!stageRef.current) return;
    const vp = { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight };
    if (route.verb && route.root) {
      const rn = layout.roots.find((r) => r.root.r === route.root);
      const vn = rn?.verbs.find((v) => v.lem === route.verb);
      if (rn && vn) {
        const k = Math.min(2.2, Math.max(t.k, 1));
        flyTo({ k, x: vp.width / 2 - ((rn.x + vn.x) / 2) * k, y: vp.height / 2 - ((rn.y + vn.y) / 2) * k }, 600);
        return;
      }
    }
    if (route.root) {
      const rn = layout.roots.find((r) => r.root.r === route.root);
      if (rn) {
        const xs = [rn.x, ...rn.verbs.map((v) => v.lx)];
        const ys = [rn.y, ...rn.verbs.map((v) => v.ly)];
        const box = { x: Math.min(...xs) - 80, y: Math.min(...ys) - 60, width: Math.max(...xs) - Math.min(...xs) + 160, height: Math.max(...ys) - Math.min(...ys) + 140 };
        const target = fitRect(box, 30);
        flyTo({ ...target, k: Math.min(target.k, 1.8) }, 600);
        return;
      }
    }
    flyTo(fitRect(layout.bbox, 20), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.root, route.verb, layout]);

  const selRoot = route.root;
  const selVerb = route.verb;
  const rand = seeded(bi.id);
  const leanTrunk = (rand() - 0.5) * 14;
  const maxAngle = Math.max(0.3, ...layout.roots.map((r) => Math.abs(r.angle)));
  const trunkTop = Math.min(-layout.T * 0.8, ...layout.roots.map((r) => limbOrigin(r.angle, layout.T, leanTrunk, maxAngle).y));

  return (
    <>
      <div ref={stageRef} className="stage" aria-label={`شجرة الجذر ${dashed(bi.id)}`}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img">
          <defs>
            <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--sky-top)" />
              <stop offset="1" stopColor="var(--sky-bottom)" />
            </linearGradient>
            <radialGradient id="canopy">
              <stop offset="0" stopColor="var(--green-3)" stopOpacity="0.55" />
              <stop offset="0.55" stopColor="var(--green-3)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--green-3)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sunGlow">
              <stop offset="0" stopColor="#fff" stopOpacity="var(--sky-glow)" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="barkGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--bark-2)" />
              <stop offset="0.45" stopColor="var(--bark)" />
              <stop offset="1" stopColor="var(--bark-3)" />
            </linearGradient>
            <linearGradient id="barkGradV" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--bark-2)" />
              <stop offset="0.5" stopColor="var(--bark)" />
              <stop offset="1" stopColor="var(--bark-3)" />
            </linearGradient>
            <filter id="soft" x="-30%" y="-80%" width="160%" height="260%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <filter id="barkRough" x="-10%" y="-5%" width="120%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.05 0.35" numOctaves="2" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#sky2)" />
          <circle cx="22%" cy="8%" r="34%" fill="url(#sunGlow)" />
          <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
            <Ground width={layout.bbox.width} seed={bi.id} />
            {layout.roots.map((rn) => (
              <Canopy key={'c' + rn.root.r} rn={rn} dim={!!selRoot && selRoot !== rn.root.r} />
            ))}
            <Trunk T={layout.T} lean={leanTrunk} top={trunkTop} seed={bi.id} />
            {layout.roots.map((rn) => (
              <Branch
                key={rn.root.r}
                rn={rn}
                T={layout.T}
                R1={layout.R1}
                lean={leanTrunk}
                maxAngle={maxAngle}
                maxTokens={layout.maxTokens}
                maxVerb={layout.maxVerb}
                dim={!!selRoot && selRoot !== rn.root.r}
                selected={selRoot === rn.root.r}
                selVerb={selRoot === rn.root.r ? selVerb : undefined}
                onRoot={() => !wasDrag() && onRoot(selRoot === rn.root.r && !selVerb ? undefined : rn.root.r)}
                onVerb={(l) => !wasDrag() && onVerb(rn.root.r, l)}
              />
            ))}
            <g transform={`translate(0 ${-layout.T / 2})`} style={{ cursor: 'pointer' }} onClick={() => !wasDrag() && onRoot(undefined)}>
              <rect x="-46" y="-26" width="92" height="52" rx="16" fill="var(--panel-solid)" stroke="var(--bark)" strokeWidth="2.5" />
              <text textAnchor="middle" y="14" fontFamily="var(--font-display)" fontSize="36" fill="var(--green)">
                {dashed(bi.id)}
              </text>
              {bi.meaning && (
                <g>
                  <rect x={-(bi.meaning.length * 8.2 + 28) / 2} y="36" width={bi.meaning.length * 8.2 + 28} height="30" rx="12" fill="var(--mark)" stroke="var(--gold-2)" strokeWidth="1.5" />
                  <text textAnchor="middle" y="56" fontFamily="var(--font-body)" fontSize="15" fontWeight="600" fill="var(--ink)">
                    {bi.meaning}
                  </text>
                </g>
              )}
            </g>
          </g>
        </svg>
      </div>
      <div className="hud top-start">
        <a className="chip btn" href="#/" style={{ textDecoration: 'none' }}>
          <span aria-hidden="true">→</span> الغابة
        </a>
        <a className="chip btn" href={'#/letter/' + encodeURIComponent(bi.id[0])} style={{ textDecoration: 'none' }}>
          بستان {bi.id[0]}
        </a>
      </div>
      <div className="hud bottom-end zoombtns">
        <button className="iconbtn" aria-label="تكبير" onClick={() => zoomBy(1.4)}>＋</button>
        <button className="iconbtn" aria-label="تصغير" onClick={() => zoomBy(1 / 1.4)}>－</button>
        <button className="iconbtn" aria-label="الشجرة كاملة" title="الشجرة كاملة" onClick={() => flyTo(fitRect(layout.bbox, 20))}>⤢</button>
      </div>
      <div className="hud bottom-start">
        <span className="chip">
          <b>{arNum(bi.roots.length)}</b> جذور · <b>{arNum(bi.verbLemmas)}</b> فعل · <b>{arNum(bi.verbTokens)}</b> موضع
          {layout.extras > 0 && <> · <b>{arNum(layout.extras)}</b> فعل من المعاجم</>}
        </span>
        {layout.extras > 0 && (
          <span className="chip legend" title="الفروع الخضراء أفعال وردت في القرآن؛ الفروع الرمادية أفعال من المعاجم لم ترد فيه">
            <i className="dot q" aria-hidden="true" /> في القرآن <i className="dot x" aria-hidden="true" /> {plural(layout.extras, 'فعل', 'فعلان', 'أفعال', 'فعلًا')} في المعاجم فقط
          </span>
        )}
      </div>
    </>
  );
}

interface Pt {
  x: number;
  y: number;
}

/** Points and unit tangents along a cubic Bézier. */
function sampleCubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n: number): { pts: Pt[]; tans: Pt[] } {
  const pts: Pt[] = [];
  const tans: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
    });
    const dx = 3 * u * u * (c1.x - p0.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p1.x - c2.x);
    const dy = 3 * u * u * (c1.y - p0.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p1.y - c2.y);
    const l = Math.hypot(dx, dy) || 1;
    tans.push({ x: dx / l, y: dy / l });
  }
  return { pts, tans };
}

function sampleQuad(p0: Pt, c: Pt, p1: Pt, n: number): { pts: Pt[]; tans: Pt[] } {
  const c1 = { x: p0.x + (2 / 3) * (c.x - p0.x), y: p0.y + (2 / 3) * (c.y - p0.y) };
  const c2 = { x: p1.x + (2 / 3) * (c.x - p1.x), y: p1.y + (2 / 3) * (c.y - p1.y) };
  return sampleCubic(p0, c1, c2, p1, n);
}

/** A tapered limb: the curve thickened from w0 at its start to w1 at its tip, with a little organic wobble. */
function taper(pts: Pt[], tans: Pt[], w0: number, w1: number, rand: () => number, wobble = 0.08): string {
  const n = pts.length - 1;
  const phase = rand() * 6.28;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = (w0 + (w1 - w0) * Math.pow(t, 0.85)) * (1 + wobble * Math.sin(t * 9 + phase)) / 2;
    const nx = -tans[i].y;
    const ny = tans[i].x;
    left.push(`${(pts[i].x + nx * w).toFixed(1)},${(pts[i].y + ny * w).toFixed(1)}`);
    right.push(`${(pts[i].x - nx * w).toFixed(1)},${(pts[i].y - ny * w).toFixed(1)}`);
  }
  return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`;
}

function polyline(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

const Ground = memo(function Ground({ width, seed }: { width: number; seed: string }) {
  const rand = seeded('g' + seed);
  const w = Math.max(360, Math.min(900, width * 0.55));
  const blades = Array.from({ length: 70 }, (_, i) => {
    const x = -w / 2 + (i + rand() * 0.8) * (w / 70);
    const y = 6 + Math.abs(x / w) * 26 + rand() * 4;
    const h = 7 + rand() * 12;
    const k = (rand() - 0.5) * 8;
    return `M ${x.toFixed(1)} ${y.toFixed(1)} q ${(k / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${k.toFixed(1)} ${(-h).toFixed(1)}`;
  });
  return (
    <g aria-hidden="true">
      <ellipse cx="0" cy="22" rx={w / 2} ry="34" fill="var(--hill-1)" />
      <ellipse cx={-w * 0.08} cy="14" rx={w * 0.34} ry="24" fill="var(--hill-2)" />
      <ellipse cx={w * 0.06} cy="10" rx={w * 0.2} ry="14" fill="var(--hill-3)" opacity="0.75" />
      <ellipse cx="4" cy="8" rx="78" ry="11" fill="#000" opacity="0.22" filter="url(#soft)" />
      <path d={blades.join(' ')} stroke="var(--green-3)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
    </g>
  );
});

/** Where a limb leaves the trunk: lateral limbs lower, central ones near the top. */
function limbOrigin(angle: number, T: number, lean: number, maxAngle: number): Pt {
  const k = Math.min(1, Math.abs(angle) / maxAngle);
  const y = -T * (0.5 + 0.47 * (1 - k)) - 4;
  const x = lean * (-y / T) + Math.sign(angle || 1) * (4 + 10 * k);
  return { x, y };
}

/** Soft foliage behind the twigs of a limb, fuller when the root has more Quranic verbs. */
const Canopy = memo(function Canopy({ rn, dim }: { rn: RootNode; dim: boolean }) {
  const quranic = rn.verbs.filter((v) => !v.extra);
  if (quranic.length === 0) return null;
  const rand = seeded('c' + rn.root.r);
  const blobs = quranic.flatMap((v) => {
    const n = 1 + Math.round(rand() * 1.5);
    return Array.from({ length: n }, () => {
      const r = 26 + 30 * Math.sqrt(v.count / Math.max(1, rn.tokens)) + rand() * 14;
      return { x: v.x + (rand() - 0.5) * 30 - (v.x - rn.x) * 0.25, y: v.y + (rand() - 0.5) * 24 - 6, r };
    });
  });
  return (
    <g opacity={dim ? 0.35 : 1} style={{ transition: 'opacity .3s' }} aria-hidden="true">
      {blobs.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="url(#canopy)" />
      ))}
    </g>
  );
});

const Trunk = memo(function Trunk({ T, lean, top, seed }: { T: number; lean: number; top: number; seed: string }) {
  const rand = seeded('t' + seed);
  const { pts, tans } = sampleCubic({ x: lean * 0.1, y: 8 }, { x: lean * 0.35, y: -T * 0.35 }, { x: lean * 0.85, y: -T * 0.75 }, { x: lean, y: top }, 30);
  const body = taper(pts, tans, 60, 14, rand, 0.05);
  // root flares spreading into the ground
  const flares = [-1, 1, -0.55, 0.6].map((side, i) => {
    const s = sampleQuad({ x: side * 10, y: -10 }, { x: side * 34, y: 2 }, { x: side * (56 + rand() * 24), y: 10 + i * 2 }, 10);
    return taper(s.pts, s.tans, 16, 3, rand, 0.1);
  });
  // bark grain: wavy lines running up the trunk
  const grain = Array.from({ length: 9 }, (_, i) => {
    const off = -22 + i * 5.5 + rand() * 2;
    const g = sampleCubic({ x: off * 0.9 + lean * 0.1, y: 0 }, { x: off * 0.8 + lean * 0.35 + (rand() - 0.5) * 8, y: -T * 0.35 }, { x: off * 0.55 + lean * 0.85 + (rand() - 0.5) * 8, y: -T * 0.75 }, { x: off * 0.4 + lean, y: top + 6 }, 14);
    return polyline(g.pts);
  });
  const knots = Array.from({ length: 2 }, () => ({ x: lean * 0.5 + (rand() - 0.5) * 18, y: -T * (0.25 + rand() * 0.5), r: 3 + rand() * 3 }));
  return (
    <g aria-hidden="true">
      {flares.map((d, i) => (
        <path key={i} d={d} fill="url(#barkGrad)" />
      ))}
      <g filter="url(#barkRough)">
        <path d={body} fill="url(#barkGradV)" />
      </g>
      <clipPath id="trunkClip">
        <path d={body} />
      </clipPath>
      <g clipPath="url(#trunkClip)">
        {grain.map((d, i) => (
          <path key={i} d={d} stroke="var(--bark-3)" strokeWidth={i % 3 === 0 ? 2.2 : 1.2} fill="none" opacity="0.32" strokeLinecap="round" />
        ))}
        {knots.map((k, i) => (
          <g key={i}>
            <ellipse cx={k.x} cy={k.y} rx={k.r * 1.6} ry={k.r} fill="var(--bark-3)" opacity="0.5" />
            <ellipse cx={k.x} cy={k.y} rx={k.r * 0.8} ry={k.r * 0.45} fill="var(--bark-2)" opacity="0.6" />
          </g>
        ))}
        <path d={body} fill="url(#barkGradV)" opacity="0" />
      </g>
      <path d={polyline(pts.map((p, i) => ({ x: p.x + 20 - (i / pts.length) * 10, y: p.y })))} stroke="#000" strokeWidth="6" fill="none" opacity="0.12" strokeLinecap="round" />
    </g>
  );
});

interface BranchProps {
  rn: RootNode;
  T: number;
  R1: number;
  lean: number;
  maxAngle: number;
  maxTokens: number;
  maxVerb: number;
  dim: boolean;
  selected: boolean;
  selVerb?: string;
  onRoot: () => void;
  onVerb: (lem: string) => void;
}

const Branch = memo(function Branch({ rn, T, R1, lean, maxAngle, maxTokens, maxVerb, dim, selected, selVerb, onRoot, onVerb }: BranchProps) {
  const rand = seeded('b' + rn.root.r);
  const sinA = Math.sin(rn.angle);
  const cosA = Math.cos(rn.angle);
  // lateral limbs leave the trunk lower than the central ones
  const k = Math.min(1, Math.abs(rn.angle) / maxAngle);
  const oy = -T * (0.5 + 0.47 * (1 - k)) - 4;
  const ox = lean * (-oy / T) + Math.sign(rn.angle || 1) * (4 + 10 * k);
  const p0 = { x: ox, y: oy };
  const p1 = { x: rn.x, y: rn.y };
  const c1 = { x: ox + (rn.x - ox) * 0.12, y: oy - Math.abs(rn.y - oy) * 0.5 - 12 };
  const c2 = { x: rn.x - 0.22 * R1 * sinA, y: rn.y + 0.22 * R1 * cosA };
  const { pts, tans } = sampleCubic(p0, c1, c2, p1, 28);
  const w0 = 6 + 14 * Math.sqrt(rn.tokens / maxTokens);
  const w1 = Math.max(2.6, w0 * 0.4);
  const d = taper(pts, tans, w0, w1, rand);
  const shade = polyline(pts.map((p, i) => ({ x: p.x + tans[i].y * (w0 * (1 - i / pts.length) * 0.22 + 0.6), y: p.y - tans[i].x * (w0 * (1 - i / pts.length) * 0.22 + 0.6) })));
  const label = rn.root.r;
  const lw = 26 + 13 * label.length;
  return (
    <g opacity={dim ? 0.42 : 1} style={{ transition: 'opacity .3s' }}>
      <path d={d} fill={selected ? 'var(--gold)' : 'url(#barkGrad)'} />
      <path d={shade} stroke="#000" strokeWidth={Math.max(1, w0 * 0.18)} fill="none" opacity="0.14" strokeLinecap="round" />
      {rn.tokens > 0 &&
        [0.55, 0.8].map((t, i) => {
          const j = Math.round(t * (pts.length - 1));
          const side = i % 2 ? 1 : -1;
          return <Leaves key={i} x={pts[j].x + tans[j].y * side * 2} y={pts[j].y - tans[j].x * side * 2} dir={Math.atan2(-tans[j].x * side, tans[j].y * side)} size={7} count={4} selected={selected} seed={rn.root.r + i} />;
        })}
      {rn.verbs.map((vn, i) =>
        vn.extra ? (
          <LexTwig key={vn.key} vn={vn} from={rn} selected={selVerb === vn.lem} muted={!!selVerb && selVerb !== vn.lem} flip={i % 2 === 0} onClick={() => onVerb(vn.lem)} />
        ) : (
          <VerbTwig key={vn.key} vn={vn} from={rn} maxVerb={maxVerb} selected={selVerb === vn.lem} muted={!!selVerb && selVerb !== vn.lem} flip={i % 2 === 0} onClick={() => onVerb(vn.lem)} />
        ),
      )}
      {rn.verbs.length === 0 && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={rn.x + (rand() - 0.5) * 30} cy={rn.y - 6 - rand() * 20} r={6 + rand() * 4} fill={i % 2 ? 'var(--green-3)' : 'var(--green-2)'} opacity="0.9" />
          ))}
        </g>
      )}
      <g transform={`translate(${rn.x} ${rn.y})`} style={{ cursor: 'pointer' }} onClick={onRoot} role="button" aria-label={`الجذر ${label}`}>
        <rect x={-lw / 2} y="-15" width={lw} height="30" rx="10" fill={selected ? 'var(--gold)' : 'var(--panel-solid)'} stroke={selected ? 'var(--gold)' : 'var(--bark)'} strokeWidth="2" />
        <text textAnchor="middle" y="7" fontFamily="var(--font-title)" fontSize="19" fontWeight="700" fill={selected ? '#2a221b' : 'var(--ink)'}>
          {label}
        </text>
      </g>
    </g>
  );
});

const LEAF_PALETTE = ['var(--green-2)', 'var(--green-3)', 'var(--green)', 'var(--green-2)', 'var(--leaf-light)'];
const GOLD_PALETTE = ['var(--gold-2)', 'var(--gold)', 'var(--gold-2)'];

/** A tuft of leaves at the tip of a twig, pointing away from the branch. */
function Leaves({ x, y, dir, size, count, selected, seed }: { x: number; y: number; dir: number; size: number; count: number; selected: boolean; seed: string }) {
  const rand = seeded('l' + seed);
  const palette = selected ? GOLD_PALETTE : LEAF_PALETTE;
  const leaves = Array.from({ length: count }, (_, i) => {
    const a = dir + (i / Math.max(1, count - 1) - 0.5) * 2.4 + (rand() - 0.5) * 0.5;
    const L = size * (0.75 + rand() * 0.5);
    const W = L * 0.42;
    const back = -2 - rand() * 4;
    return { a, L, W, back, fill: palette[i % palette.length], op: 0.86 + rand() * 0.14 };
  });
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="leaves" style={{ animationDelay: `${(-rand() * 5).toFixed(2)}s`, animationDuration: `${(3.6 + rand() * 2.4).toFixed(2)}s` }}>
        {leaves.map((l, i) => (
          <g key={i} transform={`rotate(${(l.a * 180) / Math.PI}) translate(${l.back} 0)`}>
            <path d={`M0,0 C${l.L * 0.3},${-l.W} ${l.L * 0.78},${-l.W * 0.6} ${l.L},0 C${l.L * 0.78},${l.W * 0.6} ${l.L * 0.3},${l.W} 0,0 Z`} fill={l.fill} opacity={l.op} />
            <path d={`M0,0 L${l.L * 0.86},0`} stroke="var(--leaf-vein)" strokeWidth="0.7" opacity="0.5" />
          </g>
        ))}
      </g>
    </g>
  );
}

const VerbTwig = memo(function VerbTwig({ vn, from, maxVerb, selected, muted, flip, onClick }: { vn: VerbNode; from: RootNode; maxVerb: number; selected: boolean; muted: boolean; flip: boolean; onClick: () => void }) {
  const rand = seeded(vn.key);
  const mx = (from.x + vn.x) / 2;
  const my = (from.y + vn.y) / 2;
  const dx = vn.x - from.x;
  const dy = vn.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * len * 0.14 * (flip ? 1 : -1);
  const py = (dx / len) * len * 0.14 * (flip ? 1 : -1);
  const { pts, tans } = sampleQuad({ x: from.x, y: from.y }, { x: mx + px, y: my + py }, { x: vn.x, y: vn.y }, 14);
  const weight = Math.sqrt(vn.count / maxVerb);
  const d = taper(pts, tans, 2.4 + 4 * weight, 0.9, rand, 0.06);
  const tip = tans[tans.length - 1];
  const dir = Math.atan2(tip.y, tip.x);
  const size = 10 + 9 * weight;
  const count = 6 + Math.round(7 * weight);
  return (
    <g opacity={muted ? 0.45 : 1} style={{ cursor: 'pointer', transition: 'opacity .3s' }} onClick={onClick} role="button" aria-label={`الفعل ${vn.lem}`}>
      <path d={d} fill={selected ? 'var(--gold)' : 'var(--bark-2)'} />
      <Leaves x={vn.x} y={vn.y} dir={dir} size={size} count={count} selected={selected} seed={vn.key} />
      <text x={vn.lx} y={vn.ly + 6} textAnchor="middle" fontFamily="var(--font-title)" fontSize="18" fontWeight={selected ? 700 : 400} fill={selected ? 'var(--gold)' : 'var(--ink)'} paintOrder="stroke" stroke="var(--sky-bottom)" strokeWidth="4" strokeLinejoin="round">
        {vn.lem}
      </text>
      <text x={vn.lx} y={vn.ly + 22} textAnchor="middle" fontFamily="var(--font-body)" fontSize="11" fill="var(--ink-3)" paintOrder="stroke" stroke="var(--sky-bottom)" strokeWidth="3">
        {arNum(vn.count)}
      </text>
    </g>
  );
});

/** A verb of the lexica that does not occur in the Quran: a thin bare twig with a bud, no leaves. */
const LexTwig = memo(function LexTwig({ vn, from, selected, muted, flip, onClick }: { vn: VerbNode; from: RootNode; selected: boolean; muted: boolean; flip: boolean; onClick: () => void }) {
  const rand = seeded(vn.key);
  const mx = (from.x + vn.x) / 2;
  const my = (from.y + vn.y) / 2;
  const dx = vn.x - from.x;
  const dy = vn.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * len * 0.1 * (flip ? 1 : -1);
  const py = (dx / len) * len * 0.1 * (flip ? 1 : -1);
  const { pts, tans } = sampleQuad({ x: from.x, y: from.y }, { x: mx + px, y: my + py }, { x: vn.x, y: vn.y }, 12);
  const d = taper(pts, tans, selected ? 3 : 2, 0.7, rand, 0.05);
  return (
    <g opacity={muted ? 0.4 : 1} style={{ cursor: 'pointer', transition: 'opacity .3s' }} onClick={onClick} role="button" aria-label={`الفعل ${vn.lem} (من المعاجم، لم يرد في القرآن)`}>
      <path d={d} fill={selected ? 'var(--gold)' : 'var(--twig-lex)'} />
      <circle cx={vn.x} cy={vn.y - 1} r={selected ? 4 : 2.8} fill={selected ? 'var(--gold-2)' : 'var(--panel-solid)'} stroke={selected ? 'var(--gold)' : 'var(--twig-lex)'} strokeWidth="1.5" />
      <text x={vn.lx} y={vn.ly + 5} textAnchor="middle" fontFamily="var(--font-title)" fontSize="14.5" fontWeight={selected ? 700 : 400} fill={selected ? 'var(--gold)' : 'var(--ink-3)'} paintOrder="stroke" stroke="var(--sky-bottom)" strokeWidth="3" strokeLinejoin="round">
        {vn.lem}
      </text>
    </g>
  );
});
