"""
Sales Data Analysis & Management System
---------------------------------------
Flask backend for the project. Loads the sales dataset, executes the data
cleaning / preprocessing pipeline, serves the executive dashboard, and
provides a full REST API for data ingestion, transaction management (CRUD),
CSV bulk upload/export matching requested schema:
[s.no, order id, product, quantity ordered, price each, order date, purchase address, month, sales, city, hour]
and real-time filtered analytics.

Run:
    pip install -r requirements.txt
    python app.py
Then open http://127.0.0.1:5000
"""

import io
from flask import Flask, render_template, jsonify, request, Response
import pandas as pd
from analysis.data_processor import SalesDataProcessor

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Initialize and run data pipeline at startup
processor = SalesDataProcessor().run_pipeline()


def extract_filters():
    """Extracts common query filters from request.args."""
    return {
        "category": request.args.get("category", ""),
        "region": request.args.get("region", ""),
        "start_date": request.args.get("start_date", ""),
        "end_date": request.args.get("end_date", ""),
        "search": request.args.get("search", ""),
    }


@app.route("/")
def index():
    return render_template("index.html")


# ==========================================
#  ANALYTICS & METRICS ENDPOINTS (FILTERED)
# ==========================================

@app.route("/api/overview")
def api_overview():
    filters = extract_filters()
    return jsonify({
        "summary": processor.summary_stats(filters),
        "data_quality": processor.quality_report,
        "raw_exploration": processor.explore(),
    })


@app.route("/api/monthly-trend")
def api_monthly_trend():
    filters = extract_filters()
    return jsonify(processor.monthly_trend(filters))


@app.route("/api/sales-by-hour")
def api_sales_by_hour():
    filters = extract_filters()
    return jsonify(processor.sales_by_hour(filters))


@app.route("/api/sales-by-weekday")
def api_sales_by_weekday():
    filters = extract_filters()
    return jsonify(processor.sales_by_weekday(filters))


@app.route("/api/top-products")
def api_top_products():
    n = int(request.args.get("n", 10))
    filters = extract_filters()
    return jsonify(processor.top_products(n, filters))


@app.route("/api/category-sales")
def api_category_sales():
    filters = extract_filters()
    return jsonify(processor.category_sales(filters))


@app.route("/api/region-sales")
def api_region_sales():
    filters = extract_filters()
    return jsonify(processor.region_sales(filters))


@app.route("/api/region-category-matrix")
def api_region_category_matrix():
    filters = extract_filters()
    return jsonify(processor.region_category_matrix(filters))


@app.route("/api/correlation")
def api_correlation():
    filters = extract_filters()
    return jsonify(processor.quantity_price_correlation(filters))


@app.route("/api/revenue-histogram")
def api_revenue_histogram():
    filters = extract_filters()
    bins = int(request.args.get("bins", 12))
    return jsonify(processor.revenue_histogram(bins=bins, filters=filters))


@app.route("/api/top-orders")
def api_top_orders():
    n = int(request.args.get("n", 10))
    filters = extract_filters()
    return jsonify(processor.top_orders(n, filters))


# ==========================================
#  TRANSACTIONS MANAGEMENT & CRUD ENDPOINTS
# ==========================================

@app.route("/api/catalog")
def api_catalog():
    """Returns categories, standard products, prices, and regions for form selectors."""
    return jsonify(processor.get_catalog())


@app.route("/api/orders", methods=["GET"])
def api_get_orders():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    search = request.args.get("search", "")
    category = request.args.get("category", "")
    region = request.args.get("region", "")
    sort_by = request.args.get("sort_by", "SNo")
    sort_order = request.args.get("sort_order", "asc")
    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")

    result = processor.get_orders_paginated(
        page=page,
        limit=limit,
        search=search,
        category=category,
        region=region,
        sort_by=sort_by,
        sort_order=sort_order,
        start_date=start_date,
        end_date=end_date,
    )
    return jsonify(result)


@app.route("/api/orders", methods=["POST"])
def api_add_order():
    """Insert a new sales transaction record."""
    data = request.get_json() or {}
    if not data.get("Product"):
        return jsonify({"success": False, "error": "Product name is required"}), 400

    try:
        inserted = processor.add_transaction(data)
        return jsonify({
            "success": True,
            "message": f"Order {inserted.get('OrderID')} successfully recorded!",
            "order": inserted,
            "summary": processor.summary_stats(),
        }), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/orders/<order_id>", methods=["PUT"])
def api_update_order(order_id):
    """Update an existing transaction record."""
    data = request.get_json() or {}
    updated = processor.update_transaction(order_id, data)
    if updated:
        return jsonify({
            "success": True,
            "message": f"Order {order_id} successfully updated!",
            "summary": processor.summary_stats(),
        })
    return jsonify({"success": False, "error": f"Order {order_id} not found"}), 404


@app.route("/api/orders/all", methods=["DELETE"])
@app.route("/api/clear-all", methods=["POST", "DELETE"])
def api_clear_all_orders():
    """Deletes all transactions in the system and resets the ledger."""
    res = processor.clear_all_transactions()
    return jsonify(res)


@app.route("/api/orders/<order_id>", methods=["DELETE"])
def api_delete_order(order_id):
    """Delete a transaction record."""
    if str(order_id).lower() in ["all", "__all__"]:
        return api_clear_all_orders()
    deleted = processor.delete_transaction(order_id)
    if deleted:
        return jsonify({
            "success": True,
            "message": f"Order {order_id} deleted successfully.",
            "summary": processor.summary_stats(),
        })
    return jsonify({"success": False, "error": f"Order {order_id} not found"}), 404


