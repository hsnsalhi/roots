import { useMemo, useState } from 'react';
import { IMPF_VOWEL, LETTER_NAMES, MOOD, POS, SOURCES, SOURCE_ORDER, TENSE, VOICE, arNum, dashed, pgnLabel, plural, spaced, verbFormOf } from '../roots';
import { hrefTree, type Route } from '../router';
import { loadLisan } from '../data';
import type { BiRoot, IndexFile, LexVerb, Noun, RootFile, Verb, VerbForm } from '../types';
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
  const lex = file && route.verb && !verb ? (file.lexicon ?? []).find((x) => x.v === route.verb) : undefined;
  const current = verb?.lem ?? lex?.v;

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
            {current ? <button onClick={() => onRoot(route.root)}>{route.root}</button> : <span>{route.root}</span>}
          </>
        )}
        {current && (
          <>
            <span className="sep">›</span>
            <span>{current}</span>
          </>
        )}
      </nav>
      {!route.root && <BiSection bi={bi} files={files} onRoot={onRoot} />}
      {route.root && !file && <p className="note">جارٍ التحميل…</p>}
      {file && !current && route.verb && <p className="note">لا يوجد فعل بهذا اللفظ «{route.verb}» في هذا الجذر.</p>}
      {file && !current && <RootSection bi={bi} file={file} index={index} onVerb={(l) => onVerb(file.r, l)} />}
      {file && verb && <VerbSection bi={bi} file={file} verb={verb} index={index} />}
      {file && lex && <LexVerbSection bi={bi} file={file} x={lex} />}
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

/** Small chips naming the sources that list a verb. */
function SourceBadges({ src, quran, className }: { src?: string[]; quran?: boolean; className?: string }) {
  const list = SOURCE_ORDER.filter((s) => src?.includes(s));
  if (!quran && list.length === 0) return null;
  return (
    <span className={'badges' + (className ? ' ' + className : '')}>
      {quran && <i className="badge q" title="ورد في القرآن الكريم">القرآن</i>}
      {list.map((s) => (
        <i key={s} className="badge" title={`${SOURCES[s].name} — ${SOURCES[s].who}`}>
          {SOURCES[s].short}
        </i>
      ))}
    </span>
  );
}

function impfLabel(x: LexVerb): string {
  return x.imp.map((c) => IMPF_VOWEL[c] ?? c).join(' و');
}

function LexDetails({ x }: { x: LexVerb }) {
  return (
    <dl className="kv">
      {x.imp.length > 0 && (
        <>
          <dt>المضارع</dt>
          <dd>{impfLabel(x)}</dd>
        </>
      )}
      {x.tr !== undefined && (
        <>
          <dt>التعدّي</dt>
          <dd>{x.tr ? 'متعدٍّ' : 'لازم'}</dd>
        </>
      )}
      {x.vn && x.vn.length > 0 && (
        <>
          <dt>المصدر</dt>
          <dd>{x.vn.join('، ')}</dd>
        </>
      )}
      {x.alt && x.alt.length > 0 && (
        <>
          <dt>ضبط آخر</dt>
          <dd>{x.alt.join('، ')}</dd>
        </>
      )}
      {x.g && x.g.length > 0 && (
        <>
          <dt>المعنى في ويكاموس</dt>
          <dd className="gloss">{x.g.join(' · ')}</dd>
        </>
      )}
      <dt>المصادر</dt>
      <dd>
        <SourceBadges src={x.src} quran={!!x.q} />
      </dd>
    </dl>
  );
}

function Cite({ cite }: { cite?: [string, string] }) {
  if (!cite) return null;
  const s = SOURCES[cite[0]];
  return (
    <blockquote className="cite">
      {cite[1]}
      <span className="from">من مادّة الجذر في {s ? `${s.name} — ${s.who}` : cite[0]}</span>
    </blockquote>
  );
}

