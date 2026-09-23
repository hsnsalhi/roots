"""Four more classical dictionaries (OpenITI, Shamela editions), cut per root:

  ayn  al-Khalil b. Ahmad, Kitab al-Ayn (Shamela0001682)
  thd  al-Azhari, Tahdhib al-Lugha (Shamela0007031)
  mhk  Ibn Sida, al-Muhkam wa-l-muhit al-aczam (Shamela0009757)
  taj  al-Zabidi, Taj al-carus (Shamela0007030)

The first three follow al-Khalil's plan: a chapter for every set of letters,
listing the permutations (تقاليب) of those letters that the language uses and
those it leaves unused (مهمل).  The Ayn states the verdict in the chapter
heading — «باب العين والكاف والدال معهما (ع ك د، د ع ك، د ك ع مستعملات، ع د ك،
ك د ع، ك ع د مهملات)» — and the entries follow as «# عكد: …» paragraphs; the
Tahdhib has the same shape with «# عك، كع: مستعملان» lines; the Muhkam gives
every permutation its own heading («العين والكاف والدال», «مقلوبه: (ع د ك)»).
The Taj is alphabetical by last radical like the Sihah, one heading per root.
"""
from __future__ import annotations

import re
from collections import defaultdict

from dicts import AR, LETTER_NAMES, hn

WEAKISH = set("ويأاىء")

_NAME2LETTER = dict(LETTER_NAMES)
_NAME2LETTER.update({"الألف": "أ", "الزاي": "ز", "الزاء": "ز", "الياء": "ي", "الواو": "و"})
_NAME_RE = re.compile(r"ال(?:همزة|ألف|باء|تاء|ثاء|جيم|حاء|خاء|دال|ذال|راء|زاي|زاء|سين|شين|صاد|ضاد|طاء|ظاء|عين|غين|فاء|قاف|كاف|لام|ميم|نون|هاء|واو|ياء)")
_SPACED = re.compile(r"(?<![ء-ي])([ء-ي](?: [ء-ي]){1,3})(?![ء-ي])")
_VERDICT = re.compile(r"(مستعمل\w*|يستعمل\w*|استعمل\w*|مهمل\w*)")
_MARK = re.compile(r"\s*(ms\d+|PageV\d+P\d+|«\d+»|\(\d+\)|\[\d+\])\s*")


def _after_header(txt: str) -> str:
    return txt.split("#META#Header#End#", 1)[1] if "#META#Header#End#" in txt else txt


def letters_of(heading: str) -> list[str]:
    """Letters named in a chapter heading, in order: «العين والهاء مع الدال» → ع ه د."""
    return [_NAME2LETTER[n] for n in _NAME_RE.findall(heading) if n in _NAME2LETTER]


def norm_root(letters: str) -> str:
    """Root key: hamza carriers → أ, alif maqsura → ي, a two-letter root doubled (عك → عكك)."""
    r = hn(letters.replace(" ", "")).replace("ى", "ي")
    if len(r) == 2:
        r = r + r[1]
    return r


def perm_key(root: str) -> str:
    """Chapter key of a root in al-Khalil's plan: its distinct letters, sorted."""
    return "".join(sorted(set(norm_root(root))))


def _verdicts(heading: str) -> dict[str, str]:
    """{root: "used" | "unused"} read from a chapter heading of the Ayn."""
    out: dict[str, str] = {}
    pending: list[str] = []
    seen_verdict = False
    for m in re.finditer(r"(?<![ء-ي])([ء-ي](?: [ء-ي]){1,3})(?![ء-ي])|(مستعمل\w*|يستعمل\w*|استعمل\w*|مهمل\w*)", heading):
        if m.group(1):
            pending.append(norm_root(m.group(1)))
        else:
            seen_verdict = True
            verdict = "unused" if m.group(2).startswith("مهمل") else "used"
            for r in pending:
                out.setdefault(r, verdict)
            pending = []
    if pending and not seen_verdict:
        for r in pending:
            out.setdefault(r, "used")
    return out


# --------------------------------------------------------------------------
# al-Khalil school: Ayn and Tahdhib (paragraph entries), Muhkam (heading entries)
# --------------------------------------------------------------------------
def parse_ayn(path: str) -> tuple[list[tuple[str, str, str]], dict[str, dict[str, str]]]:
    """Entries (root, body, chapter heading) and al-Khalil's verdicts per chapter key."""
    txt = _after_header(open(path, encoding="utf-8").read())
    entries: list[tuple[str, str, str]] = []
    verdicts: dict[str, dict[str, str]] = defaultdict(dict)
    chapter = ""
    letters: set[str] = set()
    cur_root = None
    cur: list[str] = []

    def flush():
        if cur_root and cur:
            entries.append((cur_root, "\n".join(cur), chapter))

    for ln in txt.split("\n"):
        if ln.startswith("### "):
            flush()
            cur_root, cur = None, []
            h = _MARK.sub(" ", ln[4:].lstrip("|$ ").strip())
            names = letters_of(h)
            if names and ("باب" in h or "معهما" in h or _SPACED.search(h) or "مع " in h):
                chapter = h
                letters = set(names)
                v = _verdicts(h)
                if v:
                    key = perm_key(next(iter(v)))
                    verdicts[key].update(v)
            elif names and len(names) == 1 and h.startswith("حرف"):
                chapter, letters = "", set()
            elif not names:
                # (المضاعف, الثنائي الصحيح …): keep the current letters
                pass
            continue
        m = re.match(r"^# ((?:[%s]{2,5}[ ،,]+)*[%s]{2,5})\s*:\s*(.*)$" % (AR, AR), ln)
        if m and letters:
            roots_here = re.findall(r"[%s]{2,5}" % AR, m.group(1))
            root = roots_here[0]
            if all(set(hn(r)) <= letters | WEAKISH for r in roots_here):
                flush()
                cur_root, cur = root, [m.group(2)]
                continue
        if cur_root is not None:
            cur.append(ln)
    flush()
    return entries, dict(verdicts)