# ==========================================
#  DATA BULK INGESTION, UPLOAD, EXPORT, TEMPLATE
# ==========================================

@app.route("/api/telemetry")
def api_telemetry():
    """Returns AI Sci-Fi telemetry diagnostic metrics for HUD display."""
    return jsonify(processor.get_deep_telemetry())


@app.route("/api/upload-csv", methods=["POST"])
def api_upload_csv():
    """Uploads a user CSV file and reloads the pipeline.
    Seamlessly parses: [s.no, order id, product, quantity ordered, price each, order date, purchase address, month, sales, city, hour]
    """
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded. Please select a CSV file."}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".csv"):
        return jsonify({"success": False, "error": "Only .csv files are supported."}), 400

    try:
        raw_bytes = file.read()
        if not raw_bytes or len(raw_bytes.strip()) == 0:
            return jsonify({"success": False, "error": "Uploaded CSV file is empty"}), 400

        df = None
        for enc in ["utf-8-sig", "utf-8", "latin1", "cp1252", "iso-8859-1"]:
            try:
                df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc, on_bad_lines="skip")
                if df is not None and not df.empty:
                    break
            except Exception:
                continue

        if df is None or df.empty:
            return jsonify({"success": False, "error": "Uploaded CSV contains no valid data rows"}), 400

        processor.raw_df = processor.normalize_columns(df)
        processor.save_raw()
        processor.clean().preprocess()

        return jsonify({
            "success": True,
            "message": f"Ingested & cleaned {len(processor.df)} records successfully!",
            "summary": processor.summary_stats(),
            "quality": processor.quality_report,
            "telemetry": processor.get_deep_telemetry(),
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to parse CSV: {str(e)}"}), 500


@app.route("/api/export-csv")
def api_export_csv():
    """Exports current cleaned transaction data in exact requested schema:
    [s.no, order id, product, quantity ordered, price each, order date, purchase address, month, sales, city, hour]
    """
    if processor.df is None or processor.df.empty:
        return jsonify({"error": "No data available to export"}), 400

    export_df = processor.get_export_df()
    csv_buffer = io.StringIO()
    export_df.to_csv(csv_buffer, index=False)

    return Response(
        csv_buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=sales_data.csv"}
    )


@app.route("/api/sample-template")
def api_sample_template():
    """Provides a sample CSV template with exact requested schema:
    [s.no, order id, product, quantity ordered, price each, order date, purchase address, month, sales, city, hour]
    """
    sample_rows = [
        {"s.no": 1, "order id": "141234", "product": "iPhone 15", "quantity ordered": 1, "price each": 78000.0, "order date": "2025-01-22 21:25:00", "purchase address": "944 Chestnut St, Boston, MA 02215", "month": "January", "sales": 78000.0, "city": "Boston", "hour": 21},
        {"s.no": 2, "order id": "141235", "product": "Lightning Charging Cable", "quantity ordered": 1, "price each": 14.95, "order date": "2025-01-28 14:15:00", "purchase address": "185 Maple St, San Francisco, CA 94016", "month": "January", "sales": 14.95, "city": "San Francisco", "hour": 14},
        {"s.no": 3, "order id": "141236", "product": "Wired Headphones", "quantity ordered": 2, "price each": 11.99, "order date": "2025-01-17 13:33:00", "purchase address": "538 Adams St, San Francisco, CA 94016", "month": "January", "sales": 23.98, "city": "San Francisco", "hour": 13},
        {"s.no": 4, "order id": "141237", "product": "27in FHD Monitor", "quantity ordered": 1, "price each": 149.99, "order date": "2025-01-05 20:33:00", "purchase address": "738 10th St, Los Angeles, CA 90001", "month": "January", "sales": 149.99, "city": "Los Angeles", "hour": 20},
        {"s.no": 5, "order id": "141238", "product": "Macbook Pro Laptop", "quantity ordered": 1, "price each": 1700.00, "order date": "2025-01-25 11:59:00", "purchase address": "387 10th St, Austin, TX 73301", "month": "January", "sales": 1700.00, "city": "Austin", "hour": 11}
    ]
    template_df = pd.DataFrame(sample_rows)
    csv_buffer = io.StringIO()
    template_df.to_csv(csv_buffer, index=False)
    return Response(
        csv_buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=sales_data_template.csv"}
    )


@app.route("/api/generate-sample", methods=["POST"])
def api_generate_sample():
    """Generates benchmark sample data with configurable row count."""
    data = request.get_json() or {}
    n_rows = int(data.get("rows", 500))
    processor.generate_sample(n_rows=n_rows, save=True)
    processor.clean().preprocess()
    return jsonify({
        "success": True,
        "message": f"Generated {n_rows} fresh benchmark records!",
        "summary": processor.summary_stats(),
    })


@app.route("/api/reset-data", methods=["POST"])
def api_reset_data():
    """Resets dataset to default realistic benchmark."""
    processor.generate_sample(n_rows=500, save=True)
    processor.clean().preprocess()
    return jsonify({
        "success": True,
        "message": "Dataset successfully reset to default benchmark.",
        "summary": processor.summary_stats(),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
