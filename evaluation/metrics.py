"""
Evaluation metrics for implicit feedback recommendation

All metrics operate on ranked recommendation lists. The key idea:
we hold out some interactions as a test set, generate top-K recommendations
for each user, and measure how well the recommendations recover the held-out items
"""

import numpy as np
from scipy import sparse


def train_test_split(interaction_matrix, test_fraction=0.2, seed=42):
    """
    Splits a user-item interaction matrix into train and test sets.

    For each user, randomly holds out `test_fraction` of their interactions
    as test items

    Parameters
    ----------
    interaction_matrix : sparse CSR matrix (items x users)
        The full interaction matrix. Note: implicit library uses items-as-rows
    test_fraction : float
        Proportion of each user's interactions to hold out
    seed : int
        Random seed for reproducibility

    Returns
    -------
    train : sparse CSR matrix (items x users)
    test : sparse CSR matrix (items x users)
    """
    rng = np.random.RandomState(seed)

    # Work in COO format for easy element-wise manipulation
    coo = interaction_matrix.tocoo()
    train_row, train_col, train_data = [], [], []
    test_row, test_col, test_data = [], [], []

    # Group interactions by user (columns in items x users matrix)
    user_interactions = {}
    for i in range(len(coo.data)):
        user = coo.col[i]
        if user not in user_interactions:
            user_interactions[user] = []
        user_interactions[user].append((coo.row[i], coo.data[i]))

    for user, items in user_interactions.items():
        n_test = max(1, int(len(items) * test_fraction))
        if len(items) <= 1:
            # Users with only 1 interaction go entirely to train
            for item, val in items:
                train_row.append(item)
                train_col.append(user)
                train_data.append(val)
            continue

        indices = list(range(len(items)))
        rng.shuffle(indices)
        test_indices = set(indices[:n_test])

        for idx, (item, val) in enumerate(items):
            if idx in test_indices:
                test_row.append(item)
                test_col.append(user)
                test_data.append(val)
            else:
                train_row.append(item)
                train_col.append(user)
                train_data.append(val)

    shape = interaction_matrix.shape
    train = sparse.csr_matrix((train_data, (train_row, train_col)), shape=shape)
    test = sparse.csr_matrix((test_data, (test_row, test_col)), shape=shape)

    return train, test


def precision_at_k(recommended, relevant, k):
    #Precision@K
    top_k = set(recommended[:k])
    hits = top_k & set(relevant)
    return len(hits) / k


def recall_at_k(recommended, relevant, k):
    #Recall@K
    if len(relevant) == 0:
        return 0.0
    top_k = set(recommended[:k])
    hits = top_k & set(relevant)
    return len(hits) / len(relevant)


def ndcg_at_k(recommended, relevant, k):
    #NDCG@K
    relevant_set = set(relevant)
    top_k = recommended[:k]

    # DCG: sum of 1/log2(i+1) for each hit position
    dcg = 0.0
    for i, item in enumerate(top_k):
        if item in relevant_set:
            dcg += 1.0 / np.log2(i + 2)  # i+2 because i is 0-indexed

    # IDCG: best possible DCG if all relevant items were at the top
    n_relevant = min(len(relevant_set), k)
    idcg = sum(1.0 / np.log2(i + 2) for i in range(n_relevant))

    if idcg == 0:
        return 0.0

    return dcg / idcg


def evaluate_model(recommend_fn, train_matrix, test_matrix, k=10, 
                   user_subset=None):
    """
    Evaluates a recommendation model across all users with test interactions

    Parameters
    ----------
    recommend_fn : callable(user_id, train_matrix, k) -> list of item_ids
        Function that returns top-K item recommendations for a user
    train_matrix : sparse CSR matrix (items x users)
        Training interactions (used by the model and to filter already-seen items).
    test_matrix : sparse CSR matrix (items x users)
        Held-out interactions used as ground truth
    k : int
        Number of recommendations to evaluate
    user_subset : list of int, optional
        If provided, only evaluate these users (useful for cold-start evaluation)

    Returns
    -------
    dict with mean Precision@K, Recall@K, NDCG@K and the number of users evaluated
    """
    precisions, recalls, ndcgs = [], [], []

    # Find users who have at least one test interaction
    test_users = set(test_matrix.tocsc().nonzero()[1])

    if user_subset is not None:
        test_users = test_users & set(user_subset)

    for user in test_users:
        # Ground truth: items this user interacted with in the test set
        relevant = test_matrix.tocsc()[:, user].nonzero()[0].tolist()
        if len(relevant) == 0:
            continue

        # Get recommendations
        recommended = recommend_fn(user, train_matrix, k)

        precisions.append(precision_at_k(recommended, relevant, k))
        recalls.append(recall_at_k(recommended, relevant, k))
        ndcgs.append(ndcg_at_k(recommended, relevant, k))

    return {
        "precision@k": np.mean(precisions) if precisions else 0.0,
        "recall@k": np.mean(recalls) if recalls else 0.0,
        "ndcg@k": np.mean(ndcgs) if ndcgs else 0.0,
        "users_evaluated": len(precisions),
    }
