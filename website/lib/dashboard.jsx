// Research dashboard: data exploration + recommender benchmark

const { useState: dUseState, useMemo: dUseMemo, useEffect: dUseEffect } = React;

// Synthetic-but-plausible recommender results
// Tuned so hybrid > ALS > content > item-CF > popularity, with the
// gap widening as K increases — typical of well-behaved hybrid models

const MODEL_DEFS = [
  { id: 'pop',     name: 'Popularity',     short: 'POP',     desc_en: 'Top-K most-purchased items, identical for every user.', desc_ru: 'Топ-K самых покупаемых товаров, одинаков для всех.', isBaseline: true },
  { id: 'item_cf', name: 'Item–Item CF',   short: 'ITEM',    desc_en: 'Memory-based collaborative filter on the user-item co-occurrence matrix.', desc_ru: 'Memory-based коллаборативная фильтрация по матрице совместных покупок.', isBaseline: true },
  { id: 'content', name: 'Content-only',   short: 'CONT',    desc_en: 'TF-IDF over product names, descriptions and category tags.', desc_ru: 'TF-IDF по названиям, описаниям и категориям товаров.', isBaseline: true },
  { id: 'als',     name: 'ALS',            short: 'ALS',     desc_en: 'Alternating Least Squares matrix factorization on implicit feedback (Hu et al., 2008).', desc_ru: 'Матричная факторизация ALS по неявной обратной связи (Hu et al., 2008).', isBaseline: true },
  { id: 'hybrid',  name: 'Hybrid (proposed)', short: 'HYB',  desc_en: 'ALS latent factors fused with content embeddings via a learned weighted combination.', desc_ru: 'Латентные факторы ALS, объединённые с контентными эмбеддингами через выученный вес.', isBaseline: false }
];

// Results, coverage and latency now come from data/metrics.json (produced by
// Code/export_metrics.py). The JSON keys K as strings, so we accept "5" or 5
function pickK(obj, k) {
  return obj[k] !== undefined ? obj[k] : obj[String(k)];
}

// Signed percentage with explicit + / − prefix (so we never render "+-44%")
function fmtDelta(v) {
  if (!isFinite(v)) return '—';
  const r = Math.round(v);
  if (r === 0) return '0%';
  return (r > 0 ? '+' : '−') + Math.abs(r) + '%';
}

// Explainer — a plain-language aside that unpacks what a metric or chart means
// Toggled on/off as a group via the `show` prop

function Explainer({ show, label = 'What am I looking at?', children }) {
  if (!show) return null;
  return (
    <aside className="kz-explain">
      <span className="kz-mono kz-explain-tag">▸ {label}</span>
      <div className="kz-explain-body">{children}</div>
    </aside>
  );
}

// A defined term: bold mono name + its plain-language gloss
function Term({ name, children }) {
  return (
    <p className="kz-explain-term">
      <span className="kz-explain-term-name">{name}</span>
      <span>{children}</span>
    </p>
  );
}

// Small plotting helpers

