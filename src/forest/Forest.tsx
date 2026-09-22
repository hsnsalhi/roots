import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutForest, type Grove, type TreeNode } from './layout';
import { TreeShape } from './TreeShape';
import { usePanZoom } from '../hooks/usePanZoom';
import { ALPHABET, LETTER_NAMES, arNum, dashed, plural } from '../roots';
import { navigate } from '../router';
import type { BiRoot, IndexFile } from '../types';

interface Props {
  bis: BiRoot[];
  index: IndexFile;
  letter?: string;
  onSelect: (bi: BiRoot) => void;
}

const LABEL_MIN_ZOOM = 0.5;

export default function Forest({ bis, letter, onSelect }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => layoutForest(bis), [bis]);
  const [hover, setHover] = useState<TreeNode | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [hint, setHint] = useState(true);

  const { t, flyTo, fitRect, zoomBy, wasDrag, set } = usePanZoom(stageRef, {
    minScale: 0.08,
    maxScale: 3,
    world: { x: 0, y: 0, width: layout.width, height: layout.height },
    initial: (vp) => {
      if (vp.width < 900) {
        const g = layout.groves[0];
        return fitGroveT(g, vp);
      }
      const k = Math.min((vp.width - 40) / layout.width, (vp.height - 90) / layout.height);
      return { k, x: (vp.width - layout.width * k) / 2, y: 70 + (vp.height - 70 - layout.height * k) / 2 };
    },
  });

  function fitGroveT(g: Grove, vp: { width: number; height: number }) {
    const gw = g.x1 - g.x0 + 80;
    const gh = layout.rowH * 0.95;
    const k = Math.min(Math.max(vp.width < 600 ? 0.55 : 0.35, Math.min((vp.width - 30) / gw, (vp.height - 110) / gh)), 1.4);
    return { k, x: vp.width - (g.x1 + 40) * k - 12, y: (vp.height - gh * k) / 2 + 30 - (g.y - gh * 0.85) * k };
  }

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const goLetter = useCallback((l: string) => {
    const g = layout.groves.find((x) => x.letter === l);
    if (!g || !stageRef.current) return;
    flyTo(fitGroveT(g, { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight }), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, flyTo]);

  useEffect(() => {
    if (letter) {
      const id = setTimeout(() => goLetter(letter), 50);
      return () => clearTimeout(id);
    }
  }, [letter, goLetter]);

  // which grove is in the middle of the viewport
  const activeLetter = useMemo(() => {
    const cx = (size.w / 2 - t.x) / t.k;
    const cy = (size.h / 2 - t.y) / t.k;
    let best: Grove | null = null;
    let bd = Infinity;
    for (const g of layout.groves) {
      const gx = (g.x0 + g.x1) / 2;
      const d = Math.hypot((gx - cx) / 3, g.y - cy);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return best?.letter;
  }, [t, size, layout]);

  const showLabels = t.k >= LABEL_MIN_ZOOM;

  const onTreeClick = (n: TreeNode) => {
    if (wasDrag()) return;
    onSelect(n.bi);
  };

  const tipPos = hover ? { left: hover.x * t.k + t.x, top: (hover.y - hover.h) * t.k + t.y } : null;

  return (
    <>
      <div ref={stageRef} className="stage" aria-label="غابة الجذور: خريطة تفاعلية">
        <svg xmlns="http://www.w3.org/2000/svg" role="img">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--sky-top)" />
              <stop offset="1" stopColor="var(--sky-bottom)" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#sky)" />
          <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
            <Hills layout={layout} />
            {layout.groves.map((g) => (
              <Sign key={g.letter} grove={g} onClick={() => goLetter(g.letter)} />
            ))}
            <g className={showLabels ? 'labels-on' : 'labels-off'}>
              {layout.trees.map((n) => (
                <TreeItem key={n.bi.id} node={n} onEnter={setHover} onLeave={() => setHover(null)} onClick={onTreeClick} />
              ))}
            </g>
          </g>
        </svg>
        {hover && tipPos && (
          <div className="tip" style={tipPos}>
            <div className="bi">{dashed(hover.bi.id)}</div>
            <div className="roots">{hover.bi.roots.slice(0, 8).map((r) => r.r).join(' · ')}{hover.bi.roots.length > 8 ? ' …' : ''}</div>
            <div className="stats">
              {plural(hover.bi.roots.length, 'جذر واحد', 'جذران', 'جذور', 'جذرًا')} · {plural(hover.bi.verbLemmas, 'فعل واحد', 'فعلان', 'أفعال', 'فعلًا')} · {plural(hover.bi.verbTokens, 'موضع واحد', 'موضعان', 'مواضع', 'موضعًا')}
            </div>
          </div>
        )}
      </div>
      <nav className="letters" aria-label="الانتقال إلى بستان حرف">
        {ALPHABET.map((l) => (
          <button key={l} className={l === activeLetter ? 'active' : ''} title={`بستان ${LETTER_NAMES[l]}`} onClick={() => goLetter(l)} disabled={!layout.groves.some((g) => g.letter === l)}>
            {l}
          </button>
        ))}
      </nav>
      <div className="hud bottom-end zoombtns">
        <button className="iconbtn" aria-label="تكبير" onClick={() => zoomBy(1.5)}>＋</button>
        <button className="iconbtn" aria-label="تصغير" onClick={() => zoomBy(1 / 1.5)}>－</button>
        <button className="iconbtn" aria-label="عرض الغابة كاملة" title="الغابة كاملة" onClick={() => flyTo(fitRect({ x: 0, y: 0, width: layout.width, height: layout.height }, 30))}>⤢</button>
      </div>
      <div className="hud bottom-start">
        <span className="chip">
          <b>{arNum(bis.length)}</b> شجرة · <b>{arNum(bis.reduce((s, b) => s + b.roots.length, 0))}</b> جذرًا
        </span>
        {hint && t.k < LABEL_MIN_ZOOM && (
          <span className="chip hint">
            اختر حرفًا أو كبّر بالعجلة، ثم انقر على شجرة
            <button aria-label="إخفاء التلميح" onClick={() => setHint(false)}>×</button>
          </span>
        )}
      </div>
      <Minimap layout={layout} t={t} size={size} onJump={(wx, wy) => set({ k: t.k, x: size.w / 2 - wx * t.k, y: size.h / 2 - wy * t.k })} />
    </>
  );
}

