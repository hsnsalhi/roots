#!/usr/bin/env python3
"""Build the static data files consumed by the app.

Inputs (scripts/sources/, see fetch_sources.sh):
  quran-morphology.txt   Quranic Arabic Corpus v0.4 morphology (Arabic-script conversion)
  quran-uthmani.txt      Tanzil Uthmani Quran text v1.1 (verbatim)
  quran-data.xml         Tanzil metadata (sura names)
  maqayis_*.txt          Ibn Faris, Maqayis al-Lugha (OpenITI editions)
  arramooz.sqlite        Arramooz Alwaseet verb dictionary (GPL)
  wiktionary_verbs.jsonl English Wiktionary Arabic verbs (kaikki.org extract, CC BY-SA)
  lisan.txt, qamus.txt, sihah.txt   Lisan al-Arab, al-Qamus al-Muhit, al-Sihah (OpenITI editions)
  ayn.txt, tahdhib.txt, muhkam.txt, taj.txt   Kitab al-Ayn, Tahdhib al-Lugha, al-Muhkam, Taj al-Arus (OpenITI editions)
  mufradat_*.txt         Al-Raghib, al-Mufradat (OpenITI editions)

Outputs (public/data/):
  index.json             every root with statistics + lemmas (for the forest & search)
  roots/<id>.json        one file per root: verbs (with every Quranic occurrence),
                         nominal derivatives, dictionary entries
  quran/<sura>.json      the Quran text, tokenised to match the corpus word numbering
"""
from __future__ import annotations

import datetime as dt
import itertools
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, OrderedDict, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dicts import hn, load_maqayis, load_mufradat, strip_diacritics, unmapped_headwords  # noqa: E402
from lexicon import build_lexicon, khalil_verdicts, load_arramooz, load_classical, load_wiktionary  # noqa: E402
from lexica import norm_root as lex_norm, perm_key  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "sources")
OUT = os.path.join(ROOT, "public", "data")

ALPHABET = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي"
ORDER = {c: i for i, c in enumerate(ALPHABET)}
WEAK = set("وي")

_LETTER_NAMES = "همزة|باء|تاء|ثاء|جيم|حاء|خاء|دال|ذال|راء|زاء|زاي|سين|شين|صاد|ضاد|طاء|ظاء|عين|غين|فاء|قاف|كاف|لام|ميم|نون|هاء|واو|ياء"
_GIST_LEAD = re.compile(r"^(?:\s*و?\s*ال(?:%s))+(?:\s*و?\s*الحرف\s+المعتل(?:\s*وهو\s+ال(?:واو|ياء))?)?(?:\s*و?\s*ال(?:مهموز|مضاعف))?\s*[:،,]?\s*" % _LETTER_NAMES)


def gist(text: str | None) -> str | None:
    """The core-meaning sentence of an Ibn Faris entry, without the spelled letters."""
    if not text:
        return None
    p = text.split("\n")[0]
    q = _GIST_LEAD.sub("", p)
    m = re.search(r"[.؛]", q)
    if m and m.start() > 25:
        q = q[:m.start()]
    q = q.strip(" :،,.؛")
    if len(q) > 230:
        cut = q[:230]
        i = max(cut.rfind("،"), cut.rfind(" "))
        q = cut[:i if i > 120 else 230] + "…"
    return q or None


def load_bi_meanings() -> dict[str, str]:
    """Curated general meanings of the biliteral groups (scripts/bi_meanings.json)."""
    path = os.path.join(ROOT, "scripts", "bi_meanings.json")
    if not os.path.exists(path):
        return {}
    raw = json.load(open(path, encoding="utf-8"))
    out = {}
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        m = v.get("m") if isinstance(v, dict) else v
        if m:
            out[k] = m.strip()
    return out


def norm_root(r: str) -> str:
    r = hn(r)
    return r.replace("ا", "أ")


def sort_key(r: str):
    return [ORDER.get(c, 99) for c in norm_root(r)]


# --------------------------------------------------------------------------
# Quran text
# --------------------------------------------------------------------------
_NORM_RE = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـٓ-ٕ\s]")


def norm_word(w: str) -> str:
    """Lenient comparison key: strips vocalisation, small letters, hamza
    carriers and alif/alif-maqsura, which differ between the two editions."""
    w = _NORM_RE.sub("", w)
    return re.sub("[اٱىءٕٔ]", "", w)