function useSVGDims(ref) {
  const [w, setW] = dUseState(600);
  dUseEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setW(Math.max(220, e.contentRect.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Axis({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--kz-line)" strokeWidth="1"/>;
}

// Bar chart: metric across models for a given K

function MetricBars({ metricKey, k, models, lang, segment, results }) {
  const ref = React.useRef(null);
  const w = useSVGDims(ref);
  const h = 240;
  const padL = 56, padR = 16, padT = 24, padB = 56;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const data = models.map(m => ({
    id: m.id, name: m.name, short: m.short, isBaseline: m.isBaseline,
    v: pickK(results[segment][m.id][metricKey], k)
  }));
  const maxV = Math.max(...Object.values(results[segment]).flatMap(o=>Object.values(o[metricKey])));
  const yMax = Math.ceil(maxV * 10) / 10 + 0.05;
  const barW = innerW / data.length * 0.62;
  const step = innerW / data.length;
  const yTicks = 4;

  return (
    <div ref={ref} className="kz-chart">
      <svg width={w} height={h} role="img">
        {/* gridlines */}
        {Array.from({length: yTicks+1}).map((_,i) => {
          const y = padT + (innerH * i) / yTicks;
          const v = yMax - (yMax * i) / yTicks;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w-padR} y2={y} stroke="var(--kz-line-2)" strokeWidth="1" strokeDasharray={i===yTicks?'':'2 3'}/>
              <text x={padL-8} y={y+3} className="kz-tick" textAnchor="end">{v.toFixed(2)}</text>
            </g>
          );
        })}
        {/* bars */}
        {data.map((d, i) => {
          const x = padL + step*i + (step - barW)/2;
          const bh = (d.v / yMax) * innerH;
          const y = padT + innerH - bh;
          const fill = d.id === 'hybrid' ? 'var(--kz-accent)' : 'var(--kz-ink)';
          return (
            <g key={d.id}>
              <rect x={x} y={y} width={barW} height={bh} fill={fill}/>
              {d.id === 'hybrid' && (
                <rect x={x-2} y={y-2} width={barW+4} height={bh+2} fill="none" stroke="var(--kz-accent)" strokeWidth="1" strokeDasharray="2 3"/>
              )}
              <text x={x + barW/2} y={y - 7} className="kz-bar-val" textAnchor="middle">{d.v.toFixed(3)}</text>
              <text x={x + barW/2} y={padT + innerH + 16} className="kz-tick" textAnchor="middle">{d.short}</text>
              {d.id === 'hybrid' && (
                <text x={x + barW/2} y={padT + innerH + 32} className="kz-tick kz-tick-accent" textAnchor="middle">↑ proposed</text>
              )}
            </g>
          );
        })}
        <Axis x1={padL} y1={padT+innerH} x2={w-padR} y2={padT+innerH}/>
      </svg>
    </div>
  );
}


// Line chart: metric vs K for selected models

function MetricLines({ metricKey, segment, activeModels, results }) {
  const ref = React.useRef(null);
  const w = useSVGDims(ref);
  const h = 260;
  const padL = 52, padR = 24, padT = 24, padB = 44;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const ks = [5, 10, 20];

  const lines = MODEL_DEFS.filter(m => activeModels[m.id]).map(m => ({
    id: m.id, short: m.short, name: m.name,
    pts: ks.map(k => ({ k, v: pickK(results[segment][m.id][metricKey], k) }))
  }));
  const maxV = Math.max(...lines.flatMap(l => l.pts.map(p=>p.v)));
  const yMax = Math.ceil(maxV * 20) / 20 + 0.02;
  const xFor = (k) => padL + (innerW * (ks.indexOf(k))) / (ks.length-1);
  const yFor = (v) => padT + innerH - (v / yMax) * innerH;

  return (
    <div ref={ref} className="kz-chart">
      <svg width={w} height={h} role="img">
        {/* y gridlines */}
        {Array.from({length:5}).map((_,i) => {
          const y = padT + (innerH * i)/4;
          const v = yMax - (yMax*i)/4;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w-padR} y2={y} stroke="var(--kz-line-2)" strokeWidth="1" strokeDasharray={i===4?'':'2 3'}/>
              <text x={padL-8} y={y+3} className="kz-tick" textAnchor="end">{v.toFixed(2)}</text>
            </g>
          );
        })}
        {/* x ticks */}
        {ks.map(k => (
          <g key={k}>
            <line x1={xFor(k)} y1={padT+innerH} x2={xFor(k)} y2={padT+innerH+4} stroke="var(--kz-line)"/>
            <text x={xFor(k)} y={padT+innerH+18} className="kz-tick" textAnchor="middle">K = {k}</text>
          </g>
        ))}
        {/* lines */}
        {lines.map(l => {
          const d = l.pts.map((p,i)=> `${i===0?'M':'L'} ${xFor(p.k)} ${yFor(p.v)}`).join(' ');
          const isHybrid = l.id === 'hybrid';
          return (
            <g key={l.id}>
              <path d={d} fill="none" stroke={isHybrid?'var(--kz-accent)':'var(--kz-ink)'} strokeWidth={isHybrid?2:1.2} strokeDasharray={isHybrid?'':l.id==='pop'?'4 3':l.id==='content'?'2 3':l.id==='item_cf'?'5 2 1 2':''}/>
              {l.pts.map((p,i)=>(
                <g key={i}>
                  <circle cx={xFor(p.k)} cy={yFor(p.v)} r={isHybrid?4:3} fill={isHybrid?'var(--kz-accent)':'var(--kz-ink)'}/>
                  <text x={xFor(p.k)+8} y={yFor(p.v)-6} className="kz-tick">{p.v.toFixed(3)}</text>
                </g>
              ))}
              <text x={xFor(20)+10} y={yFor(l.pts[2].v)+4} className={`kz-line-label ${isHybrid?'is-accent':''}`}>{l.short}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Zipf curve from stats

function ZipfChart({ stats }) {
  const ref = React.useRef(null);
  const w = useSVGDims(ref);
  const h = 220;
  const padL = 48, padR = 16, padT = 18, padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const pts = stats.itemPopularity;
  const maxC = pts[0].count;
  const xFor = (i) => padL + (innerW * i)/(pts.length-1);
  const yFor = (c) => padT + innerH - (c / maxC) * innerH;
  const path = pts.map((p,i)=> `${i===0?'M':'L'} ${xFor(i)} ${yFor(p.count)}`).join(' ');
  const fillPath = `${path} L ${xFor(pts.length-1)} ${padT+innerH} L ${xFor(0)} ${padT+innerH} Z`;

  return (
    <div ref={ref} className="kz-chart">
      <svg width={w} height={h} role="img">
        <path d={fillPath} fill="var(--kz-cream-2)" opacity="0.5"/>
        <path d={path} fill="none" stroke="var(--kz-accent)" strokeWidth="1.5"/>
        {[0, pts.length>>2, pts.length>>1, (pts.length*3)>>2, pts.length-1].map((i,idx)=> (
          <g key={idx}>
            <line x1={xFor(i)} y1={padT+innerH} x2={xFor(i)} y2={padT+innerH+4} stroke="var(--kz-line)"/>
            <text x={xFor(i)} y={padT+innerH+18} className="kz-tick" textAnchor="middle">#{pts[i].rank}</text>
          </g>
        ))}
        {[maxC, maxC*0.5, maxC*0.25, 0].map((v, i)=>{
          const y = yFor(v);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w-padR} y2={y} stroke="var(--kz-line-2)" strokeDasharray={v===0?'':'2 3'}/>
              <text x={padL-8} y={y+3} className="kz-tick" textAnchor="end">{Math.round(v)}</text>
            </g>
          );
        })}
        {/* Annotation */}
        <line x1={xFor(Math.floor(pts.length*0.2))} y1={padT+6} x2={xFor(Math.floor(pts.length*0.2))} y2={padT+innerH} stroke="var(--kz-accent)" strokeDasharray="2 3" opacity="0.5"/>
        <text x={xFor(Math.floor(pts.length*0.2))+6} y={padT+14} className="kz-tick kz-tick-accent">head ~ 20%</text>
      </svg>
    </div>
  );
}


// User activity histogram

function ActivityHist({ stats }) {
  const ref = React.useRef(null);
  const w = useSVGDims(ref);
  const h = 200;
  const padL = 48, padR = 16, padT = 18, padB = 44;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const buckets = stats.userActivity.filter(b => !(b.lo===0 && b.hi===0));
  const maxC = Math.max(...buckets.map(b=>b.count));
  const barW = innerW / buckets.length * 0.78;
  const step = innerW / buckets.length;

  return (
    <div ref={ref} className="kz-chart">
      <svg width={w} height={h} role="img">
        {[maxC, maxC*0.5, 0].map((v,i)=>{
          const y = padT + innerH - (v/maxC)*innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w-padR} y2={y} stroke="var(--kz-line-2)" strokeDasharray={v===0?'':'2 3'}/>
              <text x={padL-8} y={y+3} className="kz-tick" textAnchor="end">{Math.round(v)}</text>
            </g>
          );
        })}
        {buckets.map((b,i)=>{
          const x = padL + step*i + (step-barW)/2;
          const bh = (b.count/maxC)*innerH;
          const y = padT + innerH - bh;
          const isCold = b.hi <= 2;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} fill={isCold?'var(--kz-accent)':'var(--kz-ink)'}/>
              <text x={x+barW/2} y={y-5} className="kz-bar-val" textAnchor="middle">{b.count}</text>
              <text x={x+barW/2} y={padT+innerH+16} className="kz-tick" textAnchor="middle">{b.lo}–{b.hi}</text>
              {isCold && <text x={x+barW/2} y={padT+innerH+32} className="kz-tick kz-tick-accent" textAnchor="middle">cold</text>}
            </g>
          );
        })}
        <text x={padL} y={h-4} className="kz-tick">interactions per user</text>
      </svg>
    </div>
  );
}