def parse_tahdhib(path: str) -> tuple[list[tuple[str, str, str]], dict[str, dict[str, str]]]:
    txt = _after_header(open(path, encoding="utf-8").read())
    entries: list[tuple[str, str, str]] = []
    verdicts: dict[str, dict[str, str]] = defaultdict(dict)
    chapter = ""
    letters: set[str] = set()
    strong: set[str] = set()
    names: list[str] = []
    cur_root = None
    cur: list[str] = []

    def flush():
        if cur_root and cur:
            entries.append((cur_root, "\n".join(cur), chapter))

    def note_used(text: str):
        for r in re.findall(r"(?<![ء-ي])([ء-ي]{2,4})(?![ء-ي])", text):
            if set(hn(r)) <= letters | WEAKISH:
                verdicts[perm_key(r)].setdefault(norm_root(r), "used")

    for ln in txt.split("\n"):
        if ln.startswith("### "):
            flush()
            cur_root, cur = None, []
            h = _MARK.sub(" ", ln[4:].lstrip("|$ ").strip()).strip("() ")
            nm = letters_of(h)
            if nm and (h.startswith("باب") or "مع" in h or h.startswith("أبواب")):
                chapter, letters, names = h, set(nm), nm
                strong = {c for c in nm if c not in WEAKISH}
                if "استعمل" in h:
                    note_used(h.split("استعمل", 1)[1])
            continue
        m = re.match(r"^# ((?:[%s]{2,5}\s*[،,]\s*)+[%s]{2,5})\s*[:،]?\s*(مستعمل|يستعمل).*$" % (AR, AR), ln)
        if m and letters:
            note_used(m.group(1))
            continue
        m = re.match(r"^# \(([%s](?: [%s]){1,4})\)\s*[:،]?\s*(.*)$" % (AR, AR), ln)
        if m and letters:
            root = m.group(1).replace(" ", "")
            if set(hn(root)) >= strong or set(hn(root)) <= letters | WEAKISH:
                flush()
                cur_root, cur = root, [m.group(2)] if m.group(2).strip() else []
                if not cur:
                    cur = [""]
                continue
        m = re.match(r"^# ((?:[%s]{2,5}[ ،,]+)*[%s]{2,5})\s*:\s*(.*)$" % (AR, AR), ln)
        if m and letters:
            roots_here = re.findall(r"[%s]{2,5}" % AR, m.group(1))
            root = roots_here[0]
            rl = set(hn(root))
            fits = (rl <= letters | WEAKISH) if len(names) >= 3 else (rl >= strong and len(rl) >= 2)
            if fits and not m.group(2).startswith(("مستعمل", "يستعمل", "مهمل")):
                for r in roots_here:
                    verdicts[perm_key(r)].setdefault(norm_root(r), "used")
                flush()
                cur_root, cur = root, [m.group(2)]
                continue
        if cur_root is not None:
            cur.append(ln)
    flush()
    return entries, dict(verdicts)


def parse_muhkam(path: str) -> list[tuple[str, str, str]]:
    """Entries (root, body, chapter).  The first entry of a letter group carries the
    marker «*letters|listed…»: its permutation is settled by `choose_permutation`
    once the group's «مقلوبه» headings are known."""
    txt = _after_header(open(path, encoding="utf-8").read())
    raw: list[list] = []          # [root or marker, body lines, chapter, group index]
    listed: dict[int, list[str]] = defaultdict(list)
    cur = None
    chapter = ""
    group = -1
    weak = False

    def start(root: str):
        nonlocal cur
        cur = [root, [], chapter, group]
        raw.append(cur)

    for ln in txt.split("\n"):
        if ln.startswith("### "):
            cur = None
            h = _MARK.sub(" ", ln[4:].lstrip("|$ ").strip())
            if h.startswith("مقلوب"):
                inside = re.search(r"\(([%s ]+)\)" % AR, h)
                if inside:
                    r = inside.group(1).replace(" ", "")
                    if 2 <= len(r) <= 5:
                        listed[group].append(r)
                        start(r)
                continue
            if any(w in h for w in ("المعتل", "اللفيف")):
                weak = True
            elif any(w in h for w in ("الصحيح", "المضاعف", "الرباعي", "الخماسي")):
                weak = False
            names = letters_of(h)
            if names and 2 <= len(names) <= 4 and not any(w in h for w in ("باب", "حرف", "كتاب", "أبواب", "الثنائي", "الثلاثي", "الرباعي", "الخماسي", "المضاعف", "اللفيف", "المعتل")):
                chapter = h
                group += 1
                start("*" + "".join(names) + ("+" if weak and len(names) == 2 else ""))
            continue
        if cur is not None:
            cur[1].append(ln)
    out: list[tuple[str, str, str]] = []
    for root, lines, chap, g in raw:
        if lines:
            if root.startswith("*"):
                root = root + "|" + ",".join(listed.get(g, []))
            out.append((root, "\n".join(lines), chap))
    return out