const Hills = memo(function Hills({ layout }: { layout: ReturnType<typeof layoutForest> }) {
  const fills = ['var(--hill-1)', 'var(--hill-2)', 'var(--hill-3)'];
  const paths = [];
  for (let r = 0; r < layout.rows; r++) {
    const ground = r * layout.rowH + layout.rowH * 0.8 + 40;
    const pts: string[] = [];
    for (let x = 0; x <= layout.width; x += 160) {
      const y = ground - 10 + Math.sin(x / 420 + r * 1.7) * 9 + Math.sin(x / 130 + r) * 3;
      pts.push(`${x} ${y.toFixed(1)}`);
    }
    const bottom = (r + 1) * layout.rowH + 40 + 30;
    paths.push(<path key={r} d={`M 0 ${bottom} L ${pts.join(' L ')} L ${layout.width} ${bottom} Z`} fill={fills[r % 3]} />);
    paths.push(<path key={'g' + r} d={`M 0 ${ground + 26} L ${layout.width} ${ground + 26}`} stroke="var(--ground)" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 10" />);
  }
  return <g>{paths}</g>;
});

const Sign = memo(function Sign({ grove, onClick }: { grove: Grove; onClick: () => void }) {
  const x = grove.x1 - 30;
  const y = grove.y + 8;
  return (
    <g transform={`translate(${x} ${y})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      <rect x={-3} y={-62} width={6} height={62} fill="var(--bark-2)" />
      <rect x={-34} y={-92} width={68} height={44} rx={8} fill="var(--panel-solid)" stroke="var(--bark)" strokeWidth="2.5" />
      <text x="0" y={-58} textAnchor="middle" fontFamily="var(--font-display)" fontSize="34" fill="var(--bark)">
        {grove.letter}
      </text>
      <text x="0" y={22} textAnchor="middle" fontFamily="var(--font-body)" fontSize="13" fill="var(--ink-3)">
        بستان {LETTER_NAMES[grove.letter]}
      </text>
    </g>
  );
});

const TreeItem = memo(function TreeItem({ node, onEnter, onLeave, onClick }: { node: TreeNode; onEnter: (n: TreeNode) => void; onLeave: () => void; onClick: (n: TreeNode) => void }) {
  return (
    <g
      className="tree"
      transform={`translate(${node.x} ${node.y})`}
      style={{ cursor: 'pointer' }}
      onPointerEnter={() => onEnter(node)}
      onPointerLeave={onLeave}
      onClick={() => onClick(node)}
      role="link"
      aria-label={`شجرة ${dashed(node.bi.id)}`}
      tabIndex={-1}
    >
      <TreeShape h={node.h} w={node.w} seed={node.seed} shrub={node.shrub} fruits={node.bi.verbLemmas} detail={node.h < 90 ? 'low' : 'high'} />
      <text className="tlabel" y={node.shrub ? 16 : 20} textAnchor="middle" fontFamily="var(--font-title)" fontSize={node.shrub ? 12 : 15} fontWeight="700" fill="var(--ink-2)">
        {dashed(node.bi.id)}
      </text>
    </g>
  );
});

function Minimap({ layout, t, size, onJump }: { layout: ReturnType<typeof layoutForest>; t: { x: number; y: number; k: number }; size: { w: number; h: number }; onJump: (x: number, y: number) => void }) {
  const vx = -t.x / t.k;
  const vy = -t.y / t.k;
  const vw = size.w / t.k;
  const vh = size.h / t.k;
  const ref = useRef<SVGSVGElement>(null);
  const onClick = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // preserveAspectRatio meet: compute scale/offset
    const s = Math.min(r.width / layout.width, r.height / layout.height);
    const ox = (r.width - layout.width * s) / 2;
    const oy = (r.height - layout.height * s) / 2;
    onJump((e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s);
  };
  return (
    <div className="minimap" title="الخريطة المصغّرة" onClick={onClick}>
      <svg ref={ref} viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMid meet">
        {layout.trees.map((n) => (
          <circle key={n.bi.id} cx={n.x} cy={n.y - n.h / 2} r={n.shrub ? 8 : 12 + n.h / 12} fill={n.shrub ? 'var(--moss)' : 'var(--green-2)'} opacity="0.8" />
        ))}
        <rect x={vx} y={vy} width={vw} height={vh} fill="rgba(255,255,255,0.15)" stroke="var(--gold)" strokeWidth={Math.max(6, layout.width / 400)} />
      </svg>
    </div>
  );
}

export function useNavigateLetter() {
  return (l: string) => navigate('#/letter/' + encodeURIComponent(l));
}
