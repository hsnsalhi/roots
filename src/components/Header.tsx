import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../settings';
import { hrefTree, navigate } from '../router';
import { biliteralOf, dashed, normLetters, stripDiacritics, arNum } from '../roots';
import type { BiRoot, IndexFile, IndexRoot } from '../types';

interface Props {
  index: IndexFile | null;
  bis: BiRoot[];
  aboutOpen?: boolean;
}

interface Hit {
  kind: 'bi' | 'root' | 'verb' | 'lex' | 'noun';
  label: string;
  meta: string;
  href: string;
  key: string;
}

const KIND_LABEL: Record<Hit['kind'], string> = { bi: 'جذر ثنائي', root: 'جذر', verb: 'فعل في القرآن', lex: 'فعل في المعاجم', noun: 'اسم' };

function normQuery(q: string): string {
  return normLetters(stripDiacritics(q.trim())).replace(/[\s\-‑ـ]/g, '');
}

export default function Header({ index, bis, aboutOpen }: Props) {
  const { settings, update } = useSettings();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const rootById = useMemo(() => new Map((index?.roots ?? []).map((r) => [r.r, r])), [index]);

  const hits = useMemo<Hit[]>(() => {
    const nq = normQuery(q);
    if (!index || nq.length < 1) return [];
    const out: Hit[] = [];
    const seen = new Set<string>();
    const push = (h: Hit) => {
      if (!seen.has(h.key)) {
        seen.add(h.key);
        out.push(h);
      }
    };
    const biOf = (r: IndexRoot) => biliteralOf(r.r, settings.rule);
    // biliteral trees
    for (const b of bis) {
      if (b.id === nq || (nq.length === 1 && b.id[0] === nq)) {
        push({ kind: 'bi', label: dashed(b.id), meta: `${arNum(b.roots.length)} جذور · ${arNum(b.verbLemmas)} فعل`, href: hrefTree(b.id), key: 'b' + b.id });
      }
      if (out.length > 40) break;
    }
    // roots
    for (const r of index.roots) {
      if (r.l === nq || (nq.length >= 2 && r.l.startsWith(nq))) {
        push({ kind: 'root', label: r.r, meta: `${arNum(r.v)} فعل · ${arNum(r.n)} اسم`, href: hrefTree(biOf(r), r.r), key: 'r' + r.r });
      }
      if (out.length > 60) break;
    }
    // verb lemmas
    if (nq.length >= 2) {
      for (const r of index.roots) {
        for (const lem of r.lem) {
          const nl = normLetters(stripDiacritics(lem));
          if (nl.includes(nq)) push({ kind: 'verb', label: lem, meta: `الجذر ${r.r}`, href: hrefTree(biOf(r), r.r, lem), key: 'v' + r.r + lem });
        }
        if (out.length > 80) break;
      }
      for (const r of index.roots) {
        for (const lem of r.nl) {
          const nl = normLetters(stripDiacritics(lem));
          if (nl.includes(nq)) push({ kind: 'noun', label: lem, meta: `الجذر ${r.r}`, href: hrefTree(biOf(r), r.r), key: 'n' + r.r + lem });
        }
        if (out.length > 100) break;
      }
      // verbs of the lexica absent from the Quran
      for (const r of index.roots) {
        for (const lem of r.xl ?? []) {
          const nl = normLetters(stripDiacritics(lem));
          if (nl.includes(nq)) push({ kind: 'lex', label: lem, meta: `الجذر ${r.r} · خارج القرآن`, href: hrefTree(biOf(r), r.r, lem), key: 'x' + r.r + lem });
        }
        if (out.length > 120) break;
      }
    }
    return out.slice(0, 60);
  }, [q, index, bis, settings.rule, rootById]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (h: Hit) => {
    navigate(h.href);
    setOpen(false);
    setQ('');
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="header">
      <a className="brand" href="#/" aria-label="غابة الجذور — الصفحة الرئيسية">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="var(--green)" />
          <path d="M31 58V36" stroke="var(--bark)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="32" cy="27" r="15" fill="var(--green-3)" />
          <circle cx="21" cy="33" r="10" fill="var(--green-2)" />
          <circle cx="43" cy="33" r="10" fill="var(--green-2)" />
          <circle cx="32" cy="18" r="9" fill="var(--green-4)" />
        </svg>
        <div>
          <h1>غابة الجذور</h1>
          <small>الجذور الثنائية لأفعال القرآن الكريم</small>
        </div>
      </a>
      <div className="spacer" />
      <div className="search" ref={boxRef} role="search">
        <input
          type="search"
          value={q}
          placeholder="ابحث عن جذر أو فعل أو كلمة… مثل: قلب"
          aria-label="بحث"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          disabled={!index}
        />
        <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        {open && q.trim() && (
          <div className="results" role="listbox">
            {hits.length === 0 && <div className="empty">لا نتائج لـ «{q}»</div>}
            {hits.map((h, i) => (
              <button key={h.key} className={i === active ? 'active' : ''} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
                <span className="kind">{KIND_LABEL[h.kind]}</span>
                <span className="word">{h.label}</span>
                <span className="meta">{h.meta}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <a className="iconbtn" href="#/about" title="حول التطبيق والمصادر" aria-label="حول التطبيق" aria-current={aboutOpen ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
      </a>
      <button className="iconbtn" title={dark ? 'الوضع النهاري' : 'الوضع الليلي'} aria-label="تبديل السمة" onClick={() => update({ theme: dark ? 'light' : 'dark' })}>
        {dark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
        )}
      </button>
      <button className="iconbtn" title="الإعدادات" aria-label="الإعدادات" aria-pressed={menu} onClick={() => setMenu((m) => !m)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="var(--panel-solid)" /><circle cx="15" cy="12" r="2" fill="var(--panel-solid)" /><circle cx="8" cy="18" r="2" fill="var(--panel-solid)" /></svg>
      </button>
      {menu && (
        <div className="settings-menu" role="dialog" aria-label="الإعدادات">
          <h3>الإعدادات</h3>
          <fieldset>
            <legend>قاعدة استخراج الجذر الثنائي</legend>
            <label>
              <input type="radio" name="rule" checked={settings.rule === 'first-two'} onChange={() => update({ rule: 'first-two' })} />
              <span>
                الحرفان الأولان من الجذر الثلاثي
                <small>القراءة الشائعة لنظرية الثنائية: قَلَبَ ← ق‑ل، قَالَ (ق‑و‑ل) ← ق‑و</small>
              </span>
            </label>
            <label>
              <input type="radio" name="rule" checked={settings.rule === 'strong'} onChange={() => update({ rule: 'strong' })} />
              <span>
                الحرفان الصحيحان (إسقاط حرف العلة والتضعيف)
                <small>قَالَ (ق‑و‑ل) ← ق‑ل، مَدَّ (م‑د‑د) ← م‑د، رَمَى (ر‑م‑ي) ← ر‑م</small>
              </span>
            </label>
          </fieldset>
          <fieldset>
            <legend>محتوى الغابة</legend>
            <label>
              <input type="checkbox" checked={settings.showEmpty} onChange={(e) => update({ showEmpty: e.target.checked })} />
              <span>
                إظهار الجذور التي لا فعل لها في القرآن
                <small>تُرسم شجيرات صغيرة للجذور الاسمية فقط (مثل: شمس، كوكب)</small>
              </span>
            </label>
          </fieldset>
          <fieldset>
            <legend>محتوى الشجرة</legend>
            <label>
              <input type="checkbox" checked={settings.showLexicon} onChange={(e) => update({ showLexicon: e.target.checked })} />
              <span>
                إظهار أفعال الجذر التي لم ترد في القرآن
                <small>تُرسم فروعًا رمادية بلا ورق، من المعاجم: الصحاح والقاموس المحيط ولسان العرب والرموز وويكاموس</small>
              </span>
            </label>
          </fieldset>
          <fieldset>
            <legend>السمة</legend>
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <label key={t}>
                <input type="radio" name="theme" checked={settings.theme === t} onChange={() => update({ theme: t })} />
                <span>{t === 'auto' ? 'تلقائية (حسب النظام)' : t === 'light' ? 'نهارية' : 'ليلية'}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </header>
  );
}
