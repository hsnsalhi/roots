#!/usr/bin/env python3
"""Build the static data files consumed by the app.

Inputs (scripts/sources/, see fetch_sources.sh):
  quran-morphology.txt   Quranic Arabic Corpus v0.4 morphology (Arabic-script conversion)
  quran-uthmani.txt      Tanzil Uthmani Quran text v1.1 (verbatim)
  quran-data.xml         Tanzil metadata (sura names)
  maqayis_*.txt          Ibn Faris, Maqayis al-Lugha (OpenITI editions)
  mufradat_*.txt         Al-Raghib, al-Mufradat (OpenITI editions)

Outputs (public/data/):
  index.json             every root with statistics + lemmas (for the forest & search)
  roots/<id>.json        one file per root: verbs (with every Quranic occurrence),
                         nominal derivatives, dictionary entries
  quran/<sura>.json      the Quran text, tokenised to match the corpus word numbering
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, OrderedDict, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dicts import hn, load_maqayis, load_mufradat, strip_diacritics, unmapped_headwords  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "sources")
OUT = os.path.join(ROOT, "public", "data")

ALPHABET = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي"
ORDER = {c: i for i, c in enumerate(ALPHABET)}
WEAK = set("وي")


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

    # ---- write ------------------------------------------------------------
    ordered = sorted(roots, key=sort_key)
    os.makedirs(os.path.join(OUT, "roots"), exist_ok=True)
    for old in os.listdir(os.path.join(OUT, "roots")):
        os.remove(os.path.join(OUT, "roots", old))
    index = []
    for i, r in enumerate(ordered):
        rec = roots[r]
        rid = f"r{i:04d}"
        verbs = []
        for v in sorted(rec["verbs"].values(), key=lambda x: (x["form"], -x["count"])):
            forms = sorted(v["forms"].values(), key=lambda f: -len(f["locs"]))
            verbs.append({"lem": v["lem"], "form": v["form"], "count": v["count"], "forms": forms})
        nouns = sorted(rec["nouns"].values(), key=lambda x: -x["count"])
        vo = sum(v["count"] for v in verbs)
        no = sum(n["count"] for n in nouns)
        data = {
            "id": rid, "r": r, "letters": list(norm_root(r)),
            "verbs": verbs, "nouns": nouns,
            "maqayis": maq.get(r, {}).get("text"), "maqayis_ed": maq.get(r, {}).get("ed"),
            "mufradat": muf.get(r, {}).get("text"), "mufradat_ed": muf.get(r, {}).get("ed"),
        }
        with open(os.path.join(OUT, "roots", f"{rid}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        index.append({
            "id": rid, "r": r, "l": norm_root(r),
            "v": len(verbs), "vo": vo, "n": len(nouns), "no": no,
            "lem": [v["lem"] for v in verbs], "nl": [n["lem"] for n in nouns],
            "d": (1 if r in maq else 0) | (2 if r in muf else 0),
        })
    meta = {
        "generated": t0.strftime("%Y-%m-%d"),
        "counts": {"roots": len(index), "verbRoots": sum(1 for x in index if x["v"]),
                   "verbLemmas": sum(x["v"] for x in index), "verbTokens": sum(x["vo"] for x in index),
                   "nounLemmas": sum(x["n"] for x in index), "words": len(words), "verses": len(verses),
                   "maqayis": len(maq), "mufradat": len(muf)},
        "suras": [{"n": s, "name": smeta[s]["name"], "ayas": smeta[s]["ayas"], "type": smeta[s]["type"]} for s in range(1, 115)],
        "basmala": basmala,
        "alphabet": list(ALPHABET),
    }
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "roots": index}, f, ensure_ascii=False, separators=(",", ":"))
    print("done in", dt.datetime.now() - t0)
    print(json.dumps(meta["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