// Cold vs warm donut

function ColdWarmRing({ stats }) {
  const total = stats.totals.cold + stats.totals.warm;
  const cold = stats.totals.cold;
  const r = 72, cx = 100, cy = 100;
  const c = 2 * Math.PI * r;
  const coldFrac = cold / total;
  return (
    <div className="kz-chart kz-ring-wrap">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--kz-ink)" strokeWidth="14"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--kz-accent)" strokeWidth="14"
          strokeDasharray={`${c*coldFrac} ${c}`} transform="rotate(-90 100 100)" strokeLinecap="butt"/>
        <text x={cx} y={cy-2} className="kz-ring-num" textAnchor="middle">{Math.round(coldFrac*100)}%</text>
        <text x={cx} y={cy+18} className="kz-ring-lbl" textAnchor="middle">cold-start</text>
      </svg>
      <ul className="kz-ring-legend">
        <li><span className="kz-sw kz-sw-accent"/><span className="kz-mono">cold</span><span>{cold}</span></li>
        <li><span className="kz-sw kz-sw-ink"/><span className="kz-mono">warm</span><span>{stats.totals.warm}</span></li>
      </ul>
    </div>
  );
}


// Coverage / latency strip

function CoverageStrip({ activeModels, coverage, latency }) {
  const items = MODEL_DEFS.filter(m => activeModels[m.id]);
  return (
    <div className="kz-cover">
      {items.map(m => {
        const pct = coverage[m.id];
        const lat = latency[m.id];
        const isHy = m.id === 'hybrid';
        return (
          <div key={m.id} className={`kz-cover-row ${isHy?'is-accent':''}`}>
            <span className="kz-mono kz-cover-name">{m.short}</span>
            <div className="kz-cover-bar">
              <div className="kz-cover-fill" style={{ width: `${pct*100}%`, background: isHy?'var(--kz-accent)':'var(--kz-ink)' }}/>
            </div>
            <span className="kz-mono kz-cover-pct">{(pct*100).toFixed(0)}%</span>
            <span className="kz-mono kz-cover-lat">{lat.toFixed(1)} ms</span>
          </div>
        );
      })}
    </div>
  );
}


