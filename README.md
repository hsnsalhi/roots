<div dir="rtl" align="right">

# غابة الجذور 🌳

**خريطة تفاعلية للجذور الثنائية لأفعال القرآن الكريم.**

كلّ شجرة في الغابة جذرٌ ثنائي، تتفرّع منها الجذور الثلاثية التي تشترك في حرفيه، ثم الأفعال الواردة في القرآن من كلّ جذر
مع تصريفاتها ومواضعها في المصحف، وإلى جانبها أفعال الجذر الأخرى التي لم ترد في القرآن كما تذكرها المعاجم،
ومعاني الجذر في أمّهات المعاجم: «مقاييس اللغة» لابن فارس، و«المفردات في غريب القرآن» للراغب الأصفهاني، و«الصحاح» للجوهري،
و«القاموس المحيط» للفيروزآبادي، و«لسان العرب» لابن منظور.

🔗 **الموقع:** <https://hsnsalhi.github.io/roots/>

## الفكرة

ذهب عدد من علماء العربية إلى أنّ الجذور الثلاثية ترجع إلى نواة ثنائية تحمل المعنى العامّ ثم يخصّصه الحرف الثالث
(انظر «الاشتقاق الأكبر» عند ابن جنّي في الخصائص، ومنهج ابن فارس في ردّ كلّ جذر إلى أصل معنوي). هذا التطبيق أداة
للاستقراء والمقارنة: يضع الجذور التي تتشارك في حرفين جنبًا إلى جنب، ويعرض أصولها في المعاجم، وأفعالها في القرآن كلّها.

يتيح التطبيق قاعدتين لاستخراج النواة الثنائية (من الإعدادات):

| القاعدة | المثال |
|---|---|
| **الحرفان الأولان** من الجذر الثلاثي (الافتراضية) | قَلَبَ ← ق‑ل، قَالَ (ق‑و‑ل) ← ق‑و |
| **الحرفان الصحيحان** بعد إسقاط حرف العلّة والتضعيف | قَالَ ← ق‑ل، مَدَّ ← م‑د، رَمَى ← ر‑م |

## ماذا في الغابة؟

- **الغابة**: مشهد ثلاثي الأبعاد (WebGL) فيه ٤٨٦ شجرة (بالقاعدة الافتراضية) موزّعة على بساتين بحسب الحرف الأول، على أرض متموّجة
  بعشبها وظلالها وسمائها ونهارها وليلها. ارتفاع الشجرة بعدد مواضع أفعالها في القرآن، وفوقها لوحة بحرفي جذرها، والشجيرات الصغيرة جذورٌ لم يرد منها فعل.
  دوران بالسحب، اقتراب بالعجلة أو بإصبعين، شريط حروف، لافتات خشبية للبساتين، خريطة مصغّرة، وبحث عن جذر أو فعل أو كلمة.
- **المعنى الجامع**: لوحة صغيرة عند جذع كلّ شجرة تحمل المعنى العامّ المشترك بين جذور المجموعة حين يوجد (نحو: القطع والفصل، الاجتماع والضمّ).
  وهو خلاصة استقرائية استُخلصت من الأصول التي يذكرها ابن فارس لكلّ جذر (ملف `scripts/bi_meanings.json`)، لا يُعرض إلا حين يجمع أكثر الجذور خيطٌ واحد، وهو اجتهاد قابل للمراجعة لا نصّ معجمي.
- **الشجرة**: كلّ غصن جذر ثلاثي وكلّ فرع فعل. الفروع الخضراء المورقة أفعال وردت في القرآن، والفروع الرمادية الجرداء أفعال من الجذر
  وردت في المعاجم ولم ترد في القرآن (يمكن إخفاؤها من الإعدادات). النقر على الغصن يعرض أصل الجذر عند ابن فارس ومادّته عند الراغب
  وفي الصحاح والقاموس المحيط ولسان العرب (يُحمَّل عند الطلب) ومشتقّاته الاسمية؛ والنقر على الفعل يعرض وزنه وصيغه الواردة
  (الزمن، الإسناد، البناء للمعلوم/المجهول) وآياته كلّها مع تظليل الكلمة، ثم المصادر المعجمية التي تذكره؛ والنقر على فعل رمادي يعرض
  وزنه ومضارعه وتعدّيه ومصدره ومصادره وشاهدًا من مادّة الجذر في أحد المعاجم.