function BiSection({ bi, files, onRoot }: { bi: BiRoot; files: Map<string, RootFile>; onRoot: (r: string) => void }) {
  return (
    <>
      <h2>
        {dashed(bi.id)} <span className="sub">الجذر الثنائي: {LETTER_NAMES[bi.id[0]]} و{LETTER_NAMES[bi.id[1]]}</span>
      </h2>
      <div className="stat-row">
        <div className="stat"><b>{arNum(bi.roots.length)}</b> {bi.roots.length === 1 ? 'جذر' : 'جذور'}</div>
        <div className="stat"><b>{arNum(bi.verbLemmas)}</b> {bi.verbLemmas === 1 ? 'فعل في القرآن' : 'أفعال في القرآن'}</div>
        <div className="stat"><b>{arNum(bi.verbTokens)}</b> موضع للأفعال</div>
        <div className="stat"><b>{arNum(bi.nounLemmas)}</b> مشتق اسمي</div>
        {bi.otherVerbs > 0 && <div className="stat"><b>{arNum(bi.otherVerbs)}</b> فعل آخر في المعاجم</div>}
      </div>
      <div className="meaning-card">
        <div className="lbl">المعنى الجامع للمجموعة · استقراءٌ من أصول ابن فارس</div>
        {bi.meaning ? <div className="txt">{bi.meaning}</div> : <div className="txt none">لم نتبيّن خيطًا جامعًا واضحًا بين أصول جذور هذه المجموعة.</div>}
      </div>
      <p className="note">
        انقر على غصن في الشجرة أو على جذر في القائمة لقراءة أصله في المعاجم، وعلى فرع أخضر لعرض الفعل وآياته. الفروع الرمادية أفعال من الجذر
        وردت في المعاجم ولم ترد في القرآن.
      </p>
      <h3>
        الجذور الثلاثية <span className="n">وأصولها عند ابن فارس</span>
      </h3>
      <ul className="list">
        {bi.roots.map((r) => {
          const f = files.get(r.r);
          const gist = f?.gist ?? firstSentence(f?.maqayis ?? null);
          return (
            <li key={r.r}>
              <button onClick={() => onRoot(r.r)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="lem">{r.r}</span>
                    <span className="form">
                      {plural(r.v, 'فعل واحد', 'فعلان', 'أفعال', 'فعلًا')} في القرآن · {plural(r.n, 'اسم واحد', 'اسمان', 'أسماء', 'اسمًا')}
                      {r.x > 0 && <> · {plural(r.x, 'فعل آخر', 'فعلان آخران', 'أفعال أخرى', 'فعلًا آخر')} في المعاجم</>}
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
  const others = useMemo(() => (file.lexicon ?? []).filter((x) => !x.q), [file]);
  return (
    <>
      <h2>
        {spaced(file.r)} <span className="sub">جذر ثلاثي من شجرة {dashed(bi.id)}</span>
      </h2>
      <div className="stat-row">
        <div className="stat"><b>{arNum(file.verbs.length)}</b> {file.verbs.length === 1 ? 'فعل في القرآن' : 'أفعال في القرآن'}</div>
        <div className="stat"><b>{arNum(verbTokens)}</b> موضع للأفعال</div>
        <div className="stat"><b>{arNum(file.nouns.length)}</b> مشتق اسمي</div>
        <div className="stat"><b>{arNum(nounTokens)}</b> موضع للأسماء</div>
        <div className="stat"><b>{arNum(others.length)}</b> فعل آخر في المعاجم</div>
      </div>

      <h3>المعنى في المعاجم</h3>
      <DictEntry key={file.id + 'm'} title="مقاييس اللغة" author="ابن فارس (ت ٣٩٥هـ)" text={file.maqayis} />
      <DictEntry key={file.id + 'r'} title="المفردات في غريب القرآن" author="الراغب الأصفهاني (ت ٥٠٢هـ)" text={file.mufradat} />
      <DictEntry key={file.id + 's'} title="الصحاح" author="الجوهري (ت ٣٩٣هـ)" text={file.sihah ?? null} />
      <DictEntry key={file.id + 'q'} title="القاموس المحيط" author="الفيروزآبادي (ت ٨١٧هـ)" text={file.qamus ?? null} />
      {file.lisan ? (
        <DictEntry key={file.id + 'l'} title="لسان العرب" author="ابن منظور (ت ٧١١هـ)" load={() => loadLisan(file.id)} />
      ) : (
        <DictEntry key={file.id + 'l0'} title="لسان العرب" author="ابن منظور (ت ٧١١هـ)" text={null} />
      )}

      <h3>
        الأفعال في القرآن <span className="n">{arNum(file.verbs.length)}</span>
      </h3>
      {file.verbs.length === 0 && <p className="note">لم يرد من هذا الجذر فعل في القرآن الكريم؛ وردت منه المشتقات الاسمية أدناه.</p>}
      <ul className="list">
        {file.verbs.map((v) => (
          <li key={v.lem + v.form}>
            <button onClick={() => onVerb(v.lem)}>
              <span className="lem">{v.lem}</span>
              <span className="form">وزن {verbFormOf(v.form, file.r).pattern}</span>
              <SourceBadges src={v.src} />
              <span className="cnt">{plural(v.count, 'موضع واحد', 'موضعان', 'مواضع', 'موضعًا')}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3>
        أفعال أخرى من الجذر <span className="n">{arNum(others.length)} · في المعاجم، لم ترد في القرآن</span>
      </h3>
      {others.length === 0 && <p className="note">لم نجد في المعاجم المتاحة أفعالًا أخرى من هذا الجذر.</p>}
      <ul className="list lex">
        {others.map((x) => (
          <li key={x.v + x.form}>
            <button onClick={() => onVerb(x.v)}>
              <span className={'lem lex' + (x.uv ? ' uv' : '')}>{x.v}</span>
              <span className="form">
                وزن {verbFormOf(x.form, file.r).pattern}
                {x.imp.length > 0 && <> · مضارعه {impfLabel(x)}</>}
                {x.tr !== undefined && <> · {x.tr ? 'متعدٍّ' : 'لازم'}</>}
              </span>
              <SourceBadges src={x.src} className="cnt" />
            </button>
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <p className="note">
          جُمعت هذه الأفعال من معجم الرموز الوسيط وويكاموس ومن مواد الجذر في الصحاح والقاموس المحيط ولسان العرب، وتُذكر عند كلّ فعل
          المصادر التي وُجد فيها؛ ما وُجد في المعاجم القديمة وحدها كُتب بضبط الوزن إن كان مزيدًا، وبلا ضبط إن كان مجرّدًا.
        </p>
      )}

      <h3>
        المشتقات الاسمية <span className="n">{arNum(file.nouns.length)}</span>
      </h3>
      <ul className="list">
        {file.nouns.map((n) => (
          <li key={n.lem + n.pos}>
            <button className={noun === n ? 'active' : ''} onClick={() => setNoun(noun === n ? null : n)}>
              <span className="lem">{n.lem}</span>
              <span className="form">{POS[n.pos] ?? n.pos}{n.form && n.form > 1 ? ` · وزن ${verbFormOf(n.form, file.r).pattern}` : ''}</span>
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
  const vf = verbFormOf(verb.form, file.r);
  const rec = (file.lexicon ?? []).find((x) => x.v === verb.lem && x.form === verb.form) ?? (file.lexicon ?? []).find((x) => x.q?.includes(verb.lem));
  return (
    <>
      <h2>
        {verb.lem}
        <span className="sub">
          فعل من الجذر <a href={hrefTree(bi.id, file.r)}>{file.r}</a> · شجرة {dashed(bi.id)}
        </span>
      </h2>
      <div className="stat-row">
        <div className="stat"><b>{vf.pattern}</b> الوزن ({vf.name})</div>
        <div className="stat"><b>{arNum(verb.count)}</b> {verb.count === 1 ? 'موضع' : 'موضعًا'} في القرآن</div>
        <div className="stat"><b>{arNum(verb.forms.length)}</b> {verb.forms.length === 1 ? 'صيغة' : 'صيغ'}</div>
      </div>
      {verb.lems && verb.lems.length > 0 && (verb.lems.length > 1 || verb.lems[0] !== verb.lem) && (
        <p className="note">
          صيغة المدوّنة لهذا الفعل: {verb.lems.join('، ')} — وقد رُدّت إلى صيغة الماضي المعجمية.
        </p>
      )}

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

      <h3>
        في المعاجم <span className="n">المصادر التي تذكر الفعل</span>
      </h3>
      {rec ? (
        <>
          <LexDetails x={rec} />
          <Cite cite={rec.cite} />
        </>
      ) : (
        <p className="note">
          <SourceBadges quran /> لم نجد هذا الفعل بهذه الصيغة في المعاجم المتاحة، أو لم تُتح مطابقته آليًا.
        </p>
      )}
    </>
  );
}

function LexVerbSection({ bi, file, x }: { bi: BiRoot; file: RootFile; x: LexVerb }) {
  const vf = verbFormOf(x.form, file.r);
  return (
    <>
      <h2>
        <span className={x.uv ? 'uv' : ''}>{x.v}</span>
        <span className="sub">
          فعل من الجذر <a href={hrefTree(bi.id, file.r)}>{file.r}</a> · شجرة {dashed(bi.id)} · لم يرد في القرآن
        </span>
      </h2>
      <div className="stat-row">
        <div className="stat"><b>{vf.pattern}</b> الوزن ({vf.name})</div>
        <div className="stat"><b>{arNum(x.src.length)}</b> {x.src.length === 1 ? 'مصدر' : 'مصادر'}</div>
        {x.imp.length > 0 && <div className="stat"><b>{impfLabel(x)}</b> المضارع</div>}
      </div>
      {x.uv && <p className="note">ضبط هذا الفعل غير معروف: وُجد في معجم غير مشكول فقط، فكُتب بلا حركات.</p>}
      <h3>في المعاجم</h3>
      <LexDetails x={x} />
      <Cite cite={x.cite} />
      {x.word && x.src.includes('wk') && (
        <p className="note">
          <a href={`https://en.wiktionary.org/wiki/${encodeURIComponent(x.word)}#Arabic`} target="_blank" rel="noreferrer">
            مدخل الفعل في ويكاموس ↗
          </a>
        </p>
      )}
      <p className="note">
        هذا الفعل من أفعال اللغة التي لم ترد في القرآن الكريم؛ يُرسم في الشجرة فرعًا رماديًا بلا ورق. التوثيق من المعاجم القديمة آليٌّ
        يعتمد على صيغ الاستشهاد المعتادة (فَعَلَ يَفْعُلُ، المصادر، أوزان المزيد) في مادّة الجذر، فقد يفوته فعل أو يخطئ في آخر.
      </p>
    </>
  );
}
