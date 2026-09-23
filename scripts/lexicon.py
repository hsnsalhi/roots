"""Verbs of the language beyond the Quran, gathered from several open sources
and attested source by source:

  ar  Arramooz Alwaseet verb dictionary (Taha Zerrouki & Mohamed Kebdani, GPL),
      read from its SQLite file: vocalised verbs with root, imperfect vowel and
      transitivity.
  wk  English Wiktionary (CC BY-SA), through the kaikki.org extract reduced by
      extract_wiktionary.py: vocalised verbs with form, root, non-past, verbal
      nouns and glosses.
  ls  Ibn Manzur, Lisan al-Arab (OpenITI, Shamela edition)
  qm  al-Firuzabadi, al-Qamus al-Muhit (OpenITI, Shamela edition)
  sh  al-Jawhari, al-Sihah (OpenITI, Shamela edition)

The three classical dictionaries are unvocalised.  Their entries are cut per
root, and every verb is looked for in the entry of its root with the citation
frames of Arabic lexicography (فعل يفعل, the distinctive derived stems, their
verbal nouns and participles).  A verb known from Arramooz or Wiktionary is
"attested" by a dictionary when such a frame matches; a verb that none of the
vocalised sources has is "discovered" only from unambiguous frames.
"""
from __future__ import annotations

import itertools
import json
import re
import sqlite3
from collections import defaultdict

from dicts import (_MARKERS, AR, clean_body, heading_variants, hn, resolve_roots,
                   strip_diacritics)

SOURCES = {"ar": "أرموز", "wk": "ويكاموس", "ls": "لسان العرب", "qm": "القاموس المحيط", "sh": "الصحاح",
           "ayn": "العين", "thd": "تهذيب اللغة", "mhk": "المحكم", "taj": "تاج العروس"}
DICTS = ("qm", "sh", "ayn", "mhk", "thd", "ls", "taj")   # citation preference: the concise ones first

SHADDA = "ّ"
FATHA, DAMMA, KASRA, SUKUN = "َ", "ُ", "ِ", "ْ"
_DIAC_KEEP_SHADDA = re.compile(r"[ؐ-ًؚ-ِْ-ٰٟۖ-ۭـ]")

IMPERFECT_VOWEL = {"ضمة": "u", "كسرة": "i", "فتحة": "a"}
WEAK = "وي"


# --------------------------------------------------------------------------
# normalisation
# --------------------------------------------------------------------------
def _madda(s: str) -> str:
    """آ is hamza+alif at the start of a word, a lengthened alif elsewhere (جَآءَ)."""
    return re.sub(r"(?<![ء-ي])آ", "أا", s).replace("آ", "ا")


def tnorm(s: str) -> str:
    """Text space used for matching: every hamza carrier but إ becomes أ."""
    s = _madda(s)
    return s.translate(str.maketrans({"ؤ": "أ", "ئ": "أ", "ء": "أ", "ٱ": "ا"}))


def ukey(vocalized: str) -> str:
    """Unvocalised key of a verb, spelling differences between sources removed."""
    s = re.sub("ى(?=[\u064b-\u0652\u06e6-\u06e8])", "ي", vocalized)
    s = strip_diacritics(s)
    s = tnorm(s).replace("إ", "أ")
    if s.endswith("ى"):
        s = s[:-1] + "ا"
    return s


def skeleton(vocalized: str) -> tuple[list[str], set[int]]:
    """Letters of a vocalised verb (hamza-normalised) and the indexes carrying a shadda."""
    s = _DIAC_KEEP_SHADDA.sub("", vocalized)
    s = tnorm(s).replace("إ", "أ")
    letters: list[str] = []
    doubled: set[int] = set()
    for ch in s:
        if ch == SHADDA:
            if letters:
                doubled.add(len(letters) - 1)
        else:
            letters.append(ch)
    return letters, doubled


# --------------------------------------------------------------------------
# verb form (وزن) of a vocalised verb
# --------------------------------------------------------------------------
def verb_form(vocalized: str, root: str) -> int:
    """Form number (1–10 for triliteral roots, 1–4 for quadriliteral), 0 if unknown."""
    L, dbl = skeleton(vocalized)
    n = len(L)
    last = n - 1
    if len(root) >= 4:
        if n == 4:
            return 1
        if n == 5 and L[0] == "ت":
            return 2
        if n == 6 and L[0] == "ا" and L[3] == "ن":
            return 3
        if n == 5 and L[0] == "ا" and last in dbl:
            return 4
        return 0
    if n >= 5 and L[0] == "ا" and L[1] == "س" and L[2] == "ت":
        return 10
    if n >= 4 and L[0] == "ا" and L[1] == "ن" and n <= 5:
        return 7
    if n >= 4 and L[0] == "ا" and L[2] == "ت" and n <= 5:
        return 8
    if n >= 4 and L[0] == "ا" and L[1] in "ضصظ" and L[2] == "ط" and n <= 5:
        return 8   # اضطرب, اصطبر, اضطرّ
    if n >= 4 and L[0] == "ا" and L[1] in "زذد" and L[2] == "د" and n <= 5:
        return 8   # ازدجر, ازداد
    if n == 4 and L[0] == "ا" and L[1] in "طظصضدذزثتو" and 1 in dbl:
        return 8   # اطّلع, ادّكر, اتّخذ, اتّعد, اثّغر
    if n == 4 and L[0] == "ا" and last in dbl:
        return 9
    if n == 5 and L[0] == "ت" and L[2] == "ا":
        return 6
    if n == 4 and L[0] == "ت" and 2 in dbl:
        return 5
    if L[0] == "أ" and (n == 4 or (n == 3 and last in dbl)) and root[0] != "أ":
        return 4
    if L[0] == "أ" and n == 4 and root[0] == "أ" and L[1] == "ا":
        return 4   # آمن, آخذ
    if L[0] == "أ" and n == 3 and L[2] in "ىا" and len(root) == 3 and root[1] == "أ" and root[2] in WEAK:
        return 4   # أرى
    if n == 4 and L[1] == "ا":
        return 3
    if n == 3 and L[1] == "ا" and last in dbl and root[1] == root[2]:
        return 3   # وادّ, مادّ
    if n == 3 and 1 in dbl:
        return 2
    if n == 3 or n == 2:
        return 1
    return 0


# --------------------------------------------------------------------------
# Arramooz
# --------------------------------------------------------------------------
def load_arramooz(path: str) -> dict[str, list[dict]]:
    """{root (corpus spelling, hamza = أ): [verb records]}."""
    con = sqlite3.connect(path)
    by_root: dict[str, dict[str, dict]] = defaultdict(dict)
    rows = con.execute("select vocalized, unvocalized, root, future_type, transitive from verbs")
    for voc, unv, root, fut, trans in rows:
        voc = (voc or "").strip()
        if not voc or not root:
            continue
        for r in root.split(";"):
            r = hn(r.strip()).replace("ا", "أ")
            if not r:
                continue
            rec = by_root[r].get(voc)
            if not rec:
                form = verb_form(voc, r)
                if not form:
                    continue
                rec = {"v": voc, "form": form, "imp": [], "tr": bool(trans), "src": "ar"}
                by_root[r][voc] = rec
            code = IMPERFECT_VOWEL.get(fut or "")
            if code and code not in rec["imp"]:
                rec["imp"].append(code)
    return {r: list(recs.values()) for r, recs in by_root.items()}


