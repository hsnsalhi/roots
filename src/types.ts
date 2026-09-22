/** Shape of the JSON produced by scripts/build_data.py */

export interface IndexRoot {
  id: string;      // file id, e.g. "r0123"
  r: string;       // root as written in the corpus, e.g. "قلب"
  l: string;       // normalised letters (hamza → أ)
  v: number;       // number of verb lemmas
  vo: number;      // number of verb tokens in the Quran
  n: number;       // number of nominal lemmas
  no: number;      // number of nominal tokens
  lem: string[];   // verb lemmas
  nl: string[];    // nominal lemmas
  d: number;       // dictionary bitmask: 1 = Ibn Faris, 2 = al-Raghib
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
  lem: string;
  form: number;   // 1..12 (وزن الفعل)
  count: number;
  forms: VerbForm[];
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
}

export type BiRule = 'first-two' | 'strong';
