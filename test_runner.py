import io
import json
import pandas as pd
from app import app, processor

client = app.test_client()

print("[1/7] Testing CSV Template Download with exact schema...")
res = client.get("/api/sample-template")
assert res.status_code == 200
assert "text/csv" in res.content_type
template_text = res.data.decode("utf-8")
expected_headers = ["s.no", "order id", "product", "quantity ordered", "price each", "order date", "purchase address", "month", "sales", "city", "hour"]
for h in expected_headers:
    assert h in template_text, f"Missing header {h} in template"
print("  -> Sample Template OK with exact schema!")

print("[2/7] Testing Upload with Historical 2019 Data & Duplicate Lines (Ensuring 100% records kept)...")
# Historical dataset with duplicate item lines (legitimate multi-item orders) and 2019 dates
historical_csv = (
    'Order ID,Product,Quantity Ordered,Price Each,Order Date,Purchase Address\n'
    '176558,USB-C Charging Cable,2,11.95,04/19/19 08:46,"917 1st St, Dallas, TX 75001"\n'
    '176559,Bose SoundSport Headphones,1,99.99,04/07/19 22:30,"682 Chestnut St, Boston, MA 02215"\n'
    '176560,Google Phone,1,600,04/12/19 14:38,"669 Spruce St, Los Angeles, CA 90001"\n'
    '176560,Wired Headphones,1,11.99,04/12/19 14:38,"669 Spruce St, Los Angeles, CA 90001"\n'
    '176561,Wired Headphones,1,11.99,04/30/19 09:27,"333 8th St, Los Angeles, CA 90001"\n'
    '176562,USB-C Charging Cable,1,11.95,04/29/19 13:03,"381 Wilson St, San Francisco, CA 94016"\n'
    '176563,Bose SoundSport Headphones,1,99.99,04/02/19 07:46,"668 Center St, Seattle, WA 98101"\n'
    '176564,AAA Batteries (4-pack),3,2.99,04/12/19 10:58,"790 Ridge St, Atlanta, GA 30301"\n'
    '176565,Lightning Charging Cable,1,14.95,04/24/19 10:56,"152 Highland St, San Francisco, CA 94016"\n'
    '176566,Lightning Charging Cable,1,14.95,04/08/19 14:11,"83 7th St, Boston, MA 02215"\n'
)
res = client.post("/api/upload-csv", data={"file": (io.BytesIO(historical_csv.encode("utf-8")), "Sales_April_2019.csv")}, content_type="multipart/form-data")
assert res.status_code == 200, f"Upload failed: {res.data}"
upload_data = json.loads(res.data)
assert upload_data["success"] is True
assert upload_data["summary"]["total_orders"] == 10, f"Expected 10 rows, got {upload_data['summary']['total_orders']}"
print(f"  -> Successfully ingested 10/10 historical 2019 records with 100% retention!")

print("[3/7] Verifying Trends & Temporal endpoints with historical 2019 data...")
hourly = client.get("/api/sales-by-hour").json
assert len(hourly.get("labels", [])) == 24, "Hourly chart must have all 24 hours"
assert len(hourly.get("values", [])) == 24
assert sum(hourly["values"]) > 0, "Hourly values should contain aggregated revenue"

weekday = client.get("/api/sales-by-weekday").json
assert len(weekday.get("labels", [])) == 7, "Weekday chart must have all 7 days"
assert len(weekday.get("values", [])) == 7
assert sum(weekday["values"]) > 0, "Weekday values should contain aggregated revenue"

monthly = client.get("/api/monthly-trend").json
assert len(monthly.get("labels", [])) == 12, "Monthly trajectory must have 12 months"
assert sum(monthly.get("values", [])) > 0, "Monthly revenue must be positive"

histogram = client.get("/api/revenue-histogram").json
assert len(histogram.get("labels", [])) > 0, "Histogram labels must not be empty"
assert len(histogram.get("values", [])) > 0, "Histogram values must not be empty"
print("  -> All Trends & Temporal endpoints working with historical dates!")

print("[4/7] Verifying Products & Regions endpoints with custom dataset...")
ranking = client.get("/api/top-products").json
assert len(ranking.get("labels", [])) > 0, "Product ranking labels must not be empty"
assert len(ranking.get("values", [])) > 0, "Product ranking values must not be empty"

