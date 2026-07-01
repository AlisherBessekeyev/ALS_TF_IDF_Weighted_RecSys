// Storefront: home / browse / PDP / cart, all in one SPA-style state machine

const { useState, useMemo, useEffect, useRef } = React;

// Recommender mock — produces "for you" and "pairs well with" lists from the
// curated sample, biased by category similarity + popularity

function recommendForUser(products, history, k = 6) {
  if (!products.length) return [];
  if (!history || !history.length) {
    // Cold start: top by popularity, but spread categories
    const byCat = {};
    [...products].sort((a,b)=>b.pop-a.pop).forEach(p => {
      if (!byCat[p.cat]) byCat[p.cat] = [];
      byCat[p.cat].push(p);
    });
    const cats = Object.keys(byCat);
    const out = [];
    let i = 0;
    while (out.length < k && i < 20) {
      cats.forEach(c => { if (byCat[c][i] && out.length < k) out.push(byCat[c][i]); });
      i++;
    }
    return out;
  }
  // Warm: weight by category match + price-band proximity, exclude history
  const histSet = new Set(history.map(p=>p.id));
  const histCats = {};
  let avgPrice = 0;
  history.forEach(p => { histCats[p.cat] = (histCats[p.cat]||0)+1; avgPrice += p.price; });
  avgPrice /= history.length;

  const scored = products.filter(p => !histSet.has(p.id)).map(p => {
    const catScore = (histCats[p.cat] || 0) / history.length;       // 0..1
    const priceScore = 1 - Math.min(1, Math.abs(p.price - avgPrice) / 25000);
    const popScore = Math.min(1, p.pop / 25);
    const score = catScore * 0.55 + popScore * 0.30 + priceScore * 0.15;
    return { ...p, _score: score };
  });
  scored.sort((a,b)=> b._score - a._score);
  return scored.slice(0, k);
}

function relatedTo(products, anchor, k = 4) {
  if (!anchor) return [];
  const sameCat = products.filter(p => p.cat === anchor.cat && p.id !== anchor.id);
  const scored = sameCat.map(p => {
    const priceScore = 1 - Math.min(1, Math.abs(p.price - anchor.price) / 20000);
    const brandBonus = p.brand === anchor.brand ? 0.1 : 0;
    const popScore = Math.min(1, p.pop / 30);
    return { ...p, _score: priceScore * 0.55 + popScore * 0.35 + brandBonus };
  });
  scored.sort((a,b)=> b._score - a._score);
  return scored.slice(0, k);
}

// Top chrome

