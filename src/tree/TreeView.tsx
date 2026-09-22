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
  const leanTrunk = (rand() - 0.5) * 10;

  return (
    <>
      <div ref={stageRef} className="stage" aria-label={`شجرة الجذر ${dashed(bi.id)}`}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img">
          <defs>
            <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--sky-top)" />
              <stop offset="1" stopColor="var(--sky-bottom)" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#sky2)" />
          <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
            <ellipse cx="0" cy="12" rx="170" ry="26" fill="var(--hill-2)" />
            <ellipse cx="0" cy="8" rx="90" ry="12" fill="var(--hill-3)" opacity="0.7" />
            <Trunk T={layout.T} lean={leanTrunk} />
            {layout.roots.map((rn) => (
              <Branch
                key={rn.root.r}
                rn={rn}
                T={layout.T}
                R1={layout.R1}
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

const Trunk = memo(function Trunk({ T, lean }: { T: number; lean: number }) {
  const d = `M -24 0 Q ${-26 + lean / 2} ${-T * 0.5} ${-11 + lean} ${-T} L ${11 + lean} ${-T} Q ${26 + lean / 2} ${-T * 0.5} 24 0 Z`;
  return (
    <g>
      <path d={`M -60 8 Q -40 -4 -22 0 M 60 8 Q 40 -4 22 0 M -30 6 Q -10 -6 0 2`} stroke="var(--bark)" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d={d} fill="var(--bark)" />
      <path d={`M ${-6 + lean * 0.4} ${-T * 0.15} Q ${-2 + lean * 0.7} ${-T * 0.5} ${-4 + lean} ${-T * 0.85}`} stroke="var(--bark-2)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
    </g>
  );
});

interface BranchProps {
  rn: RootNode;
  T: number;
  R1: number;
  maxTokens: number;
  maxVerb: number;
  dim: boolean;
  selected: boolean;
  selVerb?: string;
  onRoot: () => void;
  onVerb: (lem: string) => void;
}

const Branch = memo(function Branch({ rn, T, R1, maxTokens, maxVerb, dim, selected, selVerb, onRoot, onVerb }: BranchProps) {
  const sinA = Math.sin(rn.angle);
  const cosA = Math.cos(rn.angle);
  const w = 4 + 11 * Math.sqrt(rn.tokens / maxTokens);
  const c1 = { x: 0, y: -T - R1 * 0.4 };
  const c2 = { x: rn.x - 0.25 * R1 * sinA, y: rn.y + 0.25 * R1 * cosA };
  const d = `M 0 ${-T} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${rn.x} ${rn.y}`;
  const label = rn.root.r;
  const lw = 26 + 13 * label.length;
  const rand = seeded('b' + rn.root.r);
  return (
    <g opacity={dim ? 0.45 : 1} style={{ transition: 'opacity .3s' }}>
      <path d={d} stroke={selected ? 'var(--gold)' : 'var(--bark)'} strokeWidth={w} fill="none" strokeLinecap="round" />
      {rn.verbs.map((vn, i) =>
        vn.extra ? (
          <LexTwig key={vn.key} vn={vn} from={rn} selected={selVerb === vn.lem} muted={!!selVerb && selVerb !== vn.lem} flip={i % 2 === 0} onClick={() => onVerb(vn.lem)} />
        ) : (
          <VerbTwig key={vn.key} vn={vn} from={rn} maxVerb={maxVerb} selected={selVerb === vn.lem} muted={!!selVerb && selVerb !== vn.lem} flip={i % 2 === 0} onClick={() => onVerb(vn.lem)} />
        ),
      )}
      {rn.verbs.length === 0 && (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={rn.x + (rand() - 0.5) * 26} cy={rn.y - 6 - rand() * 18} r={6 + rand() * 4} fill="var(--green-3)" opacity="0.9" />
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

const VerbTwig = memo(function VerbTwig({ vn, from, maxVerb, selected, muted, flip, onClick }: { vn: VerbNode; from: RootNode; maxVerb: number; selected: boolean; muted: boolean; flip: boolean; onClick: () => void }) {
  const mx = (from.x + vn.x) / 2;
  const my = (from.y + vn.y) / 2;
  const dx = vn.x - from.x;
  const dy = vn.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * len * 0.14 * (flip ? 1 : -1);
  const py = (dx / len) * len * 0.14 * (flip ? 1 : -1);
  const d = `M ${from.x} ${from.y} Q ${mx + px} ${my + py} ${vn.x} ${vn.y}`;
  const w = 1.6 + 4 * Math.sqrt(vn.count / maxVerb);
  const leafR = 5 + 6 * Math.sqrt(vn.count / maxVerb);
  const rand = seeded(vn.key);
  return (
    <g opacity={muted ? 0.5 : 1} style={{ cursor: 'pointer', transition: 'opacity .3s' }} onClick={onClick} role="button" aria-label={`الفعل ${vn.lem}`}>
      <path d={d} stroke={selected ? 'var(--gold)' : 'var(--bark-2)'} strokeWidth={w} fill="none" strokeLinecap="round" />
      <circle cx={vn.x + (rand() - 0.5) * 8} cy={vn.y - 3} r={leafR} fill={selected ? 'var(--gold-2)' : 'var(--green-2)'} />
      <circle cx={vn.x + (rand() - 0.5) * 12} cy={vn.y - 8} r={leafR * 0.75} fill={selected ? 'var(--gold)' : 'var(--green-3)'} />
      <text x={vn.lx} y={vn.ly + 6} textAnchor="middle" fontFamily="var(--font-title)" fontSize="18" fontWeight={selected ? 700 : 400} fill={selected ? 'var(--gold)' : 'var(--ink)'}>
        {vn.lem}
      </text>
      <text x={vn.lx} y={vn.ly + 22} textAnchor="middle" fontFamily="var(--font-body)" fontSize="11" fill="var(--ink-3)">
        {arNum(vn.count)}
      </text>
    </g>
  );
});

/** A verb of the lexica that does not occur in the Quran: a thin bare twig with a bud, no leaves. */
const LexTwig = memo(function LexTwig({ vn, from, selected, muted, flip, onClick }: { vn: VerbNode; from: RootNode; selected: boolean; muted: boolean; flip: boolean; onClick: () => void }) {
  const mx = (from.x + vn.x) / 2;
  const my = (from.y + vn.y) / 2;
  const dx = vn.x - from.x;
  const dy = vn.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * len * 0.1 * (flip ? 1 : -1);
  const py = (dx / len) * len * 0.1 * (flip ? 1 : -1);
  const d = `M ${from.x} ${from.y} Q ${mx + px} ${my + py} ${vn.x} ${vn.y}`;
  return (
    <g opacity={muted ? 0.4 : 1} style={{ cursor: 'pointer', transition: 'opacity .3s' }} onClick={onClick} role="button" aria-label={`الفعل ${vn.lem} (من المعاجم، لم يرد في القرآن)`}>
      <path d={d} stroke={selected ? 'var(--gold)' : 'var(--twig-lex)'} strokeWidth={selected ? 2.2 : 1.3} fill="none" strokeLinecap="round" strokeDasharray={selected ? undefined : '5 3'} />
      <circle cx={vn.x} cy={vn.y - 1} r={selected ? 4 : 2.8} fill={selected ? 'var(--gold-2)' : 'var(--panel-solid)'} stroke={selected ? 'var(--gold)' : 'var(--twig-lex)'} strokeWidth="1.5" />
      <text x={vn.lx} y={vn.ly + 5} textAnchor="middle" fontFamily="var(--font-title)" fontSize="14.5" fontWeight={selected ? 700 : 400} fill={selected ? 'var(--gold)' : 'var(--ink-3)'}>
        {vn.lem}
      </text>
    </g>
  );
});