# --------------------------------------------------------------------------
# Wiktionary
# --------------------------------------------------------------------------
def _core_letters(L: list[str], dbl: set[int], form: int, quad: bool) -> list[list[str]]:
    """Strip the affixes of a form from a verb skeleton; returns candidate cores
    (several when the spelling is ambiguous, e.g. اتّصل → وصل / تصل / أصل)."""
    n = len(L)
    if quad:
        if form == 2 and L[0] == "ت":
            return [L[1:]]
        if form == 3 and n == 6 and L[0] == "ا" and L[3] == "ن":
            return [[L[1], L[2], L[4], L[5]]]
        if form == 4 and L[0] == "ا":
            return [L[1:]]
        return [L]
    if form in (1, 2):
        core = list(L)
    elif form == 3:
        core = [L[0]] + L[2:] if n >= 4 and L[1] == "ا" else list(L)
    elif form == 4:
        if L[0] == "أ" and n == 4 and L[1] == "ا":
            core = ["أ", L[2], L[3]]
        elif L[0] == "أ":
            core = L[1:]
        else:
            core = list(L)
    elif form == 5:
        core = L[1:] if L[0] == "ت" else list(L)
    elif form == 6:
        core = [L[1]] + L[3:] if n >= 5 and L[0] == "ت" and L[2] == "ا" else list(L)
    elif form == 7:
        core = L[2:] if L[:2] == ["ا", "ن"] else list(L)
    elif form == 8:
        if L[0] != "ا":
            core = list(L)
        elif n >= 4 and L[2] == "ت" and not (L[1] == "ت" and 1 in dbl):
            core = [L[1]] + L[3:]
        elif L[1] in "ضصظ" and L[2] == "ط":
            core = [L[1]] + L[3:]
        elif L[1] in "زذ" and L[2] == "د":
            core = [L[1]] + L[3:]
        elif L[1] in "طظصضدذزثتو" and 1 in dbl:
            if L[1] == "ت":
                return [["و"] + L[2:], ["ت"] + L[2:], ["ي"] + L[2:], ["أ"] + L[2:]]
            if L[1] == "د":
                return [["ذ"] + L[2:], ["د"] + L[2:]]
            core = [L[1]] + L[2:]
        else:
            core = L[1:]
    elif form == 9:
        core = L[1:] if L[0] == "ا" else list(L)
    elif form == 10:
        core = L[3:] if L[:3] == ["ا", "س", "ت"] else list(L)
    elif form == 11:
        core = [L[1], L[2], L[4]] if n == 5 else list(L)
    elif form == 12:
        core = [L[1], L[2], L[5]] if n == 6 else list(L)
    else:
        core = list(L)
    return [core]


def derive_roots(vocalized: str, form: int, quad: bool, nonpast: list[str]) -> list[str]:
    """Candidate roots of a vocalised verb whose form is known (weak letters
    resolved with the non-past when possible), most likely first."""
    L, dbl = skeleton(vocalized)
    out: list[str] = []
    np = "".join(strip_diacritics(x) for x in nonpast)
    npv = "".join(nonpast)
    for core in _core_letters(L, dbl, form, quad):
        core = list(core)
        # doubled root written with a shadda: مَدَّ, أَمَدَّ, اِمْتَدَّ …
        offset = len(L) - len(core)
        if len(core) == 2:
            core = [core[0], core[1], core[1]]
        elif len(core) == 3 and (len(L) - 1) in dbl and core[1] == core[2] and form in (2, 5):
            pass
        elif len(core) == 3 and form in (1, 4, 7, 8, 10) and (len(L) - 1) in dbl and offset >= 0:
            pass
        if quad or len(core) == 4:
            out.append("".join(core))
            continue
        if len(core) != 3:
            continue
        r1, r2, r3 = core
        mids = [r2]
        if r2 == "ا":
            if re.search(r"[ُ]و|و[ُ]", npv) or "و" in np:
                mids = ["و", "ي"]
            elif "ي" in np:
                mids = ["ي", "و"]
            else:
                mids = ["و", "ي"]
        lasts = [r3]
        if r3 in "ىا":
            if np.endswith("و") or re.search(r"و[ْ]?$", npv):
                lasts = ["و", "ي"]
            elif np.endswith("ي"):
                lasts = ["ي", "و"]
            else:
                lasts = ["ي", "و"] if r3 == "ى" else ["و", "ي"]
        for m in mids:
            for l in lasts:
                out.append(r1 + m + l)
    seen: list[str] = []
    for r in out:
        if r not in seen:
            seen.append(r)
    return seen