categories = client.get("/api/category-sales").json
assert len(categories.get("labels", [])) > 0, "Category breakdown labels must not be empty"
assert len(categories.get("values", [])) > 0, "Category breakdown values must not be empty"

regions = client.get("/api/region-sales").json
assert len(regions.get("labels", [])) > 0, "Region sales labels must not be empty"
assert len(regions.get("values", [])) > 0, "Region sales values must not be empty"

matrix = client.get("/api/region-category-matrix").json
assert len(matrix.get("regions", [])) > 0, "Region x Category matrix regions must not be empty"
assert len(matrix.get("matrix", [])) > 0, "Region x Category matrix data must not be empty"
print("  -> All Products & Regions endpoints working flawlessly!")

print("[5/7] Testing AI Sci-Fi Holographic Telemetry Engine...")
telemetry = client.get("/api/telemetry").json
assert telemetry.get("total_records") == 10
assert "top_product" in telemetry
assert "top_region" in telemetry
assert "peak_hour" in telemetry
assert len(telemetry.get("ai_insights", [])) >= 3
print("  -> Sci-Fi Holographic Telemetry generated successfully!")

print("[6/7] Testing Purge / Delete All Transactions Button & Empty State Chart Responses...")
del_all = client.delete("/api/orders/all").json
assert del_all["success"] is True
assert del_all["deleted_count"] == 10

overview_empty = client.get("/api/overview").json
assert overview_empty["summary"]["total_orders"] == 0
assert overview_empty["summary"]["total_revenue"] == 0

# Check empty state chart endpoints
empty_monthly = client.get("/api/monthly-trend").json
assert len(empty_monthly["labels"]) == 12
assert sum(empty_monthly["values"]) == 0

empty_hourly = client.get("/api/sales-by-hour").json
assert len(empty_hourly["labels"]) == 24
assert sum(empty_hourly["values"]) == 0

empty_weekday = client.get("/api/sales-by-weekday").json
assert len(empty_weekday["labels"]) == 7
assert sum(empty_weekday["values"]) == 0

empty_prods = client.get("/api/top-products").json
assert len(empty_prods["labels"]) > 0

empty_cats = client.get("/api/category-sales").json
assert len(empty_cats["labels"]) > 0

empty_regs = client.get("/api/region-sales").json
assert len(empty_regs["labels"]) > 0

empty_matrix = client.get("/api/region-category-matrix").json
assert len(empty_matrix["regions"]) > 0

orders_empty = client.get("/api/orders").json
assert orders_empty["total"] == 0
assert len(orders_empty["orders"]) == 0
print("  -> Purged all transactions. Database and UI ledger accurately reset to 0 with non-empty chart structures!")

# Test uppercase CSV upload
test_csv_upper = (
    's.no,order id,product,quantity ordered,price each,order date,purchase address,month,sales,city,hour\n'
    '1,999001,iPhone 15,1,78000,2025-01-22 21:25:00,"944 Chestnut St, Boston, MA 02215",January,78000,Boston,21\n'
)
upper_res = client.post("/api/upload-csv", data={"file": (io.BytesIO(test_csv_upper.encode("utf-8")), "SALES_UPPER.CSV")}, content_type="multipart/form-data")
assert upper_res.status_code == 200, f"Uppercase CSV upload failed: {upper_res.data}"
assert upper_res.json["success"] is True
print("  -> Uppercase .CSV filename accepted and ingested successfully!")

print("[7/7] Regenerating Standard Benchmark to Restore Clean State...")
gen_res = client.post("/api/generate-sample", json={"rows": 500})
assert gen_res.status_code == 200
new_overview = client.get("/api/overview").json
new_orders = client.get("/api/orders").json
assert new_overview["summary"]["total_orders"] == new_orders["total"] >= 500
print(f"  -> Benchmark regenerated & synchronized! Total rows: {new_orders['total']}")

print("\n=========================================================================")
print("  ALL TESTS PASSED: HISTORICAL DATES, SCI-FI HUD, PURGE ALL & RETENTION  ")
print("=========================================================================")

