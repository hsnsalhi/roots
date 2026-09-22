import { useMemo, useState } from 'react';
import { LETTER_NAMES, MOOD, POS, TENSE, VERB_FORMS, VOICE, arNum, dashed, pgnLabel, plural, spaced } from '../roots';
import { hrefTree, type Route } from '../router';
import type { BiRoot, IndexFile, Noun, RootFile, Verb, VerbForm } from '../types';
import Verses from './Verses';
import DictEntry from './DictEntry';

interface Props {
  bi: BiRoot;
  index: IndexFile;
  files: Map<string, RootFile>;
  route: Extract<Route, { view: 'tree' }>;
  onRoot: (r?: string) => void;
  onVerb: (r: string, lem: string) => void;
}

export default function Panel({ bi, index, files, route, onRoot, onVerb }: Props) {
  const file = route.root ? files.get(route.root) : undefined;
  const verb = file && route.verb ? file.verbs.find((v) => v.lem === route.verb) : undefined;

  return (
    <div>
      <nav className="crumbs" aria-label="مسار التصفح">
        <a href="#/">الغابة</a>
        <span className="sep">›</span>
        <a href={'#/letter/' + encodeURIComponent(bi.id[0])}>بستان {LETTER_NAMES[bi.id[0]]}</a>
        <span className="sep">›</span>
        {route.root ? (
          <button onClick={() => onRoot(undefined)}>{dashed(bi.id)}</button>
        ) : (
          <span>{dashed(bi.id)}</span>
        )}
        {route.root && (
          <>
            <span className="sep">›</span>
            {verb ? <button onClick={() => onRoot(route.root)}>{route.root}</button> : <span>{route.root}</span>}
          </>
        )}
        {verb && (
          <>
            <span className="sep">›</span>
            <span>{verb.lem}</span>
          </>
        )}
      </nav>
      {!route.root && <BiSection bi={bi} files={files} onRoot={onRoot} />}
      {route.root && !file && <p className="note">جارٍ التحميل…</p>}
      {file && !verb && <RootSection bi={bi} file={file} index={index} onVerb={(l) => onVerb(file.r, l)} />}
      {file && verb && <VerbSection bi={bi} file={file} verb={verb} index={index} />}
    </div>
  );
}

function firstSentence(text: string | null, max = 170): string | null {
  if (!text) return null;
  const p = text.split('\n')[0];
  if (p.length <= max) return p;
  const cut = p.slice(0, max);
  const i = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('،'), cut.lastIndexOf(' '));
  return cut.slice(0, i > 60 ? i : max) + '…';
}