def load_wiktionary(path: str, known_roots: set[str]) -> dict[str, list[dict]]:
    """{root: [verb records]}; entries without an explicit root are attached to
    the derived root that exists in `known_roots` (corpus or Arramooz roots)."""
    by_root: dict[str, list[dict]] = defaultdict(list)
    with open(path, encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            form = d["form"]
            if not form or form > 12:
                continue
            roots = [hn(r.replace(" ", "")).replace("ا", "أ") for r in d["roots"]]
            if not roots:
                cands = derive_roots(d["v"], form, d["quad"], d["np"])
                known = [c for c in cands if c in known_roots]
                roots = known[:1] or cands[:1]
            imp = [x for x in d["nv"] if x in ("a", "i", "u")]
            if not imp:
                for npf in d["np"]:
                    m = re.search(r"([َُِ])[^َُِ]*[ُ]?$", npf[:-1])
                    if m:
                        imp.append({"َ": "a", "ُ": "u", "ِ": "i"}[m.group(1)])
                        break
            tr = True if d.get("tr") else (False if d.get("itr") else None)
            rec = {"v": d["v"], "form": form, "imp": imp, "tr": tr, "src": "wk",
                   "g": [g for g in d["g"][:2] if g], "word": d["word"], "vn": d["vn"][:3]}
            for r in roots:
                if 3 <= len(r) <= 4:
                    by_root[r].append(rec)
    return by_root


# --------------------------------------------------------------------------
# morphology: citation forms of every stem of a root (unvocalised skeletons
# in the matching text space, plus a vocalised perfect for display)
# --------------------------------------------------------------------------
def _fix_hamza(s: str) -> str:
    """Seat the hamza of a generated vocalised word (generation uses أ everywhere)."""
    s = re.sub(r"^أَا", "آ", s)
    s = re.sub(r"^أ" + FATHA + "ا", "آ", s)
    s = s.replace("اأ", "اء")
    s = re.sub(KASRA + "أ", KASRA + "ئ", s)
    s = re.sub("ي" + SUKUN + "?أ", "يء", s)
    s = re.sub(DAMMA + "أ", DAMMA + "ؤ", s)
    s = re.sub("و" + SUKUN + "?أ", "وء", s)
    return s


def _skel(vocalized: str) -> str:
    return tnorm(strip_diacritics(vocalized))


class Stems:
    """All citation skeletons of one form of a root."""

    def __init__(self) -> None:
        self.perf: list[str] = []      # 3ms perfect
        self.stem: list[str] = []      # perfect before a consonant suffix (كتبـت, قلـت, مددـت)
        self.impf: list[str] = []      # 3ms imperfect with ي
        self.masdar: list[str] = []    # verbal nouns (distinctive ones only)
        self.part: list[str] = []      # participles (distinctive ones only)
        self.weak_masdar: list[str] = []   # verbal nouns accepted only as weak evidence
        self.voc: str = ""             # vocalised perfect for display


def _v(*parts: str) -> str:
    return "".join(parts)


def stems_of(root: str, form: int) -> Stems | None:
    """Skeletons of `form` for `root` (corpus spelling), None if the form does not apply."""
    r = list(root)
    st = Stems()
    if len(r) == 4:
        r1, r2, r3, r4 = r
        if form == 1:
            st.voc = _v(r1, FATHA, r2, SUKUN, r3, FATHA, r4, FATHA)
            st.perf = [r1 + r2 + r3 + r4]
            st.stem = st.perf
            st.impf = ["ي" + r1 + r2 + r3 + r4]
            st.masdar = [r1 + r2 + r3 + r4 + "ة", r1 + r2 + r3 + "ا" + r4]
        elif form == 2:
            st.voc = _v("ت", FATHA, r1, FATHA, r2, SUKUN, r3, FATHA, r4, FATHA)
            st.perf = ["ت" + r1 + r2 + r3 + r4]
            st.stem = st.perf
            st.impf = ["يت" + r1 + r2 + r3 + r4]
            st.masdar = ["الت" + r1 + r2 + r3 + r4]
            st.part = ["مت" + r1 + r2 + r3 + r4]
        elif form == 3:
            st.voc = _v("ا", KASRA, r1, SUKUN, r2, FATHA, "ن", SUKUN, r3, FATHA, r4, FATHA)
            st.perf = ["ا" + r1 + r2 + "ن" + r3 + r4]
            st.stem = st.perf
            st.impf = ["ي" + r1 + r2 + "ن" + r3 + r4]
            st.masdar = ["ا" + r1 + r2 + "ن" + r3 + "ا" + r4]
        elif form == 4:
            st.voc = _v("ا", KASRA, r1, SUKUN, r2, FATHA, r3, FATHA, r4, SHADDA, FATHA)
            st.perf = ["ا" + r1 + r2 + r3 + r4]
            st.stem = ["ا" + r1 + r2 + r3 + r4 + r4]
            st.impf = ["ي" + r1 + r2 + r3 + r4]
            st.masdar = ["ا" + r1 + r2 + r3 + "ا" + r4]
            st.part = ["م" + r1 + r2 + r3 + r4]
        else:
            return None
        st.voc = _fix_hamza(st.voc)
        return st
    if len(r) != 3:
        return None
    r1, r2, r3 = r
    dbl = r2 == r3 and r2 not in WEAK
    hollow = r2 in WEAK and r3 not in WEAK
    defect = r3 in WEAK
    assim = r1 == "و"
    # the weak third radical of derived forms is written ى, or ا after a ي (أحيا, حيّا)
    Y = "ا" if r2 == "ي" else "ى"
    if form == 1:
        if dbl:
            st.perf = [r1 + r2]
            st.stem = [r1 + r2 + r2]
            st.impf = ["ي" + r1 + r2]
            st.voc = _v(r1, FATHA, r2, SHADDA, FATHA)
        elif hollow:
            st.perf = [r1 + "ا" + r3]
            st.stem = [r1 + r3]
            st.impf = ["ي" + r1 + "و" + r3, "ي" + r1 + "ي" + r3, "ي" + r1 + "ا" + r3]
            st.voc = _v(r1, FATHA, "ا", r3, FATHA)
        elif defect:
            st.perf = [r1 + r2 + "ى", r1 + r2 + "ا", r1 + r2 + "ي"]
            if r2 == r3:
                st.perf.append(r1 + r2)          # حَيَّ, عَيَّ
            st.stem = [r1 + r2 + r3, r1 + r2 + "ي"]
            st.impf = ["ي" + r1 + r2 + "ي", "ي" + r1 + r2 + "و", "ي" + r1 + r2 + "ى", "ي" + r1 + r2 + "ا"]
            if r2 == "أ":
                st.impf += ["ي" + r1 + "ى"]
            if assim:
                st.impf += ["ي" + r2 + "ي", "ي" + r2 + "ى"]
            st.voc = _v(r1, FATHA, r2, FATHA, "ى" if r3 == "ي" else "ا")
        else:
            st.perf = [r1 + r2 + r3]
            st.stem = st.perf
            st.impf = ["ي" + r1 + r2 + r3]
            if assim:
                st.impf += ["ي" + r2 + r3]
            if r1 == "ي":
                st.impf += ["يي" + r2 + r3]
            st.voc = _v(r1, FATHA, r2, FATHA, r3, FATHA)
        st.masdar = []
    elif form == 2:
        if defect:
            st.perf = [r1 + r2 + Y]
            st.stem = [r1 + r2 + "ي"]
            st.impf = ["ي" + r1 + r2 + "ي"]
            st.masdar = ["ت" + r1 + r2 + "ية"]
            st.voc = _v(r1, FATHA, r2, SHADDA, FATHA, Y)
        else:
            st.perf = [r1 + r2 + r3]
            st.stem = st.perf
            st.impf = ["ي" + r1 + r2 + r3]
            st.masdar = ["ت" + r1 + r2 + "ي" + r3, "ت" + r1 + r2 + r3 + "ة"]
            st.voc = _v(r1, FATHA, r2, SHADDA, FATHA, r3, FATHA)
    elif form == 3:
        if defect:
            st.perf = [r1 + "ا" + r2 + Y]
            st.stem = [r1 + "ا" + r2 + "ي"]
            st.impf = ["ي" + r1 + "ا" + r2 + "ي"]
            st.masdar = ["م" + r1 + "ا" + r2 + "اة"]
            st.voc = _v(r1, FATHA, "ا", r2, FATHA, Y)
        elif dbl:
            st.perf = [r1 + "ا" + r2]
            st.stem = [r1 + "ا" + r2 + r2]
            st.impf = ["ي" + r1 + "ا" + r2]
            st.masdar = ["م" + r1 + "ا" + r2 + "ة"]
            st.voc = _v(r1, FATHA, "ا", r2, SHADDA, FATHA)
        else:
            st.perf = [r1 + "ا" + r2 + r3]
            st.stem = st.perf
            st.impf = ["ي" + r1 + "ا" + r2 + r3]
            st.masdar = ["م" + r1 + "ا" + r2 + r3 + "ة"]
            st.voc = _v(r1, FATHA, "ا", r2, FATHA, r3, FATHA)
    elif form == 4:
        if dbl:
            st.perf = ["أ" + r1 + r2]
            st.stem = ["أ" + r1 + r2 + r2]
            st.impf = ["ي" + r1 + r2]
            st.masdar = ["إ" + r1 + r2 + "ا" + r2]
            st.voc = _v("أ", FATHA, r1, FATHA, r2, SHADDA, FATHA)
        elif hollow:
            st.perf = ["أ" + r1 + "ا" + r3]
            st.stem = ["أ" + r1 + r3]
            st.impf = ["ي" + r1 + "ي" + r3]
            st.masdar = ["إ" + r1 + "ا" + r3 + "ة"]
            st.voc = _v("أ", FATHA, r1, FATHA, "ا", r3, FATHA)
        elif defect:
            st.perf = ["أ" + r1 + r2 + Y]
            st.stem = ["أ" + r1 + r2 + "ي"]
            st.impf = ["ي" + r1 + r2 + "ي"]
            st.masdar = ["إ" + r1 + r2 + "اأ"]
            if r2 == "أ":
                st.perf += ["أ" + r1 + Y]
                st.impf += ["ي" + r1 + "ي"]
            st.voc = _v("أ", FATHA, r1, SUKUN, r2, FATHA, Y)
        else:
            pre = "أا" if r1 == "أ" else "أ" + r1
            st.perf = [pre + r2 + r3]
            st.stem = st.perf
            st.impf = ["ي" + r1 + r2 + r3]
            if r1 in "ويأ":
                st.impf = ["يو" + r2 + r3] if r1 in "وي" else ["يأ" + r2 + r3]
            st.masdar = ["إي" + r2 + "ا" + r3] if r1 in "وأي" else ["إ" + r1 + r2 + "ا" + r3]
            st.voc = _v("أ", FATHA, "ا", r2, FATHA, r3, FATHA) if r1 == "أ" else _v("أ", FATHA, r1, SUKUN, r2, FATHA, r3, FATHA)
    elif form == 5:
        if defect:
            st.perf = ["ت" + r1 + r2 + Y]
            st.stem = ["ت" + r1 + r2 + "ي"]
            st.impf = ["يت" + r1 + r2 + Y]
            st.masdar = ["الت" + r1 + r2 + "ي"]
            st.part = ["مت" + r1 + r2 + "ي", "مت" + r1 + r2]
            st.voc = _v("ت", FATHA, r1, FATHA, r2, SHADDA, FATHA, Y)
        elif dbl:
            st.perf = ["ت" + r1 + r2 + r2]
            st.stem = st.perf
            st.impf = ["يت" + r1 + r2 + r2]
            st.masdar = ["الت" + r1 + r2 + r2]
            st.part = ["مت" + r1 + r2 + r2]
            st.voc = _v("ت", FATHA, r1, FATHA, r2, SHADDA, FATHA, r2, FATHA)
        else:
            st.perf = ["ت" + r1 + r2 + r3]
            st.stem = st.perf
            st.impf = ["يت" + r1 + r2 + r3]
            st.masdar = ["الت" + r1 + r2 + r3]
            st.part = ["مت" + r1 + r2 + r3]
            st.voc = _v("ت", FATHA, r1, FATHA, r2, SHADDA, FATHA, r3, FATHA)
    elif form == 6:
        if defect:
            st.perf = ["ت" + r1 + "ا" + r2 + Y]
            st.stem = ["ت" + r1 + "ا" + r2 + "ي"]
            st.impf = ["يت" + r1 + "ا" + r2 + Y]
            st.masdar = ["الت" + r1 + "ا" + r2 + "ي"]
            st.part = ["مت" + r1 + "ا" + r2 + "ي", "مت" + r1 + "ا" + r2]
            st.voc = _v("ت", FATHA, r1, FATHA, "ا", r2, FATHA, Y)
        elif dbl:
            st.perf = ["ت" + r1 + "ا" + r2]
            st.stem = ["ت" + r1 + "ا" + r2 + r2]
            st.impf = ["يت" + r1 + "ا" + r2]
            st.masdar = ["الت" + r1 + "ا" + r2]
            st.part = ["مت" + r1 + "ا" + r2]
            st.voc = _v("ت", FATHA, r1, FATHA, "ا", r2, SHADDA, FATHA)
        else:
            st.perf = ["ت" + r1 + "ا" + r2 + r3]
            st.stem = st.perf
            st.impf = ["يت" + r1 + "ا" + r2 + r3]
            st.masdar = ["الت" + r1 + "ا" + r2 + r3]
            st.part = ["مت" + r1 + "ا" + r2 + r3]
            st.voc = _v("ت", FATHA, r1, FATHA, "ا", r2, FATHA, r3, FATHA)
    elif form == 7:
        if dbl:
            st.perf = ["ان" + r1 + r2]
            st.stem = ["ان" + r1 + r2 + r2]
            st.impf = ["ين" + r1 + r2]
            st.masdar = ["ان" + r1 + r2 + "ا" + r2]
            st.part = ["من" + r1 + r2]
            st.voc = _v("ا", KASRA, "ن", SUKUN, r1, FATHA, r2, SHADDA, FATHA)
        elif hollow:
            st.perf = ["ان" + r1 + "ا" + r3]
            st.stem = ["ان" + r1 + r3]
            st.impf = ["ين" + r1 + "ا" + r3]
            st.masdar = ["ان" + r1 + "يا" + r3]
            st.part = ["من" + r1 + "ا" + r3]
            st.voc = _v("ا", KASRA, "ن", SUKUN, r1, FATHA, "ا", r3, FATHA)
        elif defect:
            st.perf = ["ان" + r1 + r2 + Y]
            st.stem = ["ان" + r1 + r2 + "ي"]
            st.impf = ["ين" + r1 + r2 + "ي"]
            st.masdar = ["ان" + r1 + r2 + "اأ"]
            st.part = ["من" + r1 + r2 + "ي", "من" + r1 + r2]
            st.voc = _v("ا", KASRA, "ن", SUKUN, r1, FATHA, r2, FATHA, Y)
        else:
            st.perf = ["ان" + r1 + r2 + r3]
            st.stem = st.perf
            st.impf = ["ين" + r1 + r2 + r3]
            st.masdar = ["ان" + r1 + r2 + "ا" + r3]
            st.part = ["من" + r1 + r2 + r3]
            st.voc = _v("ا", KASRA, "ن", SUKUN, r1, FATHA, r2, FATHA, r3, FATHA)
    elif form == 8:
        # infixed ت with its assimilations: اطّلع، اضطرب، ازدجر، ادّكر، اتّبع، اتّصل، ائتمن
        if r1 == "ط":
            infix = ["ط"]
            vinf = "ط" + SHADDA + FATHA
        elif r1 in "ضصظ":
            infix = [r1 + "ط"] + (["ظ"] if r1 == "ظ" else [])
            vinf = r1 + SUKUN + "ط" + FATHA
        elif r1 == "ز":
            infix = ["زد"]
            vinf = "ز" + SUKUN + "د" + FATHA
        elif r1 == "ذ":
            infix = ["ذ", "ذد", "د"]
            vinf = "ذ" + SHADDA + FATHA
        elif r1 == "د":
            infix = ["د"]
            vinf = "د" + SHADDA + FATHA
        elif r1 in "توي":
            infix = ["ت"]
            vinf = "ت" + SHADDA + FATHA
        elif r1 == "ث":
            infix = ["ث", "ثت"]
            vinf = "ث" + SHADDA + FATHA
        elif r1 == "أ":
            infix = ["أت", "ت"]
            vinf = "أ" + SUKUN + "ت" + FATHA
        else:
            infix = [r1 + "ت"]
            vinf = r1 + SUKUN + "ت" + FATHA
        if dbl:
            st.perf = ["ا" + i + r2 for i in infix]
            st.stem = ["ا" + i + r2 + r2 for i in infix]
            st.impf = ["ي" + i + r2 for i in infix]
            st.masdar = ["ا" + i + r2 + "ا" + r2 for i in infix]
            st.part = ["م" + i + r2 for i in infix]
            st.voc = _v("ا", KASRA, vinf, r2, SHADDA, FATHA)
        elif hollow:
            st.perf = ["ا" + i + "ا" + r3 for i in infix]
            st.stem = ["ا" + i + r3 for i in infix]
            st.impf = ["ي" + i + "ا" + r3 for i in infix]
            st.masdar = ["ا" + i + "يا" + r3 for i in infix]
            st.part = ["م" + i + "ا" + r3 for i in infix]
            st.voc = _v("ا", KASRA, vinf, "ا", r3, FATHA)
        elif defect:
            st.perf = ["ا" + i + r2 + Y for i in infix]
            st.stem = ["ا" + i + r2 + "ي" for i in infix]
            st.impf = ["ي" + i + r2 + "ي" for i in infix]
            st.masdar = ["ا" + i + r2 + "اأ" for i in infix]
            st.part = ["م" + i + r2 + "ي" for i in infix] + ["م" + i + r2 for i in infix]
            st.voc = _v("ا", KASRA, vinf, r2, FATHA, Y)
        else:
            st.perf = ["ا" + i + r2 + r3 for i in infix]
            st.stem = st.perf
            st.impf = ["ي" + i + r2 + r3 for i in infix]
            st.masdar = ["ا" + i + r2 + "ا" + r3 for i in infix]
            st.part = ["م" + i + r2 + r3 for i in infix]
            st.voc = _v("ا", KASRA, vinf, r2, FATHA, r3, FATHA)
    elif form == 9:
        if defect or dbl:
            return None
        st.perf = ["ا" + r1 + r2 + r3]
        st.stem = ["ا" + r1 + r2 + r3 + r3]
        st.impf = []
        st.masdar = []
        st.weak_masdar = ["ا" + r1 + r2 + "ا" + r3]
        st.voc = _v("ا", KASRA, r1, SUKUN, r2, FATHA, r3, SHADDA, FATHA)
    elif form == 10:
        if dbl:
            st.perf = ["است" + r1 + r2]
            st.stem = ["است" + r1 + r2 + r2]
            st.impf = ["يست" + r1 + r2]
            st.masdar = ["است" + r1 + r2 + "ا" + r2]
            st.part = ["مست" + r1 + r2]
            st.voc = _v("ا", KASRA, "س", SUKUN, "ت", FATHA, r1, FATHA, r2, SHADDA, FATHA)
        elif hollow:
            st.perf = ["است" + r1 + "ا" + r3]
            st.stem = ["است" + r1 + r3]
            st.impf = ["يست" + r1 + "ي" + r3]
            st.masdar = ["است" + r1 + "ا" + r3 + "ة"]
            st.part = ["مست" + r1 + "ي" + r3]
            st.voc = _v("ا", KASRA, "س", SUKUN, "ت", FATHA, r1, FATHA, "ا", r3, FATHA)
        elif defect:
            st.perf = ["است" + r1 + r2 + Y]
            st.stem = ["است" + r1 + r2 + "ي"]
            st.impf = ["يست" + r1 + r2 + "ي"]
            st.masdar = ["است" + r1 + r2 + "اأ"]
            st.part = ["مست" + r1 + r2 + "ي", "مست" + r1 + r2]
            st.voc = _v("ا", KASRA, "س", SUKUN, "ت", FATHA, r1, SUKUN, r2, FATHA, Y)
        else:
            st.perf = ["است" + r1 + r2 + r3]
            st.stem = st.perf
            st.impf = ["يست" + r1 + r2 + r3]
            st.masdar = ["است" + r1 + r2 + "ا" + r3]
            st.part = ["مست" + r1 + r2 + r3]
            st.voc = _v("ا", KASRA, "س", SUKUN, "ت", FATHA, r1, SUKUN, r2, FATHA, r3, FATHA)
    else:
        return None
    st.voc = _fix_hamza(st.voc)
    return st


# --------------------------------------------------------------------------
# evidence patterns
# --------------------------------------------------------------------------
_B = r"(?<![ء-ي])"
_E = r"(?![ء-ي])"
_PFX_PERF = r"(?:و|ف|ك|ل|ول|فل|وك|فك)?"
_SUF_PERF = (r"(?:ت|تا|وا|تم|تن|ن|نا|ه|ها|هم|هن|ك|كم|كن|ني|ته|تها|تهم|تك|تني|تاه|تاها|توا|توه|توها"
             r"|ناه|ناها|ناهم|وه|وها|وهم|وني|اه|اها|هما|تموه|تموها|تمونا|ا)?")
_SUF_STEM = r"(?:ت|تا|تم|تن|تما|ن|نا)(?:ه|ها|هم|هن|ك|كم|ني|نا|وه|وها)?"
_PFX_IMPF = r"(?:و|ف|ل|س|ول|فل|وس|فس|لا|ولا|فلا|أ|أف|أو)?"
_SUF_IMPF = r"(?:ه|ها|هم|هن|ك|كم|كن|ني|نا|ون|ان|وا|ونه|ونها|ونهم|انه|انها|وه|وها|وهم|ونك|ونني|ن|هما)?"
_PFX_NOUN = r"(?:ال|وال|فال|كال|بال|لل|ولل|فلل|و|ف|ك|ب|ل|وب|فب|وك|فك|ول|فل)?"
_SUF_NOUN = r"(?:ا|ة|ه|ها|هم|هن|ك|كم|ي|ات|ين|ون|ان|تا|تان|تين|ته|تها|تهم|تك|هما|كما|ي|ين)?"
_GAP = r"(?:[\s،:؛.,]+[^\s،:؛.,]+){0,3}?[\s،:؛.,]+"


def _alt(skels: list[str]) -> str:
    return "(?:" + "|".join(re.escape(s) for s in sorted(set(skels), key=len, reverse=True)) + ")"


class Evidence:
    """Compiled evidence regexes of one form of one root."""

    def __init__(self, form: int, st: Stems, unique: set[str], pair_ok: bool) -> None:
        self.form = form
        self.st = st
        strong: list[str] = []
        weak: list[str] = []
        pairs: list[str] = []
        u_perf = [s for s in st.perf if s in unique]
        u_impf = [s for s in st.impf if s in unique]
        u_stem = [s for s in st.stem if s in unique]
        u_stem_t = [s for s in st.stem if s not in unique and s + "ت" in unique]
        if u_perf:
            strong.append(_B + _PFX_PERF + _alt(u_perf) + _SUF_PERF + _E)
        if u_stem:
            strong.append(_B + _PFX_PERF + _alt(u_stem) + _SUF_STEM + _E)
        if u_stem_t:
            strong.append(_B + _PFX_PERF + _alt(u_stem_t) + r"(?:ت|تا|تم|تن|تما)(?:ه|ها|هم|هن|ك|كم|ني|نا|وه|وها)?" + _E)
        if st.weak_masdar:
            weak.append(_B + _PFX_NOUN + _alt(st.weak_masdar) + _SUF_NOUN + _E)
        if u_impf:
            strong.append(_B + _PFX_IMPF + _alt(u_impf) + _SUF_IMPF + _E)
        if st.masdar:
            strong.append(_B + _PFX_NOUN + _alt(st.masdar) + _SUF_NOUN + _E)
        if st.part:
            strong.append(_B + _PFX_NOUN + _alt(st.part) + _SUF_NOUN + _E)
        if st.perf and st.impf and pair_ok:
            pairs.append(_B + _PFX_PERF + _alt(st.perf) + _SUF_PERF + _GAP
                         + _PFX_IMPF + _alt(st.impf) + _SUF_IMPF + _E)
        if form == 1 and st.perf:
            # فعل … فعلاً : the perfect followed by its own مصدر with tanwin
            weak.append(_B + _PFX_PERF + _alt(st.perf) + _SUF_PERF + _GAP + _alt([s + "ا" for s in st.stem]) + _E)
        if [s for s in st.perf if s not in unique] and form != 1:
            weak.append(_B + _PFX_PERF + _alt(st.perf) + r"(?:ه|ها|هم|هن|ني|نا|ك|كم|وا|تم|تا)" + _E)
        if [s for s in st.stem if s not in unique] and form != 1:
            weak.append(_B + _PFX_PERF + _alt(st.stem) + _SUF_STEM + _E)
        self.strong = [re.compile(p) for p in strong]
        self.pairs = [re.compile(p) for p in pairs]
        self.weak = [re.compile(p) for p in weak]

    def search(self, text: str, discover: bool):
        for rx in self.strong:
            m = rx.search(text)
            if m:
                return m
        for rx in self.pairs:
            m = rx.search(text)
            if m:
                return m
        if not discover:
            for rx in self.weak:
                m = rx.search(text)
                if m:
                    return m
        return None


def evidence_for_root(root: str) -> dict[int, Evidence]:
    """Evidence regexes for every form of a root; skeletons shared by several
    forms (or by the 2nd/1st-person imperfect and the elative) are not accepted
    alone."""
    forms = range(1, 5) if len(root) == 4 else range(1, 11)
    stems = {f: stems_of(root, f) for f in forms}
    stems = {f: s for f, s in stems.items() if s}
    pool: dict[str, set[int]] = defaultdict(set)
    for f, s in stems.items():
        for sk in s.perf + s.impf + s.masdar + s.part:
            pool[sk].add(f)
        for sk in s.stem:
            pool[sk + "ت"].add(f)
            pool[sk].add(f)
        for sk in s.impf:            # 2nd/1st person imperfects as decoys
            for p in ("ت", "أ", "ن"):
                pool[p + sk[1:]].add(-f)
    if len(root) == 3:
        r1, r2, r3 = root
        pool["أ" + root].add(-100)                     # elative أفعل / 1st person imperfect
        if r2 in WEAK:
            pool["أ" + r1 + r3].add(-100)
        # active participle of form I (فاعل, قائل, رامٍ) = perfect of form III
        for ap in (r1 + "ا" + r2 + r3, r1 + "اأ" + r3, r1 + "ا" + r2 + "ي", r1 + "ا" + r2):
            pool[ap].add(-101)
        pool["م" + r1 + r2 + "و" + r3].add(-102)          # passive participle مفعول
        pool["ا" + root].add(-103)                        # imperative of form I (اكتب = افعلّ)
        if r2 == r3:                                      # مادّ/يمادّ look like hollow ماد/يماد
            for sk in (r1 + "ا" + r2, "ي" + r1 + "ا" + r2, "ي" + r1 + "و" + r2, "ي" + r1 + "ي" + r2):
                pool[sk].add(-104)
        if r2 in WEAK:                                    # قوّل is written like the noun قول
            pool[root].add(-105)
            pool["م" + r1 + "ا" + r3].add(-108)               # مُطَاع (IV passive participle) = مطّاع
        pool["م" + r1 + r2 + r3].add(-107)                # مَفْعَل nouns of place/time/instrument = مطّلع, متّبع
        if r2 == r3:
            pool["م" + r1 + r2].add(-107)                 # مَظِنّة, مَقَرّ
    if len(root) == 4:
        pool["م" + root].add(-106)                        # participle of the plain quadriliteral
    unique = {sk for sk, fs in pool.items() if len(fs) == 1 and next(iter(fs)) > 0}
    pair_keys: dict[tuple[str, str], set[int]] = defaultdict(set)
    for f, s in stems.items():
        for a in s.perf:
            for b in s.impf:
                pair_keys[(a, b)].add(f)
    out: dict[int, Evidence] = {}
    for f, s in stems.items():
        pair_ok = f == 1 or all(len(pair_keys[(a, b)]) == 1 for a in s.perf for b in s.impf)
        out[f] = Evidence(f, s, unique, pair_ok)
    return out


# --------------------------------------------------------------------------
# classical dictionaries: per-root entries
# --------------------------------------------------------------------------
def _after_header(txt: str) -> str:
    return txt.split("#META#Header#End#", 1)[1] if "#META#Header#End#" in txt else txt


def parse_lisan(path: str) -> list[tuple[str, str, str]]:
    """(heading, body, fasl|bab) for every entry of Lisan al-Arab (Shamela).
    Entries are headed '### $ root:'; a few are plain paragraphs '# root: …',
    accepted when the root fits the current chapter and section."""
    txt = _after_header(open(path, encoding="utf-8").read())
    bab = fasl = ""
    out = []
    cur_head = None
    cur: list[str] = []

    def flush():
        if cur_head is not None and cur:
            out.append((cur_head, "\n".join(cur), fasl + "|" + bab))

    for ln in txt.split("\n"):
        m = re.match(r"^### \|\|? *(?:حرف\s+)?(.+?)\s*$", ln)
        if m and not ln.startswith("### $"):
            name = m.group(1)
            flush()
            cur_head, cur = None, []
            if name.startswith("فصل"):
                fasl = section_letter(name[3:].strip())
            elif len(name) <= 12:
                letter = section_letter(name)
                if letter:
                    bab = letter
            continue
        m = re.match(r"^### \$ *([%s]{1,12}):(.*)$" % AR, ln) or re.match(r"^# ([%s]{3,4}):( .*)$" % AR, ln)
        if m and (ln.startswith("### $") or (fasl and bab and fits_section(hn(m.group(1)), fasl, bab))):
            flush()
            cur_head = m.group(1).strip()
            cur = [m.group(2)]
            continue
        if ln.startswith("### "):
            flush()
            cur_head, cur = None, []
            continue
        if cur_head is not None:
            cur.append(ln)
    flush()
    return out


def parse_sihah(path: str) -> list[tuple[str, str, str]]:
    """(heading, body, fasl|bab) for every '[root]' entry of al-Sihah (Shamela)."""
    txt = _after_header(open(path, encoding="utf-8").read())
    bab = fasl = ""
    out = []
    cur_head = None
    cur: list[str] = []

    def flush():
        if cur_head is not None and cur:
            b = bab
            if not b and cur_head:
                last = hn(cur_head)[-1]
                b = "وي" if last in "وياى" else last
            out.append((cur_head, "\n".join(cur), fasl + "|" + b))

    glue = False
    for ln in txt.split("\n"):
        m = re.match(r"^### \| *\[ *([%s ]{1,12})(?:\]|\s*\(\d+\)\s*\]|$)" % AR, ln)
        if m:
            flush()
            cur_head, cur, glue = m.group(1).replace(" ", ""), [], False
            continue
        m = re.match(r"^### \| *(باب|فصل)\s+(.+?)\s*$", ln)
        if m:
            flush()
            cur_head, cur, glue = None, [], False
            letter = section_letter(m.group(2))
            if m.group(1) == "باب":
                bab = letter
            else:
                if letter and fasl and _ORDER.get(letter, 0) <= _ORDER.get(fasl, 0):
                    bab = ""          # the sections started over: a new chapter without its heading
                fasl = letter
            continue
        m = re.match(r"^### \| *([%s]{1,12}(?: [%s]{1,12})?)\s*$" % (AR, AR), ln)
        if m and cur_head is not None:
            # a running page header pasted into the entry, splitting a word:
            # "ومع" / "### | قد" / "# ا، أي جلس" → ومعقدا، أي جلس
            if cur:
                cur[-1] = cur[-1].rstrip() + m.group(1)
            else:
                cur.append("# " + m.group(1))
            glue = True
            continue
        if ln.startswith("### "):
            flush()
            cur_head, cur, glue = None, [], False
            continue
        if cur_head is not None:
            if glue:
                cur[-1] += re.sub(r"^(?:# |~~)", "", ln)
                glue = False
            else:
                cur.append(ln)
    flush()
    return out


_QUAL = {"المعجمة": {"الدال": "ذ", "الحاء": "خ", "الراء": "ز", "السين": "ش", "الصاد": "ض", "الطاء": "ظ", "العين": "غ"}}
_BAB = {"الهمزة": "أ", "الالف": "أ", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "الجيم": "ج", "الحاء": "ح", "الخاء": "خ",
        "الدال": "د", "الذال": "ذ", "الراء": "ر", "الزاي": "ز", "السين": "س", "الشين": "ش", "الصاد": "ص",
        "الضاد": "ض", "الطاء": "ط", "الظاء": "ظ", "العين": "ع", "الغين": "غ", "الفاء": "ف", "القاف": "ق",
        "الكاف": "ك", "اللام": "ل", "الميم": "م", "النون": "ن", "الهاء": "ه", "الواو": "و", "الياء": "ي",
        "الألف": "أ", "الألف اللينة": "ا", "الواو والياء": "وي", "الزاى": "ز", "الزاء": "ز", "الظار": "ظ", "و- ي": "وي", "و-ي": "وي"}


_ORDER = {c: i for i, c in enumerate("أبتثجحخدذرزسشصضطظعغفقكلمنهوي")}


def section_letter(name: str) -> str:
    """Letter(s) of a باب/فصل/حرف heading name such as 'الدال المعجمة' or 'و- ي'."""
    name = re.sub(r"\s*(ms\d+|PageV\d+P\d+|:)\s*", " ", name).strip()
    if name in _BAB:
        return _BAB[name]
    if len(name) == 1 and name in "ءأبتثجحخدذرزسشصضطظعغفقكلمنهويا":
        return "أ" if name == "ء" else name
    parts = name.split()
    if not parts:
        return ""
    if parts[0] == "الواو" and "والياء" in parts:
        return "وي"
    base = _BAB.get(parts[0], "")
    if len(parts) > 1 and parts[1] in _QUAL and parts[0] in _QUAL[parts[1]]:
        return _QUAL[parts[1]][parts[0]]
    if base == "ا":
        return "أ"
    return base


def fits_section(root: str, fasl: str, bab: str) -> bool:
    """Does a root (corpus spelling) belong to the chapter (last radical) and
    section (first radical) it was found in?"""
    n = hn(root)
    if fasl and n[0] != fasl:
        return False
    if not bab:
        return True
    if bab == "وي":
        return n[-1] in "ويأ"
    return n[-1] == bab


def parse_qamus(path: str) -> list[tuple[str, str, str]]:
    """(headword, body, fasl+bab) for every • entry of al-Qamus al-Muhit (Shamela)."""
    txt = _after_header(open(path, encoding="utf-8").read())
    bab = fasl = ""
    out = []
    cur_head = None
    cur: list[str] = []

    out_section: list[str] = []

    def flush():
        if cur_head is not None and cur:
            out.append((cur_head, "\n".join(cur), out_section[-1] if out_section else fasl + "|" + bab))

    for ln in txt.split("\n"):
        m = re.match(r"^### \| *\"?\*?(باب|فصل)\s+(?:ms\d+\s+)?(.+?)\s*$", ln)
        if m:
            flush()
            cur_head, cur = None, []
            name = m.group(2).strip()
            code = section_letter(name)
            if m.group(1) == "باب":
                bab = code
            else:
                fasl = code
            continue
        if ln.startswith("### "):
            flush()
            cur_head, cur = None, []
            continue
        m = re.match(r"^# •\s*(.*)$", ln)
        if m:
            flush()
            rest = m.group(1)
            mark = re.match(r"^(و|ي)\s*:\s*(.*)$", rest)   # باب الواو والياء: و/ي tells the last radical
            bab_here = bab
            if mark:
                bab_here, rest = mark.group(1), mark.group(2)
            hw = re.match(r"([%s]+)" % AR, rest)
            cur_head = hw.group(1) if hw else ""
            cur = [rest]
            section_here = fasl + "|" + bab_here
            out_section.append(section_here)
            continue
        if cur_head is not None:
            cur.append(ln)
    flush()
    return out


def _lemma_score(body: str, root: str, lemma_index) -> int:
    plain = strip_diacritics(body)
    return sum(plain.count(lem) for lem in lemma_index.get(root, []) if len(lem) >= 3)


def _qamus_roots(hw: str, body: str, section: str, rootsN: dict[str, str], lemma_index) -> list[str]:
    fasl, bab = section.split("|")
    if not fasl or not bab or bab == "ا":
        return []
    hw = hn(hw)
    tries = [hw]
    for pre in ("ال", "و", "ف", "ك", "ب", "ل"):
        if hw.startswith(pre) and len(hw) - len(pre) >= 2:
            tries.append(hw[len(pre):])
    more = []
    for t in tries:
        for suf in ("ه", "ها", "هم", "ة", "ت", "وا", "ني", "ك", "ان", "ون", "ين", "ات", "تا"):
            if t.endswith(suf) and len(t) - len(suf) >= 2:
                more.append(t[:-len(suf)])
    tries += more

    def fits(r: str) -> bool:
        n = hn(r)
        return n[0] == fasl and (n[-1] in bab if len(bab) > 1 else n[-1] == bab)

    for t in tries:
        cands = [rootsN[v] for v in heading_variants(t, surface=True) if v in rootsN and fits(rootsN[v])]
        if cands:
            break
    else:
        cands = []
    if not cands:
        letters = set(hw)
        cands = [r for n, r in rootsN.items() if fits(r) and len(n) == 3 and n[1] in letters and n[1] not in "او"]
        cands = [r for r in cands if _lemma_score(body, r, lemma_index) >= 2]
        if len(cands) > 1:
            return []
    if len(cands) <= 1:
        return cands
    scored = sorted(((_lemma_score(body, r, lemma_index), r) for r in cands), reverse=True)
    top = scored[0][0]
    chosen = [scored[0][1]]
    for hits, r in scored[1:]:
        if hits >= 2 and hits >= 0.3 * top:
            chosen.append(r)
    return chosen


def load_classical(paths: dict[str, str], roots: set[str], lemma_index, freq,
                   heads: dict[str, set[str]] | None = None) -> dict[str, dict[str, str]]:
    """{code: {root: cleaned entry text}} for the dictionaries in `paths`; when
    `heads` is given, heads[code] receives every root that has an entry heading
    (normalised), whether or not it is a Quranic root."""
    from lexica import choose_permutation, norm_root as lex_norm, parse_ayn, parse_muhkam, parse_tahdhib, parse_taj
    rootsN = {hn(r): r for r in roots}
    known = set(rootsN)
    result: dict[str, dict[str, str]] = {}
    parsers = (("ls", parse_lisan), ("qm", parse_qamus), ("sh", parse_sihah),
               ("ayn", lambda p: parse_ayn(p)[0]), ("thd", lambda p: parse_tahdhib(p)[0]),
               ("mhk", parse_muhkam), ("taj", parse_taj))
    for code, parser in parsers:
        if code not in paths:
            continue
        per_root: dict[str, list[str]] = defaultdict(list)
        head_set: set[str] = set()
        for h, body, section in parser(paths[code]):
            if code == "mhk" and h.startswith("*"):
                h = choose_permutation(h, body, rootsN, lemma_index, known)
            if code == "qm":
                targets = _qamus_roots(h, body, section, rootsN, lemma_index)
            else:
                if not re.fullmatch(r"[%s]{2,6}" % AR, h):
                    continue
                head_set.add(lex_norm(h))
                targets = resolve_roots(h, body, rootsN, lemma_index, freq)
                fasl, bab = section.split("|") if "|" in section and code in ("ls", "sh", "taj") else ("", "")
                if code == "sh":
                    fasl = ""          # the Shamela Sihah lacks some section headings
                # the chapter headings of the Shamela texts are incomplete: the section is
                # trusted only when the entry's own heading agrees with it
                hh = hn(h)
                if bab and bab != "ا" and fits_section(hh, fasl, bab) and len(hh) >= 3:
                    targets = [r for r in targets if fits_section(r, fasl, bab)]
            if not targets:
                continue
            cleaned = clean_body(body, "shamela")
            if len(cleaned) < 15:
                continue
            for r in targets:
                per_root[r].append(cleaned)
        result[code] = {r: "\n\n".join(dict.fromkeys(parts)) for r, parts in per_root.items()}
        if heads is not None:
            heads[code] = head_set
    return result


def khalil_verdicts(ayn_path: str, tahdhib_path: str | None = None) -> dict[str, dict[str, str]]:
    """{chapter key (sorted distinct letters): {root: "used" | "unused"}} from the
    chapter headings of the Ayn, completed by the Tahdhib's «مستعمل» lists."""
    from lexica import parse_ayn, parse_tahdhib
    _, v = parse_ayn(ayn_path)
    out: dict[str, dict[str, str]] = {k: dict(d) for k, d in v.items()}
    if tahdhib_path:
        _, v2 = parse_tahdhib(tahdhib_path)
        for k, d in v2.items():
            for r, verdict in d.items():
                out.setdefault(k, {}).setdefault(r, verdict)
    return out


# --------------------------------------------------------------------------
# attestation, discovery and merge
# --------------------------------------------------------------------------
def _snippet(text: str, start: int, end: int, width: int = 150) -> str:
    a = max(0, start - 60)
    b = min(len(text), end + width)
    if a > 0:
        cut = text.rfind(" ", a, start)
        a = cut + 1 if cut != -1 else a
    if b < len(text):
        cut = text.find(" ", b - 20, b + 30)
        b = cut if cut != -1 else b
    s = text[a:b].replace("\n", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return ("…" if a > 0 else "") + s + ("…" if b < len(text) else "")


_LEM_PFX = ("ي", "ت", "ن", "أ", "ٱ", "ا")
_LEM_SUF = ("تم", "تا", "وا", "ون", "ين", "ان", "نا", "ت", "ن", "ا", "ي", "و", "ه", "ها", "هم", "ك")


def _common_prefix(a: str, b: str) -> int:
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def lemma_fits(lem: str, st: Stems) -> bool:
    """Is a corpus lemma (possibly an inflected form) a form of these stems?"""
    ks = ukey(lem)
    perf = {ukey(p) for p in st.perf}
    stem = {ukey(p) for p in st.stem}
    impf = {ukey(p) for p in st.impf}
    for p in list(impf):                      # jussive: يقل, يرم, يغتب, يستحي
        if p[-1] in "يوا":
            impf.add(p[:-1])
        if len(p) >= 4 and p[-2] in "اوي":
            impf.add(p[:-2] + p[-1])
    for p in list(perf):                      # 3rd fem. sing. of a weak-final verb: رمت, تخلت
        if p[-1] in "يوا":
            stem.add(p[:-1])
    if st.perf and st.perf[0][0] == "ت" and len(st.perf[0]) >= 4:   # assimilated يسّمّع, يدّارك
        impf.add("ي" + st.perf[0][1:])
    bare = {p[1:] for p in impf}
    if ks in perf or ks in impf or ks in stem:
        return True
    for suf in _LEM_SUF:
        if ks.endswith(suf) and len(ks) > len(suf) + 1:
            base = ks[:-len(suf)]
            if base in perf or base in stem or base in impf:
                return True
            for pre in _LEM_PFX:
                if base.startswith(pre) and base[1:] in bare:
                    return True
    for pre in _LEM_PFX:
        if ks.startswith(pre) and ks[1:] in bare:
            return True
    return False


def is_citation(lem: str) -> bool:
    """Does a corpus lemma look like a 3rd person masculine singular active perfect?"""
    return bool(re.search("[" + FATHA + "ىا]$", lem)) and (len(lem) < 2 or lem[1] != DAMMA) and not lem.startswith(("ي", "ت", "ن"))


def _form_of_corpus(lem: str, form: int, root: str) -> int:
    """Corpus VF, or a form derived from the lemma when the corpus gives none for
    quadriliteral roots."""
    if len(root) == 4:
        f = verb_form(lem, root)
        return f or form
    return form


def build_lexicon(root: str, quran_verbs: list[tuple[str, int]], arr: list[dict], wik: list[dict],
                  texts: dict[str, str]) -> list[dict]:
    """Merged verb list of a root.  Each record:
    v (vocalised lemma), form, imp (imperfect vowels), tr (transitive or None),
    q (corpus lemma when the verb occurs in the Quran), src (source codes),
    g (Wiktionary glosses), alt (other vocalisations), cite ([source, text]),
    uv (True when the vocalisation is unknown: a discovered form-I verb)."""
    merged: dict[tuple[str, int], dict] = {}
    order: list[tuple[str, int]] = []

    def key_of(v: str, form: int) -> tuple[str, int]:
        return (ukey(v), form)

    def add(v: str, form: int, src: str, **extra) -> dict:
        k = key_of(v, form)
        rec = merged.get(k)
        if not rec:
            rec = {"v": v, "u": k[0], "form": form, "imp": [], "tr": None, "q": None, "src": [], "alt": []}
            merged[k] = rec
            order.append(k)
        if src not in rec["src"]:
            rec["src"].append(src)
        if src in ("ar", "wk") and strip_diacritics(v) == strip_diacritics(rec["v"]) and v != rec["v"] and v not in rec["alt"] and not rec.get("uv"):
            if len(v) > len(rec["v"]):
                rec["alt"].append(rec["v"])
                rec["v"] = v
            else:
                rec["alt"].append(v)
        for code in extra.get("imp", []):
            if code not in rec["imp"]:
                rec["imp"].append(code)
        if extra.get("tr") is not None and rec["tr"] is None:
            rec["tr"] = extra["tr"]
        if extra.get("g") and not rec.get("g"):
            rec["g"] = extra["g"]
        if extra.get("word") and not rec.get("word"):
            rec["word"] = extra["word"]
        if extra.get("vn") and not rec.get("vn"):
            rec["vn"] = extra["vn"]
        return rec

    for r in arr:
        add(r["v"], r["form"], "ar", imp=r["imp"], tr=r["tr"])
    for r in wik:
        add(r["v"], r["form"], "wk", imp=r["imp"], tr=r["tr"], g=r["g"], word=r["word"], vn=r["vn"])
    ev = evidence_for_root(root)
    # corpus verbs: the corpus "lemma" is often an inflected form (يُحْمَدُ, مَلَكَتْ);
    # it is matched to the record of its form whose citation skeleton it fits
    for lem, form in quran_verbs:
        form = _form_of_corpus(lem, form, root)
        k = key_of(lem, form)
        rec = merged.get(k)
        if (rec and not rec.get("uv") and strip_diacritics(lem) == strip_diacritics(rec["v"]) and lem != rec["v"]
                and is_citation(lem) and lem.count(FATHA) + lem.count(KASRA) + lem.count(DAMMA) >= rec["v"].count(FATHA) + rec["v"].count(KASRA) + rec["v"].count(DAMMA) - 1):
            if rec["v"] not in rec["alt"]:
                rec["alt"].append(rec["v"])
            rec["v"] = lem
            rec["alt"] = [a for a in rec["alt"] if a != lem]
        if not rec:
            same = [merged[kk] for kk in order if kk[1] == form]
            st = ev[form].st if form in ev else None
            if same and st and lemma_fits(lem, st):
                rec = same[0]
                if len(same) > 1:
                    ks = ukey(lem)
                    # an imperfect with a long vowel after the first radical (يَمِيلُ) belongs to
                    # the hollow perfect (مَالَ), not to its sound doublet (مَيِلَ يَمْيَلُ)
                    hollow = bool(re.match("^[يتنأ][" + FATHA + DAMMA + KASRA + "]?[ء-ي][" + FATHA + DAMMA + KASRA + "][وياى]", lem))
                    rec = max(same, key=lambda x: (_common_prefix(x["u"], ks), (len(x["u"]) > 1 and x["u"][1] == "ا") == hollow))
        if not rec:
            rec = add(lem, form, "qu")
            st = ev[form].st if form in ev else None
            if st and form >= 2 and lemma_fits(lem, st) and not is_citation(lem):
                rec["v"] = st.voc            # citation form of an inflected corpus lemma
                rec["u"] = ukey(st.voc)
        rec.setdefault("q", None)
        rec["q"] = (rec["q"] or []) + [lem]

    tt = {code: tnorm(txt) for code, txt in texts.items()}
    # attestation of known verbs (only when the verb's own skeleton is a citation
    # skeleton of its form: Arramooz's أَقْوَلَ is not the Qamus's أَقَالَ)
    for k in order:
        rec = merged[k]
        e = ev.get(rec["form"])
        if not e:
            continue
        if rec["u"] not in {ukey(p) for p in e.st.perf}:
            continue
        for code in DICTS:
            t = tt.get(code)
            if not t:
                continue
            m = e.search(t, discover=False)
            if m:
                rec["src"].append(code)
                if "cite" not in rec:
                    rec["cite"] = [code, _snippet(texts[code], m.start(), m.end())]
    # discovery of verbs that no vocalised source has
    for code in DICTS:
        t = tt.get(code)
        if not t:
            continue
        for form, e in ev.items():
            if any(merged[k]["form"] == form for k in order):
                continue
            m = e.search(t, discover=True)
            if not m:
                continue
            st = e.st
            if form == 1 and len(root) == 3:
                v, uv = st.perf[0], True
            else:
                v, uv = st.voc, False
            rec = add(v, form, code)
            rec["uv"] = uv
            if "cite" not in rec:
                rec["cite"] = [code, _snippet(texts[code], m.start(), m.end())]
    out = []
    for k in order:
        rec = merged[k]
        rec["src"] = [s for s in rec["src"] if s != "qu"]
        if not rec["alt"]:
            del rec["alt"]
        if rec["tr"] is None:
            del rec["tr"]
        if "uv" in rec and not rec["uv"]:
            del rec["uv"]
        out.append(rec)
    out.sort(key=lambda x: (x["form"], x["q"] is None, x["v"]))
    return out