function TopBar({ lang, view, setView, cart, onOpenCart }) {
  const t = I18N[lang];
  const cartCount = cart.reduce((a,b)=>a+b.qty,0);
  return (
    <header className="kz-top">
      <div className="kz-top-inner">
        <button className="kz-logo" onClick={() => setView({ kind: 'home' })} aria-label="Kazan home">
          <span className="kz-logo-mark">K</span>
          <span className="kz-logo-word">Kazan</span>
        </button>
        <nav className="kz-nav">
          <button className={`kz-nav-link ${view.kind==='home'?'is-active':''}`} onClick={() => setView({ kind: 'home' })}>{t.nav_shop}</button>
          <button className={`kz-nav-link ${view.kind==='browse'?'is-active':''}`} onClick={() => setView({ kind: 'browse' })}>{t.nav_journal}</button>
          <button className="kz-nav-link" onClick={() => setView({ kind: 'browse' })}>{t.nav_about}</button>
        </nav>
        <div className="kz-top-actions">
          <span className="kz-mono kz-top-meta">ALMATY · 11°</span>
          <button className="kz-cart-btn" onClick={onOpenCart} aria-label="Open basket">
            <span className="kz-mono">[basket</span>
            <span className="kz-cart-count">{cartCount.toString().padStart(2,'0')}</span>
            <span className="kz-mono">]</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// Product card

function ProductCard({ product, lang, onClick, layout = 'grid' }) {
  const t = I18N[lang];
  const name = lang === 'ru' ? product.name_ru : product.name_en;
  const meta = CATEGORY_META[product.cat];
  const catName = lang === 'ru' ? meta.ru : meta.en;
  const rating = ratingFor(product.id);
  const reviews = reviewsFor(product.id);
  return (
    <article className={`kz-card kz-card-${layout}`} onClick={onClick} role="button" tabIndex="0"
      onKeyDown={(e)=>{ if(e.key==='Enter') onClick(); }}>
      <ProductPlaceholder category={product.cat} size={layout==='grid'?'md':'sm'} label={`${meta.short.toLowerCase()}_${product.id}.jpg`}/>
      <div className="kz-card-body">
        <div className="kz-card-meta">
          <span className="kz-mono kz-card-cat">{catName}</span>
          <span className="kz-mono kz-card-rating">★ {rating} <span className="kz-dim">· {reviews}</span></span>
        </div>
        <h3 className="kz-card-name">{name}</h3>
        <div className="kz-card-foot">
          <span className="kz-card-price">{fmtKZT(product.price, lang)}</span>
          <span className="kz-mono kz-card-sku">№{product.id.toString().padStart(4,'0')}</span>
        </div>
      </div>
    </article>
  );
}


// Home

function Home({ products, lang, history, setView, addToCart }) {
  const t = I18N[lang];
  const recs = useMemo(() => recommendForUser(products, history, 4), [products, history]);
  const popular = useMemo(() => [...products].sort((a,b)=>b.pop-a.pop).slice(0, 6), [products]);
  const cats = Object.keys(CATEGORY_META);

  return (
    <main className="kz-main">
      {/* Hero ------------------------------------------------------------- */}
      <section className="kz-hero">
        <div className="kz-hero-grid">
          <div className="kz-hero-text">
            <span className="kz-mono kz-eyebrow">{t.hero_eyebrow}</span>
            <h1 className="kz-hero-title">
              <em className="kz-display">{t.hero_title_a}</em><br/>
              <em className="kz-display kz-hero-title-2">{t.hero_title_b}</em>
            </h1>
            <p className="kz-hero-sub">{t.hero_sub}</p>
            <div className="kz-hero-ctas">
              <button className="kz-btn kz-btn-primary" onClick={() => setView({ kind: 'browse' })}>{t.hero_cta} →</button>
              <button className="kz-btn kz-btn-ghost">{t.hero_cta_alt}</button>
            </div>
            <div className="kz-hero-meta kz-mono">{t.hero_meta}</div>
          </div>
          <div className="kz-hero-art">
            <div className="kz-hero-card">
              <ProductPlaceholder category="Portable Kettle" size="xl" label="hero_kettle.tif"/>
              <div className="kz-hero-card-tag kz-mono">
                <span>FIG. 01</span>
                <span>—</span>
                <span>SwiftKettle 193-X</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Rule/>

      {/* Categories ------------------------------------------------------- */}
      <section className="kz-section">
        <header className="kz-section-head">
          <div>
            <h2 className="kz-display kz-section-title">{t.sec_categories}</h2>
            <p className="kz-section-sub">{t.sec_categories_sub}</p>
          </div>
          <span className="kz-mono kz-dim">{cats.length.toString().padStart(2,'0')} / {cats.length.toString().padStart(2,'0')}</span>
        </header>
        <div className="kz-cats">
          {cats.map((c, i) => {
            const meta = CATEGORY_META[c];
            const count = products.filter(p=>p.cat===c).length;
            return (
              <button key={c} className="kz-cat" onClick={() => setView({ kind: 'browse', filter: c })}>
                <span className="kz-cat-num kz-mono">{(i+1).toString().padStart(2,'0')}</span>
                <span className="kz-cat-glyph"><CatGlyph category={c} size={48}/></span>
                <span className="kz-cat-name">{lang==='ru'?meta.ru:meta.en}</span>
                <span className="kz-cat-meta kz-mono">{count} →</span>
              </button>
            );
          })}
        </div>
      </section>

      <Rule/>

      {/* For you (recommendations) --------------------------------------- */}
      <section className="kz-section kz-section-cream">
        <header className="kz-section-head">
          <div>
            <span className="kz-mono kz-eyebrow kz-eyebrow-tight">— {t.rec_strip_label}</span>
            <h2 className="kz-display kz-section-title">{t.sec_for_you}</h2>
            <p className="kz-section-sub">{t.sec_for_you_sub}</p>
          </div>
          <span className="kz-mono kz-dim">hybrid · k=4</span>
        </header>
        <div className="kz-rec-strip">
          {recs.map((p, i) => (
            <div key={p.id} className="kz-rec-item">
              <span className="kz-rec-rank kz-mono">{(i+1).toString().padStart(2,'0')}</span>
              <ProductCard product={p} lang={lang} onClick={()=>setView({kind:'pdp', id:p.id})}/>
            </div>
          ))}
        </div>
      </section>

      <Rule/>

      {/* Most popular ----------------------------------------------------- */}
      <section className="kz-section">
        <header className="kz-section-head">
          <div>
            <h2 className="kz-display kz-section-title">{t.sec_popular}</h2>
            <p className="kz-section-sub">{t.sec_popular_sub}</p>
          </div>
          <button className="kz-link" onClick={()=>setView({kind:'browse'})}>{t.nav_shop} →</button>
        </header>
        <div className="kz-grid kz-grid-3">
          {popular.map(p => (
            <ProductCard key={p.id} product={p} lang={lang}
              onClick={()=>setView({kind:'pdp', id:p.id})}/>
          ))}
        </div>
      </section>

      <Rule/>

      {/* Editorial / journal blurb --------------------------------------- */}
      <section className="kz-section">
        <div className="kz-journal">
          <div className="kz-journal-col">
            <span className="kz-mono kz-eyebrow">{t.sec_journal} — 03 / 12</span>
            <h3 className="kz-display kz-journal-title">
              {lang==='ru'
                ? 'Заметка о блендерах и горных дорогах.'
                : 'A note on blenders and mountain roads.'}
            </h3>
            <p className="kz-journal-body">
              {lang==='ru'
                ? 'Мы взяли пять USB-блендеров на трассу А-2 и записали, какой из них первым сдался. Подсказка — не самый дорогой.'
                : 'We took five USB blenders down the A-2 highway and recorded which one quit first. Hint — it wasn\'t the most expensive.'}
            </p>
            <button className="kz-link">{lang==='ru'?'Читать':'Read'} →</button>
          </div>
          <div className="kz-journal-col">
            <span className="kz-mono kz-eyebrow">{t.sec_journal} — 04 / 12</span>
            <h3 className="kz-display kz-journal-title">
              {lang==='ru'
                ? '110 или 220 — выбираем напряжение.'
                : '110 or 220 — choosing your voltage.'}
            </h3>
            <p className="kz-journal-body">
              {lang==='ru'
                ? 'Гид по дорожным чайникам для тех, кто ездит между Алматы, Стамбулом и Лондоном.'
                : 'A guide to travel kettles for anyone moving between Almaty, Istanbul and London.'}
            </p>
            <button className="kz-link">{lang==='ru'?'Читать':'Read'} →</button>
          </div>
        </div>
      </section>
    </main>
  );
}


// Browse / catalogue

function Browse({ products, lang, setView, initialFilter }) {
  const t = I18N[lang];
  const [cat, setCat] = useState(initialFilter || 'All');
  const [sort, setSort] = useState('popular');

  const cats = ['All', ...Object.keys(CATEGORY_META)];
  const filtered = useMemo(() => {
    let arr = cat === 'All' ? products : products.filter(p=>p.cat===cat);
    arr = [...arr];
    if (sort === 'popular') arr.sort((a,b)=>b.pop-a.pop);
    else if (sort === 'price_asc') arr.sort((a,b)=>a.price-b.price);
    else if (sort === 'price_desc') arr.sort((a,b)=>b.price-a.price);
    return arr;
  }, [products, cat, sort]);

  return (
    <main className="kz-main">
      <section className="kz-section kz-section-tight">
        <header className="kz-browse-head">
          <div>
            <span className="kz-mono kz-eyebrow">— {t.nav_shop}</span>
            <h1 className="kz-display kz-browse-title">
              {cat === 'All'
                ? (lang==='ru'?'Полный каталог':'The full catalogue')
                : (lang==='ru'?CATEGORY_META[cat].ru:CATEGORY_META[cat].en)}
            </h1>
          </div>
          <span className="kz-mono kz-dim">{filtered.length.toString().padStart(3,'0')} {lang==='ru'?'позиций':'items'}</span>
        </header>

        <div className="kz-toolbar">
          <div className="kz-chips">
            {cats.map(c => (
              <button key={c} className={`kz-chip ${cat===c?'is-active':''}`} onClick={()=>setCat(c)}>
                {c==='All' ? (lang==='ru'?'Все':'All') : (lang==='ru'?CATEGORY_META[c].ru:CATEGORY_META[c].en)}
              </button>
            ))}
          </div>
          <div className="kz-sort">
            <span className="kz-mono kz-dim">{lang==='ru'?'СОРТИРОВКА':'SORT BY'}</span>
            <select className="kz-select" value={sort} onChange={(e)=>setSort(e.target.value)}>
              <option value="popular">{lang==='ru'?'Популярные':'Most popular'}</option>
              <option value="price_asc">{lang==='ru'?'Цена ↑':'Price low → high'}</option>
              <option value="price_desc">{lang==='ru'?'Цена ↓':'Price high → low'}</option>
            </select>
          </div>
        </div>

        <div className="kz-grid kz-grid-3">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} lang={lang}
              onClick={()=>setView({kind:'pdp', id:p.id})}/>
          ))}
        </div>
      </section>
    </main>
  );
}

