"""
Synthetic Data Generator — Portable Kitchen Appliances E-Commerce
Generates: products.csv, users.csv, interactions.csv
"""

import numpy as np
import pandas as pd
import random
import csv
from itertools import product as iterproduct

SEED = 42
np.random.seed(SEED)
random.seed(SEED)

N_USERS = 1000
N_PRODUCTS = 1000
COLD_START_FRACTION = 0.15  # 15% of users are cold-start

# ---------------------------------------------------------------------------
# 1. PRODUCT CATALOG
# ---------------------------------------------------------------------------

categories = {
    "Portable Kettle": {
        "en_adjectives": ["compact", "travel-sized", "foldable", "stainless steel", "dual-voltage",
                          "mini", "cordless", "rapid-boil", "collapsible", "lightweight"],
        "en_features": ["1000W heating element", "0.5L capacity", "auto shut-off",
                        "boil-dry protection", "360° swivel base", "LED indicator",
                        "BPA-free interior", "carry pouch included", "2-minute boil time",
                        "universal voltage 110-240V"],
        "ru_adjectives": ["компактный", "дорожный", "складной", "из нержавеющей стали",
                          "двухвольтовый", "мини", "беспроводной", "быстрокипятильный",
                          "коллапсируемый", "лёгкий"],
        "ru_features": ["нагревательный элемент 1000 Вт", "ёмкость 0.5 л", "автоотключение",
                        "защита от закипания без воды", "поворотная база 360°", "LED-индикатор",
                        "BPA-свободный корпус", "чехол в комплекте", "кипячение за 2 минуты",
                        "универсальное напряжение 110-240В"],
        "brands": ["TravelBrews", "KettlePro", "PortaBoil", "SwiftKettle", "RoamWarm"],
        "price_range": (1500, 8000),
    },
    "Multi-Cooker": {
        "en_adjectives": ["portable", "all-in-one", "programmable", "smart", "mini",
                          "electric", "multifunctional", "compact", "pressure", "slow"],
        "en_features": ["8-in-1 cooking modes", "1.5L inner pot", "delay timer",
                        "non-stick coating", "steam release valve", "keep-warm function",
                        "stainless steel housing", "dishwasher-safe parts",
                        "touch panel controls", "overheat protection"],
        "ru_adjectives": ["портативный", "многофункциональный", "программируемый", "умный",
                          "мини", "электрический", "универсальный", "компактный",
                          "скороварка", "медленноварка"],
        "ru_features": ["8 режимов приготовления", "внутренняя кастрюля 1.5 л",
                        "таймер задержки", "антипригарное покрытие", "клапан сброса пара",
                        "функция поддержания тепла", "корпус из нержавеющей стали",
                        "детали для посудомоечной машины", "сенсорная панель", "защита от перегрева"],
        "brands": ["CookMate", "MultiChef", "QuickPot", "AllCook", "SmartPot"],
        "price_range": (8000, 35000),
    },
    "Rice Cooker": {
        "en_adjectives": ["fuzzy logic", "portable", "mini", "induction", "micom",
                          "digital", "stainless", "smart", "compact", "non-stick"],
        "en_features": ["1L capacity", "automatic keep-warm", "steam basket included",
                        "detachable inner lid", "measuring cup and spatula included",
                        "multiple cooking presets", "24-hour delay timer",
                        "non-stick removable pot", "cool-touch handle", "cord storage"],
        "ru_adjectives": ["с нечёткой логикой", "портативный", "мини", "индукционный",
                          "цифровой", "из нержавеющей стали", "умный", "компактный",
                          "с антипригарным покрытием", "многофункциональный"],
        "ru_features": ["ёмкость 1 л", "автоматическое поддержание тепла", "пароварочная корзина",
                        "съёмная внутренняя крышка", "мерный стакан и лопатка в комплекте",
                        "несколько режимов приготовления", "таймер на 24 часа",
                        "съёмная антипригарная кастрюля", "ручка cool-touch", "хранение шнура"],
        "brands": ["GrainMaster", "RiceKing", "ZenRice", "PerfectGrain", "CrispRice"],
        "price_range": (5000, 25000),
    },
    "Coffee Maker": {
        "en_adjectives": ["single-serve", "portable", "espresso", "drip", "capsule",
                          "travel", "rechargeable", "hand-held", "stovetop", "cold-brew"],
        "en_features": ["USB-C charging", "15-bar pressure pump", "thermal carafe",
                        "reusable filter", "adjustable brew strength", "milk frother included",
                        "self-cleaning mode", "pod and ground compatible",
                        "temperature control", "spill-proof lid"],
        "ru_adjectives": ["порционный", "портативный", "эспрессо", "капельный", "капсульный",
                          "дорожный", "перезаряжаемый", "ручной", "гейзерный", "холодного заваривания"],
        "ru_features": ["зарядка USB-C", "насос давления 15 бар", "термос-кофейник",
                        "многоразовый фильтр", "регулируемая крепость", "вспениватель молока",
                        "режим самоочистки", "совместим с капсулами и молотым кофе",
                        "контроль температуры", "крышка от разливания"],
        "brands": ["BrewGo", "EspressoX", "JavaPod", "MobileBrew", "CaféToGo"],
        "price_range": (4000, 40000),
    },
    "Portable Blender": {
        "en_adjectives": ["rechargeable", "personal", "mini", "cordless", "USB",
                          "travel", "smoothie", "powerful", "self-cleaning", "quiet"],
        "en_features": ["600mAh battery", "6 stainless blades", "400ml cup",
                        "one-button operation", "USB charging cable included",
                        "BPA-free tritan cup", "leak-proof lid", "2-speed settings",
                        "self-cleaning mode", "dishwasher-safe blade assembly"],
        "ru_adjectives": ["перезаряжаемый", "персональный", "мини", "беспроводной",
                          "USB", "дорожный", "для смузи", "мощный", "самоочищающийся", "тихий"],
        "ru_features": ["аккумулятор 600 мАч", "6 лезвий из нержавеющей стали", "чаша 400 мл",
                        "управление одной кнопкой", "кабель USB в комплекте",
                        "чаша BPA-free из тритана", "крышка без протечек", "2 скоростных режима",
                        "режим самоочистки", "лезвия для посудомоечной машины"],
        "brands": ["BlendJoy", "SmoothiePro", "MiniBlend", "VortexGo", "FreshBlend"],
        "price_range": (3000, 15000),
    },
}

