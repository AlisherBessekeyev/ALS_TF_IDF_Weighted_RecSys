"""
Baseline recommenders: Popularity and Item-Item CF

Popularity recommends the most purchased items globally
Item-Item CF implements the Deshpande & Karypis (2004) algorithm
discussed in the literature review
"""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from scipy import sparse


class PopularityModel:
    def __init__(self):
        self.item_scores = None

    def fit(self, interaction_matrix):
        #Compute global item popularity as the sum of all interactions per item
        self.item_scores = np.array(interaction_matrix.sum(axis=1)).flatten()

    def recommend(self, user_id, interaction_matrix, k=10):
        """
        Return top-K most popular items the user hasn't already interacted with.
        """
        already_seen = set(interaction_matrix.tocsc()[:, user_id].nonzero()[0])

        scores = self.item_scores.copy()
        for item in already_seen:
            scores[item] = -1

        top_k = np.argsort(scores)[::-1][:k]
        return top_k.tolist()


class ItemItemCFModel:
    """
    Item-Item Collaborative Filtering

    This is the memory-based algorithm discussed at length in the literature
    review. The process:

    1. Pre-compute pairwise cosine similarity between all items, where each
       item is a vector in user-space (its column in the interaction matrix).
       Truncate to the top-k_neighbors most similar items per item

    2. At recommendation time, for a user's basket of purchased items:
       - Build candidate set: union of all neighbors of basket items,
         minus items already in the basket
       - Score each candidate by summing its similarity with every basket
         item whose neighbor list it appears in
       - Return top-N scored candidates

    This is a binary implicit feedback variant — we use purchase occurrence,
    not ratings. Scores are similarity sums, not weighted averages
    """

    def __init__(self, k_neighbors=20):
        """
        Parameters
        ----------
        k_neighbors : int
            Number of most similar items to store per item. Karypis (2001)
            showed that even k=10-20 provides reasonably accurate
            recommendations, with diminishing returns beyond that
        """
        self.k_neighbors = k_neighbors
        # neighbor_ids[i] = array of k most similar item indices to item i
        self.neighbor_ids = None
        # neighbor_sims[i] = corresponding similarity scores
        self.neighbor_sims = None

    def fit(self, interaction_matrix):
        #Pre-compute the truncated item-item similarity model
        n_items = interaction_matrix.shape[0]

        # Each item is a vector across all users. Cosine similarity measures
        # co-purchase overlap, normalized by item popularity
        similarity_matrix = cosine_similarity(interaction_matrix)

        # Zero out self-similarity (an item is always perfectly similar to itself)
        np.fill_diagonal(similarity_matrix, 0)

        # Truncate: keep only top-k neighbors per item
        # This is the implementation-level optimization Karypis describes:
        # storing the full n×n matrix is unnecessary and wasteful
        self.neighbor_ids = np.zeros((n_items, self.k_neighbors), dtype=int)
        self.neighbor_sims = np.zeros((n_items, self.k_neighbors))

        for i in range(n_items):
            top_k_idx = np.argsort(similarity_matrix[i])[::-1][:self.k_neighbors]
            self.neighbor_ids[i] = top_k_idx
            self.neighbor_sims[i] = similarity_matrix[i][top_k_idx]

    def recommend(self, user_id, interaction_matrix, k=10):
        """
        Generate top-K recommendations using the item-item model

        1. Get the user's basket (purchased items)
        2. For each basket item, look up its pre-computed neighbor list
        3. Union all neighbors, remove items already in basket -> candidate set
        4. Score each candidate = sum of similarities from basket items
           whose neighbor list contains the candidate
        5. Return top-N by score
        """
        # Step 1: User's basket
        basket = set(interaction_matrix.tocsc()[:, user_id].nonzero()[0])

        if len(basket) == 0:
            return []

        # Steps 2-4: Build candidate scores
        candidate_scores = {}

        for basket_item in basket:
            # Look up this basket item's pre-computed neighbors
            neighbors = self.neighbor_ids[basket_item]
            sims = self.neighbor_sims[basket_item]

            for neighbor_id, sim in zip(neighbors, sims):
                if neighbor_id in basket:
                    continue  # skip items already purchased
                if sim <= 0:
                    continue  # skip zero/negative similarity

                # Sum similarity — the more basket items a candidate is
                # similar to, the higher it scores (the Karypis scoring rule)
                if neighbor_id not in candidate_scores:
                    candidate_scores[neighbor_id] = 0.0
                candidate_scores[neighbor_id] += sim

        if not candidate_scores:
            return []

        # Step 5: Sort by score, return top-K
        sorted_candidates = sorted(
            candidate_scores.items(), key=lambda x: x[1], reverse=True
        )
        top_k = [item_id for item_id, score in sorted_candidates[:k]]
        return top_k