// PDP

function PDP({ product, products, lang, setView, addToCart }) {
  const t = I18N[lang];
  if (!product) return null;
  const name = lang === 'ru' ? product.name_ru : product.name_en;
  const desc = lang === 'ru' ? product.desc_ru : product.desc_en;
  const meta = CATEGORY_META[product.cat];
  const related = useMemo(() => relatedTo(products, product, 4), [products, product]);
  const rating = ratingFor(product.id);
  const reviews = reviewsFor(product.id);

  return (
    <main className="kz-main">
      <div className="kz-section kz-section-tight">
        <button className="kz-link kz-back" onClick={()=>setView({kind:'browse'})}>← {t.back}</button>

        <div className="kz-pdp">
          <div className="kz-pdp-art">
            <div className="kz-pdp-frame">
              <ProductPlaceholder category={product.cat} size="xl" label={`${meta.short.toLowerCase()}_${product.id}_a.tif`}/>
              <div className="kz-pdp-frame-tag kz-mono">
                <span>PLATE A</span>
                <span>—</span>
                <span>{product.brand}</span>
              </div>
            </div>
            <div className="kz-pdp-thumbs">
              {['B','C','D'].map(letter => (
                <div key={letter} className="kz-pdp-thumb">
                  <ProductPlaceholder category={product.cat} size="sm" label={`PL.${letter}`}/>
                </div>
              ))}
            </div>
          </div>

          <div className="kz-pdp-info">
            <span className="kz-mono kz-eyebrow">— {lang==='ru'?meta.ru:meta.en} · {t.sku_label} №{product.id.toString().padStart(4,'0')}</span>
            <h1 className="kz-display kz-pdp-title">{name}</h1>
            <div className="kz-pdp-rating">
              <span className="kz-pdp-stars">★ {rating}</span>
              <span className="kz-mono kz-dim">{reviews} {t.review_count}</span>
              <span className="kz-mono kz-dot">·</span>
              <span className="kz-mono kz-stock">{t.in_stock}</span>
            </div>

            <p className="kz-pdp-desc">{desc}</p>

            <dl className="kz-pdp-specs">
              <div><dt className="kz-mono">{t.pdp_brand}</dt><dd>{product.brand}</dd></div>
              <div><dt className="kz-mono">{t.pdp_voltage}</dt><dd>{t.pdp_voltage_v}</dd></div>
              <div><dt className="kz-mono">{t.pdp_capacity}</dt><dd>{t.pdp_capacity_v}</dd></div>
              <div><dt className="kz-mono">{t.pdp_warranty}</dt><dd>{t.pdp_warranty_v}</dd></div>
              <div><dt className="kz-mono">{t.pdp_shipping}</dt><dd>{t.pdp_ship_v}</dd></div>
            </dl>

            <div className="kz-pdp-buy">
              <div className="kz-pdp-price-row">
                <span className="kz-pdp-price">{fmtKZT(product.price, lang)}</span>
                <span className="kz-mono kz-dim">{t.pop_rank} · {Math.min(99, Math.max(1, 99 - product.pop * 3))}</span>
              </div>
              <div className="kz-pdp-btns">
                <button className="kz-btn kz-btn-primary" onClick={()=>{ addToCart(product); }}>{t.add_to_cart} →</button>
                <button className="kz-btn kz-btn-ghost">{t.buy_now}</button>
              </div>
            </div>
          </div>
        </div>

        <Rule style={{marginTop: 'var(--kz-sp-xl)'}}/>

        <section className="kz-section-related">
          <header className="kz-section-head">
            <div>
              <span className="kz-mono kz-eyebrow">— hybrid recommender</span>
              <h2 className="kz-display kz-section-title">{t.you_might}</h2>
              <p className="kz-section-sub">{t.you_might_sub}</p>
            </div>
            <span className="kz-mono kz-dim">k=4</span>
          </header>
          <div className="kz-grid kz-grid-4">
            {related.map(p => (
              <ProductCard key={p.id} product={p} lang={lang}
                onClick={()=>setView({kind:'pdp', id:p.id})}/>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}


// Cart drawer

function CartDrawer({ open, onClose, cart, setCart, lang, setView }) {
  const t = I18N[lang];
  const subtotal = cart.reduce((a,b)=>a + b.product.price * b.qty, 0);

  function setQty(id, qty) {
    setCart(cart.map(i => i.product.id===id ? {...i, qty: Math.max(1, qty)} : i));
  }
  function remove(id) {
    setCart(cart.filter(i => i.product.id !== id));
  }

  return (
    <>
      <div className={`kz-cart-overlay ${open?'is-open':''}`} onClick={onClose}/>
      <aside className={`kz-cart-drawer ${open?'is-open':''}`} aria-hidden={!open}>
        <header className="kz-cart-head">
          <h2 className="kz-display kz-cart-title">{t.cart_title}</h2>
          <button className="kz-cart-close" onClick={onClose} aria-label="Close">[ × ]</button>
        </header>
        <Rule/>

        {cart.length === 0 ? (
          <div className="kz-cart-empty">
            <span className="kz-mono kz-dim">[ {t.cart_empty} ]</span>
            <button className="kz-btn kz-btn-ghost" onClick={()=>{ onClose(); setView({kind:'browse'}); }}>{t.cart_continue}</button>
          </div>
        ) : (
          <>
            <ul className="kz-cart-list">
              {cart.map(item => {
                const p = item.product;
                const meta = CATEGORY_META[p.cat];
                const name = lang==='ru'?p.name_ru:p.name_en;
                return (
                  <li key={p.id} className="kz-cart-item">
                    <div className="kz-cart-thumb">
                      <ProductPlaceholder category={p.cat} size="sm" label={meta.short}/>
                    </div>
                    <div className="kz-cart-item-body">
                      <span className="kz-mono kz-dim">№{p.id.toString().padStart(4,'0')} · {lang==='ru'?meta.ru:meta.en}</span>
                      <h4 className="kz-cart-item-name">{name}</h4>
                      <div className="kz-cart-item-foot">
                        <div className="kz-qty">
                          <button onClick={()=>setQty(p.id, item.qty-1)} aria-label="Decrease">−</button>
                          <span className="kz-mono">{item.qty}</span>
                          <button onClick={()=>setQty(p.id, item.qty+1)} aria-label="Increase">+</button>
                        </div>
                        <span className="kz-cart-item-price">{fmtKZT(p.price * item.qty, lang)}</span>
                      </div>
                      <button className="kz-cart-remove" onClick={()=>remove(p.id)}>[ {t.remove} ]</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Rule/>
            <div className="kz-cart-totals">
              <div className="kz-cart-row"><span>{t.cart_subtotal}</span><span>{fmtKZT(subtotal, lang)}</span></div>
              <div className="kz-cart-row"><span>{t.cart_shipping}</span><span className="kz-mono">{t.free}</span></div>
              <Rule/>
              <div className="kz-cart-row kz-cart-total"><span className="kz-display">{t.cart_total}</span><span className="kz-display">{fmtKZT(subtotal, lang)}</span></div>
              <button className="kz-btn kz-btn-primary kz-btn-block">{t.cart_checkout} →</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

Object.assign(window, {
  TopBar, ProductCard, Home, Browse, PDP, CartDrawer,
  recommendForUser, relatedTo
});
