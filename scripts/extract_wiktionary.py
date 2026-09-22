#!/usr/bin/env python3
"""Reduce the kaikki.org (Wiktextract) dump of English-Wiktionary Arabic verbs to
the few fields build_data.py needs: one line per verb lemma with its vocalised
citation form(s), verb form (وزن), vowels, root, non-past, verbal nouns, and glosses.

usage: extract_wiktionary.py <kaikki.org-dictionary-Arabic-by-pos-verb.jsonl> <out.jsonl>

Wiktionary text is CC BY-SA 4.0; the extract keeps the page title (``word``) so
that every record can be traced back to https://en.wiktionary.org/wiki/<word>.
"""
from __future__ import annotations

import json
import re
import sys

ROOTCAT = re.compile(r"^Arabic terms belonging to the root (.+)$")
HEAD_ARG = re.compile(r"^([IVX]+q?)(?:/([aiu])~([aiu,]+))?")
FORM_TAG = re.compile(r"^form-([ivx]+)(q?)$")
ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10,
         "xi": 11, "xii": 12, "xiii": 13, "xiv": 14, "xv": 15}


def main(src: str, dst: str) -> None:
    n_in = n_out = 0
    with open(src, encoding="utf-8") as f, open(dst, "w", encoding="utf-8") as out:
        for line in f:
            n_in += 1
            d = json.loads(line)
            heads = d.get("head_templates") or []
            if not any(h.get("name") == "ar-verb" for h in heads):
                continue
            roots: list[str] = []
            for t in d.get("etymology_templates") or []:
                if t.get("name") in ("ar-rootbox", "ar-root"):
                    for k, v in (t.get("args") or {}).items():
                        if k.isdigit() and v and v not in roots:
                            roots.append(v)
            cats = list(d.get("categories") or [])
            senses = d.get("senses") or []
            for s in senses:
                cats += list(s.get("categories") or [])
            for c in cats:
                nm = c.get("name", "") if isinstance(c, dict) else str(c)
                m = ROOTCAT.match(nm)
                if m and m.group(1) not in roots:
                    roots.append(m.group(1))
            # one record per head (a page can carry several verbs: رَشَدَ / رَشِدَ)
            by_head: dict[int, dict] = {}
            forms = d.get("forms") or []
            for fm in forms:
                if fm.get("source") == "conjugation":
                    continue
                tags = fm.get("tags") or []
                nr = fm.get("head_nr", 1)
                rec = by_head.setdefault(nr, {"v": None, "form": 0, "quad": False, "np": [], "vn": []})
                if "canonical" in tags:
                    rec["v"] = fm.get("form")
                    for t in tags:
                        m = FORM_TAG.match(t)
                        if m:
                            rec["form"] = ROMAN.get(m.group(1), 0)
                            rec["quad"] = bool(m.group(2))
                elif "non-past" in tags:
                    rec["np"].append(fm.get("form"))
                elif "noun-from-verb" in tags:
                    rec["vn"].append(fm.get("form"))
            ar_heads = [h for h in heads if h.get("name") == "ar-verb"]
            glosses = []
            tags_all: set[str] = set()
            for s in senses:
                g = s.get("glosses") or []
                if g:
                    glosses.append("; ".join(g))
                for t in s.get("tags") or []:
                    tags_all.add(t)
            for i, h in enumerate(ar_heads, start=1):
                rec = by_head.get(i) or by_head.get(1) or {}
                if not rec.get("v"):
                    continue
                arg = (h.get("args") or {}).get("1", "")
                m = HEAD_ARG.match(arg)
                past_v = m.group(2) if m else None
                np_v = m.group(3).split(",") if m and m.group(3) else []
                out.write(json.dumps({
                    "word": d["word"], "v": rec["v"], "form": rec["form"], "quad": rec["quad"],
                    "pv": past_v, "nv": np_v, "np": rec["np"], "vn": rec["vn"],
                    "roots": roots, "g": glosses[:3], "tr": ("transitive" in tags_all) or None,
                    "itr": ("intransitive" in tags_all) or None,
                }, ensure_ascii=False) + "\n")
                n_out += 1
    print(f"wiktionary: {n_in} entries read, {n_out} verb lemmas written", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
