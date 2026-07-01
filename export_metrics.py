"""
Export real evaluation metrics to a JSON file the website can consume.

After this script finishes, copy the generated `metrics.json` into the
website's `data/` folder (next to `stats.json`). The research dashboard
will pick it up on next reload

Usage:
    cd Code
    source venv/bin/activate
    python export_metrics.py

Outputs `Code/metrics.json`. Move/copy it to `<website>/data/metrics.json`
"""

import os
import sys
import json
import time
from datetime import datetime, timezone

import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from models.baselines import PopularityModel, ItemItemCFModel
from models.als import ALSModel
from models.content import ContentModel
from models.hybrid import HybridModel
from evaluation.metrics import train_test_split, evaluate_model
from run_evaluation import load_data, identify_cold_start_users


KS = [5, 10, 20]
METRIC_KEYS = {"precision@k": "p", "recall@k": "r", "ndcg@k": "n"}


def evaluate_at_ks(recommend_fn, train, test, user_subset=None):
    """Run evaluate_model for each K and reshape to {p: {5: .., 10: .., 20: ..}, ...}"""
    out = {"p": {}, "r": {}, "n": {}}
    for k in KS:
        res = evaluate_model(recommend_fn, train, test, k=k, user_subset=user_subset)
        out["p"][str(k)] = round(float(res["precision@k"]), 4)
        out["r"][str(k)] = round(float(res["recall@k"]), 4)
        out["n"][str(k)] = round(float(res["ndcg@k"]), 4)
    return out


def measure_coverage(recommend_fn, train, n_items, k=10, sample_users=None):
    """Coverage = (unique items ever recommended at K) / n_items

    To keep this fast on ALS / item-CF / hybrid we sample up to 200 users
    """
    n_users = train.shape[1]
    rng = np.random.RandomState(7)
    user_ids = (
        rng.choice(n_users, size=min(sample_users or 200, n_users), replace=False)
        if sample_users
        else range(n_users)
    )
    seen = set()
    for u in user_ids:
        try:
            recs = recommend_fn(int(u), train, k)
            seen.update(int(r) for r in recs)
        except Exception:
            pass
    return round(len(seen) / n_items, 4)


def measure_latency_ms(recommend_fn, train, k=10, n_samples=50):
    """Per-request latency in milliseconds, averaged over n_samples random users"""
    n_users = train.shape[1]
    rng = np.random.RandomState(11)
    user_ids = rng.choice(n_users, size=min(n_samples, n_users), replace=False)
    # warmup
    try:
        recommend_fn(int(user_ids[0]), train, k)
    except Exception:
        pass
    t0 = time.perf_counter()
    counted = 0
    for u in user_ids:
        try:
            recommend_fn(int(u), train, k)
            counted += 1
        except Exception:
            pass
    if counted == 0:
        return 0.0
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    return round(elapsed_ms / counted, 2)


def main():
    print("Loading data...")
    products_df, users_df, interactions_df, M = load_data()
    n_users = len(users_df)
    n_items = len(products_df)
    density = round(M.nnz / (n_users * n_items) * 100, 3)

    print(f"  {n_items} items x {n_users} users, {M.nnz} interactions, density={density}%")

    cold_users, warm_users = identify_cold_start_users(interactions_df, n_users, threshold=2)
    print(f"  cold-start users (<=2 interactions): {len(cold_users)}")
    print(f"  warm users (>2 interactions):        {len(warm_users)}")

    print("\nSplitting train/test...")
    train, test = train_test_split(M, test_fraction=0.2)
    print(f"  train nnz={train.nnz}  test nnz={test.nnz}")

    print("\nTraining models...")
    pop = PopularityModel();              pop.fit(train);                  print("  - popularity")
    item_cf = ItemItemCFModel(k_neighbors=20); item_cf.fit(train);         print("  - item-item CF")
    als = ALSModel(factors=20, regularization=0.1, alpha=40, iterations=15)
    als.fit(train);                                                        print("  - ALS")
    content = ContentModel();              content.fit(products_df, train); print("  - content (TF-IDF)")
    hybrid = HybridModel(als, content, alpha=0.6);                          print("  - hybrid (alpha=0.6)")

    models = {
        "pop":     pop,
        "item_cf": item_cf,
        "content": content,
        "als":     als,
        "hybrid":  hybrid,
    }

    print("\nEvaluating (warm / cold) at K in", KS, "...")
    results = {"warm": {}, "cold": {}}
    for mid, m in models.items():
        print(f"  - {mid}")
        results["warm"][mid] = evaluate_at_ks(m.recommend, train, test, user_subset=warm_users)
        results["cold"][mid] = evaluate_at_ks(m.recommend, train, test, user_subset=cold_users)

    print("\nMeasuring coverage @ K=10 (sampled)...")
    coverage = {mid: measure_coverage(m.recommend, train, n_items, k=10, sample_users=200)
                for mid, m in models.items()}
    for mid, v in coverage.items():
        print(f"  - {mid:<8}  cov={v}")

    print("\nMeasuring latency (per-request, ms)...")
    latency = {mid: measure_latency_ms(m.recommend, train, k=10, n_samples=50)
               for mid, m in models.items()}
    for mid, v in latency.items():
        print(f"  - {mid:<8}  {v} ms / req")

    # Zero-popularity items (long tail)
    item_totals = np.array(M.sum(axis=1)).flatten()
    zero_pop = int((item_totals == 0).sum())

    payload = {
        "status": "measured",
        "run_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "dataset": {
            "users": n_users,
            "products": n_items,
            "interactions": int(M.nnz),
            "density": density,
            "cold_users": int(len(cold_users)),
            "warm_users": int(len(warm_users)),
            "zero_pop_items": zero_pop,
        },
        "config": {
            "als":     {"factors": 20, "regularization": 0.1, "alpha": 40, "iterations": 15},
            "item_cf": {"k_neighbors": 20},
            "hybrid":  {"alpha": 0.6},
            "split":   {"test_fraction": 0.2, "seed": 42},
        },
        "results":  results,
        "coverage": coverage,
        "latency":  latency,
    }

    out_path = os.path.join(BASE_DIR, "metrics.json")
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"\n✓ wrote {out_path}")
    print("  copy this file to your website's data/ folder, e.g.:")
    print("    cp Code/metrics.json <website>/data/metrics.json")


if __name__ == "__main__":
    main()