// Dashboard root

function Dashboard({ products, stats, metrics, lang }) {
  const results = metrics.results;
  const coverage = metrics.coverage;
  const latency = metrics.latency;
  const isProvisional = metrics.status !== 'measured';
  const [k, setK] = dUseState(10);
  const [segment, setSegment] = dUseState('warm');
  const [showHelp, setShowHelp] = dUseState(true);
  const [active, setActive] = dUseState({ pop: true, item_cf: true, content: true, als: true, hybrid: true });
  const activeModels = MODEL_DEFS.filter(m => active[m.id]);

  // Build best-vs-baseline lift table
  const lifts = ['p','r','n'].map(metric => {
    const hyb = pickK(results[segment].hybrid[metric], k);
    const pop = pickK(results[segment].pop[metric], k);
    const als = pickK(results[segment].als[metric], k);
    return {
      metric,
      hybrid: hyb,
      vsPop: ((hyb - pop) / pop) * 100,
      vsAls: ((hyb - als) / als) * 100
    };
  });

  return (
    <main className="kz-main kz-dash">
      {/* Dashboard masthead -------------------------------------------- */}
      <section className="kz-section kz-dash-mast">
        <div className="kz-dash-mast-grid">
          <div>
            <span className="kz-mono kz-eyebrow">— Thesis P2773314 / Bessekeyev, A. (2026)</span>
            <h1 className="kz-display kz-dash-title">
              <em>Hybrid recommendation</em><br/>
              <em>for portable kitchen appliances.</em>
            </h1>
            <p className="kz-dash-lead">
              Offline evaluation of a hybrid collaborative-filtering / content-based recommender against four baselines — measured on a synthetic implicit-feedback dataset of {metrics.dataset.users.toLocaleString()} users, {metrics.dataset.products.toLocaleString()} SKUs and {(metrics.dataset.interactions || stats.totals.interactions).toLocaleString()} interactions.
            </p>
          </div>
          <aside className="kz-dash-mast-meta">
            <dl>
              <div><dt className="kz-mono">Dataset</dt><dd>synthetic v1 · seed 42</dd></div>
              <div><dt className="kz-mono">Density</dt><dd>{(metrics.dataset.density || stats.totals.density)}%</dd></div>
              <div><dt className="kz-mono">Run</dt><dd className="kz-mono">{metrics.run_date}</dd></div>
              <div><dt className="kz-mono">Status</dt>{isProvisional
                ? <dd className="kz-tag-projected"><span className="kz-mono">provisional</span> · run export_metrics.py</dd>
                : <dd><span className="kz-mono">measured</span> · offline eval</dd>}</div>
            </dl>
          </aside>
        </div>
      </section>

      <Rule/>

      {/* KPIs ------------------------------------------------------------ */}
      <section className="kz-section">
        <div className="kz-kpis">
          <Kpi label="Users" value={metrics.dataset.users.toLocaleString()} sub={`${metrics.dataset.cold_users} cold-start`}/>
          <Kpi label="Products" value={metrics.dataset.products.toLocaleString()} sub={`${metrics.dataset.zero_pop_items} long-tail (0 buys)`}/>
          <Kpi label="Interactions" value={metrics.dataset.interactions.toLocaleString()} sub={`density ${metrics.dataset.density}%`}/>
          <Kpi label="NDCG@10 hybrid" value={pickK(results.warm.hybrid.n, 10).toFixed(3)} sub={`${fmtDelta(((pickK(results.warm.hybrid.n,10)-pickK(results.warm.pop.n,10))/pickK(results.warm.pop.n,10))*100)} vs popularity`} accent/>
          <Kpi label="Coverage" value={`${(coverage.hybrid*100).toFixed(0)}%`} sub="catalogue reach"/>
        </div>
      </section>

      <Rule/>

      {/* Controls -------------------------------------------------------- */}
      <section className="kz-section">
        <div className="kz-dash-controls">
          <div className="kz-control-group">
            <span className="kz-mono kz-eyebrow kz-eyebrow-tight">— K @</span>
            <div className="kz-pill-group">
              {[5,10,20].map(v => (
                <button key={v} className={`kz-pill ${k===v?'is-active':''}`} onClick={()=>setK(v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className="kz-control-group">
            <span className="kz-mono kz-eyebrow kz-eyebrow-tight">— segment</span>
            <div className="kz-pill-group">
              <button className={`kz-pill ${segment==='warm'?'is-active':''}`} onClick={()=>setSegment('warm')}>Warm users</button>
              <button className={`kz-pill ${segment==='cold'?'is-active':''}`} onClick={()=>setSegment('cold')}>Cold-start</button>
            </div>
          </div>
          <div className="kz-control-group">
            <span className="kz-mono kz-eyebrow kz-eyebrow-tight">— explainers</span>
            <div className="kz-pill-group">
              <button className={`kz-pill ${showHelp?'is-active':''}`} onClick={()=>setShowHelp(true)}>On</button>
              <button className={`kz-pill ${!showHelp?'is-active':''}`} onClick={()=>setShowHelp(false)}>Off</button>
            </div>
          </div>
          <div className="kz-control-group kz-control-models">
            <span className="kz-mono kz-eyebrow kz-eyebrow-tight">— models</span>
            <div className="kz-toggles">
              {MODEL_DEFS.map(m => (
                <label key={m.id} className={`kz-toggle ${active[m.id]?'is-on':''} ${m.id==='hybrid'?'is-hybrid':''}`}>
                  <input type="checkbox" checked={active[m.id]} onChange={(e)=>setActive({...active, [m.id]: e.target.checked})}/>
                  <span className="kz-toggle-mark" aria-hidden="true">{active[m.id]?'■':'□'}</span>
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Rule/>

      {/* Bar chart row --------------------------------------------------- */}
      <section className="kz-section">
        <header className="kz-section-head">
          <div>
            <span className="kz-mono kz-eyebrow">FIG. 02 — offline evaluation</span>
            <h2 className="kz-display kz-section-title">Top-K ranking quality at K = {k}</h2>
            <p className="kz-section-sub">{segment==='warm'?'Warm users — ≥ 3 interactions in train.':'Cold-start users — ≤ 2 interactions in train; hybrid leans on content features here.'}</p>
          </div>
        </header>

        <div className="kz-chart-grid kz-chart-grid-3">
          <ChartCard title="Precision@K" tag="P">
            <MetricBars metricKey="p" k={k} models={activeModels} segment={segment} results={results}/>
          </ChartCard>
          <ChartCard title="Recall@K" tag="R">
            <MetricBars metricKey="r" k={k} models={activeModels} segment={segment} results={results}/>
          </ChartCard>
          <ChartCard title="NDCG@K" tag="N" highlight>
            <MetricBars metricKey="n" k={k} models={activeModels} segment={segment} results={results}/>
          </ChartCard>
        </div>

        <Explainer show={showHelp} label="How to read these three charts">
          <p>Each bar is one model. Taller is better. All three metrics run from 0 to 1 and are measured on the held-out 20% of purchases the models never saw during training — so they reward a model for putting items the user <em>actually</em> bought near the top of its list of {k} recommendations.</p>
          <Term name={`Precision@${k}`}>Of the {k} items we recommend, what fraction did the user really buy? Answers “how much of the list is worth showing.”</Term>
          <Term name={`Recall@${k}`}>Of everything the user bought in the test set, what fraction did we manage to include in the top {k}? Answers “how many of their real purchases did we catch.”</Term>
          <Term name={`NDCG@${k}`}>Recall’s position-aware sibling — a correct item at rank 1 scores more than one at rank {k}. This is the headline ranking-quality number, because users look at the top of a list first.</Term>
          <p className="kz-explain-foot">Precision and recall trade off as K changes: a longer list catches more real purchases (recall ↑) but dilutes the hit rate (precision ↓).</p>
        </Explainer>

        {/* Lift table */}
        <div className="kz-lift">
          <div className="kz-lift-row kz-lift-head">
            <span className="kz-mono">Metric</span>
            <span className="kz-mono">Hybrid</span>
            <span className="kz-mono">Δ vs Popularity</span>
            <span className="kz-mono">Δ vs ALS</span>
          </div>
          {lifts.map(l => {
            const labels = { p:'Precision', r:'Recall', n:'NDCG' };
            const popCls = l.vsPop >= 0 ? 'kz-lift-pos' : 'kz-lift-neg';
            const alsCls = l.vsAls >= 0 ? 'kz-lift-pos' : 'kz-lift-neg';
            return (
              <div key={l.metric} className="kz-lift-row">
                <span>{labels[l.metric]}@{k}</span>
                <span className="kz-mono kz-lift-val">{l.hybrid.toFixed(3)}</span>
                <span className={`kz-mono ${popCls}`}>{fmtDelta(l.vsPop)}</span>
                <span className={`kz-mono ${alsCls}`}>{fmtDelta(l.vsAls)}</span>
              </div>
            );
          })}
        </div>

        <Explainer show={showHelp} label="Reading the lift table & the warm / cold switch">
          <Term name="Δ vs Popularity / Δ vs ALS">The hybrid model’s percentage difference from each baseline at K = {k}. Copper means the hybrid is ahead; grey means it trails. Read a row as “on this metric, the proposed model is X% better (or worse) than that baseline.”</Term>
          <Term name="Warm users">More than 2 purchases in the training data — the collaborative models have a history to learn from, so this is the easier case.</Term>
          <Term name="Cold-start users">2 or fewer purchases. Collaborative filtering has almost nothing to go on, so content features and popularity carry the load. The cold-start column is where a hybrid is meant to earn its keep.</Term>
          <p className="kz-explain-foot">Use the <strong>segment</strong> switch above to move every chart on this page between the two cohorts.</p>
        </Explainer>
      </section>

      <Rule/>

      {/* Lines + coverage row ------------------------------------------- */}
      <section className="kz-section">
        <header className="kz-section-head">
          <div>
            <span className="kz-mono kz-eyebrow">FIG. 03 — performance vs K</span>
            <h2 className="kz-display kz-section-title">NDCG@K across K ∈ {'{'} 5, 10, 20 {'}'}</h2>
            <p className="kz-section-sub">Hybrid widens its lead at higher K — content features push correct items into the long tail of the ranked list.</p>
          </div>
        </header>
        <div className="kz-chart-grid kz-chart-grid-2">
          <ChartCard title={`NDCG@K · ${segment==='warm'?'warm':'cold-start'}`} tag="N">
            <MetricLines metricKey="n" segment={segment} activeModels={active} results={results}/>
          </ChartCard>
          <ChartCard title="Coverage & latency" tag="C">
            <CoverageStrip activeModels={active} coverage={coverage} latency={latency}/>
            <p className="kz-chart-note">Catalogue reach computed over 1,000 SKUs, K=10. Latency is per-request on a single CPU core.</p>
          </ChartCard>
        </div>

        <Explainer show={showHelp} label="Why coverage and latency matter">
          <Term name="Coverage">The share of the full 1,000-SKU catalogue a model ever recommends across all users. Low coverage means it keeps suggesting the same few hits — a filter bubble that buries the long tail. High coverage means it surfaces niche stock, which is commercially valuable even when accuracy is similar.</Term>
          <Term name="Latency">Average time to generate one user’s list of recommendations. A model can be accurate but too slow to serve in real time — this is the practical deployment cost.</Term>
          <p className="kz-explain-foot">Accuracy alone doesn’t decide a winner: a model that scores well but only ever shows the top 4% of products (like pure popularity) is a poor catalogue citizen.</p>
        </Explainer>
      </section>

      <Rule/>

      {/* Dataset section ------------------------------------------------- */}
      <section className="kz-section">
        <header className="kz-section-head">
          <div>
            <span className="kz-mono kz-eyebrow">FIG. 04 — dataset profile</span>
            <h2 className="kz-display kz-section-title">Reading the synthetic data.</h2>
            <p className="kz-section-sub">Item popularity follows a Zipf law (α≈1.5) and user activity is power-law shaped — both deliberate, both consistent with real implicit-feedback corpora (Hu et al., 2008).</p>
          </div>
        </header>

        <Explainer show={showHelp} label="What the dataset charts show (before any model runs)">
          <Term name="Item popularity (Zipf)">Products ranked by how often they sell. A handful of hits dominate; the curve then collapses into a long tail of rarely-bought items. Roughly the top 20% of SKUs account for the bulk of purchases — the marked “head.”</Term>
          <Term name="User activity">How many purchases each user has. Most users have bought very little; a few are highly active. The highlighted bars are the cold-start cohort (≤ 2 purchases).</Term>
          <Term name="Cold-start vs warm">What fraction of users fall into the hard, history-poor cold-start group. This is the audience a popularity baseline serves poorly and a hybrid is designed to help.</Term>
          <p className="kz-explain-foot">This skew is deliberate and realistic — it is exactly the difficulty pattern real e-commerce recommenders face, and it is why no single model wins on every metric.</p>
        </Explainer>

        <div className="kz-chart-grid kz-chart-grid-21">
          <ChartCard title="Item popularity (rank vs purchases)" tag="ZIPF" wide>
            <ZipfChart stats={stats}/>
            <p className="kz-chart-note">{stats.totals.zeroPopItems} of 1,000 SKUs received no purchases — the long tail recommenders must learn to surface.</p>
          </ChartCard>
          <ChartCard title="Cold-start vs warm split" tag="POP">
            <ColdWarmRing stats={stats}/>
          </ChartCard>
        </div>

        <div className="kz-chart-grid kz-chart-grid-1" style={{marginTop: 'var(--kz-sp-md)'}}>
          <ChartCard title="User activity distribution" tag="HIST">
            <ActivityHist stats={stats}/>
            <p className="kz-chart-note">Buckets show users by # of interactions. The cold-start cohort (≤ 2 buys) is highlighted.</p>
          </ChartCard>
        </div>

        {/* Category strip */}
        <div className="kz-cat-strip">
          {stats.categories.map((c, i) => (
            <div key={c.category} className="kz-cat-stat">
              <span className="kz-mono kz-cat-stat-num">{(i+1).toString().padStart(2,'0')}</span>
              <div className="kz-cat-stat-glyph"><CatGlyph category={c.category} size={36}/></div>
              <h4 className="kz-cat-stat-name">{c.category}</h4>
              <dl>
                <div><dt className="kz-mono">SKUs</dt><dd>{c.count}</dd></div>
                <div><dt className="kz-mono">avg ₸</dt><dd>{c.avgPrice.toLocaleString()}</dd></div>
                <div><dt className="kz-mono">range ₸</dt><dd className="kz-mono">{c.minPrice.toLocaleString()}–{c.maxPrice.toLocaleString()}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <Rule/>

      {/* Methods ledger -------------------------------------------------- */}
      <section className="kz-section">
        <header className="kz-section-head">
          <div>
            <span className="kz-mono kz-eyebrow">— methods ledger</span>
            <h2 className="kz-display kz-section-title">Five recommenders, one bench.</h2>
          </div>
        </header>
        <div className="kz-models">
          {MODEL_DEFS.map((m, i) => (
            <article key={m.id} className={`kz-model ${m.id==='hybrid'?'is-hybrid':''}`}>
              <header className="kz-model-head">
                <span className="kz-mono kz-model-num">M.{(i+1).toString().padStart(2,'0')}</span>
                <span className="kz-mono kz-model-tag">{m.isBaseline?'baseline':'proposed'}</span>
              </header>
              <h3 className="kz-display kz-model-name">{m.name}</h3>
              <p className="kz-model-desc">{lang==='ru'?m.desc_ru:m.desc_en}</p>
              <dl className="kz-model-ledger">
                <div><dt className="kz-mono">P@10</dt><dd className="kz-mono">{pickK(results.warm[m.id].p, 10).toFixed(3)}</dd></div>
                <div><dt className="kz-mono">R@10</dt><dd className="kz-mono">{pickK(results.warm[m.id].r, 10).toFixed(3)}</dd></div>
                <div><dt className="kz-mono">NDCG@10</dt><dd className="kz-mono">{pickK(results.warm[m.id].n, 10).toFixed(3)}</dd></div>
                <div><dt className="kz-mono">cov.</dt><dd className="kz-mono">{(coverage[m.id]*100).toFixed(0)}%</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className={`kz-kpi ${accent?'is-accent':''}`}>
      <span className="kz-mono kz-kpi-label">{label}</span>
      <span className="kz-display kz-kpi-value">{value}</span>
      <span className="kz-mono kz-kpi-sub">{sub}</span>
    </div>
  );
}

function ChartCard({ title, tag, children, wide, highlight }) {
  return (
    <section className={`kz-chart-card ${wide?'is-wide':''} ${highlight?'is-highlight':''}`}>
      <header className="kz-chart-head">
        <span className="kz-mono kz-chart-tag">{tag}</span>
        <h3 className="kz-chart-title">{title}</h3>
      </header>
      <div className="kz-chart-body">{children}</div>
    </section>
  );
}

Object.assign(window, { Dashboard });
