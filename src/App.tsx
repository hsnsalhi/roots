import { useEffect, useMemo, useState } from 'react';
import { loadIndex } from './data';
import { groupBiliteral, dashed } from './roots';
import { SettingsProvider, useSettings } from './settings';
import { useRoute, navigate, hrefTree } from './router';
import type { IndexFile } from './types';
import Header from './components/Header';
import Forest3D from './forest3d/Forest3D';
import TreeView from './tree/TreeView';
import About from './components/About';

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}

function Shell() {
  const route = useRoute();
  const { settings } = useSettings();
  const [index, setIndex] = useState<IndexFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [about, setAbout] = useState(false);

  useEffect(() => {
    loadIndex().then(setIndex).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const roots = useMemo(() => {
    if (!index) return [];
    return settings.showEmpty ? index.roots : index.roots.filter((r) => r.v > 0);
  }, [index, settings.showEmpty]);
  const bis = useMemo(() => groupBiliteral(roots, settings.rule, index?.bi ?? {}), [roots, settings.rule, index]);
  const biMap = useMemo(() => new Map(bis.map((b) => [b.id, b])), [bis]);

  useEffect(() => {
    if (route.view === 'tree') {
      document.title = `${dashed(route.bi)}${route.root ? ' · ' + route.root : ''} — غابة الجذور`;
    } else document.title = 'غابة الجذور — جذور أفعال القرآن الكريم';
  }, [route]);

  let content;
  if (error) content = <div className="error">تعذّر تحميل البيانات: {error}</div>;
  else if (!index) content = <div className="loading"><div><div className="spinner" />جارٍ تحميل الغابة…</div></div>;
  else if (route.view === 'tree') {
    const bi = biMap.get(route.bi);
    if (!bi) {
      content = (
        <div className="error">
          <div>
            لا توجد شجرة بهذا الجذر «{dashed(route.bi)}» وفق القاعدة الحالية.
            <br />
            <a href="#/">العودة إلى الغابة</a>
          </div>
        </div>
      );
    } else content = <TreeView key={bi.id} bi={bi} index={index} route={route} />;
  } else content = <Forest3D bis={bis} letter={route.letter} onSelect={(b) => navigate(hrefTree(b.id))} />;

  return (
    <div className="app">
      <Header index={index} bis={bis} onAbout={() => setAbout(true)} />
      <main className="main">{content}</main>
      {about && <About index={index} onClose={() => setAbout(false)} />}
    </div>
  );
}
