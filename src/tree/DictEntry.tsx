import { useState } from 'react';

export default function DictEntry({ title, author, text }: { title: string; author: string; text: string | null }) {
  const [open, setOpen] = useState(false);
  const paras = text ? text.split('\n') : [];
  const long = paras.length > 3 || (text?.length ?? 0) > 900;
  return (
    <section className={'dict' + (!open && long ? ' collapsed' : '')} aria-label={title}>
      <div className="src">
        <span>
          <b>{title}</b> — {author}
        </span>
        {long && (
          <button className="more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'اختصار' : 'المزيد'}
          </button>
        )}
      </div>
      {!text && <p className="missing">لا يوجد مدخل لهذا الجذر في النسخة الرقمية المتاحة من المعجم.</p>}
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
