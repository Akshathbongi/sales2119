"""
generate_data.py
-----------------
Creates data/raw_sales_data.csv — a synthetic sales transaction dataset
that intentionally contains missing values and duplicate rows, so the
Sales Data Analysis System has real data-cleaning work to do (as per the
project methodology: Module 3 - Data Cleaning, Module 4 - Preprocessing).

Run once: python generate_data.py
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

random.seed(42)
np.random.seed(42)

PRODUCTS = {
    "Electronics": [
        ("Macbook Pro Laptop", 145000), ("iPhone 15", 78000), ("ThinkPad Laptop", 62000),
        ("Google Phone", 45000), ("27in 4K Gaming Monitor", 32000),
        ("34in Ultrawide Monitor", 28000), ("Apple Airpods Headphones", 18000),
        ("Bose SoundSport Headphones", 12000), ("27in FHD Monitor", 14000),
        ("Flatscreen TV", 39000), ("Tablet", 18000), ("Wired Headphones", 1500),
    ],
    "Furniture": [
        ("Office Chair", 4500), ("Study Desk", 12000), ("Bookshelf", 6000),
        ("Filing Cabinet", 8000), ("Sofa", 22000),
    ],
    "Office": [
        ("Printer", 15500), ("Scanner", 9000), ("Projector", 26000),
        ("Whiteboard", 3200), ("Paper Ream (Box)", 1200),
    ],
    "Accessories": [
        ("Laptop Bag", 1800), ("USB-C Cable", 400), ("Wireless Mouse", 900),
        ("Mechanical Keyboard", 3500), ("Webcam", 2800),
    ],
    "Clothing": [
        ("Formal Shirt", 1200), ("Running Shoes", 3200), ("Jacket", 4500),
    ],
}

REGIONS = ["North", "South", "East", "West"]

def random_date(start, end):
    delta = end - start
    rand_days = random.randint(0, delta.days)
    rand_seconds = random.randint(0, 86399)
    return start + timedelta(days=rand_days, seconds=rand_seconds)

start_date = datetime(2025, 1, 1)
end_date = datetime(2025, 12, 31)

rows = []
order_id = 1001
for _ in range(1600):
    category = random.choice(list(PRODUCTS.keys()))
    product, base_price = random.choice(PRODUCTS[category])
    qty = random.choice([1, 1, 1, 2, 2, 3, 4, 5, 6, 8])
    price = round(base_price * random.uniform(0.92, 1.08), -1)
    revenue = round(price * qty, 2)
    dt = random_date(start_date, end_date)
    region = random.choice(REGIONS)

    rows.append({
        "OrderID": f"SO{order_id}",
        "Date": dt.strftime("%Y-%m-%d"),
        "Hour": dt.hour,
        "Product": product,
        "Category": category,
        "Region": region,
        "Qty": qty,
        "Price": price,
        "Revenue": revenue,
        "CustomerAge": random.randint(18, 65),
    })
    order_id += 1

df = pd.DataFrame(rows)

# --- Inject data-quality problems on purpose ---------------------------

# 1) Missing values scattered across a few columns
for col, frac in [("Price", 0.02), ("Region", 0.015), ("Qty", 0.01), ("CustomerAge", 0.03)]:
    idx = df.sample(frac=frac, random_state=hash(col) % 1000).index
    df.loc[idx, col] = np.nan

# 2) Recompute Revenue as missing wherever Price/Qty is missing (realistic knock-on effect)
df.loc[df["Price"].isna() | df["Qty"].isna(), "Revenue"] = np.nan

# 3) Duplicate ~3% of rows verbatim (common data-entry duplication)
dupes = df.sample(frac=0.03, random_state=7)
df = pd.concat([df, dupes], ignore_index=True)

# 4) Shuffle so duplicates aren't trivially adjacent
df = df.sample(frac=1, random_state=1).reset_index(drop=True)

df.to_csv("data/raw_sales_data.csv", index=False)
print(f"Wrote data/raw_sales_data.csv with {len(df)} rows "
      f"({df.isna().any(axis=1).sum()} rows with missing values, "
      f"{df.duplicated().sum()} exact duplicate rows)")
