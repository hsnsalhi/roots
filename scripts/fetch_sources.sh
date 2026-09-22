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

# 3. Ibn Faris (d. 395 AH), Mu'jam Maqayis al-Lugha — OpenITI corpus editions
OI="https://raw.githubusercontent.com/OpenITI"
curl -fsSL -o maqayis_shamela.txt \
  "$OI/0400AH/master/data/0395IbnFarisQazwini/0395IbnFarisQazwini.MucjamMaqayis/0395IbnFarisQazwini.MucjamMaqayis.Shamela0021710-ara1"
curl -fsSL -o maqayis_jk.txt \
  "$OI/0400AH/master/data/0395IbnFarisQazwini/0395IbnFarisQazwini.MucjamMaqayis/0395IbnFarisQazwini.MucjamMaqayis.JK008008-ara1"

# 4. Al-Raghib al-Isfahani (d. 502 AH), al-Mufradat fi Gharib al-Qur'an — OpenITI corpus editions
curl -fsSL -o mufradat_masaha.txt \
  "$OI/0525AH/master/data/0502RaghibIsbahani/0502RaghibIsbahani.Mufradat/0502RaghibIsbahani.Mufradat.Masaha003644-ara1"
curl -fsSL -o mufradat_shamela.txt \
  "$OI/0525AH/master/data/0502RaghibIsbahani/0502RaghibIsbahani.Mufradat/0502RaghibIsbahani.Mufradat.Shamela0023636-ara1"
curl -fsSL -o mufradat_jk.txt \
  "$OI/0525AH/master/data/0502RaghibIsbahani/0502RaghibIsbahani.Mufradat/0502RaghibIsbahani.Mufradat.JK001150-ara1"
echo "done"
