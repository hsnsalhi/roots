import { useEffect, useMemo, useState } from 'react';
import { loadSura } from '../data';
import { arNum, parseLoc } from '../roots';
import type { IndexFile, SuraFile } from '../types';

const PAGE = 15;

export default function Verses({ locs, index }: { locs: string[]; index: IndexFile }) {
  const [shown, setShown] = useState(PAGE);
  const [suras, setSuras] = useState<Map<number, SuraFile>>(new Map());
  const page = useMemo(() => locs.slice(0, shown).map(parseLoc), [locs, shown]);
  const needed = useMemo(() => [...new Set(page.map((l) => l.s))], [page]);

  useEffect(() => {
    let alive = true;
    const missing = needed.filter((s) => !suras.has(s));
    if (!missing.length) return;
    Promise.all(missing.map((s) => loadSura(s))).then((files) => {
      if (!alive) return;
      setSuras((m) => {
        const n = new Map(m);
        for (const f of files) n.set(f.s, f);
        return n;
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed]);

  const names = index.meta.suras;
  return (
    <div className="verses">
      {page.map((l, i) => {
        const f = suras.get(l.s);
        const tokens = f?.v[l.a - 1];
        const meta = names[l.s - 1];
        return (
          <article className="verse" key={locs[i]}>
            <div className="ref">
              <span>
                سورة {meta.name} · الآية {arNum(l.a)}
              </span>
              <a href={`https://quran.com/${l.s}/${l.a}`} target="_blank" rel="noopener" title="فتح الآية في quran.com">
                {arNum(l.s)}:{arNum(l.a)}
              </a>
            </div>
            {tokens ? (
              <div className="txt" lang="ar">
                {tokens.map((tk, j) => (
                  <span key={j}>
                    {j === l.w - 1 ? <mark>{tk}</mark> : tk}
                    {j < tokens.length - 1 ? ' ' : ''}
                  </span>
                ))}
                <span style={{ color: 'var(--ink-3)', fontSize: '0.75em' }}> ﴿{arNum(l.a)}﴾</span>
              </div>
            ) : (
              <div className="note">جارٍ تحميل السورة…</div>
            )}
          </article>
        );
      })}
      {shown < locs.length && (
        <button className="loadmore" onClick={() => setShown((s) => s + PAGE * 2)}>
          عرض المزيد ({arNum(locs.length - shown)} متبقية)
        </button>
      )}
    </div>
  );
}