- **أفعال المعاجم**: عند كلّ فعل شارات بالمصادر التي وُجد فيها: القرآن، الرموز (معجم الرموز الوسيط)، ويكاموس، الصحاح، القاموس، اللسان.
  أفعال المعاجم القديمة (وهي غير مشكولة) تُستخرج آليًا بصيغ الاستشهاد المعتادة في مادّة الجذر (فَعَلَ يَفْعُلُ، المصادر، الأوزان المزيدة المميِّزة)،
  فهي توثيق تقريبي قد يفوته فعل أو يخطئ في آخر.
- **الأرقام**: ١٦٥١ جذرًا (منها ٩٤١ ورد منه فعل)، ١٤٧٠ فعلًا قرآنيًا في ١٩٣٥٣ موضعًا، ٣١٦٣ مشتقًّا اسميًا، ٦٢٣٦ آية؛
  و٧٩٦٧ فعلًا في المعاجم منها ٦٤٩٧ لم ترد في القرآن.

## المصادر والتراخيص

| المصدر | الاستعمال | الترخيص |
|---|---|---|
| [مدوّنة القرآن العربية](https://corpus.quran.com) (Quranic Arabic Corpus v0.4، جامعة ليدز، كايس دوكس) عبر [quran-morphology](https://github.com/mustafa0x/quran-morphology) | الجذور، الأفعال، الأوزان، التصريف، مواضع الكلمات | GNU GPL |
| [مشروع تنزيل](https://tanzil.net) — الرسم العثماني، الإصدار 1.1 | نصّ الآيات (منقول حرفيًا من غير تغيير) | CC BY 3.0 |
| ابن فارس (ت 395هـ)، **معجم مقاييس اللغة** — عبر [OpenITI](https://github.com/OpenITI) | الأصل المعنوي لكلّ جذر | نصّ تراثي في الملك العام |
| الراغب الأصفهاني (ت 502هـ)، **المفردات في غريب القرآن** — عبر [OpenITI](https://github.com/OpenITI) | مادّة الجذر في مفردات القرآن | نصّ تراثي في الملك العام |
| الجوهري (ت 393هـ)، **الصحاح**؛ الفيروزآبادي (ت 817هـ)، **القاموس المحيط**؛ ابن منظور (ت 711هـ)، **لسان العرب** — رقمنة المكتبة الشاملة عبر [OpenITI](https://github.com/OpenITI) | مادّة الجذر، واستخراج أفعاله وتوثيقها | نصوص تراثية في الملك العام |
| [معجم الرموز الوسيط](https://github.com/linuxscout/arramooz) (طه زروقي ومحمد كبداني)، عبر حزمة `arramooz-pysqlite` | أفعال الجذر بضبطها ومضارعها وتعدّيها | GNU GPL |
| [ويكاموس الإنجليزي](https://en.wiktionary.org) عبر مستخرج [kaikki.org](https://kaikki.org/dictionary/Arabic/) (Wiktextract) | أفعال الجذر بأوزانها ومضارعها ومصادرها ومعانيها | CC BY-SA 4.0 |

حُذفت من نصوص المعاجم مقدّمات المحقّقين وحواشيهم، وقد تبقى في النصّ آثار من الرقمنة الآلية.
شيفرة التطبيق برخصة MIT (انظر `LICENSE`)، وملفات البيانات المولَّدة في `public/data/` تتبع تراخيص مصادرها أعلاه.

</div>

---

# Forêt des racines (français)

Application web (React + Vite + three.js, statique) qui représente les **racines bilitères des verbes du Coran** sous forme de forêt 3D :
chaque arbre est une racine bilitère, ses branches sont les racines trilitères qui partagent ces deux lettres, et les rameaux
sont les verbes attestés dans le Coran (rameaux verts feuillus), avec toutes leurs occurrences, complétés par les autres verbes
de la racine que donnent les dictionnaires mais que le Coran n'emploie pas (rameaux gris nus, masquables). Le sens de la racine
est donné par cinq dictionnaires classiques (Ibn Fāris, *Maqāyīs al-lugha* ; al-Rāghib al-Iṣfahānī, *al-Mufradāt* ; al-Jawharī,
*al-Ṣiḥāḥ* ; al-Fīrūzābādī, *al-Qāmūs al-muḥīṭ* ; Ibn Manẓūr, *Lisān al-ʿarab*, chargé à la demande).

**Site :** <https://hsnsalhi.github.io/roots/>

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit le site à chaque push sur la branche `main` et publie le dossier
`dist/` dans la branche `gh-pages`. GitHub Pages sert cette branche à l'adresse `https://<utilisateur>.github.io/<dépôt>/`.

Si le site n'apparaît pas après le premier déploiement, activez Pages une seule fois à la main :
**Settings → Pages → Build and deployment → Source : Deploy from a branch → Branch : `gh-pages` / `(root)`**.
La configuration Vite utilise une base relative, donc n'importe quel sous-chemin fonctionne.

## Développement local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produit dist/
npm run preview
```

## Régénérer les données

Les fichiers de `public/data/` sont produits par un script Python (bibliothèque standard uniquement) :

```bash
scripts/fetch_sources.sh      # télécharge les sources brutes dans scripts/sources/ (ignoré par git)
python3 scripts/build_data.py # écrit public/data/index.json, roots/*.json, quran/*.json
```

Le script aligne mot à mot la morphologie du corpus avec le texte de Tanzil (la basmala d'ouverture est détachée du premier
verset des sourates), regroupe les occurrences par lemme et par forme (temps, personne, voix, mode), puis extrait les entrées
des deux dictionnaires (édition Shamela/JK pour Ibn Fāris, édition Masaha/JK pour al-Rāghib) en supprimant l'apparat des éditeurs modernes.
Couverture : 1 549 entrées d'Ibn Fāris, 1 523 d'al-Rāghib, 1 593 du Ṣiḥāḥ, 1 537 du Qāmūs et 1 626 du Lisān pour 1 651 racines.

Les verbes hors Coran viennent de deux sources vocalisées, Arramooz Alwaseet (GPL) et le Wiktionnaire anglais (extrait
kaikki.org, CC BY-SA), fusionnées par squelette consonantique et forme verbale, puis de l'extraction automatique des trois
dictionnaires classiques (non vocalisés) : pour chaque racine, le module `scripts/lexicon.py` engendre les squelettes des formes
I à X (racines saines, sourdes, hamzées, assimilées, concaves, défectueuses, quadrilitères) et cherche dans l'entrée de la racine
les cadres de citation habituels (فعل يفعل, noms verbaux et participes des formes dérivées, formes à préfixe distinctif) ;
un verbe déjà connu est « attesté » par le dictionnaire, un verbe inconnu des sources vocalisées n'est « découvert » que par
un cadre non ambigu. Chaque verbe porte la liste de ses sources et un extrait de l'entrée. Les lemmes du corpus qui ne sont pas
des formes de citation (يُحْمَدُ, مَلَكَتْ) sont ramenés à l'accompli de 3e personne par appariement avec ce lexique.
Résultat : 7 967 verbes, dont 6 497 absents du Coran.
Le « sens commun » (المعنى الجامع) affiché sous chaque arbre vient du fichier `scripts/bi_meanings.json` : une synthèse
prudente, groupe par groupe, des sens fondamentaux qu'Ibn Fāris donne aux racines du groupe (null quand aucun fil conducteur
net ne se dégage). C'est une interprétation révisable, pas une entrée de dictionnaire ; le fichier peut être corrigé à la main.

## Structure

```
index.html, src/            application (React 19, TypeScript, Vite 8, three.js pour la forêt, SVG pour l'arbre)
src/forest3d/               vue « forêt » 3D : terrain, arbres procéduraux texturés, ombres, ciel/brume, herbe, caméra orbitale, minicarte
src/tree/                   vue « arbre » : disposition en éventail, panneau (dictionnaires, formes, versets)
scripts/build_data.py       pipeline de données ;  scripts/dicts.py : analyseurs des dictionnaires de sens
scripts/lexicon.py          verbes hors Coran : Arramooz, Wiktionnaire, Lisān/Qāmūs/Ṣiḥāḥ (morphologie, attestation, fusion)
scripts/extract_wiktionary.py   réduction de l'extrait kaikki.org du Wiktionnaire
public/data/                données générées (≈ 40 Mo dont 20 Mo de Lisān, chargées à la demande par racine)
.github/workflows/          déploiement GitHub Pages
```

## Sources et licences

Voir le tableau ci-dessus (section arabe) : Quranic Arabic Corpus (GPL), Tanzil (CC BY 3.0, texte reproduit tel quel),
Ibn Fāris, al-Rāghib, al-Jawharī, al-Fīrūzābādī et Ibn Manẓūr (textes du domaine public, via OpenITI), Arramooz Alwaseet (GPL),
Wiktionnaire anglais (CC BY-SA 4.0). Le code est sous licence MIT.