function BiSection({ bi, files, onRoot }: { bi: BiRoot; files: Map<string, RootFile>; onRoot: (r: string) => void }) {
  return (
    <>
      <h2>
        {dashed(bi.id)} <span className="sub">الجذر الثنائي: {LETTER_NAMES[bi.id[0]]} و{LETTER_NAMES[bi.id[1]]}</span>
      </h2>
      <div className="stat-row">
        <div className="stat"><b>{arNum(bi.roots.length)}</b> {bi.roots.length === 1 ? 'جذر' : 'جذور'}</div>
        <div className="stat"><b>{arNum(bi.verbLemmas)}</b> {bi.verbLemmas === 1 ? 'فعل' : 'أفعال'}</div>
        <div className="stat"><b>{arNum(bi.verbTokens)}</b> موضع للأفعال</div>
        <div className="stat"><b>{arNum(bi.nounLemmas)}</b> مشتق اسمي</div>
      </div>
      <p className="note">انقر على غصن في الشجرة أو على جذر في القائمة لقراءة أصله عند ابن فارس ومادّته عند الراغب، وعلى فرع لعرض الفعل وآياته.</p>
      <h3>
        الجذور الثلاثية <span className="n">وأصولها عند ابن فارس</span>
      </h3>
      <ul className="list">
        {bi.roots.map((r) => {
          const f = files.get(r.r);
          const gist = firstSentence(f?.maqayis ?? null);
          return (
            <li key={r.r}>
              <button onClick={() => onRoot(r.r)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span className="lem">{r.r}</span>
                    <span className="form">
                      {plural(r.v, 'فعل واحد', 'فعلان', 'أفعال', 'فعلًا')} · {plural(r.n, 'اسم واحد', 'اسمان', 'أسماء', 'اسمًا')}
                    </span>
                  </div>
                  {gist && <div className="note" style={{ whiteSpace: 'normal', lineHeight: 1.6 }}>{gist}</div>}
                </div>
                <span className="cnt">{arNum(r.vo + r.no)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function RootSection({ bi, file, index, onVerb }: { bi: BiRoot; file: RootFile; index: IndexFile; onVerb: (lem: string) => void }) {
  const [noun, setNoun] = useState<Noun | null>(null);
  const verbTokens = file.verbs.reduce((s, v) => s + v.count, 0);
  const nounTokens = file.nouns.reduce((s, n) => s + n.count, 0);
  return (
    <>
      <h2>
        {spaced(file.r)} <span className="sub">جذر ثلاثي من شجرة {dashed(bi.id)}</span>
      </h2>
      <div className="stat-row">
        <div className="stat"><b>{arNum(file.verbs.length)}</b> {file.verbs.length === 1 ? 'فعل' : 'أفعال'}</div>
        <div className="stat"><b>{arNum(verbTokens)}</b> موضع للأفعال</div>
        <div className="stat"><b>{arNum(file.nouns.length)}</b> مشتق اسمي</div>
        <div className="stat"><b>{arNum(nounTokens)}</b> موضع للأسماء</div>
      </div>

      <h3>المعنى في المعاجم</h3>
      <DictEntry title="مقاييس اللغة" author="ابن فارس (ت ٣٩٥هـ)" text={file.maqayis} />
      <DictEntry title="المفردات في غريب القرآن" author="الراغب الأصفهاني (ت ٥٠٢هـ)" text={file.mufradat} />

      <h3>
        الأفعال في القرآن <span className="n">{arNum(file.verbs.length)}</span>
      </h3>
      {file.verbs.length === 0 && <p className="note">لم يرد من هذا الجذر فعل في القرآن الكريم؛ وردت منه المشتقات الاسمية أدناه.</p>}
      <ul className="list">
        {file.verbs.map((v) => (
          <li key={v.lem}>
            <button onClick={() => onVerb(v.lem)}>
              <span className="lem">{v.lem}</span>
              <span className="form">
                وزن {VERB_FORMS[v.form]?.pattern ?? arNum(v.form)}
              </span>
              <span className="cnt">{plural(v.count, 'موضع واحد', 'موضعان', 'مواضع', 'موضعًا')}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3>
        المشتقات الاسمية <span className="n">{arNum(file.nouns.length)}</span>
      </h3>
      <ul className="list">
        {file.nouns.map((n) => (
          <li key={n.lem + n.pos}>
            <button className={noun === n ? 'active' : ''} onClick={() => setNoun(noun === n ? null : n)}>
              <span className="lem">{n.lem}</span>
              <span className="form">{POS[n.pos] ?? n.pos}{n.form && n.form > 1 ? ` · وزن ${VERB_FORMS[n.form]?.pattern ?? ''}` : ''}</span>
              <span className="cnt">{arNum(n.count)}</span>
            </button>
            {noun === n && (
              <div style={{ padding: '4px 4px 10px' }}>
                <Verses key={n.lem} locs={n.locs} index={index} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function VerbSection({ bi, file, verb, index }: { bi: BiRoot; file: RootFile; verb: Verb; index: IndexFile }) {
  const [sel, setSel] = useState<VerbForm | null>(null);
  const locs = useMemo(() => (sel ? sel.locs : verb.forms.flatMap((f) => f.locs)), [sel, verb]);
  const vf = VERB_FORMS[verb.form];
  return (
    <>
      <h2>
        {verb.lem}
        <span className="sub">
          فعل من الجذر <a href={hrefTree(bi.id, file.r)}>{file.r}</a> · شجرة {dashed(bi.id)}
        </span>
      </h2>
      <div className="stat-row">
        <div className="stat"><b>{vf?.pattern ?? arNum(verb.form)}</b> الوزن ({vf?.name ?? ''})</div>
        <div className="stat"><b>{arNum(verb.count)}</b> {verb.count === 1 ? 'موضع' : 'موضعًا'} في القرآن</div>
        <div className="stat"><b>{arNum(verb.forms.length)}</b> {verb.forms.length === 1 ? 'صيغة' : 'صيغ'}</div>
      </div>

      <h3>
        الصيغ الواردة <span className="n">انقر على صيغة لحصر الآيات بها</span>
      </h3>
      <table className="forms">
        <thead>
          <tr>
            <th>الصيغة</th>
            <th>الزمن</th>
            <th>الإسناد</th>
            <th>البناء</th>
            <th>العدد</th>
          </tr>
        </thead>
        <tbody>
          {verb.forms.map((f) => (
            <tr key={f.w + f.t + f.p + f.v + f.m} role="button" tabIndex={0} className={sel === f ? 'active' : ''} onClick={() => setSel(sel === f ? null : f)} onKeyDown={(e) => e.key === 'Enter' && setSel(sel === f ? null : f)}>
              <td className="w">{f.w}</td>
              <td>
                {TENSE[f.t] ?? f.t}
                {f.m && <span className="note"> {MOOD[f.m] ?? f.m}</span>}
              </td>
              <td>{pgnLabel(f.p)}</td>
              <td>{f.v === 'PASS' ? VOICE.PASS : VOICE.ACT}</td>
              <td>{arNum(f.locs.length)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>
        الآيات <span className="n">{arNum(locs.length)} {sel ? `بصيغة ${sel.w}` : 'موضعًا'}</span>
      </h3>
      <Verses key={verb.lem + (sel?.w ?? '')} locs={locs} index={index} />
    </>
  );
}