def generate_products(n=1000):
    cat_names = list(categories.keys())
    # Distribute 1000 products roughly evenly across 5 categories
    products = []
    product_id = 1

    per_category = n // len(cat_names)
    remainder = n % len(cat_names)

    for i, cat_name in enumerate(cat_names):
        count = per_category + (1 if i < remainder else 0)
        cat = categories[cat_name]

        for _ in range(count):
            adj_en = random.choice(cat["en_adjectives"])
            feat1_en = random.choice(cat["en_features"])
            feat2_en = random.choice([f for f in cat["en_features"] if f != feat1_en])
            brand = random.choice(cat["brands"])
            model_num = f"{random.randint(100,999)}-{random.choice('ABCDEFGX')}"

            name_en = f"{brand} {adj_en.title()} {cat_name} {model_num}"
            desc_en = (f"The {brand} {model_num} is a {adj_en} {cat_name.lower()} "
                       f"designed for on-the-go use. Features include {feat1_en} and {feat2_en}. "
                       f"Ideal for car travel, camping, and small spaces.")

            adj_ru = random.choice(cat["ru_adjectives"])
            feat1_ru = random.choice(cat["ru_features"])
            feat2_ru = random.choice([f for f in cat["ru_features"] if f != feat1_ru])

            name_ru = f"{brand} {adj_ru} {cat_name} {model_num}"
            desc_ru = (f"{brand} {model_num} — это {adj_ru} {cat_name.lower()} "
                       f"для использования в дороге. Особенности: {feat1_ru} и {feat2_ru}. "
                       f"Идеально для автопутешествий, кемпинга и небольших пространств.")

            price = round(random.uniform(*cat["price_range"]), -1)

            products.append({
                "product_id": product_id,
                "category": cat_name,
                "brand": brand,
                "name_en": name_en,
                "name_ru": name_ru,
                "description_en": desc_en,
                "description_ru": desc_ru,
                "price_kzt": price,
            })
            product_id += 1

    random.shuffle(products)
    # Re-assign product_ids after shuffle so they're not grouped by category
    for idx, p in enumerate(products):
        p["product_id"] = idx + 1

    return pd.DataFrame(products)


# ---------------------------------------------------------------------------
# 2. USER LIST
# ---------------------------------------------------------------------------

def generate_users(n=1000):
    users = [{"user_id": i + 1} for i in range(n)]
    return pd.DataFrame(users)


# ---------------------------------------------------------------------------
# 3. INTERACTIONS
# ---------------------------------------------------------------------------

