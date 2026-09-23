"""Parsers for the two classical dictionaries used by the app.

Both texts come from the OpenITI corpus (mARkdown format):

* Ibn Faris (d. 1004 CE / 395 AH), Mu'jam Maqayis al-Lugha  — every entry opens with the
  root's letters spelled out ("القاف واللام والباء ...") and gives the root's
  core meaning(s).  Primary edition: Shamela0021710 (section headings
  ``### | (root)``); fallback: JK008008 (inline ``( root )`` headings).
* Al-Raghib al-Isfahani (d. 1108 CE / 502 AH), al-Mufradat fi Gharib al-Qur'an — the
  classic dictionary of Quranic vocabulary, organised by root.  Primary
  edition: Masaha003644 (each headword is a one-word paragraph); fallback:
  JK001150 (``# headword :`` paragraphs).

Only the classical text body is kept: modern editors' prefaces, footnotes and
endnotes are removed.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

AR = "ء-ي"
_HAMZA = str.maketrans({"ؤ": "أ", "ئ": "أ", "ء": "أ", "إ": "أ", "آ": "أ"})


def hn(s: str) -> str:
    """Normalise every hamza carrier to bare alif-hamza (corpus convention)."""
    return s.translate(_HAMZA)


_DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def strip_diacritics(s: str) -> str:
    return _DIAC.sub("", s).replace("ٱ", "ا")


LETTER_NAMES = {
    "الهمزة": "أ", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "الجيم": "ج",
    "الحاء": "ح", "الخاء": "خ", "الدال": "د", "الذال": "ذ", "الراء": "ر",
    "الزاء": "ز", "الزاي": "ز", "السين": "س", "الشين": "ش", "الصاد": "ص",
    "الضاد": "ض", "الطاء": "ط", "الظاء": "ظ", "العين": "ع", "الغين": "غ",
    "الفاء": "ف", "القاف": "ق", "الكاف": "ك", "اللام": "ل", "الميم": "م",
    "النون": "ن", "الهاء": "ه", "الواو": "و", "الياء": "ي",
}
_LETPAT = "|".join(LETTER_NAMES)
_SPELLED = re.compile(r"(%s)(?: و(%s))+" % (_LETPAT, _LETPAT))


def spelled_letters(body: str) -> tuple[str | None, str | None]:
    """(letters named at the start of an Ibn Faris entry, hint for a weak third
    letter), e.g. ('قلب', None) or ('سع', 'و') for
    'السين والعين والحرف المعتل وهو الواو'."""
    m = _SPELLED.search(body[:400])
    if not m:
        return None, None
    letters = hn("".join(LETTER_NAMES[x] for x in re.findall(_LETPAT, m.group(0))))
    tail = body[m.end():m.end() + 60]
    hint = None
    if "المعتل" in tail or "الهمزة" in tail:
        mm = re.search(r"(?:وهو|وهي|أعني|يعني) (الواو|الياء|الهمزة)", tail)
        if mm:
            hint = LETTER_NAMES[mm.group(1)]
    return letters, hint


# --------------------------------------------------------------------------
# cleaning
# --------------------------------------------------------------------------
_MARKERS = re.compile(r"PageV\d+P\d+:?|ms\d+|@\d+@|\(\d+\)|«\d+»|\[\d+\]|ENDNOTES:|_{3,}")


def clean_body(body: str, edition: str) -> str:
    """Turn a mARkdown fragment into plain paragraphs separated by '\\n'."""
    body = _MARKERS.sub(" ", body)
    body = re.sub(r"^\s*#{2,}.*$", " ", body, flags=re.M)      # stray headings
    if edition == "jk":
        body = body.replace("@QB@", "﴿").replace("@QE@", "﴾")
        body = re.sub(r"\^ ?\( ", "﴿", body)
        body = re.sub(r" \) ?\^", "﴾", body)
    body = body.replace("%~%", " … ").replace("% %", " … ").replace("%", " ")
    body = re.sub(r"\[([^\[\]]{0,40})\]", r"\1", body)          # editorial brackets
    body = re.sub(r"\(\s*\)", " ", body)
    lines = body.split("\n")
    paras: list[str] = []
    cur: list[str] = []
    for ln in lines:
        s = ln.rstrip()
        if s.startswith("~~"):
            cur.append(s[2:].strip())
            continue
        if cur:
            paras.append(" ".join(cur))
            cur = []
        s = s.lstrip("#").strip()
        if s:
            cur.append(s)
    if cur:
        paras.append(" ".join(cur))
    out = []
    for p in paras:
        if edition == "jk":
            p = re.sub(r"\s*\|\s*", ". ", p)
        p = re.sub(r"\s+", " ", p).strip(" .،:؛")
        p = re.sub(r"\s+([،.؛:!؟])", r"\1", p)
        p = re.sub(r"\.\s*\.(\s*\.)*", "…", p)
        p = p.strip()
        if len(p) > 1:
            out.append(p)
    return "\n".join(out)


# --------------------------------------------------------------------------
# heading → root candidates
# --------------------------------------------------------------------------
def heading_variants(h: str, surface: bool = False) -> list[str]:
    """Possible corpus roots for a dictionary heading, best guesses first."""
    h = hn(h)
    out = [h]
    if len(h) == 2:
        out += [h + h[1], h + "و", h + "ي"]
    if len(h) >= 3:
        if h[-1] in "ىيو":
            out += [h[:-1] + "ي", h[:-1] + "و"]
        if h[-1] == "ا":
            out += [h[:-1] + "و", h[:-1] + "ي", h[:-1] + "أ"]
        if h.endswith("اء"):
            out += [h[:-2] + "يأ", h[:-2] + "وأ", h[:-2] + "وه"]
        if surface:
            if len(h) == 3 and h[1] == "ا":                      # hollow surface form
                out += [h[0] + "و" + h[2], h[0] + "ي" + h[2]]
            if len(h) == 4 and h[1] == "ا":
                out += [h[0] + "و" + h[2:], h[0] + "ي" + h[2:]]
            if h.startswith("ا") and len(h) >= 4:                # اسم, ابن …
                out += [h[1:], "أ" + h[1:], h[1:] + "و", h[1:] + "ي"]
            if h.endswith("ة"):
                out += [h[:-1], h[:-1] + "و", h[:-1] + "ي"]
            if h.endswith("ى") and len(h) == 3:
                out += [h[0] + "و" + h[1], h[0] + "ي" + h[1]]
    seen: list[str] = []
    for v in out:
        if v not in seen:
            seen.append(v)
    return seen


def resolve_roots(h: str, body: str, rootsN: dict[str, str], lemma_index, freq,
                  surface: bool = False, spelled: tuple[str | None, str | None] = (None, None)) -> list[str]:
    """Roots (corpus spelling) that a heading + entry body should be attached to."""
    hN = hn(h)
    if not surface and len(hN) >= 4:
        hN = hN[:2] + hN[2:].replace("ى", "ي")
    # a two-letter heading is a geminate root (رب → ربب); in Ibn Faris it can be
    # nothing else, so an entry for a non-Quranic geminate is dropped rather than
    # attached to a weak-final root (خش must not feed خشي)
    if len(hN) == 2:
        if hN + hN[1] in rootsN:
            return [rootsN[hN + hN[1]]]
        if not surface:
            return []
    # Ibn Faris heads the entries of weak-final roots with every weak letter they
    # take, e.g. (بلوي) = بلو + بلي, (عصوى) = عصو + عصي, (بكوء) = بكو + بكأ + بكي
    if not surface and len(hN) >= 4 and all(c in "ويأ" for c in hN[2:]):
        tail = set(hN[2:])
        if tail & {"و", "ي"}:
            tail |= {"و", "ي"}
        found = [rootsN[hN[:2] + c] for c in "ويأ" if c in tail and hN[:2] + c in rootsN]
        if found:
            return found
    # a sound heading spelled exactly like a Quranic root wins over its variants;
    # weak-final headings (بلي/بلو …) keep the variant logic, since one Ibn Faris
    # entry usually covers both the و and the ي root
    if not surface and hN in rootsN and hN[-1] not in "ويىا":
        return [rootsN[hN]]
    cands = [rootsN[v] for v in heading_variants(h, surface) if v in rootsN]
    if not cands:
        return []
    letters, hint = spelled
    if letters:
        exact = [r for r in cands if hn(r) == letters]
        if exact:
            return exact[:1]
        if hint:
            hinted = [r for r in cands if hn(r) == letters + hint]
            if hinted:
                return hinted[:1]
        consistent = [r for r in cands if hn(r).startswith(letters[:2])]
        if consistent:
            cands = consistent
    if len(cands) == 1:
        return cands
    plain = strip_diacritics(body)
    scored = []
    for r in cands:
        hits = sum(plain.count(lem) for lem in lemma_index.get(r, []) if len(lem) >= 3)
        scored.append((hits, freq.get(r, 0), r))
    scored.sort(reverse=True)
    top = scored[0][0]
    chosen = [scored[0][2]]
    # an entry that clearly discusses two homographic roots (صلا → صلو/صلي) serves both
    for hits, _, r in scored[1:]:
        if hits >= 2 and hits >= 0.3 * top:
            chosen.append(r)
    return chosen


# --------------------------------------------------------------------------
# Ibn Faris
# --------------------------------------------------------------------------
_HEAD_TAIL = re.compile(r"(\s*(ms\d+|PageV\d+P\d+))+\s*$")


def _after_header(txt: str) -> str:
    return txt.split("#META#Header#End#", 1)[1] if "#META#Header#End#" in txt else txt


def parse_maqayis_shamela(path: str) -> list[tuple[str, str]]:
    txt = _after_header(open(path, encoding="utf-8").read())
    heads = [(m.start(), m.end(), m.group(1)) for m in re.finditer(r"^### \|+ ?(.*)$", txt, flags=re.M)]
    entries = []
    for i, (pos, end0, h) in enumerate(heads):
        end = heads[i + 1][0] if i + 1 < len(heads) else len(txt)
        hh = _HEAD_TAIL.sub("", h.strip())
        m = re.fullmatch(r"\(?\s*\[?\s*([%s]{2,6})\s*\]?\s*\)?" % AR, hh)
        if not m:
            continue
        entries.append((m.group(1), txt[end0:end]))
    return entries


def parse_maqayis_jk(path: str) -> list[tuple[str, str]]:
    txt = _after_header(open(path, encoding="utf-8").read())
    cands = [(m.start(), m.end(), m.group(1)) for m in re.finditer(r"\( ?([%s]{2,5}) ?\)" % AR, txt)]
    entries = []
    for i, (pos, end0, h) in enumerate(cands):
        end = cands[i + 1][0] if i + 1 < len(cands) else len(txt)
        body = txt[end0:end]
        cut = re.search(r"^# \| \d* ?\( ?(كتاب|باب)", body, flags=re.M)
        if cut:
            body = body[:cut.start()]
        entries.append((h, body))
    return entries


def load_maqayis(paths: dict[str, str], roots: set[str], lemma_index, freq) -> dict[str, dict]:
    """Return {root: {"text":..., "ed":..., "verified": bool}}."""
    rootsN = {hn(r): r for r in roots}
    result: dict[str, dict] = {}
    for ed, parser in (("shamela", parse_maqayis_shamela), ("jk", parse_maqayis_jk)):
        if ed not in paths:
            continue
        per_root: dict[str, list] = defaultdict(list)
        for h, body in parser(paths[ed]):
            spelled = spelled_letters(body)
            targets = resolve_roots(h, body, rootsN, lemma_index, freq, spelled=spelled)
            if not targets:
                continue
            cleaned = clean_body(body, ed)
            if len(cleaned) < 40:
                continue
            letters = spelled[0]
            for root in targets:
                verified = bool(letters) and hn(root).startswith(letters[:2])
                per_root[root].append((verified, cleaned))
        for root, lst in per_root.items():
            if root in result:
                continue
            good = [c for v, c in lst if v] or [c for v, c in lst]
            longest = max(len(c) for c in good)
            good = [c for c in good if len(c) >= 120 or len(c) == longest]
            result[root] = {"text": "\n\n".join(dict.fromkeys(good)), "ed": ed, "verified": any(v for v, _ in lst)}
    return result


# --------------------------------------------------------------------------
# Al-Raghib
# --------------------------------------------------------------------------
_MASAHA_HEAD = re.compile(
    r"^# [\s.،:؛()\d\-*]*([%s]{2,7})(?:\s+(?:ms\d+|PageV\d+P\d+|\(\d+\)))*\s*$" % AR, flags=re.M)


def parse_mufradat_masaha(path: str) -> list[tuple[str, str]]:
    txt = _after_header(open(path, encoding="utf-8").read())
    cut = txt.find("### |EDITOR|")
    if cut > 0:
        txt = txt[:cut]
    heads = [(m.start(), m.end(), m.group(1)) for m in _MASAHA_HEAD.finditer(txt)]
    entries = []
    for i, (pos, end0, h) in enumerate(heads):
        end = heads[i + 1][0] if i + 1 < len(heads) else len(txt)
        entries.append((h, txt[end0:end]))
    return entries


def parse_mufradat_jk(path: str) -> list[tuple[str, str]]:
    txt = _after_header(open(path, encoding="utf-8").read())
    heads = [(m.start(), m.end(), m.group(1)) for m in
             re.finditer(r"^# ([%s]{2,7})(?: ms\d+| PageV\d+P\d+)* ?:" % AR, txt, flags=re.M)]
    entries = []
    for i, (pos, end0, h) in enumerate(heads):
        end = heads[i + 1][0] if i + 1 < len(heads) else len(txt)
        entries.append((h, txt[end0:end]))
    return entries


# headwords whose spelling cannot be derived mechanically (surface word → root)
MUFRADAT_OVERRIDES = {
    "أخ": "أخو", "أب": "أبو", "يد": "يدي", "ذو": "ذو", "فم": "فوه", "ابن": "بني",
    "اسم": "سمو", "ماء": "موه", "جاء": "جيأ", "شيء": "شيأ", "سوء": "سوأ", "كلا": "كلل",
}


def load_mufradat(paths: dict[str, str], roots: set[str], lemma_index, freq) -> dict[str, dict]:
    rootsN = {hn(r): r for r in roots}
    result: dict[str, dict] = {}
    for ed, parser in (("masaha", parse_mufradat_masaha), ("jk", parse_mufradat_jk)):
        if ed not in paths:
            continue
        per_root: dict[str, list] = defaultdict(list)
        for h, body in parser(paths[ed]):
            hN = hn(h)
            if hN in MUFRADAT_OVERRIDES and hn(MUFRADAT_OVERRIDES[hN]) in rootsN:
                targets = [rootsN[hn(MUFRADAT_OVERRIDES[hN])]]
            else:
                targets = resolve_roots(h, body, rootsN, lemma_index, freq, surface=True)
            if not targets:
                continue
            cleaned = clean_body(body, ed)
            if len(cleaned) < 30:
                continue
            for root in targets:
                per_root[root].append(cleaned)
        for root, lst in per_root.items():
            if root in result:
                continue
            longest = max(len(c) for c in lst)
            good = [c for c in lst if len(c) >= 100 or len(c) == longest]
            result[root] = {"text": "\n\n".join(dict.fromkeys(good)), "ed": ed}
    return result


def unmapped_headwords(paths: dict[str, str], roots: set[str]) -> Counter:
    """Debug helper: headwords of the primary Mufradat edition not mapped to a root."""
    rootsN = {hn(r): r for r in roots}
    c: Counter = Counter()
    for h, _ in parse_mufradat_masaha(paths["masaha"]):
        if not any(v in rootsN for v in heading_variants(h, surface=True)) and hn(h) not in MUFRADAT_OVERRIDES:
            c[h] += 1
    return c
