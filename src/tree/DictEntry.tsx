import { useState } from 'react';

interface Props {
  title: string;
  author: string;
  /** the entry; undefined when it must be fetched with `load` */
  text?: string | null;
  /** fetch the entry on request (large dictionaries) */
  load?: () => Promise<string | null>;
  missing?: string;
}

export default function DictEntry({ title, author, text, load, missing }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<string | null | undefined>(text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = text !== undefined ? text : loaded;
  const paras = current ? current.split('\n') : [];
  const long = paras.length > 3 || (current?.length ?? 0) > 900;

  const fetchIt = () => {
    if (!load) return;
    setBusy(true);
    load()
      .then((t) => {
        setLoaded(t);
        setOpen(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <section className={'dict' + (!open && long ? ' collapsed' : '')} aria-label={title}>
      <div className="src">
        <span>
          <b>{title}</b> — {author}
        </span>
        {current === undefined && load && (
          <button className="more" onClick={fetchIt} disabled={busy}>
            {busy ? 'جارٍ التحميل…' : 'عرض المادّة'}
          </button>
        )}
        {current !== undefined && long && (
          <button className="more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'اختصار' : 'المزيد'}
          </button>
        )}
      </div>
      {error && <p className="missing">تعذّر التحميل: {error}</p>}
      {current === null && <p className="missing">{missing ?? 'لا يوجد مدخل لهذا الجذر في النسخة الرقمية المتاحة من المعجم.'}</p>}
      {current === undefined && !load && <p className="missing">{missing ?? 'لا يوجد مدخل لهذا الجذر.'}</p>}
      {(open || !long ? paras : paras.slice(0, 3)).map((p, i) => (
        <p key={i}>{trim(p, open || !long ? Infinity : 900)}</p>
      ))}
    </section>
  );
}

function trim(p: string, max: number): string {
  if (p.length <= max) return p;
  return p.slice(0, max) + '…';
}
