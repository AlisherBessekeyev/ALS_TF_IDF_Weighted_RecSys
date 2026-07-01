"""
Weighted Hybrid Recommender

Combines ALS (collaborative filtering) and content-based (TF-IDF) scores
using a linear weighting scheme. This is the simplest hybrid strategy

    final_score = alpha * als_score + (1 - alpha) * content_score

Where alpha controls the balance:
- alpha = 1.0 -> pure collaborative filtering
- alpha = 0.0 -> pure content-based filtering
- alpha = 0.6 -> 60% collaborative, 40% content (a common starting point)

Both score vectors are normalized to [0, 1] before combination so that
neither component dominates simply by having a larger scale
"""

import numpy as np
from scipy import sparse


class HybridModel:
    def __init__(self, als_model, content_model, alpha=0.6):
        """
        Parameters
        ----------
        als_model : ALSModel
            Trained ALS model
        content_model : ContentModel
            Trained content-based model
        alpha : float
            Weight for the collaborative signal. (1 - alpha) goes to content
        """
        self.als_model = als_model
        self.content_model = content_model
        self.alpha = alpha

    def _normalize(self, scores):
        # Min-max normalize scores to [0, 1]
        min_s = scores.min()
        max_s = scores.max()
        if max_s - min_s == 0:
            return np.zeros_like(scores)
        return (scores - min_s) / (max_s - min_s)

    def recommend(self, user_id, interaction_matrix, k=10):
        """
        Generate hybrid recommendations by combining normalized scores
        from both models
        """
        n_items = interaction_matrix.shape[0]

        # ALS scores
        # Score = dot product of user vector with every item vector
        user_factors = self.als_model.get_user_factors()
        item_factors = self.als_model.get_item_factors()
        als_scores = item_factors.dot(user_factors[user_id])
        als_scores = self._normalize(als_scores)

        # Content scores
        content_scores = self.content_model.score_items(user_id, interaction_matrix)
        content_scores = self._normalize(content_scores)

        # Combine
        combined = self.alpha * als_scores + (1 - self.alpha) * content_scores

        # Exclude already purchased items
        already_seen = set(interaction_matrix.tocsc()[:, user_id].nonzero()[0])
        for item in already_seen:
            combined[item] = -1

        top_k = np.argsort(combined)[::-1][:k]
        return top_k.tolist()
