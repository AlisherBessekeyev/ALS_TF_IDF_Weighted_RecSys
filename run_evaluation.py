"""
Main evaluation script

Trains all models (popularity baseline, ALS, content-based, hybrid),
evaluates them on the same train/test split, and reports Precision@10,
Recall@10, and NDCG@10 for both warm-start and cold-start users
"""

import os
import sys
import numpy as np
import pandas as pd
from scipy import sparse

# Add project root to path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from models.baselines import PopularityModel, ItemItemCFModel
from models.als import ALSModel
from models.content import ContentModel
from models.hybrid import HybridModel
from evaluation.metrics import train_test_split, evaluate_model


def load_data():
    # Load CSVs and build the interaction matrix
    data_dir = os.path.join(BASE_DIR, "data")
    products_df = pd.read_csv(os.path.join(data_dir, "products.csv"))
    users_df = pd.read_csv(os.path.join(data_dir, "users.csv"))
    interactions_df = pd.read_csv(os.path.join(data_dir, "interactions.csv"))

    # Build sparse matrix (items x users) — the format implicit expects.
    # user_id and product_id are 1-indexed in the CSV, so subtract 1.
    user_idx = interactions_df["user_id"].values - 1
    item_idx = interactions_df["product_id"].values - 1
    values = interactions_df["purchase_count"].values.astype(np.float64)

    n_users = len(users_df)
    n_items = len(products_df)

    interaction_matrix = sparse.csr_matrix(
        (values, (item_idx, user_idx)),
        shape=(n_items, n_users)
    )

    return products_df, users_df, interactions_df, interaction_matrix


def identify_cold_start_users(interactions_df, n_users, threshold=2):
    # Cold-start users: those with 0 to `threshold` total interactions.
    user_counts = interactions_df.groupby("user_id").size()
    all_user_ids = set(range(n_users))
    warm_user_ids = set((user_counts[user_counts > threshold].index - 1).tolist())
    cold_user_ids = list(all_user_ids - warm_user_ids)
    warm_user_ids = list(warm_user_ids)
    return cold_user_ids, warm_user_ids


def print_results(name, results):
    # Evaluation results for one model
    print(f"  {name:<20s}  "
          f"P@10={results['precision@k']:.4f}  "
          f"R@10={results['recall@k']:.4f}  "
          f"NDCG@10={results['ndcg@k']:.4f}  "
          f"(n={results['users_evaluated']})")


def main():
    print("Loading data...")
    products_df, users_df, interactions_df, interaction_matrix = load_data()

    n_users = len(users_df)
    n_items = len(products_df)
    density = interaction_matrix.nnz / (n_users * n_items) * 100
    print(f"  Matrix: {n_items} items x {n_users} users, "
          f"{interaction_matrix.nnz} interactions, density={density:.2f}%")

    # Identify cold/warm users before splitting
    cold_users, warm_users = identify_cold_start_users(
        interactions_df, n_users, threshold=2
    )
    print(f"  Cold-start users (<=2 interactions): {len(cold_users)}")
    print(f"  Warm users (>2 interactions):        {len(warm_users)}")

    # --- Train/test split ---
    print("\nSplitting into train/test...")
    train, test = train_test_split(interaction_matrix, test_fraction=0.2)
    print(f"  Train: {train.nnz} interactions")
    print(f"  Test:  {test.nnz} interactions")

    K = 10

    # =====================================================================
    # 1. POPULARITY BASELINE
    # =====================================================================
    print("\n--- Popularity Baseline ---")
    pop_model = PopularityModel()
    pop_model.fit(train)

    # =====================================================================
    # 2. ITEM-ITEM CF (Deshpande & Karypis, 2004)
    # =====================================================================
    print("--- Item-Item CF (k_neighbors=20) ---")
    itemcf_model = ItemItemCFModel(k_neighbors=20)
    itemcf_model.fit(train)

    # =====================================================================
    # 3. ALS
    # =====================================================================
    print("--- ALS (factors=20, alpha=40, iterations=15) ---")
    als_model = ALSModel(factors=20, regularization=0.1, alpha=40, iterations=15)
    als_model.fit(train)

    # =====================================================================
    # 4. CONTENT-BASED
    # =====================================================================
    print("--- Content-Based (TF-IDF) ---")
    content_model = ContentModel()
    content_model.fit(products_df, train)

    # =====================================================================
    # 5. WEIGHTED HYBRID
    # =====================================================================
    print("--- Weighted Hybrid (alpha=0.6) ---")
    hybrid_model = HybridModel(als_model, content_model, alpha=0.6)

    # =====================================================================
    # EVALUATE ALL MODELS
    # =====================================================================
    models = {
        "Popularity": pop_model,
        "Item-Item CF": itemcf_model,
        "ALS": als_model,
        "Content (TF-IDF)": content_model,
        "Hybrid (a=0.6)": hybrid_model,
    }

    # -- Overall evaluation --
    print(f"\n{'='*70}")
    print(f" OVERALL RESULTS (K={K})")
    print(f"{'='*70}")

    for name, model in models.items():
        results = evaluate_model(model.recommend, train, test, k=K)
        print_results(name, results)

    # -- Warm-start users only --
    print(f"\n{'='*70}")
    print(f" WARM-START USERS ONLY (>{2} interactions)")
    print(f"{'='*70}")

    for name, model in models.items():
        results = evaluate_model(
            model.recommend, train, test, k=K, user_subset=warm_users
        )
        print_results(name, results)

    # -- Cold-start users only --
    print(f"\n{'='*70}")
    print(f" COLD-START USERS (<=2 interactions)")
    print(f"{'='*70}")

    for name, model in models.items():
        results = evaluate_model(
            model.recommend, train, test, k=K, user_subset=cold_users
        )
        print_results(name, results)

    # =====================================================================
    # HYBRID ALPHA SWEEP — find the best weight
    # =====================================================================
    print(f"\n{'='*70}")
    print(f" HYBRID ALPHA SWEEP")
    print(f"{'='*70}")

    for a in [0.0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0]:
        hybrid = HybridModel(als_model, content_model, alpha=a)
        results = evaluate_model(hybrid.recommend, train, test, k=K)
        print(f"  alpha={a:.1f}  "
              f"P@10={results['precision@k']:.4f}  "
              f"R@10={results['recall@k']:.4f}  "
              f"NDCG@10={results['ndcg@k']:.4f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
