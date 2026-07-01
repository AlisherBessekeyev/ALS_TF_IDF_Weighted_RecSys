// App root: tabs + state + tweaks panel + cart drawer.

const { useState: aUseState, useEffect: aUseEffect, useMemo: aUseMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "lang": "en",
  "palette": "default",
  "typePair": "instrument",
  "density": "comfy"
}/*EDITMODE-END*/;

function App({ products, stats, metrics }) {
  const [tab, setTab] = aUseState('storefront'); // storefront | dashboard
  const [view, setView] = aUseState({ kind: 'home' });
  const [cart, setCart] = aUseState([]);
  const [cartOpen, setCartOpen] = aUseState(false);
  const [history, setHistory] = aUseState([]); // simulated user purchase history

  // Tweaks
  const [tweaks, setTweaks] = useTweaks(TWEAK_DEFAULTS);
  const lang = tweaks.lang;

  // Sync html data attrs for palette/density/type
  aUseEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-palette', tweaks.palette);
    html.setAttribute('data-density', tweaks.density);
    html.setAttribute('data-type', tweaks.typePair);
    html.setAttribute('lang', tweaks.lang);
  }, [tweaks]);

  // Scroll to top when view changes
  aUseEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [view, tab]);

  function addToCart(product) {
    setCart(prev => {
      const found = prev.find(i => i.product.id === product.id);
      if (found) return prev.map(i => i.product.id === product.id ? {...i, qty: i.qty+1} : i);
      return [...prev, { product, qty: 1 }];
    });
    // also count toward simulated user history (capped to last 8)
    setHistory(prev => {
      if (prev.find(p => p.id === product.id)) return prev;
      return [...prev, product].slice(-8);
    });
    setCartOpen(true);
  }

  const product = view.kind === 'pdp' ? products.find(p => p.id === view.id) : null;
  const t = I18N[lang];

  return (
    <>
      <TopBar lang={lang} view={view} setView={(v)=>{ setTab('storefront'); setView(v); }}
        cart={cart} onOpenCart={()=>setCartOpen(true)}/>

      <div className="kz-tabs">
        <div className="kz-tabs-inner">
          <button className={`kz-tab-btn ${tab==='storefront'?'is-active':''}`} onClick={()=>setTab('storefront')}>
            01 / {t.tab_storefront}
          </button>
          <button className={`kz-tab-btn ${tab==='dashboard'?'is-active':''}`} onClick={()=>setTab('dashboard')}>
            02 / {t.tab_dashboard}
          </button>
          <span className="kz-tabs-spacer"/>
          <span className="kz-mono kz-tabs-meta">
            {tab==='storefront' ? '— EDITION Nº01' : '— THESIS P2773314 / OFFLINE EVAL · v1'}
          </span>
        </div>
      </div>

      {tab === 'storefront' ? (
        <>
          {view.kind === 'home'   && <Home   products={products} lang={lang} history={history} setView={setView} addToCart={addToCart}/>}
          {view.kind === 'browse' && <Browse products={products} lang={lang} setView={setView} initialFilter={view.filter}/>}
          {view.kind === 'pdp'    && <PDP    product={product} products={products} lang={lang} setView={setView} addToCart={addToCart}/>}
        </>
      ) : (
        <Dashboard products={products} stats={stats} metrics={metrics} lang={lang}/>
      )}

      <footer className="kz-footer">
        <div className="kz-footer-inner">
          <div>
            <div className="kz-footer-mark">Kazan</div>
            <div className="kz-mono kz-dim" style={{marginTop: 8}}>{t.footer_a}</div>
          </div>
          <p className="kz-footer-mid">{t.footer_b}</p>
          <div className="kz-footer-meta">
            <div>{t.footer_c}</div>
            <div>Ed. 01 · Spring 2026</div>
            <div>Print run · 1 copy</div>
          </div>
        </div>
      </footer>

      <CartDrawer open={cartOpen} onClose={()=>setCartOpen(false)} cart={cart} setCart={setCart} lang={lang} setView={setView}/>

      <KazanTweaks tweaks={tweaks} setTweak={setTweaks}/>
    </>
  );
}

function KazanTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Language">
        <TweakRadio
          value={tweaks.lang}
          onChange={(v)=>setTweak('lang', v)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ru', label: 'Русский' }
          ]}
        />
      </TweakSection>

      <TweakSection title="Palette">
        <TweakColor
          value={tweaks.palette}
          onChange={(v)=>setTweak('palette', v)}
          options={[
            { value: 'default', color: ['#F6F2EA','#1B1A17','#8E4B2A'] },
            { value: 'cocoa',   color: ['#ECE3D2','#2A1F14','#6B4326'] },
            { value: 'sage',    color: ['#EFEDE3','#1F2A22','#4F6B45'] },
            { value: 'ink',     color: ['#15161A','#ECE6D8','#D9A26A'] }
          ]}
        />
      </TweakSection>

      <TweakSection title="Type pair">
        <TweakSelect
          value={tweaks.typePair}
          onChange={(v)=>setTweak('typePair', v)}
          options={[
            { value: 'instrument', label: 'Instrument Serif + Geist' },
            { value: 'cormorant',  label: 'Cormorant + Geist' },
            { value: 'newsreader', label: 'Newsreader + Geist' },
            { value: 'dmsans',     label: 'DM Serif Display + DM Sans' }
          ]}
        />
      </TweakSection>

      <TweakSection title="Density">
        <TweakRadio
          value={tweaks.density}
          onChange={(v)=>setTweak('density', v)}
          options={[
            { value: 'comfy',   label: 'Comfy' },
            { value: 'compact', label: 'Compact' }
          ]}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

async function loadJSON(id, fetchPath) {
  const tag = document.getElementById(id);
  if (tag && tag.textContent.trim()) {
    try { return JSON.parse(tag.textContent); } catch(_) {}
  }
  return fetch(fetchPath).then(r => r.json());
}

async function boot() {
  const [products, stats, metrics] = await Promise.all([
    loadJSON('data-products', 'data/sample-products.json'),
    loadJSON('data-stats',    'data/stats.json'),
    loadJSON('data-metrics',  'data/metrics.json')
  ]);
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App products={products} stats={stats} metrics={metrics}/>);
}
boot();