# --------------------------------------------------------------------------
# Taj al-carus: one heading per root, chapters by last radical
# --------------------------------------------------------------------------
def parse_taj(path: str) -> list[tuple[str, str, str]]:
    txt = _after_header(open(path, encoding="utf-8").read())
    entries: list[tuple[str, str, str]] = []
    bab = fasl = ""
    cur_head = None
    cur: list[str] = []
    glue = False
    lines = txt.split("\n")

    def flush():
        if cur_head is not None and cur:
            entries.append((cur_head, "\n".join(cur), fasl + "|" + bab))

    def fits(root: str) -> bool:
        # only the chapter (last radical) is reliable in this digitisation; the
        # section headings are often malformed
        n = hn(root)
        if bab == "وي":
            return n[-1] in "ويىاأ"
        return not bab or n[-1] == bab

    for ln in lines:
        if ln.startswith("### "):
            h = _MARK.sub(" ", ln[4:].lstrip("|$ ").strip()).strip()
            m = re.match(r"^\(?(باب|فصل)\s+(.+?)\)?$", h)
            if m:
                flush()
                cur_head, cur, glue = None, [], False
                names = letters_of(m.group(2))
                if names:
                    if m.group(1) == "باب":
                        bab = "وي" if ("الواو" in m.group(2) and "الياء" in m.group(2)) else names[0]
                    else:
                        fasl = names[0]
                continue
            h2 = re.sub(r"[\s\u00a0\u200e\u200f]+", " ", h).strip(" .،:")
            # «علم», «ع ل م» and irregular spacings such as «ق وم»
            m = re.match(r"^([%s]{2,6})$" % AR, h2) or (re.fullmatch(r"[%s ]{3,12}" % AR, h2) and 2 <= len(h2.replace(" ", "")) <= 6 and re.match(r"^(.*)$", h2))
            if m and fits(m.group(1).replace(" ", "")):
                flush()
                cur_head, cur, glue = m.group(1).replace(" ", ""), [], False
                continue
            if cur_head is not None and re.fullmatch(r"[%s .،]{1,14}" % AR, h):
                # a running page header pasted into the entry, splitting a word
                if cur:
                    cur[-1] = cur[-1].rstrip() + h.replace(" ", "")
                else:
                    cur.append("# " + h.replace(" ", ""))
                glue = True
                continue
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
    return entries


def choose_permutation(marker: str, body: str, rootsN: dict[str, str], lemma_index, known: set[str]) -> str:
    """The permutation that the first entry of a Muhkam letter group treats.
    marker = «*letters[+]|listed,…»: the candidates are the permutations of the
    letters (a two-letter group is a doubled root, or two radicals plus a weak
    one when marked +) that are not listed as «مقلوبه»; the group's own order
    wins when it is a known root, else the known candidate whose lemmas the
    body uses most, else the first known one."""
    import itertools
    from dicts import strip_diacritics
    head, _, listed_s = marker[1:].partition("|")
    listed = set(listed_s.split(",")) if listed_s else set()
    plus = head.endswith("+")
    letters = list(head.rstrip("+"))
    sets: list[list[str]] = []
    if len(letters) == 2 and plus:
        for w in "ويأ":
            sets.append(letters + [w])
    elif len(letters) == 2:
        sets.append([letters[0], letters[1], letters[1]])
    else:
        sets.append(letters)
    perms: list[str] = []
    for ls in sets:
        for p in itertools.permutations(ls):
            r = "".join(p)
            if r not in perms and r not in listed:
                perms.append(r)
    if not perms:
        return "".join(letters)
    own = "".join(letters) if len(letters) >= 3 else perms[0]
    if own in perms and (own in rootsN or own in known):
        return own
    plain = strip_diacritics(body[:3000])
    best, best_hits = None, 0
    for r in perms:
        cr = rootsN.get(r)
        if not cr:
            continue
        hits = sum(1 for lem in set(lemma_index.get(cr, [])) if len(lem) >= 3 and lem in plain)
        if hits > best_hits:
            best, best_hits = r, hits
    if best:
        return best
    for r in perms:
        if r in rootsN or r in known:
            return r
    return perms[0]
