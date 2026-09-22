import { useEffect, useRef, useState } from 'react';
import { ALPHABET, LETTER_NAMES, arNum, dashed, plural } from '../roots';
import { useSettings } from '../settings';
import type { BiRoot } from '../types';
import type { Layout3D, Tree3D } from './layout3d';
import { ForestScene, type CameraInfo } from './scene';

interface Props {
  bis: BiRoot[];
  letter?: string;
  onSelect: (bi: BiRoot) => void;
}

export default function Forest3D({ bis, letter, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ForestScene | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ tree: Tree3D; x: number; y: number } | null>(null);
  const [cam, setCam] = useState<CameraInfo | null>(null);
  const [layout, setLayout] = useState<Layout3D | null>(null);
  const [hint, setHint] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const { settings } = useSettings();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const introDone = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let scene: ForestScene;
    try {
      scene = new ForestScene(el, {
        onHover: (tree, screen) => setHover(tree && screen ? { tree, x: screen.x, y: screen.y } : null),
        onSelect: (tree) => onSelectRef.current(tree.bi),
        onCamera: setCam,
      });
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
      return;
    }
    sceneRef.current = scene;
    (window as unknown as { __forest?: ForestScene }).__forest = scene;
    scene.init().then(() => setReady(true));
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setTrees(bis);
    const lay = scene.getLayout();
    setLayout(lay);
    // first arrival: glide from the overview down into the first grove
    if (!introDone.current && !letter && lay?.groves.length) {
      introDone.current = true;
      const id = setTimeout(() => scene.flyToGrove(lay.groves[0].letter, 2800), 700);
      return () => clearTimeout(id);
    }
    introDone.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bis, ready]);

  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    sceneRef.current?.setNight(dark);
  }, [dark, ready]);

  useEffect(() => {
    if (!ready || !letter) return;
    const id = setTimeout(() => sceneRef.current?.flyToGrove(letter), 80);
    return () => clearTimeout(id);
  }, [letter, ready, layout]);

  // which grove is closest to the camera target
  let activeLetter: string | undefined;
  if (cam && layout) {
    let bd = Infinity;
    for (const g of layout.groves) {
      const d = Math.hypot(g.cx - (cam.x + cam.dirX * Math.min(cam.distance, 200)), g.cz - (cam.z + cam.dirZ * Math.min(cam.distance, 200)));
      if (d < bd) {
        bd = d;
        activeLetter = g.letter;
      }
    }
    if (cam.distance > 500) activeLetter = undefined;
  }

  return (
    <>
      <div ref={containerRef} className="stage3d" aria-label="غابة الجذور: مشهد ثلاثي الأبعاد" />
      {failed && <div className="error">تعذّر تشغيل العرض ثلاثي الأبعاد (WebGL): {failed}</div>}
      {!ready && !failed && <div className="loading"><div><div className="spinner" />تنمو الغابة…</div></div>}
      {hover && (
        <div className="tip" style={{ left: hover.x, top: hover.y }}>
          <div className="bi">{dashed(hover.tree.bi.id)}</div>
          <div className="roots">{hover.tree.bi.roots.slice(0, 8).map((r) => r.r).join(' · ')}{hover.tree.bi.roots.length > 8 ? ' …' : ''}</div>
          <div className="stats">
            {plural(hover.tree.bi.roots.length, 'جذر واحد', 'جذران', 'جذور', 'جذرًا')} · {plural(hover.tree.bi.verbLemmas, 'فعل واحد', 'فعلان', 'أفعال', 'فعلًا')} · {plural(hover.tree.bi.verbTokens, 'موضع واحد', 'موضعان', 'مواضع', 'موضعًا')}
          </div>
        </div>
      )}
      <nav className="letters" aria-label="الانتقال إلى بستان حرف">
        {ALPHABET.map((l) => (
          <button key={l} className={l === activeLetter ? 'active' : ''} title={`بستان ${LETTER_NAMES[l]}`} disabled={!layout?.groves.some((g) => g.letter === l)} onClick={() => sceneRef.current?.flyToGrove(l)}>
            {l}
          </button>
        ))}
      </nav>
      <div className="hud bottom-end zoombtns">
        <button className="iconbtn" aria-label="اقتراب" onClick={() => sceneRef.current?.zoomBy(1.6)}>＋</button>
        <button className="iconbtn" aria-label="ابتعاد" onClick={() => sceneRef.current?.zoomBy(1 / 1.6)}>－</button>
        <button className="iconbtn" aria-label="عرض الغابة كاملة" title="الغابة كاملة" onClick={() => sceneRef.current?.fitAll()}>⤢</button>
      </div>
      <div className="hud bottom-start">
        <span className="chip">
          <b>{arNum(bis.length)}</b> شجرة · <b>{arNum(bis.reduce((s, b) => s + b.roots.length, 0))}</b> جذرًا
        </span>
        {hint && ready && (
          <span className="chip hint">
            اسحب للدوران · العجلة للاقتراب · الزر الأيمن للتحريك · انقر على شجرة
            <button aria-label="إخفاء التلميح" onClick={() => setHint(false)}>×</button>
          </span>
        )}
      </div>
      {layout && cam && <Minimap layout={layout} cam={cam} onJump={(x, z) => sceneRef.current?.lookAtPoint(x, z)} />}
    </>
  );
}

function Minimap({ layout, cam, onJump }: { layout: Layout3D; cam: CameraInfo; onJump: (x: number, z: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const b = layout.bounds;
  const pad = 30;
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxZ - b.minZ + pad * 2;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    c.width = cw * dpr;
    c.height = ch * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const s = Math.min(cw / w, ch / h);
    const ox = (cw - w * s) / 2;
    const oy = (ch - h * s) / 2;
    const X = (x: number) => ox + (x - b.minX + pad) * s;
    const Y = (z: number) => oy + (z - b.minZ + pad) * s;
    ctx.clearRect(0, 0, cw, ch);
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue('--hill-1') || '#d3dfb9';
    ctx.fillRect(0, 0, cw, ch);
    for (const g of layout.groves) {
      ctx.fillStyle = css.getPropertyValue('--green-2') || '#4f9a57';
      for (const t of g.trees) {
        ctx.beginPath();
        ctx.arc(X(t.x), Y(t.z), Math.max(1, (t.shrub ? 1.5 : t.height * 0.34) * s), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = css.getPropertyValue('--ink-2') || '#5b4d3f';
      ctx.font = `700 ${Math.max(9, 12)}px Amiri, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.letter, X(g.cx), Y(g.cz));
    }
    // camera
    const cx = X(cam.x);
    const cy = Y(cam.z);
    ctx.fillStyle = css.getPropertyValue('--gold') || '#b8862b';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const a = Math.atan2(cam.dirZ, cam.dirX);
    ctx.arc(cx, cy, 16, a - 0.5, a + 0.5);
    ctx.closePath();
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }, [layout, cam, b, w, h]);
  const onClick = (e: React.MouseEvent) => {
    const c = ref.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const s = Math.min(r.width / w, r.height / h);
    const ox = (r.width - w * s) / 2;
    const oy = (r.height - h * s) / 2;
    onJump((e.clientX - r.left - ox) / s + b.minX - pad, (e.clientY - r.top - oy) / s + b.minZ - pad);
  };
  return (
    <div className="minimap" title="الخريطة المصغّرة: انقر للانتقال" onClick={onClick}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
