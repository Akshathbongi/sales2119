# SalesPulse • Enterprise Sales Analytics & Data Studio

A modern, full-featured Python (**Flask + Pandas + NumPy + Chart.js**) web application for sales performance analytics, automated data-cleaning pipelines, interactive data insertion (CRUD), bulk CSV ingestion, and real-time business intelligence.

---

## 🚀 Key Features

1. **Interactive Data Ingestion & CRUD**:
   - **Insert New Sale**: Quick-entry modal with category-to-product auto-fill, unit price presets, live total revenue calculation, and immediate pipeline synchronization.
   - **Edit & Delete Records**: Directly edit or delete transactions from the live ledger with instant KPI recalculation.
   - **Paginated Ledger**: Search, filter, and sort through thousands of transactions.
2. **Bulk Data Studio & CSV Ingestion**:
   - **Drag-and-Drop CSV Upload**: Import custom sales datasets with automated schema handling.
   - **One-Click Export**: Export preprocessed, cleaned datasets directly to CSV.
   - **Synthetic Benchmark Generator**: Instantly generate 250, 500, or 1,000+ benchmark sales records.
3. **Global Multi-Dimensional Dynamic Filtering**:
   - Filter by Date Range (From - To), Category, Region, and search queries with instant reactivity across all charts and KPIs.
4. **Data Science & ETL Pipeline Inspector**:
   - Step-by-step visualizer for Modules 1 through 5.
   - Before vs. After data quality audit (duplicates dropped, missing values imputed, outliers handled).
   - Multi-variable Pearson Correlation Matrix.
5. **Executive Visual Analytics**:
   - KPI metric cards (Total Revenue, Total Orders, Units Sold, Avg. Order Value).
   - Monthly revenue trajectory, 24-hour peak sales cycle, weekday patterns, and revenue histogram.
   - Top products breakdown, category revenue doughnut, regional performance, and Region × Category matrix heatmap.
6. **Modern Design System**:
   - Dark & Light theme switcher with local storage memory.
   - Glassmorphism, smooth micro-interactions, responsive sidebar navigation, and toast notifications.

---

## 💻 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Application
```bash
python app.py
```

### 3. Open in Browser
Visit **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📁 Project Architecture

```
sales_dashboard/
├── app.py                      # Flask Application & REST API Endpoints
├── generate_data.py            # Synthetic dataset generator with data quality scenarios
├── requirements.txt            # Dependencies (Flask, Pandas, NumPy)
├── data/
│   └── raw_sales_data.csv      # Central sales data store
├── analysis/
│   ├── __init__.py
│   └── data_processor.py       # SalesDataProcessor (ETL, Cleaning, Preprocessing, EDA, CRUD)
├── templates/
│   └── index.html              # Modern dashboard & data studio template
└── static/
    ├── css/
    │   └── style.css           # Design system (Dark/Light themes, Glassmorphism)
    └── js/
        └── dashboard.js        # Dynamic Chart.js engine, CRUD manager, Filters & Modals
```

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/overview` | `GET` | Returns high-level summary KPIs, data quality audit, and raw stats |
| `/api/monthly-trend` | `GET` | Monthly revenue aggregations |
| `/api/sales-by-hour` | `GET` | 24-hour sales distribution |
| `/api/sales-by-weekday` | `GET` | Day-of-week sales volume |
| `/api/top-products` | `GET` | Top $N$ products by revenue (`?n=8`) |
| `/api/category-sales` | `GET` | Category revenue breakdown |
| `/api/region-sales` | `GET` | Regional revenue performance |
| `/api/region-category-matrix`| `GET` | Heatmap cross-matrix (Region × Category) |
| `/api/correlation` | `GET` | Pearson correlation matrix |
| `/api/revenue-histogram` | `GET` | Binned revenue distribution |
| `/api/catalog` | `GET` | Product catalog, pricing presets, categories & regions |
| `/api/orders` | `GET` | Paginated, searchable, sorted list of transactions |
| `/api/orders` | `POST` | Insert a new sales transaction |
| `/api/orders/<id>` | `PUT` | Update an existing transaction |
| `/api/orders/<id>` | `DELETE` | Delete a transaction |
| `/api/upload-csv` | `POST` | Upload and process a new CSV dataset |
| `/api/export-csv` | `GET` | Download cleaned dataset as CSV |
| `/api/generate-sample` | `POST` | Generate synthetic benchmark data |
| `/api/reset-data` | `POST` | Reset dataset to default benchmark |
