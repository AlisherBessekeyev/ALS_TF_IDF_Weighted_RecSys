# Kazan - Recommender System Prototype

A research prototype accompanying thesis **P2773314**. It pairs a hybrid
collaborative-filtering / content-based recommender (Python) with a single-page
e-commerce website (React) that surfaces the recommendations and reports the
offline evaluation results.

The submission contains two sibling folders:

```
thesis/
├── Code/          Python recommender models + evaluation harness
└── website/       React storefront + research dashboard
    ├── index.html
    ├── styles.css
    ├── data/      JSON consumed by the page (products, stats, metrics)
    └── lib/       React components (transpiled in-browser by Babel)
```

There are two ways to view the website:

1. **`Kazan-Thesis.html`** - a single self-contained file. Double-click it to
   open in any browser; no server, no Python, no internet connection required.
   This is the quickest way to view the finished prototype.
2. **From source** - run the steps below. This is the route to take if you want
   to regenerate the evaluation metrics from the recommender code.

---

## Step 1 - Regenerate the metrics (optional)

The website ships with a pre-computed `website/data/metrics.json`, so this step
can be skipped if you only want to view the existing results. To re-run the full
offline evaluation from the trained models:

```bash
cd Code
python3 -m venv venv
source venv/bin/activate          # macOS / Linux
# .\venv\Scripts\activate         # Windows PowerShell

pip install numpy scipy pandas scikit-learn implicit tqdm
python export_metrics.py
```

`export_metrics.py` trains all five models (Popularity, Item–Item CF, ALS,
Content TF-IDF, and the proposed Hybrid), evaluates them on the held-out 20%
test split, measures coverage and latency, and writes a fresh `Code/metrics.json`
(~30–60 seconds on a modern laptop).

Copy the result into the website's data folder:

```bash
cp metrics.json ../website/data/metrics.json      # macOS / Linux
# copy metrics.json ..\website\data\metrics.json  # Windows
```

Deactivate the virtual environment when finished:

```bash
deactivate
```

---

## Step 2 - Serve the website locally

The page loads its JSON via `fetch()`, which browsers block when an HTML file is
opened directly from the filesystem (the `file://` protocol). A small local web
server is therefore required. From the `website/` folder:

```bash
cd website
python3 -m http.server 8000
```

The terminal prints `Serving HTTP on 0.0.0.0 port 8000`. Leave this window
open, closing it stops the server.

> Not needed for `Kazan-Thesis.html`, which embeds its data inline and runs
> straight from `file://`.

---

## Step 3 - Open the page

Visit:

```
http://localhost:8000
```

The two tabs near the top switch between surfaces:

- **01 / Storefront** - the customer-facing catalogue, home page, product
  detail pages, and basket.
- **02 / Research dashboard** - the offline evaluation results loaded from
  `metrics.json`. The masthead shows the run date and a "measured · offline
  eval" status tag confirming real metrics are being displayed.

Inside the dashboard, use the controls to switch between K ∈ {5, 10, 20}, toggle
warm vs. cold-start user segments, and include or exclude individual models.

---

## Step 4 - Shut down

Return to the terminal running the server and press **Ctrl + C**.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `python3: command not found` | Python not installed or not on PATH | Install from python.org, or try `python` instead of `python3` |
| Browser shows a blank screen | Opened via `file://` instead of the local server | Use `http://localhost:8000` (Step 3), or open `Kazan-Thesis.html` instead |
| Dashboard says "provisional · run export_metrics.py" | `metrics.json` still contains placeholders | Run Step 1 |
| `Address already in use` on port 8000 | Another process holds the port | Use another port: `python3 -m http.server 8001`, then open `http://localhost:8001` |
| `ModuleNotFoundError: implicit` | Dependencies missing in the active venv | Re-run the `pip install` line from Step 1 with the venv activated |

---

## Technology

- **Website:** React 18, Babel Standalone (in-browser JSX, no build step),
  hand-authored CSS.
- **Recommender:** Python with `numpy`, `scipy`, `pandas`, `scikit-learn`, and
  `implicit` (ALS for implicit feedback; Hu, Koren & Volinsky, 2008).

The recommender models run offline in Python. `export_metrics.py` serialises
their evaluation results to JSON, which the website reads at load time - the
browser performs no model inference.