def load_quran():
    verses: dict[tuple[int, int], str] = {}
    for line in open(os.path.join(SRC, "quran-uthmani.txt"), encoding="utf-8"):
        line = line.rstrip("\n")
        if not line or line.startswith("#"):
            continue
        s, a, t = line.split("|", 2)
        verses[(int(s), int(a))] = t
    basmala = verses[(1, 1)]
    nb = norm_word(basmala)
    has_basmala: dict[int, bool] = {}
    for s in range(1, 115):
        t = verses[(s, 1)]
        toks = t.split(" ")
        if s not in (1, 9) and len(toks) > 4 and norm_word(" ".join(toks[:4])) == nb:
            verses[(s, 1)] = " ".join(toks[4:])
            has_basmala[s] = True
        else:
            has_basmala[s] = s != 9
    meta = {}
    tree = ET.parse(os.path.join(SRC, "quran-data.xml"))
    for el in tree.getroot().iter("sura"):
        meta[int(el.get("index"))] = {
            "name": el.get("name"), "tname": el.get("tname"), "ayas": int(el.get("ayas")),
            "type": "مكية" if el.get("type") == "Meccan" else "مدنية",
        }
    return verses, basmala, has_basmala, meta


def align(cwords: list[str], toks: list[str], loc) -> list[str]:
    """Map corpus words onto Tanzil tokens (merging tokens when the corpus
    treats several as one word).  Returns one display token per corpus word."""
    out: list[str] = []
    j = 0
    for i, cw in enumerate(cwords):
        ncw = norm_word(cw)
        if j < len(toks) and norm_word(toks[j]) == ncw:
            out.append(toks[j])
            j += 1
            continue
        merged = 0
        for k in (2, 3):
            if j + k <= len(toks) and norm_word("".join(toks[j:j + k])) == ncw:
                merged = k
                break
        if merged:
            out.append(" ".join(toks[j:j + merged]))
            j += merged
            continue
        raise SystemExit(f"alignment failed at {loc} word {i + 1}: {cw!r} vs {toks[j:j + 2]!r}")
    if j != len(toks):
        raise SystemExit(f"alignment left tokens at {loc}: {toks[j:]!r}")
    return out


# --------------------------------------------------------------------------
# corpus
# --------------------------------------------------------------------------
PGN_RE = re.compile(r"^[123](?:M|F)?(?:S|D|P)$")
POS_PRIORITY = ["PN", "ACT_PCPL", "PASS_PCPL", "VN", "ADJ", "NV", "IMPN", "T", "LOC", "N"]


def parse_feats(feat: str):
    kv, flags = {}, []
    for tok in feat.split("|"):
        if ":" in tok:
            k, v = tok.split(":", 1)
            kv[k] = v
        else:
            flags.append(tok)
    return kv, flags


def load_corpus():
    words: "OrderedDict[tuple[int,int,int], list]" = OrderedDict()
    for line in open(os.path.join(SRC, "quran-morphology.txt"), encoding="utf-8"):
        line = line.rstrip("\n")
        if not line:
            continue
        loc, form, tag, feat = line.split("\t")
        s, a, w, seg = (int(x) for x in loc.split(":"))
        kv, flags = parse_feats(feat)
        words.setdefault((s, a, w), []).append({"seg": seg, "form": form, "tag": tag, "kv": kv, "flags": flags})
    return words


