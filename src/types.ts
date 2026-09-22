/** Shape of the JSON produced by scripts/build_data.py */

export interface IndexRoot {
  id: string;      // file id, e.g. "r0123"
  r: string;       // root as written in the corpus, e.g. "قلب"
  l: string;       // normalised letters (hamza → أ)
  v: number;       // number of verb lemmas
  vo: number;      // number of verb tokens in the Quran
  n: number;       // number of nominal lemmas
  no: number;      // number of nominal tokens
  lem: string[];   // verb lemmas (citation forms)
  nl: string[];    // nominal lemmas
  x: number;       // verbs of the root attested in the lexica but absent from the Quran
  xl: string[];    // their citation forms
  d: number;       // dictionary bitmask: 1 = Ibn Faris, 2 = al-Raghib, 4 = Qamus, 8 = Sihah, 16 = Lisan
}

export interface SuraMeta {
  n: number;
  name: string;
  ayas: number;
  type: string;
}

export interface IndexFile {
  meta: {
    generated: string;
    counts: Record<string, number>;
    suras: SuraMeta[];
    basmala: string;
    alphabet: string[];
  };
  roots: IndexRoot[];
  /** curated general meaning of each biliteral group (المعنى الجامع), when one exists */
  bi: Record<string, string>;
}

export interface VerbForm {
  w: string;   // surface form (verb + subject suffix)
  t: 'PERF' | 'IMPF' | 'IMPV' | string;
  p: string;   // person/gender/number, e.g. "3MS"
  v: 'ACT' | 'PASS';
  m: string;   // mood for imperfect: IND / SUBJ / JUS
  locs: string[]; // "sura:aya:word"
}

export interface Verb {
  lem: string;    // citation form (the corpus lemma of an imperfect-only verb is an imperfect: it is replaced)
  form: number;   // 1..12 (وزن الفعل)
  count: number;
  forms: VerbForm[];
  src?: string[]; // lexical sources that also list the verb (see LexVerb.src)
  lems?: string[]; // corpus lemmas merged under this citation form
}

/** A verb of the root in the lexica (Arramooz, Wiktionary, Lisan al-Arab, al-Qamus, al-Sihah) */
export interface LexVerb {
  v: string;            // vocalised citation form (unvocalised when uv)
  u: string;            // unvocalised key
  form: number;
  imp: string[];        // imperfect vowel(s): "a" | "i" | "u"
  tr?: boolean;         // transitive
  q: string[] | null;   // corpus lemmas when the verb occurs in the Quran
  src: string[];        // "ar" Arramooz, "wk" Wiktionary, "qm" Qamus, "sh" Sihah, "ls" Lisan
  g?: string[];         // Wiktionary glosses (English)
  vn?: string[];        // verbal nouns (Wiktionary)
  word?: string;        // Wiktionary page title
  alt?: string[];       // other vocalisations met in the sources
  cite?: [string, string]; // [source, passage of the dictionary entry]
  uv?: boolean;         // vocalisation unknown (found only in an unvocalised dictionary)
}

export interface Noun {
  lem: string;
  pos: string;    // N, PN, ACT_PCPL, PASS_PCPL, VN, ADJ, …
  form: number | null;
  count: number;
  locs: string[];
}

export interface RootFile {
  id: string;
  r: string;
  letters: string[];
  verbs: Verb[];
  nouns: Noun[];
  maqayis: string | null;
  maqayis_ed: string | null;
  mufradat: string | null;
  mufradat_ed: string | null;
  /** Ibn Faris's core-meaning sentence for the root */
  gist: string | null;
  /** every verb of the root known to the lexica, Quranic ones included */
  lexicon: LexVerb[];
  qamus: string | null;
  sihah: string | null;
  /** a Lisan al-Arab entry exists in data/lisan/<id>.json */
  lisan: boolean;
}

export interface SuraFile {
  s: number;
  name: string;
  tname: string;
  type: string;
  basmala: boolean;
  v: string[][];   // v[aya-1] = display tokens, one per corpus word
}

/** A biliteral root ("tree") grouping several triliteral roots */
export interface BiRoot {
  id: string;          // the two letters, e.g. "قل"
  letters: [string, string];
  roots: IndexRoot[];
  verbLemmas: number;
  verbTokens: number;
  nounLemmas: number;
  nounTokens: number;
  /** verbs of the group's roots attested in the lexica but absent from the Quran */
  otherVerbs: number;
  /** general common meaning of the group, if one exists */
  meaning?: string;
}

export type BiRule = 'first-two' | 'strong';
