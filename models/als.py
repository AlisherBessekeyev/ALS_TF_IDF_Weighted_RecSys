"""
ALS (Alternating Least Squares) for implicit feedback

The implicit library handles everything internally — we just pass in the
interaction matrix and hyperparameters
"""

import os
import numpy as np
import pandas as pd
from scipy import sparse
from implicit.als import AlternatingLeastSquares


class ALSModel:
    def __init__(self, factors=50, regularization=0.01, alpha=40, iterations=15):
        """
        Parameters
        ----------
        factors : int
            Number of latent dimensions (k). Each user and item gets a vector
            of this length. Typical range: 20-200
        regularization : float
            Lambda in the cost function. Prevents overfitting by penalizing
            large parameter values
        alpha : float
            Confidence scaling factor from Hu et al. (2008)
            c_ui = 1 + alpha * r_ui. Higher alpha means purchase count
            differences matter more
        iterations : int
            Number of ALS alternation cycles. Typically 10-15 is enough
        """
        self.alpha = alpha
        self.model = AlternatingLeastSquares(
            factors=factors,
            regularization=regularization,
            iterations=iterations,
            random_state=42,
        )

    def fit(self, interaction_matrix):
        """
        Train the ALS model

        Parameters
        ----------
        interaction_matrix : sparse CSR matrix (items x users)
            Raw purchase counts. We transpose internally because the
            implicit library expects (users x items), but our project
            convention throughout is (items x users)
        """
        self.interaction_matrix = interaction_matrix
        # implicit expects (users x items); transpose to match
        user_items = interaction_matrix.T.tocsr()
        # Apply confidence weighting: c_ui = 1 + alpha * r_ui
        # The implicit library adds the +1 internally
        weighted = (user_items * self.alpha).astype("double")
        self.model.fit(weighted)

    def recommend(self, user_id, interaction_matrix, k=10):
        """
        Return top-K recommendations for a user

        The implicit library handles filtering already-seen items internally
        when filter_already_liked_items=True
        """
        # The implicit library expects a user-items matrix (users x items) for filtering
        user_items = interaction_matrix.T.tocsr()

        ids, scores = self.model.recommend(
            user_id,
            user_items[user_id],
            N=k,
            filter_already_liked_items=True,
        )
        return ids.tolist()

    def get_user_factors(self):
        #Returns the learned user latent factor matrix
        return self.model.user_factors

    def get_item_factors(self):
        #Returns the learned item latent factor matrix
        return self.model.item_factors
