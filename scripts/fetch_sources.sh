#!/usr/bin/env bash
# Downloads the raw sources used by build_data.py into scripts/sources/.
# All sources are open: see README.md ("المصادر") for licences and attribution.
set -euo pipefail
cd "$(dirname "$0")/sources"

# 1. Quranic Arabic Corpus v0.4 morphology (Kais Dukes, University of Leeds, GPL),
#    in the Arabic-script conversion maintained at github.com/mustafa0x/quran-morphology
curl -fsSL -o quran-morphology.txt \
  "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt"

# 2. Tanzil Quran text, Uthmani script, v1.1 (CC BY 3.0, verbatim, with attribution to tanzil.net)
curl -fsSL -o quran-uthmani.txt \
  "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true"
curl -fsSL -o quran-data.xml "https://tanzil.net/res/text/metadata/quran-data.xml"

# 3. Ibn Faris (d. 1004 CE / 395 AH), Mu'jam Maqayis al-Lugha — OpenITI corpus editions
OI="https://raw.githubusercontent.com/OpenITI"
curl -fsSL -o maqayis_shamela.txt \
  "$OI/0400AH/master/data/0395IbnFarisQazwini/0395IbnFarisQazwini.MucjamMaqayis/0395IbnFarisQazwini.MucjamMaqayis.Shamela0021710-ara1"
curl -fsSL -o maqayis_jk.txt \
  "$OI/0400AH/master/data/0395IbnFarisQazwini/0395IbnFarisQazwini.MucjamMaqayis/0395IbnFarisQazwini.MucjamMaqayis.JK008008-ara1"

# 4. Al-Raghib al-Isfahani (d. 1108 CE / 502 AH), al-Mufradat fi Gharib al-Qur'an — OpenITI corpus editions
curl -fsSL -o mufradat_masaha.txt \
  "$OI/0525AH/master/data/0502RaghibIsbahani/0502RaghibIsbahani.Mufradat/0502RaghibIsbahani.Mufradat.Masaha003644-ara1"
curl -fsSL -o mufradat_shamela.txt \
  "$OI/0525AH/master/data/0502RaghibIsbahani/0502RaghibIsbahani.Mufradat/0502RaghibIsbahani.Mufradat.Shamela0023636-ara1"
curl -fsSL -o mufradat_jk.txt \
  "$OI/0525AH/master/data/0502RaghibIsbahani/0502RaghibIsbahani.Mufradat/0502RaghibIsbahani.Mufradat.JK001150-ara1"


# 5. Arramooz Alwaseet (Taha Zerrouki, GPL): Arabic verbs with their roots, via the arramooz-pysqlite wheel on PyPI
tmp=$(mktemp -d)
pip download arramooz-pysqlite==0.4.2 --no-deps -d "$tmp" >/dev/null
unzip -o -q "$tmp"/arramooz_pysqlite-*.whl 'arramooz/data/arabicdictionary.sqlite' -d "$tmp"
cp "$tmp/arramooz/data/arabicdictionary.sqlite" arramooz.sqlite
rm -rf "$tmp"

# 6. English Wiktionary, Arabic verbs (CC BY-SA 4.0), through the kaikki.org / Wiktextract dump,
#    reduced to the fields the pipeline needs (the raw file is ~290 MB and is not kept)
wikt=$(mktemp)
curl -fsSL -o "$wikt" \
  "https://kaikki.org/dictionary/Arabic/pos-verb/kaikki.org-dictionary-Arabic-by-pos-verb.jsonl"
python3 ../extract_wiktionary.py "$wikt" wiktionary_verbs.jsonl
rm -f "$wikt"

# 7. Three classical dictionaries (public-domain texts, Shamela digitisations, OpenITI corpus):
#    Ibn Manzur (d. 1311 CE / 711 AH), Lisan al-Arab; al-Firuzabadi (d. 1415 CE / 817 AH), al-Qamus al-Muhit;
#    al-Jawhari (d. 1003 CE / 393 AH), al-Sihah
curl -fsSL -o lisan.txt \
  "$OI/0725AH/master/data/0711IbnManzurIfriqi/0711IbnManzurIfriqi.LisanCarab/0711IbnManzurIfriqi.LisanCarab.Shamela0001687-ara1.mARkdown"
curl -fsSL -o qamus.txt \
  "$OI/0825AH/master/data/0817MajdDinFiruzabadi/0817MajdDinFiruzabadi.QamusMuhit/0817MajdDinFiruzabadi.QamusMuhit.Shamela0007283-ara1"
curl -fsSL -o sihah.txt \
  "$OI/0400AH/master/data/0393IbnHammadJawhari/0393IbnHammadJawhari.SihahTajLugha/0393IbnHammadJawhari.SihahTajLugha.Shamela0023235-ara1"

# 8. Four more dictionaries (public-domain texts, Shamela digitisations, OpenITI corpus):
#    al-Khalil (d. 786 CE / 170 AH), Kitab al-Ayn; al-Azhari (d. 980 CE / 370 AH), Tahdhib al-Lugha;
#    Ibn Sida (d. 1066 CE / 458 AH), al-Muhkam; al-Zabidi (d. 1790 CE / 1205 AH), Taj al-Arus
curl -fsSL -o ayn.txt \
  "$OI/0175AH/master/data/0170KhalilFarahidi/0170KhalilFarahidi.Cayn/0170KhalilFarahidi.Cayn.Shamela0001682-ara1"
curl -fsSL -o tahdhib.txt \
  "$OI/0375AH/master/data/0370AbuMansurAzhari/0370AbuMansurAzhari.TahdhibLugha/0370AbuMansurAzhari.TahdhibLugha.Shamela0007031-ara1"
curl -fsSL -o muhkam.txt \
  "$OI/0475AH/master/data/0458IbnSidaMursi/0458IbnSidaMursi.MuhkamWaMuhit/0458IbnSidaMursi.MuhkamWaMuhit.Shamela0009757-ara1"
curl -fsSL -o taj.txt \
  "$OI/1225AH/master/data/1205MurtadaZabidi/1205MurtadaZabidi.TajCarus/1205MurtadaZabidi.TajCarus.Shamela0007030-ara1"
echo "done"