def main():
    t0 = dt.datetime.now()
    verses, basmala, has_basmala, smeta = load_quran()
    words = load_corpus()
    print(f"verses {len(verses)}  words {len(words)}")

    # ---- Quran files ------------------------------------------------------
    by_verse: dict[tuple[int, int], list[str]] = defaultdict(list)
    for (s, a, w), segs in words.items():
        by_verse[(s, a)].append("".join(x["form"] for x in segs))
    os.makedirs(os.path.join(OUT, "quran"), exist_ok=True)
    tokens: dict[tuple[int, int], list[str]] = {}
    for s in range(1, 115):
        vv = []
        for a in range(1, smeta[s]["ayas"] + 1):
            toks = verses[(s, a)].split(" ")
            disp = align(by_verse[(s, a)], toks, f"{s}:{a}")
            tokens[(s, a)] = disp
            vv.append(disp)
        data = {"s": s, "name": smeta[s]["name"], "tname": smeta[s]["tname"], "type": smeta[s]["type"],
                "basmala": has_basmala[s], "v": vv}
        with open(os.path.join(OUT, "quran", f"{s}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    # ---- roots ------------------------------------------------------------
    roots: dict[str, dict] = {}
    root_occ: Counter = Counter()
    lemma_index: dict[str, list[str]] = defaultdict(list)

    def root_rec(r):
        if r not in roots:
            roots[r] = {"r": r, "verbs": OrderedDict(), "nouns": OrderedDict()}
        return roots[r]

    for (s, a, w), segs in words.items():
        loc = f"{s}:{a}:{w}"
        for idx, seg in enumerate(segs):
            r = seg["kv"].get("ROOT")
            if not r:
                continue
            root_occ[r] += 1
            rec = root_rec(r)
            lem = seg["kv"].get("LEM", seg["form"])
            if seg["tag"] == "V":
                flags = seg["flags"]
                tense = next((f for f in flags if f in ("PERF", "IMPF", "IMPV")), "?")
                pgn = next((f for f in flags if PGN_RE.match(f)), "")
                form_no = int(seg["kv"].get("VF", "1"))
                voice = "PASS" if "PASS" in flags else "ACT"
                mood = seg["kv"].get("MOOD", "")
                surface = seg["form"]
                for nxt in segs[idx + 1:]:
                    nf = nxt["flags"]
                    if "SUFF" in nf and (("PRON" in nf and pgn in nf) or "EMPH" in nf):
                        surface += nxt["form"]
                        if "PRON" in nf:
                            continue
                    break
                v = rec["verbs"].setdefault(lem, {"lem": lem, "form": form_no, "count": 0, "forms": OrderedDict()})
                v["count"] += 1
                key = (surface, tense, pgn, voice, mood)
                fm = v["forms"].setdefault(key, {"w": surface, "t": tense, "p": pgn, "v": voice, "m": mood, "locs": []})
                fm["locs"].append(loc)
            else:
                flags = seg["flags"]
                pos = next((p for p in POS_PRIORITY if p in flags), seg["tag"])
                n = rec["nouns"].setdefault(lem, {"lem": lem, "pos": pos, "form": int(seg["kv"]["VF"]) if "VF" in seg["kv"] else None, "count": 0, "locs": []})
                n["count"] += 1
                n["locs"].append(loc)
    for r, rec in roots.items():
        for lem in list(rec["verbs"]) + list(rec["nouns"]):
            lemma_index[r].append(strip_diacritics(lem))
    print(f"roots {len(roots)}  verb lemmas {sum(len(x['verbs']) for x in roots.values())}  "
          f"noun lemmas {sum(len(x['nouns']) for x in roots.values())}")

    # ---- dictionaries -----------------------------------------------------
    root_set = set(roots)
    maq = load_maqayis({"shamela": os.path.join(SRC, "maqayis_shamela.txt"), "jk": os.path.join(SRC, "maqayis_jk.txt")},
                       root_set, lemma_index, root_occ)
    muf = load_mufradat({"masaha": os.path.join(SRC, "mufradat_masaha.txt"), "jk": os.path.join(SRC, "mufradat_jk.txt")},
                        root_set, lemma_index, root_occ)
    print(f"maqayis entries {len(maq)}  ({sum(1 for v in maq.values() if v['verified'])} verified)  mufradat entries {len(muf)}")
    miss_m = sorted((r for r in roots if r not in maq), key=lambda r: -root_occ[r])
    miss_f = sorted((r for r in roots if r not in muf), key=lambda r: -root_occ[r])
    print("maqayis missing", len(miss_m), [(r, root_occ[r]) for r in miss_m[:40]])
    print("mufradat missing", len(miss_f), [(r, root_occ[r]) for r in miss_f[:40]])
    if os.environ.get("DEBUG_HEADWORDS"):
        print("unmapped mufradat headwords:", unmapped_headwords({"masaha": os.path.join(SRC, "mufradat_masaha.txt")}, root_set).most_common())

    # ---- verbs beyond the Quran ------------------------------------------
    arr = load_arramooz(os.path.join(SRC, "arramooz.sqlite"))
    wik = load_wiktionary(os.path.join(SRC, "wiktionary_verbs.jsonl"), {norm_root(r) for r in roots} | set(arr))
    heads: dict[str, set[str]] = {}
    classical = load_classical({"ls": os.path.join(SRC, "lisan.txt"), "qm": os.path.join(SRC, "qamus.txt"),
                                "sh": os.path.join(SRC, "sihah.txt"), "ayn": os.path.join(SRC, "ayn.txt"),
                                "thd": os.path.join(SRC, "tahdhib.txt"), "mhk": os.path.join(SRC, "muhkam.txt"),
                                "taj": os.path.join(SRC, "taj.txt")}, root_set, lemma_index, root_occ, heads)
    khalil = khalil_verdicts(os.path.join(SRC, "ayn.txt"), os.path.join(SRC, "tahdhib.txt"))
    heads["ar"] = set(arr)
    heads["wk"] = set(wik)
    lexicon: dict[str, list[dict]] = {}
    for r, rec in roots.items():
        qv = [(lem, v["form"]) for lem, v in rec["verbs"].items()]
        n = norm_root(r)
        lexicon[r] = build_lexicon(n, qv, arr.get(n, []), wik.get(n, []), {c: m[r] for c, m in classical.items() if r in m})
    lex_all = sum(len(v) for v in lexicon.values())
    lex_other = sum(1 for v in lexicon.values() for x in v if not x["q"])
    src_counts = Counter(s for v in lexicon.values() for x in v for s in x["src"])
    print(f"lexicon verbs {lex_all}  beyond the Quran {lex_other}  sources {dict(src_counts)}  "
          f"dictionaries: " + ", ".join(f"{c} {len(m)}" for c, m in classical.items()))

    # ---- write ------------------------------------------------------------
    ordered = sorted(roots, key=sort_key)
    ON_DEMAND = ("ls", "thd", "mhk", "taj")          # large entries, served per root on request
    for sub in ["roots"] + [os.path.join("dict", c) for c in ON_DEMAND]:
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
        for old in os.listdir(os.path.join(OUT, sub)):
            os.remove(os.path.join(OUT, sub, old))
    if os.path.isdir(os.path.join(OUT, "lisan")):
        for old in os.listdir(os.path.join(OUT, "lisan")):
            os.remove(os.path.join(OUT, "lisan", old))
        os.rmdir(os.path.join(OUT, "lisan"))
    index = []
    id_of = {r: f"r{i:04d}" for i, r in enumerate(ordered)}
    rootsN = {norm_root(r): r for r in roots}
    PERM_SOURCES = ("ayn", "thd", "sh", "mhk", "ls", "taj", "ar", "wk")

    def permutations_of(r: str) -> list[dict]:
        """The other orderings of the root's letters: Quranic ones with their id and
        Ibn Faris gist, the rest with the lexica that have an entry for them, and
        al-Khalil's verdict (used / unused) when the Ayn states it."""
        letters = list(norm_root(r))
        if not 3 <= len(letters) <= 4:
            return []
        seen: list[str] = []
        for p in itertools.permutations(letters):
            cand = "".join(p)
            if cand not in seen:
                seen.append(cand)
        verdicts = khalil.get(perm_key(r), {})
        out = []
        for cand in seen:
            item: dict = {"r": cand}
            cr = rootsN.get(cand)
            if cr:
                item["q"] = id_of[cr]
                item["v"] = len(roots[cr]["verbs"])
                item["n"] = len(roots[cr]["nouns"])
                g = gist(maq.get(cr, {}).get("text"))
                if g:
                    item["g"] = g
            srcs = [c for c in PERM_SOURCES if cand in heads.get(c, ())]
            if srcs:
                item["src"] = srcs
            k = verdicts.get(cand)
            if k:
                item["k"] = k
            if cand == norm_root(r):
                item["self"] = True
            out.append(item)
        return out

    for i, r in enumerate(ordered):
        rec = roots[r]
        rid = f"r{i:04d}"
        lex = lexicon[r]
        # corpus verbs are grouped under the citation form of their lexicon record
        # (the corpus "lemma" of an imperfect-only verb is an imperfect: يُحْمَدُ → حَمِدَ)
        by_q = {q: x for x in lex for q in (x["q"] or [])}
        groups: "OrderedDict[object, dict]" = OrderedDict()
        for lem, v in rec["verbs"].items():
            x = by_q.get(lem)
            key = id(x) if x else ("lem", lem)
            g = groups.get(key)
            if not g:
                g = {"lem": x["v"] if x else lem, "form": x["form"] if x else v["form"], "count": 0,
                     "forms": OrderedDict(), "lems": [], "src": x["src"] if x else []}
                groups[key] = g
            g["count"] += v["count"]
            g["lems"].append(lem)
            for k, fm in v["forms"].items():
                cur = g["forms"].get(k)
                if cur:
                    cur["locs"].extend(fm["locs"])
                else:
                    g["forms"][k] = dict(fm, locs=list(fm["locs"]))
        verbs = []
        for g in sorted(groups.values(), key=lambda x: (x["form"], -x["count"])):
            forms = sorted(g["forms"].values(), key=lambda f: -len(f["locs"]))
            entry = {"lem": g["lem"], "form": g["form"], "count": g["count"], "forms": forms, "src": g["src"]}
            if g["lems"] != [g["lem"]]:
                entry["lems"] = g["lems"]
            verbs.append(entry)
        nouns = sorted(rec["nouns"].values(), key=lambda x: -x["count"])
        vo = sum(v["count"] for v in verbs)
        no = sum(n["count"] for n in nouns)
        others = [x for x in lex if not x["q"]]
        available = [c for c in ON_DEMAND if r in classical.get(c, {})]
        data = {
            "id": rid, "r": r, "letters": list(norm_root(r)),
            "verbs": verbs, "nouns": nouns,
            "lexicon": lex,
            "maqayis": maq.get(r, {}).get("text"), "maqayis_ed": maq.get(r, {}).get("ed"),
            "gist": gist(maq.get(r, {}).get("text")),
            "mufradat": muf.get(r, {}).get("text"), "mufradat_ed": muf.get(r, {}).get("ed"),
            "ayn": classical.get("ayn", {}).get(r),
            "qamus": classical.get("qm", {}).get(r), "sihah": classical.get("sh", {}).get(r),
            "dicts": available,
            "perms": permutations_of(r),
        }
        with open(os.path.join(OUT, "roots", f"{rid}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        for c in available:
            with open(os.path.join(OUT, "dict", c, f"{rid}.json"), "w", encoding="utf-8") as f:
                json.dump({"id": rid, "r": r, "text": classical[c][r]}, f, ensure_ascii=False, separators=(",", ":"))
        bits = {"ayn": 32, "thd": 64, "mhk": 128, "taj": 256}
        index.append({
            "id": rid, "r": r, "l": norm_root(r),
            "v": len(verbs), "vo": vo, "n": len(nouns), "no": no,
            "lem": [v["lem"] for v in verbs], "nl": [n["lem"] for n in nouns],
            "x": len(others), "xl": [x["v"] for x in others],
            "d": (1 if r in maq else 0) | (2 if r in muf else 0) | (4 if data["qamus"] else 0) | (8 if data["sihah"] else 0)
                 | (16 if "ls" in available else 0) | sum(b for c, b in bits.items() if r in classical.get(c, {})),
        })
    meta = {
        "generated": t0.strftime("%Y-%m-%d"),
        "counts": {"roots": len(index), "verbRoots": sum(1 for x in index if x["v"]),
                   "verbLemmas": sum(x["v"] for x in index), "verbTokens": sum(x["vo"] for x in index),
                   "nounLemmas": sum(x["n"] for x in index), "words": len(words), "verses": len(verses),
                   "maqayis": len(maq), "mufradat": len(muf),
                   "lexVerbs": lex_all, "lexOther": lex_other, "lexRoots": sum(1 for x in index if x["x"]),
                   "srcArramooz": src_counts.get("ar", 0), "srcWiktionary": src_counts.get("wk", 0),
                   "srcLisan": src_counts.get("ls", 0), "srcQamus": src_counts.get("qm", 0), "srcSihah": src_counts.get("sh", 0),
                   "qamus": len(classical.get("qm", {})), "sihah": len(classical.get("sh", {})), "lisan": len(classical.get("ls", {})),
                   "ayn": len(classical.get("ayn", {})), "tahdhib": len(classical.get("thd", {})), "muhkam": len(classical.get("mhk", {})),
                   "taj": len(classical.get("taj", {})),
                   "srcAyn": src_counts.get("ayn", 0), "srcTahdhib": src_counts.get("thd", 0), "srcMuhkam": src_counts.get("mhk", 0),
                   "srcTaj": src_counts.get("taj", 0), "khalil": sum(len(v) for v in khalil.values())},
        "suras": [{"n": s, "name": smeta[s]["name"], "ayas": smeta[s]["ayas"], "type": smeta[s]["type"]} for s in range(1, 115)],
        "basmala": basmala,
        "alphabet": list(ALPHABET),
    }
    bi = load_bi_meanings()
    meta["counts"]["biMeanings"] = len(bi)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "roots": index, "bi": bi}, f, ensure_ascii=False, separators=(",", ":"))
    print("done in", dt.datetime.now() - t0)
    print(json.dumps(meta["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
