<div dir="rtl" align="right">

# غابة الجذور 🌳

**خريطة تفاعلية للجذور الثنائية لأفعال القرآن الكريم.**

كلّ شجرة في الغابة جذرٌ ثنائي، تتفرّع منها الجذور الثلاثية التي تشترك في حرفيه، ثم الأفعال الواردة في القرآن من كلّ جذر
مع تصريفاتها ومواضعها في المصحف، ومعاني الجذر في معجمين من أمّهات المعاجم: «مقاييس اللغة» لابن فارس، و«المفردات في غريب القرآن» للراغب الأصفهاني.

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

- **الغابة**: ٤٨٦ شجرة (بالقاعدة الافتراضية) موزّعة على بساتين بحسب الحرف الأول. حجم الشجرة بعدد مواضع أفعالها في القرآن،
  وثمارها الذهبية بعدد أفعالها، والشجيرات الصغيرة جذورٌ لم يرد منها فعل. تحريك بالسحب، تكبير بالعجلة أو بإصبعين، شريط حروف، خريطة مصغّرة، وبحث عن جذر أو فعل أو كلمة.
- **الشجرة**: كلّ غصن جذر ثلاثي وكلّ فرع فعل. النقر على الغصن يعرض أصل الجذر عند ابن فارس ومادّته عند الراغب ومشتقّاته الاسمية؛
  والنقر على الفعل يعرض وزنه وصيغه الواردة (الزمن، الإسناد، البناء للمعلوم/المجهول) وآياته كلّها مع تظليل الكلمة.
- **الأرقام**: ١٦٥١ جذرًا (منها ٩٤١ ورد منه فعل)، ١٤٧٤ فعلًا في ١٩٣٥٣ موضعًا، ٣١٦٣ مشتقًّا اسميًا، ٦٢٣٦ آية.

## المصادر والتراخيص

| المصدر | الاستعمال | الترخيص |
|---|---|---|
| [مدوّنة القرآن العربية](https://corpus.quran.com) (Quranic Arabic Corpus v0.4، جامعة ليدز، كايس دوكس) عبر [quran-morphology](https://github.com/mustafa0x/quran-morphology) | الجذور، الأفعال، الأوزان، التصريف، مواضع الكلمات | GNU GPL |
| [مشروع تنزيل](https://tanzil.net) — الرسم العثماني، الإصدار 1.1 | نصّ الآيات (منقول حرفيًا من غير تغيير) | CC BY 3.0 |
| ابن فارس (ت 395هـ)، **معجم مقاييس اللغة** — عبر [OpenITI](https://github.com/OpenITI) | الأصل المعنوي لكلّ جذر | نصّ تراثي في الملك العام |
| الراغب الأصفهاني (ت 502هـ)، **المفردات في غريب القرآن** — عبر [OpenITI](https://github.com/OpenITI) | مادّة الجذر في مفردات القرآن | نصّ تراثي في الملك العام |

حُذفت من نصوص المعاجم مقدّمات المحقّقين وحواشيهم، وقد تبقى في النصّ آثار من الرقمنة الآلية.
شيفرة التطبيق برخصة MIT (انظر `LICENSE`)، وملفات البيانات المولَّدة في `public/data/` تتبع تراخيص مصادرها أعلاه.

</div>

---

# Forêt des racines (français)

Application web (React + Vite, statique) qui représente les **racines bilitères des verbes du Coran** sous forme de forêt :
chaque arbre est une racine bilitère, ses branches sont les racines trilitères qui partagent ces deux lettres, et les rameaux
sont les verbes attestés dans le Coran, avec toutes leurs occurrences et le sens de la racine dans deux dictionnaires classiques
(Ibn Fāris, *Maqāyīs al-lugha* ; al-Rāghib al-Iṣfahānī, *al-Mufradāt*).

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
Couverture : 1 538 entrées d'Ibn Fāris et 1 523 entrées d'al-Rāghib pour 1 651 racines.

## Structure

```
index.html, src/            application (React 19, TypeScript, Vite 8, SVG maison, aucune dépendance graphique lourde)
src/forest/                 vue « forêt » : disposition en bosquets par lettre, arbres procéduraux, pan/zoom, minicarte
src/tree/                   vue « arbre » : disposition en éventail, panneau (dictionnaires, formes, versets)
scripts/build_data.py       pipeline de données ;  scripts/dicts.py : analyseurs des dictionnaires
public/data/                données générées (≈ 10 Mo, chargées à la demande)
.github/workflows/          déploiement GitHub Pages
```

## Sources et licences

Voir le tableau ci-dessus (section arabe) : Quranic Arabic Corpus (GPL), Tanzil (CC BY 3.0, texte reproduit tel quel),
Ibn Fāris et al-Rāghib (textes du domaine public, via OpenITI). Le code est sous licence MIT.