def generate_interactions(products_df, users_df):
    """
    Generates a sparse user-item interaction matrix with purchase counts

    Design:
    - Item popularity: Zipf distribution (alpha=1.5). Reflects real-world
      long-tail purchasing behaviour where ~20% of items account for ~80%
      of purchases (Brynjolfsson, Hu and Smith, 2003)
    - User activity: power law. Most users buy 5-15 unique items; a small
      number of active users buy up to 60 unique items
    - Each user has 1-2 preferred categories. Items in preferred categories
      get a 5x weight boost, creating the collaborative signal ALS needs
    - Cold-start users: 15% of users have 0-2 interactions only
    - Purchase counts: geometric distribution (p=0.7)
    """
    n_users = len(users_df)
    n_items = len(products_df)
    product_ids = products_df["product_id"].values
    user_ids = users_df["user_id"].values
    cat_names = list(categories.keys())

    # Map each product to its category index for preference weighting
    product_categories = products_df["category"].values
    cat_to_idx = {c: i for i, c in enumerate(cat_names)}
    product_cat_idx = np.array([cat_to_idx[c] for c in product_categories])

    # Item popularity weights - Zipf distribution
    ranks = np.arange(1, n_items + 1)
    np.random.shuffle(ranks)
    zipf_weights = 1.0 / (ranks ** 1.5)
    zipf_weights /= zipf_weights.sum()

    # Designate cold-start users
    n_cold = int(n_users * COLD_START_FRACTION)
    cold_user_ids = set(np.random.choice(user_ids, size=n_cold, replace=False))

    interactions = []

    for user_id in user_ids:
        if user_id in cold_user_ids:
            # Cold-start: 0-2 unique items, no category preference
            n_unique_items = np.random.choice([0, 1, 2], p=[0.3, 0.4, 0.3])
            if n_unique_items == 0:
                continue
            chosen_items = np.random.choice(
                product_ids, size=n_unique_items, replace=False, p=zipf_weights
            )
        else:
            # Warm user: assign 1-2 preferred categories
            n_preferred = np.random.choice([1, 2], p=[0.4, 0.6])
            preferred_cats = set(np.random.choice(
                len(cat_names), size=n_preferred, replace=False
            ))

            # 5x weight boost for items in preferred categories
            user_weights = zipf_weights.copy()
            for i in range(n_items):
                if product_cat_idx[i] in preferred_cats:
                    user_weights[i] *= 5.0
            user_weights /= user_weights.sum()

            # zipf(1.5) + 10 gives most users 12-25 items, heavy users up to 80
            n_unique_items = min(int(np.random.zipf(1.5) + 10), 80)
            chosen_items = np.random.choice(
                product_ids, size=min(n_unique_items, n_items),
                replace=False, p=user_weights
            )

        for item_id in chosen_items:
            purchase_count = np.random.geometric(p=0.7)
            interactions.append({
                "user_id": int(user_id),
                "product_id": int(item_id),
                "purchase_count": int(purchase_count)
            })

    return pd.DataFrame(interactions)


# ---------------------------------------------------------------------------
# 4. RUN & SAVE
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating products...")
    products_df = generate_products(N_PRODUCTS)

    print("Generating users...")
    users_df = generate_users(N_USERS)

    print("Generating interactions...")
    interactions_df = generate_interactions(products_df, users_df)

    products_df.to_csv("products.csv", index=False)
    users_df.to_csv("users.csv", index=False)
    interactions_df.to_csv("interactions.csv", index=False)

    # Summary statistics
    n_unique_pairs = len(interactions_df)
    total_purchases = interactions_df["purchase_count"].sum()
    density = n_unique_pairs / (N_USERS * N_PRODUCTS) * 100
    avg_unique_per_user = interactions_df.groupby("user_id").size().mean()
    avg_count = interactions_df["purchase_count"].mean()
    users_with_interactions = interactions_df["user_id"].nunique()
    n_cold_actual = N_USERS - users_with_interactions

    print("\n--- Synthesis Summary ---")
    print(f"Products:                    {len(products_df)}")
    print(f"Users:                       {len(users_df)}")
    print(f"Unique user-item pairs:      {n_unique_pairs}")
    print(f"Total purchase events:       {total_purchases}")
    print(f"Matrix density:              {density:.2f}%")
    print(f"Avg unique items/user:       {avg_unique_per_user:.1f}")
    print(f"Avg purchase count per pair: {avg_count:.2f}")
    print(f"Zero-interaction users (cold-start pool): {n_cold_actual}")
    print("\nFiles saved: products.csv, users.csv, interactions.csv")
