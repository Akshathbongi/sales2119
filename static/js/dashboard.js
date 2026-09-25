/**
 * SalesPulse Analytics & Data Management Engine
 * Next-Gen Interactive Dashboard & CRUD Controller
 * Supports schema: [s.no, order id, product, quantity ordered, price each, order date, purchase address, month, sales, city, hour]
 */

// ================= GLOBAL STATE =================
const state = {
  theme: localStorage.getItem("theme") || "dark",
  activeTab: "overview",
  catalog: [],
  categories: [],
  regions: [],
  filters: {
    start_date: "",
    end_date: "",
    category: "all",
    region: "all",
    search: "",
  },
  pagination: {
    page: 1,
    limit: 10,
    search: "",
    sort_by: "SNo",
    sort_order: "asc",
    total: 0,
    pages: 1,
  },
  charts: {},
  cachedAnalytics: null,
  debounceTimer: null,
};

// ================= COLOR PALETTES =================
const PALETTE = {
  primary: "#6366f1",
  primaryGradientStart: "rgba(99, 102, 241, 0.4)",
  primaryGradientEnd: "rgba(99, 102, 241, 0.02)",
  teal: "#14b8a6",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  cyan: "#06b6d4",
  gridDark: "rgba(255, 255, 255, 0.06)",
  gridLight: "rgba(0, 0, 0, 0.06)",
  textDark: "#94a3b8",
  textLight: "#64748b",
};

const money = (v) =>
  "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function getChartTheme() {
  const isDark = state.theme === "dark";
  return {
    grid: isDark ? PALETTE.gridDark : PALETTE.gridLight,
    text: isDark ? PALETTE.textDark : PALETTE.textLight,
  };
}

// ================= AUDIO & UI FEEDBACK STATE =================
var audioCtx = null;
var soundEnabled = localStorage.getItem("scifi_sound") !== "false";

if (typeof Chart !== "undefined" && Chart && Chart.defaults && Chart.defaults.font) {
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
}

// ================= TAB SWITCHING & ROUTING =================
function switchTab(tabId) {
  if (!tabId) tabId = "overview";
  state.activeTab = tabId;

  // 1. Update navigation active state
  document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => {
    const itemTab = item.getAttribute("data-tab");
    if (itemTab === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // 2. Switch active content section
  const sections = document.querySelectorAll(".view-section");
  sections.forEach((sec) => {
    sec.classList.remove("active");
    sec.style.display = "none";
  });

  const targetSection = document.getElementById(`section-${tabId}`);
  if (targetSection) {
    targetSection.classList.add("active");
    targetSection.style.display = "block";
  }

  // 3. Update URL hash
  if (window.location.hash !== `#${tabId}`) {
    window.history.replaceState(null, null, `#${tabId}`);
  }

  // 4. Close mobile sidebar
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.remove("open");

  // 5. Render charts for the newly visible section and resize
  setTimeout(() => {
    if (state.cachedAnalytics) {
      renderSectionCharts(tabId, state.cachedAnalytics);
    } else {
      refreshDashboardData();
    }
    Object.values(state.charts).forEach((chart) => {
      if (chart && typeof chart.resize === "function") {
        chart.resize();
      }
    });
  }, 60);

  // 6. Refresh active tab data
  if (tabId === "transactions") {
    loadTransactions();
  }
}

function handleHashChange() {
  const hash = window.location.hash.replace("#", "");
  const validTabs = ["overview", "trends", "products-regions", "quality-pipeline", "transactions", "data-studio"];
  if (validTabs.includes(hash)) {
    switchTab(hash);
  }
}

// ================= THEME MANAGEMENT =================
function toggleTheme() {
  const newTheme = state.theme === "dark" ? "light" : "dark";
  state.theme = newTheme;
  localStorage.setItem("theme", newTheme);
  applyTheme(newTheme);
  refreshDashboardData();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(state.theme);

  const initialHash = window.location.hash.replace("#", "");
  const validTabs = ["overview", "trends", "products-regions", "quality-pipeline", "transactions", "data-studio"];
  const startTab = validTabs.includes(initialHash) ? initialHash : "overview";
  switchTab(startTab);

  window.addEventListener("hashchange", handleHashChange);

  document.querySelectorAll(".sidebar-nav .nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = link.getAttribute("data-tab");
      if (tab) switchTab(tab);
    });
  });

  const menuBtn = document.getElementById("btn-toggle-sidebar");
  const sidebar = document.getElementById("sidebar");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  window.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) {
      document.querySelectorAll(".dropdown-menu").forEach((m) => m.classList.remove("show"));
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });

  setupDropzones();

  await loadCatalogAndMetadata();
  await refreshDashboardData();
  await loadTransactions();
});

// ================= DRAG & DROP FILE INGESTION =================
function setupDropzones() {
  const dropzones = document.querySelectorAll(".upload-dropzone");
  dropzones.forEach((dz) => {
    ["dragenter", "dragover"].forEach((eventName) => {
      dz.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dz.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove("dragover");
      });
    });

    dz.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith(".csv")) {
          closeModal("modal-upload");
          executeCSVUpload(file);
        } else {
          showToast("Please drop a valid .csv file", "error");
        }
      }
    });
  });
}

// ================= CATALOG & METADATA =================
async function loadCatalogAndMetadata() {
  try {
    const res = await fetch("/api/catalog");
    const data = await res.json();
    state.catalog = data.catalog || [];
    state.categories = data.categories || [];
    state.regions = data.regions || [];

    populateFilterDropdowns();
    populateFormDropdowns();
  } catch (err) {
    console.error("Failed to load catalog:", err);
  }
}

function populateFilterDropdowns() {
  const catSelect = document.getElementById("filter-category");
  const regSelect = document.getElementById("filter-region");

  if (catSelect) {
    catSelect.innerHTML = `<option value="all">All Categories</option>` +
      state.categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  }

  if (regSelect) {
    regSelect.innerHTML = `<option value="all">All Regions / Cities</option>` +
      state.regions.map((r) => `<option value="${r}">${r}</option>`).join("");
  }
}

function populateFormDropdowns() {
  const catSelect = document.getElementById("form-category");
  const regSelect = document.getElementById("form-region");

  if (catSelect) {
    catSelect.innerHTML = `<option value="">Select Category...</option>` +
      state.categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  }

  if (regSelect) {
    regSelect.innerHTML = `<option value="">Select Region / City...</option>` +
      state.regions.map((r) => `<option value="${r}">${r}</option>`).join("");
  }
}

// ================= DYNAMIC FILTERING =================
function buildQueryString(extra = {}) {
  const params = new URLSearchParams();
  if (state.filters.start_date) params.append("start_date", state.filters.start_date);
  if (state.filters.end_date) params.append("end_date", state.filters.end_date);
  if (state.filters.category && state.filters.category !== "all") params.append("category", state.filters.category);
  if (state.filters.region && state.filters.region !== "all") params.append("region", state.filters.region);
  if (state.filters.search) params.append("search", state.filters.search);

  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== "") params.append(k, v);
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}

function applyFilters() {
  state.filters.start_date = document.getElementById("filter-start-date")?.value || "";
  state.filters.end_date = document.getElementById("filter-end-date")?.value || "";
  state.filters.category = document.getElementById("filter-category")?.value || "all";
  state.filters.region = document.getElementById("filter-region")?.value || "all";
  state.filters.search = document.getElementById("filter-search")?.value || "";

  renderActiveFilterTags();
  refreshDashboardData();
  state.pagination.page = 1;
  loadTransactions();
}

function debounceFilter() {
  clearTimeout(state.debounceTimer);
  const searchInput = document.getElementById("filter-search");
  const clearBtn = document.getElementById("btn-clear-search");
  if (clearBtn) clearBtn.style.display = searchInput?.value ? "block" : "none";

  state.debounceTimer = setTimeout(() => {
    applyFilters();
  }, 300);
}

function clearSearch() {
  const searchInput = document.getElementById("filter-search");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("btn-clear-search");
  if (clearBtn) clearBtn.style.display = "none";
  applyFilters();
}

function resetFilters() {
  const sDate = document.getElementById("filter-start-date");
  const eDate = document.getElementById("filter-end-date");
  const cat = document.getElementById("filter-category");
  const reg = document.getElementById("filter-region");
  const search = document.getElementById("filter-search");
  const clearBtn = document.getElementById("btn-clear-search");

  if (sDate) sDate.value = "";
  if (eDate) eDate.value = "";
  if (cat) cat.value = "all";
  if (reg) reg.value = "all";
  if (search) search.value = "";
  if (clearBtn) clearBtn.style.display = "none";

  state.filters = {
    start_date: "",
    end_date: "",
    category: "all",
    region: "all",
    search: "",
  };

  renderActiveFilterTags();
  refreshDashboardData();
  state.pagination.page = 1;
  loadTransactions();
  showToast("Filters reset to default", "info");
}

function renderActiveFilterTags() {
  const bar = document.getElementById("active-filters-bar");
  const container = document.getElementById("filter-tags-container");
  if (!bar || !container) return;

  const tags = [];
  if (state.filters.start_date) tags.push({ key: "start_date", label: `From: ${state.filters.start_date}` });
  if (state.filters.end_date) tags.push({ key: "end_date", label: `To: ${state.filters.end_date}` });
  if (state.filters.category && state.filters.category !== "all") tags.push({ key: "category", label: `Cat: ${state.filters.category}` });
  if (state.filters.region && state.filters.region !== "all") tags.push({ key: "region", label: `Region/City: ${state.filters.region}` });
  if (state.filters.search) tags.push({ key: "search", label: `Query: "${state.filters.search}"` });

  if (tags.length === 0) {
    bar.style.display = "none";
    container.innerHTML = "";
    return;
  }

  bar.style.display = "flex";
  container.innerHTML = tags.map((t) => `
    <span class="filter-tag-pill">
      ${t.label}
      <button onclick="removeFilter('${t.key}')">&times;</button>
    </span>
  `).join("");
}

function removeFilter(key) {
  if (key === "start_date") document.getElementById("filter-start-date").value = "";
  if (key === "end_date") document.getElementById("filter-end-date").value = "";
  if (key === "category") document.getElementById("filter-category").value = "all";
  if (key === "region") document.getElementById("filter-region").value = "all";
  if (key === "search") {
    document.getElementById("filter-search").value = "";
    const btn = document.getElementById("btn-clear-search");
    if (btn) btn.style.display = "none";
  }
  applyFilters();
}

// ================= ANALYTICS & CHARTS =================
async function refreshDashboardData() {
  const query = buildQueryString();
  try {
    const overview = await (await fetch(`/api/overview${query}`)).json();
    const s = overview.summary || {};

    const revEl = document.getElementById("kpi-revenue");
    const ordEl = document.getElementById("kpi-orders");
    const qtyEl = document.getElementById("kpi-qty");
    const aovEl = document.getElementById("kpi-aov");
    const navTx = document.getElementById("nav-tx-count");

    const totalOrdersCount = Number(s.total_orders || 0);
    if (revEl) revEl.textContent = money(s.total_revenue);
    if (ordEl) ordEl.textContent = totalOrdersCount.toLocaleString();
    if (qtyEl) qtyEl.textContent = Number(s.total_quantity || 0).toLocaleString();
    if (aovEl) aovEl.textContent = money(s.avg_order_value);
    if (navTx) navTx.textContent = totalOrdersCount.toLocaleString();

    // Auto-adjust KPI cards visibility if metric is missing
    const cardRev = document.getElementById("card-kpi-revenue");
    const cardOrd = document.getElementById("card-kpi-orders");
    const cardQty = document.getElementById("card-kpi-qty");
    const cardAov = document.getElementById("card-kpi-aov");
    if (cardRev) cardRev.style.display = s.total_revenue !== undefined && s.total_revenue !== null ? "" : "none";
    if (cardOrd) cardOrd.style.display = s.total_orders !== undefined && s.total_orders !== null ? "" : "none";
    if (cardQty) cardQty.style.display = s.total_quantity !== undefined && s.total_quantity !== null ? "" : "none";
    if (cardAov) cardAov.style.display = s.avg_order_value !== undefined && s.avg_order_value !== null ? "" : "none";

    // Auto-adjust date picker bounds to available date range
    if (s.date_range && s.date_range.length === 2 && s.date_range[0] && s.date_range[1]) {
      const sDate = document.getElementById("filter-start-date");
      const eDate = document.getElementById("filter-end-date");
      if (sDate) {
        sDate.min = s.date_range[0];
        sDate.max = s.date_range[1];
      }
      if (eDate) {
        eDate.min = s.date_range[0];
        eDate.max = s.date_range[1];
      }
    }

    // Quality metrics
    const q = overview.data_quality || {};
    const qb = document.getElementById("q-rows-before");
    const qa = document.getElementById("q-rows-after");
    const qd = document.getElementById("q-dupes-removed");
    const qm = document.getElementById("q-missing-fixed");
    if (qb) qb.textContent = q.rows_before || 0;
    if (qa) qa.textContent = q.rows_after || 0;
    if (qd) qd.textContent = q.duplicates_removed || 0;
    if (qm) qm.textContent = q.missing_values_before || 0;

    const [monthly, category, products, region, hourly, weekday, histogram, matrix, corr] = await Promise.all([
      fetch(`/api/monthly-trend${query}`).then((r) => r.json()),
      fetch(`/api/category-sales${query}`).then((r) => r.json()),
      fetch(`/api/top-products${buildQueryString({ n: document.getElementById("top-products-limit")?.value || 8 })}`).then((r) => r.json()),
      fetch(`/api/region-sales${query}`).then((r) => r.json()),
      fetch(`/api/sales-by-hour${query}`).then((r) => r.json()),
      fetch(`/api/sales-by-weekday${query}`).then((r) => r.json()),
      fetch(`/api/revenue-histogram${query}`).then((r) => r.json()),
      fetch(`/api/region-category-matrix${query}`).then((r) => r.json()),
      fetch(`/api/correlation${query}`).then((r) => r.json()),
    ]);

    state.cachedAnalytics = {
      monthly,
      category,
      products,
      region,
      hourly,
      weekday,
      histogram,
      matrix,
      corr,
    };

    renderAllCharts(state.cachedAnalytics);

  } catch (err) {
    console.error("Dashboard refresh error:", err);
  }
}

function renderAllCharts(data) {
  if (!data) return;
  renderMonthlyChart("chart-monthly", data.monthly);
  renderCategoryChart("chart-category", data.category);
  renderProductsChart("chart-products", data.products);
  renderRegionChart("chart-region", data.region);

  renderHourlyChart(data.hourly);
  renderWeekdayChart(data.weekday);
  renderMonthlyChart("chart-monthly-trends", data.monthly);
  renderHistogramChart(data.histogram);

  renderCategoryChart("chart-category-pr", data.category);
  renderProductsChart("chart-products-pr", data.products);
  renderRegionChart("chart-region-pr", data.region);
  renderMatrixHeatmap(data.matrix);

  renderCorrelationHeatmap(data.corr);
}

function renderSectionCharts(tabId, data) {
  if (!data) return;
  if (tabId === "overview") {
    renderMonthlyChart("chart-monthly", data.monthly);
    renderCategoryChart("chart-category", data.category);
    renderProductsChart("chart-products", data.products);
    renderRegionChart("chart-region", data.region);
  } else if (tabId === "trends") {
    renderHourlyChart(data.hourly);
    renderWeekdayChart(data.weekday);
    renderMonthlyChart("chart-monthly-trends", data.monthly);
    renderHistogramChart(data.histogram);
  } else if (tabId === "products-regions") {
    renderCategoryChart("chart-category-pr", data.category);
    renderProductsChart("chart-products-pr", data.products);
    renderRegionChart("chart-region-pr", data.region);
    renderMatrixHeatmap(data.matrix);
  } else if (tabId === "quality-pipeline") {
    renderCorrelationHeatmap(data.corr);
  }
}

// ================= BOX VISIBILITY & CHART RENDERERS =================
function setBoxVisibility(targetId, hasData) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const panel = el.closest(".dashboard-panel") || el.closest(".kpi-card");
  if (panel) {
    panel.style.display = hasData ? "" : "none";
  }
}

function renderMonthlyChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 0 && data.values && data.values.some((v) => Number(v) > 0));
  setBoxVisibility(canvasId, hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const theme = getChartTheme();

  if (state.charts[canvasId]) state.charts[canvasId].destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, PALETTE.primaryGradientStart);
  gradient.addColorStop(1, PALETTE.primaryGradientEnd);

  state.charts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Revenue",
        data: data.values,
        borderColor: PALETTE.primary,
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.38,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: PALETTE.primary,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` Revenue: ${money(ctx.raw)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11 } } },
        y: {
          grid: { color: theme.grid },
          ticks: { color: theme.text, font: { size: 11 }, callback: (v) => money(v) },
        },
      },
    },
  });
}

function renderCategoryChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 0 && data.values && data.values.some((v) => Number(v) > 0));
  setBoxVisibility(canvasId, hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const theme = getChartTheme();

  if (state.charts[canvasId]) state.charts[canvasId].destroy();

  const colors = [PALETTE.primary, PALETTE.teal, PALETTE.amber, PALETTE.purple, PALETTE.pink, PALETTE.blue];

  state.charts[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: colors.slice(0, data.labels.length),
        borderWidth: 2,
        borderColor: state.theme === "dark" ? "#161c2d" : "#ffffff",
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 10, color: theme.text, font: { size: 11.5 } },
        },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${money(ctx.raw)}` } },
      },
    },
  });
}

function renderProductsChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 0 && data.values && data.values.some((v) => Number(v) > 0));
  setBoxVisibility(canvasId, hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const theme = getChartTheme();

  if (state.charts[canvasId]) state.charts[canvasId].destroy();

  state.charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Revenue",
        data: data.values,
        backgroundColor: PALETTE.primary,
        borderRadius: 5,
        maxBarThickness: 24,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` Revenue: ${money(ctx.raw)}` } },
      },
      scales: {
        x: { grid: { color: theme.grid }, ticks: { color: theme.text, font: { size: 10.5 }, callback: (v) => money(v) } },
        y: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11 } } },
      },
    },
  });
}

function loadTopProducts() {
  refreshDashboardData();
}

function renderRegionChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 0 && data.values && data.values.some((v) => Number(v) > 0));
  setBoxVisibility(canvasId, hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const theme = getChartTheme();

  if (state.charts[canvasId]) state.charts[canvasId].destroy();

  state.charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: [PALETTE.teal, PALETTE.primary, PALETTE.amber, PALETTE.purple, PALETTE.pink],
        borderRadius: 6,
        maxBarThickness: 42,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` Revenue: ${money(ctx.raw)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11 } } },
        y: { grid: { color: theme.grid }, ticks: { color: theme.text, font: { size: 11 }, callback: (v) => money(v) } },
      },
    },
  });
}

function renderHourlyChart(data) {
  const canvas = document.getElementById("chart-hourly");
  if (!canvas) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 0 && data.values && data.values.some((v) => Number(v) > 0));
  setBoxVisibility("chart-hourly", hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const theme = getChartTheme();

  if (state.charts.hourly) state.charts.hourly.destroy();

  const labels = data.labels.map((h) => `${h}:00`);

  // Update Peak Hour Badge
  const peakBadge = document.getElementById("peak-hour-badge");
  if (peakBadge && data.values && data.values.length > 0) {
    const maxVal = Math.max(...data.values);
    const maxIdx = data.values.indexOf(maxVal);
    if (maxVal > 0 && maxIdx >= 0) {
      peakBadge.textContent = `Peak: ${data.labels[maxIdx]}:00 (${money(maxVal)})`;
    } else {
      peakBadge.textContent = "24h Distribution";
    }
  }

  state.charts.hourly = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Sales",
        data: data.values,
        borderColor: PALETTE.teal,
        backgroundColor: "rgba(20, 184, 166, 0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` Sales: ${money(ctx.raw)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 10 } } },
        y: { grid: { color: theme.grid }, ticks: { color: theme.text, font: { size: 11 }, callback: (v) => money(v) } },
      },
    },
  });
}

function renderWeekdayChart(data) {
  const canvas = document.getElementById("chart-weekday");
  if (!canvas) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 0 && data.values && data.values.some((v) => Number(v) > 0));
  setBoxVisibility("chart-weekday", hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const theme = getChartTheme();

  if (state.charts.weekday) state.charts.weekday.destroy();

  state.charts.weekday = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: PALETTE.amber,
        borderRadius: 5,
        maxBarThickness: 34,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` Sales: ${money(ctx.raw)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11 } } },
        y: { grid: { color: theme.grid }, ticks: { color: theme.text, font: { size: 11 }, callback: (v) => money(v) } },
      },
    },
  });
}

function renderHistogramChart(data) {
  const canvas = document.getElementById("chart-histogram");
  if (!canvas) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 0 && data.values && data.values.some((v) => Number(v) > 0));
  setBoxVisibility("chart-histogram", hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const theme = getChartTheme();

  if (state.charts.histogram) state.charts.histogram.destroy();

  state.charts.histogram = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels.map((l) => (String(l).startsWith("₹") ? l : `₹${l}`)),
      datasets: [{
        label: "Order Count",
        data: data.values,
        backgroundColor: PALETTE.purple,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` Count: ${ctx.raw} orders` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 10.5 } } },
        y: { grid: { color: theme.grid }, ticks: { color: theme.text, font: { size: 11 } } },
      },
    },
  });
}

// ================= HEATMAPS =================
function renderMatrixHeatmap(data) {
  const container = document.getElementById("heatmap");
  if (!container) return;
  const hasData = Boolean(data && data.regions && data.regions.length > 0 && data.categories && data.categories.length > 0 && data.matrix && data.matrix.flat().some((v) => Number(v) > 0));
  setBoxVisibility("heatmap", hasData);
  if (!hasData) return;

  container.innerHTML = "";

  const colHeader = document.createElement("div");
  colHeader.className = "heatmap-col-header";
  data.categories.forEach((c) => {
    const span = document.createElement("span");
    span.textContent = c;
    colHeader.appendChild(span);
  });
  container.appendChild(colHeader);

  const flat = data.matrix.flat();
  const max = Math.max(...flat.map(Math.abs), 1);

  data.regions.forEach((rLabel, i) => {
    const row = document.createElement("div");
    row.className = "heatmap-row";

    const label = document.createElement("div");
    label.className = "heatmap-row-label";
    label.textContent = rLabel;
    row.appendChild(label);

    data.matrix[i].forEach((val, j) => {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      const alpha = 0.15 + 0.8 * (val / max);
      cell.style.backgroundColor = `rgba(99, 102, 241, ${alpha.toFixed(2)})`;
      cell.textContent = val > 0 ? money(val) : "₹0";
      cell.title = `${rLabel} × ${data.categories[j] || ""}: ${money(val)}`;
      row.appendChild(cell);
    });

    container.appendChild(row);
  });
}

function renderCorrelationHeatmap(data) {
  const container = document.getElementById("corr-heatmap");
  if (!container) return;
  const hasData = Boolean(data && data.labels && data.labels.length > 1 && data.matrix && data.matrix.length > 1);
  setBoxVisibility("corr-heatmap", hasData);
  if (!hasData) return;

  container.innerHTML = "";

  const colHeader = document.createElement("div");
  colHeader.className = "heatmap-col-header";
  data.labels.forEach((c) => {
    const span = document.createElement("span");
    span.textContent = c;
    colHeader.appendChild(span);
  });
  container.appendChild(colHeader);

  data.labels.forEach((rLabel, i) => {
    const row = document.createElement("div");
    row.className = "heatmap-row";

    const label = document.createElement("div");
    label.className = "heatmap-row-label";
    label.textContent = rLabel;
    row.appendChild(label);

    data.matrix[i].forEach((val) => {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      const alpha = Math.min(Math.abs(val), 1);
      cell.style.backgroundColor = val >= 0
        ? `rgba(20, 184, 166, ${Math.max(alpha, 0.2).toFixed(2)})`
        : `rgba(239, 68, 68, ${Math.max(alpha, 0.2).toFixed(2)})`;
      cell.textContent = typeof val === "number" ? val.toFixed(2) : val;
      cell.title = `${rLabel} vs ${data.labels[i]}: r = ${val}`;
      row.appendChild(cell);
    });

    container.appendChild(row);
  });
}

// ================= LIVE TRANSACTIONS CRUD TABLE =================
async function loadTransactions() {
  const tbody = document.getElementById("tx-table-body");
  if (!tbody) return;

  const query = buildQueryString({
    page: state.pagination.page,
    limit: state.pagination.limit,
    search: state.pagination.search,
    sort_by: state.pagination.sort_by,
    sort_order: state.pagination.sort_order,
  });

  try {
    const res = await fetch(`/api/orders${query}`);
    const data = await res.json();
    state.pagination.total = data.total || 0;
    state.pagination.pages = data.pages || 1;

    // Synchronize toggle badge and order KPI in real-time
    const totalCount = Number(data.total || 0);
    const navTx = document.getElementById("nav-tx-count");
    if (navTx) navTx.textContent = totalCount.toLocaleString();

    const ordEl = document.getElementById("kpi-orders");
    if (ordEl) ordEl.textContent = totalCount.toLocaleString();

    renderTransactionTable(data.orders || []);
    renderPagination();
  } catch (err) {
    console.error("Failed to load transactions:", err);
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Failed to load transactions</td></tr>`;
  }
}

function renderTransactionTable(orders) {
  const tbody = document.getElementById("tx-table-body");
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">No transaction records found matching criteria. Click "+ Add Transaction" or generate sample data.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map((o, idx) => {
    const sno = o.SNo || ((state.pagination.page - 1) * state.pagination.limit + idx + 1);
    const catPillClass = `pill-${(o.Category || "").toLowerCase().replace(/\s+/g, "")}`;
    const cityAddress = o.City || o.Region || "San Francisco";
    return `
      <tr>
        <td class="text-muted" style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px;">${sno}</td>
        <td class="cell-order-id">${o.OrderID}</td>
        <td>${o.Date}</td>
        <td><strong>${o.Product}</strong></td>
        <td><span class="pill ${catPillClass}">${o.Category || "General"}</span></td>
        <td>${cityAddress}</td>
        <td class="text-right" style="font-family: 'JetBrains Mono', monospace;">${o.Qty}</td>
        <td class="text-right" style="font-family: 'JetBrains Mono', monospace;">${money(o.Price)}</td>
        <td class="text-right cell-revenue">${money(o.Revenue)}</td>
        <td>
          <div class="table-actions-cell">
            <button class="action-icon-btn" onclick="openEditModal('${o.OrderID}')" title="Edit record">
              <i class="ri-edit-line"></i>
            </button>
            <button class="action-icon-btn btn-delete" onclick="confirmDeleteOrder('${o.OrderID}')" title="Delete record">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderPagination() {
  const info = document.getElementById("pagination-info");
  const controls = document.getElementById("pagination-controls");
  if (!info || !controls) return;

  const { page, limit, total, pages } = state.pagination;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  info.textContent = `Showing ${start} to ${end} of ${total} entries`;

  let html = `
    <button class="page-btn" onclick="goToPage(${page - 1})" ${page <= 1 ? "disabled" : ""}>
      <i class="ri-arrow-left-s-line"></i>
    </button>
  `;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(pages, startPage + maxVisiblePages - 1);
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="page-btn ${i === page ? "active" : ""}" onclick="goToPage(${i})">
        ${i}
      </button>
    `;
  }

  html += `
    <button class="page-btn" onclick="goToPage(${page + 1})" ${page >= pages ? "disabled" : ""}>
      <i class="ri-arrow-right-s-line"></i>
    </button>
  `;

  controls.innerHTML = html;
}

function goToPage(p) {
  if (p < 1 || p > state.pagination.pages) return;
  state.pagination.page = p;
  loadTransactions();
}

function changePageSize() {
  const size = parseInt(document.getElementById("tx-page-size")?.value || 10);
  state.pagination.limit = size;
  state.pagination.page = 1;
  loadTransactions();
}

function handleTableSearch() {
  const search = document.getElementById("tx-search-input")?.value || "";
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => {
    state.pagination.search = search;
    state.pagination.page = 1;
    loadTransactions();
  }, 300);
}

function sortTable(column) {
  if (state.pagination.sort_by === column) {
    state.pagination.sort_order = state.pagination.sort_order === "asc" ? "desc" : "asc";
  } else {
    state.pagination.sort_by = column;
    state.pagination.sort_order = "asc";
  }
  loadTransactions();
}

// ================= MODALS & INSERT / EDIT =================
function openAddModal() {
  document.getElementById("modal-tx-title").innerHTML = `<i class="ri-add-circle-line icon-accent"></i> Record New Sales Transaction`;
  document.getElementById("form-edit-id").value = "";
  document.getElementById("form-order-id").value = "";
  document.getElementById("form-order-id").disabled = false;
  document.getElementById("form-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("form-category").value = "";
  document.getElementById("form-product-select").innerHTML = `<option value="">Select Category first...</option>`;
  document.getElementById("form-product-custom").value = "";
  document.getElementById("form-product-custom").style.display = "none";
  document.getElementById("form-price").value = "";
  document.getElementById("form-qty").value = "1";
  document.getElementById("form-region").value = "San Francisco";
  document.getElementById("form-age").value = "30";
  calculateFormRevenue();

  openModal("modal-transaction");
}

async function openEditModal(orderId) {
  try {
    const res = await fetch(`/api/orders?search=${orderId}&limit=1`);
    const data = await res.json();
    const order = data.orders && data.orders[0];
    if (!order) {
      showToast("Order record not found", "error");
      return;
    }

    document.getElementById("modal-tx-title").innerHTML = `<i class="ri-edit-line icon-accent"></i> Edit Sales Transaction (${orderId})`;
    document.getElementById("form-edit-id").value = order.OrderID;
    document.getElementById("form-order-id").value = order.OrderID;
    document.getElementById("form-order-id").disabled = true;
    document.getElementById("form-date").value = order.Date || "";
    document.getElementById("form-category").value = order.Category || "";
    
    handleCategoryChange();

    const prodSelect = document.getElementById("form-product-select");
    const customProd = document.getElementById("form-product-custom");
    let found = false;
    for (let opt of prodSelect.options) {
      if (opt.value === order.Product) {
        prodSelect.value = order.Product;
        found = true;
        break;
      }
    }
    if (!found) {
      prodSelect.value = "__custom__";
      customProd.style.display = "block";
      customProd.value = order.Product;
    }

    document.getElementById("form-price").value = order.Price;
    document.getElementById("form-qty").value = order.Qty;
    document.getElementById("form-region").value = order.City || order.Region || "San Francisco";
    document.getElementById("form-age").value = order.CustomerAge || "30";
    calculateFormRevenue();

    openModal("modal-transaction");
  } catch (err) {
    console.error("Failed to load order for edit:", err);
    showToast("Failed to retrieve order details", "error");
  }
}

function handleCategoryChange() {
  const cat = document.getElementById("form-category")?.value;
  const prodSelect = document.getElementById("form-product-select");
  const customProd = document.getElementById("form-product-custom");
  if (customProd) customProd.style.display = "none";

  if (!cat) {
    prodSelect.innerHTML = `<option value="">Select Category first...</option>`;
    return;
  }

  const items = state.catalog.filter((i) => i.category.toLowerCase() === cat.toLowerCase());
  let options = `<option value="">Select Product...</option>`;
  items.forEach((item) => {
    options += `<option value="${item.product}" data-price="${item.price}">${item.product} (₹${item.price.toLocaleString()})</option>`;
  });
  options += `<option value="__custom__">+ Enter Custom Product Name...</option>`;
  prodSelect.innerHTML = options;
}

function handleProductSelect() {
  const prodSelect = document.getElementById("form-product-select");
  const customProd = document.getElementById("form-product-custom");
  const selected = prodSelect.options[prodSelect.selectedIndex];

  if (prodSelect.value === "__custom__") {
    customProd.style.display = "block";
    customProd.focus();
  } else {
    customProd.style.display = "none";
    if (selected && selected.dataset.price) {
      document.getElementById("form-price").value = selected.dataset.price;
    }
  }
  calculateFormRevenue();
}

function calculateFormRevenue() {
  const price = parseFloat(document.getElementById("form-price")?.value || 0);
  const qty = parseFloat(document.getElementById("form-qty")?.value || 0);
  const rev = price * qty;
  const el = document.getElementById("form-calc-revenue");
  if (el) el.textContent = money(rev);
}

async function handleTransactionSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById("form-edit-id").value;
  const prodSelect = document.getElementById("form-product-select");
  const customProd = document.getElementById("form-product-custom");

  let product = prodSelect.value === "__custom__" ? customProd.value.trim() : prodSelect.value;
  if (!product) {
    showToast("Please select or enter a Product name", "error");
    return;
  }

  const payload = {
    OrderID: document.getElementById("form-order-id").value.trim() || undefined,
    Date: document.getElementById("form-date").value,
    Category: document.getElementById("form-category").value,
    Product: product,
    Price: parseFloat(document.getElementById("form-price").value),
    Qty: parseInt(document.getElementById("form-qty").value),
    City: document.getElementById("form-region").value,
    Region: document.getElementById("form-region").value,
    CustomerAge: parseInt(document.getElementById("form-age").value || 30),
  };

  try {
    let url = "/api/orders";
    let method = "POST";
    if (editId) {
      url = `/api/orders/${editId}`;
      method = "PUT";
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      showToast(editId ? `Transaction ${editId} updated!` : `New transaction recorded!`, "success");
      closeModal("modal-transaction");
      await refreshDashboardData();
      await loadTransactions();
    } else {
      showToast(data.error || "Failed to save transaction", "error");
    }
  } catch (err) {
    console.error("Submit error:", err);
    showToast("Server error during save", "error");
  }
}

// ================= DELETE =================
function confirmDeleteOrder(orderId) {
  const modal = document.getElementById("modal-confirm");
  const titleEl = document.getElementById("confirm-title");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok-btn");

  const executeDelete = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast(`Order ${orderId} deleted successfully`, "success");
        await refreshDashboardData();
        await loadTransactions();
      } else {
        showToast(data.error || "Failed to delete order", "error");
      }
    } catch (err) {
      showToast("Error deleting order", "error");
    }
  };

  if (modal && titleEl && msgEl && okBtn) {
    titleEl.innerHTML = `<i class="ri-delete-bin-line text-danger"></i> Delete Sales Transaction`;
    msgEl.innerHTML = `Are you sure you want to delete order <strong>${orderId}</strong>? This action cannot be undone.`;
    okBtn.onclick = async () => {
      closeModal("modal-confirm");
      await executeDelete();
    };
    openModal("modal-confirm");
  } else {
    if (confirm(`Are you sure you want to delete order ${orderId}?`)) {
      executeDelete();
    }
  }
}

function confirmDeleteAllOrders() {
  const modal = document.getElementById("modal-confirm");
  const titleEl = document.getElementById("confirm-title");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok-btn");

  const executePurge = async () => {
    try {
      const res = await fetch("/api/orders/all", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("All transactions deleted successfully. Database ledger reset to 0.", "success");
        await refreshDashboardData();
        await loadTransactions();
        // Reset visible counters
        const navCount = document.getElementById("nav-tx-count");
        if (navCount) navCount.textContent = "0";
        const totalCount = document.getElementById("tx-total-count");
        if (totalCount) totalCount.textContent = "0";
        const kpiOrders = document.getElementById("kpi-orders");
        if (kpiOrders) kpiOrders.textContent = "0";
        const kpiRevenue = document.getElementById("kpi-revenue");
        if (kpiRevenue) kpiRevenue.textContent = money(0);
      } else {
        showToast(data.error || "Failed to delete transactions", "error");
      }
    } catch (err) {
      showToast("Error executing bulk delete", "error");
    }
  };

  if (modal && titleEl && msgEl && okBtn) {
    titleEl.innerHTML = `<i class="ri-error-warning-line text-danger"></i> Delete All Transactions`;
    msgEl.innerHTML = `Are you sure you want to permanently delete <strong>ALL transaction records</strong> from the database? This action resets the entire ledger to zero.`;
    okBtn.onclick = async () => {
      closeModal("modal-confirm");
      await executePurge();
    };
    openModal("modal-confirm");
  } else {
    if (confirm("Are you sure you want to permanently delete ALL transaction records from the database?")) {
      executePurge();
    }
  }
}

// ================= WEB AUDIO API SOUND ENGINE =================
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Auto-unlock audio on any user interaction
function unlockAudioEngine() {
  getAudioContext();
  document.removeEventListener("click", unlockAudioEngine);
  document.removeEventListener("pointerdown", unlockAudioEngine);
  document.removeEventListener("keydown", unlockAudioEngine);
}
document.addEventListener("click", unlockAudioEngine, { passive: true });
document.addEventListener("pointerdown", unlockAudioEngine, { passive: true });
document.addEventListener("keydown", unlockAudioEngine, { passive: true });

function playCyberBeep(freq = 900, duration = 0.05) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playCyberSuccess() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chime
    freqs.forEach((f, idx) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }, idx * 80);
    });
  } catch (e) {}
}

function playCyberLaunch() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(350, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function toggleSciFiSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("scifi_sound", soundEnabled);
  updateSoundButtonUI();
  if (soundEnabled) {
    playCyberBeep(880, 0.08);
  }
}

function updateSoundButtonUI() {
  const icon = document.getElementById("scifi-sound-icon");
  const text = document.getElementById("scifi-sound-text");
  if (icon && text) {
    if (soundEnabled) {
      icon.className = "ri-volume-up-line";
      text.textContent = "AUDIO ON";
    } else {
      icon.className = "ri-volume-mute-line";
      text.textContent = "AUDIO MUTED";
    }
  }
}

// ================= SALES DATA ANALYSIS MODAL =================
function openSciFiHUD() {
  const hud = document.getElementById("modal-scifi-hud");
  if (hud) {
    hud.classList.add("show");
    hud.style.display = "flex";
    updateSoundButtonUI();
  }
}

function closeSciFiHUD() {
  const hud = document.getElementById("modal-scifi-hud");
  if (hud) {
    hud.classList.remove("show");
    hud.style.display = "none";
  }
}

function exportCleanedCSV() {
  window.location.href = "/api/export-csv";
}

function launchCockpit() {
  playCyberLaunch();
  closeSciFiHUD();
  switchTab("overview");
  showToast("Sales Data Analysis synchronized with dashboard", "success");
}

function animateNumber(el, start, end, duration, formatFn = (v) => v.toLocaleString()) {
  if (!el) return;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * easeOut;
    el.textContent = formatFn(current);
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = formatFn(end);
    }
  }
  requestAnimationFrame(update);
}

// ================= CSV UPLOAD WITH SALES DATA ANALYSIS SEQUENCE =================
function openUploadModal() {
  openModal("modal-upload");
}

async function uploadModalFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  e.target.value = "";
  closeModal("modal-upload");
  await executeCSVUpload(file);
}

function handleFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (file) {
    e.target.value = "";
    executeCSVUpload(file);
  }
}

async function executeCSVUpload(file) {
  getAudioContext(); // Resume audio context on upload
  openSciFiHUD();

  const stageDecoding = document.getElementById("scifi-stage-decoding");
  const stageTelemetry = document.getElementById("scifi-stage-telemetry");
  const terminalLogs = document.getElementById("scifi-terminal-logs");
  const progressBar = document.getElementById("scifi-progress-bar");
  const progressPct = document.getElementById("scifi-progress-pct");
  const progressPhase = document.getElementById("scifi-progress-phase");
  const headerStatus = document.getElementById("scifi-header-status");

  if (stageDecoding) stageDecoding.style.display = "flex";
  if (stageTelemetry) stageTelemetry.style.display = "none";
  if (progressBar) progressBar.style.width = "0%";
  if (progressPct) progressPct.textContent = "0%";
  if (headerStatus) {
    headerStatus.innerHTML = `<span class="scifi-dot-pulsing"></span> Analysing Dataset: ${file.name}`;
  }

  const logs = [
    { text: `[00.15s] Reading and parsing ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`, color: "text-cyan", pct: 20 },
    { text: `[00.40s] Validating 11 schema columns & transaction fields...`, color: "text-purple", pct: 45 },
    { text: `[00.70s] Cleaning transactions & calculating sales revenue...`, color: "text-emerald", pct: 70 },
    { text: `[00.95s] Aggregating regional, product, and hourly metrics...`, color: "text-cyan", pct: 88 },
    { text: `[01.20s] Sales data analysis generated successfully!`, color: "text-emerald", pct: 100 },
  ];

  if (terminalLogs) {
    terminalLogs.innerHTML = "";
  }

  // Upload request initiated
  const formData = new FormData();
  formData.append("file", file);

  const uploadPromise = fetch("/api/upload-csv", {
    method: "POST",
    body: formData,
  }).then(async (r) => {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: false, error: `Server returned error (${r.status}): ${text.slice(0, 120)}` };
    }
  }).catch((err) => ({ success: false, error: `Network upload error: ${err.message}` }));

  // Animate Terminal Logs with Audio
  let logIdx = 0;
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (logIdx < logs.length) {
        const item = logs[logIdx];
        if (terminalLogs) {
          const line = document.createElement("div");
          line.className = `log-line ${item.color}`;
          line.textContent = item.text;
          terminalLogs.appendChild(line);
          terminalLogs.scrollTop = terminalLogs.scrollHeight;
        }
        if (progressBar) progressBar.style.width = `${item.pct}%`;
        if (progressPct) progressPct.textContent = `${item.pct}%`;
        if (progressPhase) progressPhase.textContent = item.text.replace(/\[.*?\] /, "");
        playCyberBeep(850 + logIdx * 100, 0.04);
        logIdx++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });

  try {
    const data = await uploadPromise;

    if (!data.success) {
      showToast(data.error || "Failed to parse CSV dataset", "error");
      if (headerStatus) headerStatus.innerHTML = `<span class="text-danger">Analysis Failed: ${data.error || 'Error'}</span>`;
      if (terminalLogs) {
        const errLine = document.createElement("div");
        errLine.className = "log-line text-danger";
        errLine.textContent = `[FAILED] ${data.error || 'Unknown CSV Parsing error'}`;
        terminalLogs.appendChild(errLine);
      }
      if (progressPhase) progressPhase.textContent = "Upload / Parsing Error";
      return;
    }

    // Refresh background state and tables
    await refreshDashboardData();
    await loadTransactions();

    const tel = data.telemetry || {};

    // Transition to Stage 2: Sales Data Analysis Metrics
    setTimeout(() => {
      playCyberSuccess();
      if (stageDecoding) stageDecoding.style.display = "none";
      if (stageTelemetry) stageTelemetry.style.display = "flex";
      if (headerStatus) {
        headerStatus.innerHTML = `<span class="scifi-dot-pulsing"></span> Status: Analysis Complete (${(tel.total_records || 0).toLocaleString()} transactions)`;
      }

      // 1. Total Transactions
      const recEl = document.getElementById("hud-total-records");
      animateNumber(recEl, 0, tel.total_records || 0, 1000, (v) => Math.floor(v).toLocaleString());

      // 2. Data Quality Score
      const purEl = document.getElementById("hud-purity-score");
      animateNumber(purEl, 80, tel.purity_score || 99.8, 1000, (v) => `${v.toFixed(1)}%`);

      // 3. Total Revenue
      const revEl = document.getElementById("hud-total-revenue");
      animateNumber(revEl, 0, tel.total_revenue || 0, 1200, (v) => money(v));

      // 4. Avg Order Value
      const aovEl = document.getElementById("hud-aov");
      if (aovEl) aovEl.textContent = money(tel.avg_order_value || 0);

      // 5. Date Range & Median
      const rangeEl = document.getElementById("hud-date-range");
      const medEl = document.getElementById("hud-median-date");
      if (rangeEl) rangeEl.textContent = (tel.date_range && tel.date_range.join(" → ")) || "Full Horizon";
      if (medEl) medEl.textContent = tel.median_date || "Dynamic";

      // 6. Top Selling Product
      const prodEl = document.getElementById("hud-top-product");
      const prodMeta = document.getElementById("hud-top-prod-meta");
      if (prodEl && tel.top_product) prodEl.textContent = tel.top_product.name || "N/A";
      if (prodMeta && tel.top_product) prodMeta.textContent = `${money(tel.top_product.revenue)} · ${tel.top_product.share_pct}% Share`;

      // 7. Top Sales Region
      const regEl = document.getElementById("hud-top-region");
      const regMeta = document.getElementById("hud-top-reg-meta");
      if (regEl && tel.top_region) regEl.textContent = tel.top_region.name || "N/A";
      if (regMeta && tel.top_region) regMeta.textContent = `${money(tel.top_region.revenue)} · ${tel.top_region.share_pct}% Share`;

      // 8. Peak Sales Hour & Day
      const hourEl = document.getElementById("hud-peak-hour");
      const hourMeta = document.getElementById("hud-peak-hour-meta");
      if (hourEl && tel.peak_hour) hourEl.textContent = `${tel.peak_hour.hour}:00 Hours`;
      if (hourMeta && tel.peak_hour) hourMeta.textContent = `Peak Revenue: ${money(tel.peak_hour.revenue)}`;

      const dayEl = document.getElementById("hud-peak-day");
      const dayMeta = document.getElementById("hud-peak-day-meta");
      if (dayEl && tel.peak_weekday) dayEl.textContent = tel.peak_weekday.day || "Tuesday";
      if (dayMeta && tel.peak_weekday) dayMeta.textContent = `Top Day: ${money(tel.peak_weekday.revenue)}`;

      // 9. Key Sales Insights Stream
      const insightsContainer = document.getElementById("hud-ai-insights");
      if (insightsContainer && tel.ai_insights) {
        insightsContainer.innerHTML = "";
        tel.ai_insights.forEach((insight, idx) => {
          setTimeout(() => {
            const line = document.createElement("div");
            line.className = "ai-insight-line";
            line.innerHTML = `<i class="ri-check-double-line ai-bullet-icon"></i><span>${insight}</span>`;
            insightsContainer.appendChild(line);
            playCyberBeep(1100 + idx * 70, 0.03);
          }, idx * 140);
        });
      }

    }, 200);

  } catch (err) {
    console.error("Upload execution failed:", err);
    showToast("Error processing CSV upload: " + err.message, "error");
  }
}

async function generateBenchmark(rows) {
  showToast(`Generating ${rows} benchmark records...`, "info");
  try {
    const res = await fetch("/api/generate-sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, "success");
      await refreshDashboardData();
      await loadTransactions();
    }
  } catch (err) {
    showToast("Failed to generate benchmark", "error");
  }
}

function confirmResetDataset() {
  document.getElementById("confirm-title").textContent = "Reset Dataset to Default";
  document.getElementById("confirm-message").innerHTML = `This will regenerate the default synthetic retail sales benchmark and reset all modifications. Continue?`;
  
  const okBtn = document.getElementById("confirm-ok-btn");
  okBtn.onclick = async () => {
    closeModal("modal-confirm");
    try {
      const res = await fetch("/api/reset-data", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        await refreshDashboardData();
        await loadTransactions();
      }
    } catch (err) {
      showToast("Error resetting dataset", "error");
    }
  };

  openModal("modal-confirm");
}

// ================= MODAL & TOAST HELPERS =================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("show");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("show");
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach((m) => m.classList.remove("show"));
  closeSciFiHUD();
}

function toggleDropdown(id) {
  const menu = document.getElementById(id);
  if (menu) menu.classList.toggle("show");
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ri-information-line";
  if (type === "success") icon = "ri-checkbox-circle-line";
  if (type === "error") icon = "ri-error-warning-line";

  toast.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

async function showHUDTelemetryManual() {
  openSciFiHUD();
  const stageDecoding = document.getElementById("scifi-stage-decoding");
  const stageTelemetry = document.getElementById("scifi-stage-telemetry");
  const headerStatus = document.getElementById("scifi-header-status");

  if (stageDecoding) stageDecoding.style.display = "none";
  if (stageTelemetry) stageTelemetry.style.display = "flex";

  try {
    const res = await fetch("/api/telemetry");
    const tel = await res.json();

    if (headerStatus) {
      headerStatus.innerHTML = `<span class="scifi-dot-pulsing"></span> Status: Analysis Complete (${(tel.total_records || 0).toLocaleString()} transactions)`;
    }

    playCyberSuccess();

    // 1. Total Transactions
    const recEl = document.getElementById("hud-total-records");
    animateNumber(recEl, 0, tel.total_records || 0, 1000, (v) => Math.floor(v).toLocaleString());

    // 2. Data Quality Score
    const purEl = document.getElementById("hud-purity-score");
    animateNumber(purEl, 80, tel.purity_score || 99.8, 1000, (v) => `${v.toFixed(1)}%`);

    // 3. Total Revenue
    const revEl = document.getElementById("hud-total-revenue");
    animateNumber(revEl, 0, tel.total_revenue || 0, 1200, (v) => money(v));

    // 4. Avg Order Value
    const aovEl = document.getElementById("hud-aov");
    if (aovEl) aovEl.textContent = money(tel.avg_order_value || 0);

    // 5. Date Range & Median
    const rangeEl = document.getElementById("hud-date-range");
    const medEl = document.getElementById("hud-median-date");
    if (rangeEl) rangeEl.textContent = (tel.date_range && tel.date_range.join(" → ")) || "Full Horizon";
    if (medEl) medEl.textContent = tel.median_date || "Dynamic";

    // 6. Top Selling Product
    const prodEl = document.getElementById("hud-top-product");
    const prodMeta = document.getElementById("hud-top-prod-meta");
    if (prodEl && tel.top_product) prodEl.textContent = tel.top_product.name || "N/A";
    if (prodMeta && tel.top_product) prodMeta.textContent = `${money(tel.top_product.revenue)} · ${tel.top_product.share_pct}% Share`;

    // 7. Top Sales Region
    const regEl = document.getElementById("hud-top-region");
    const regMeta = document.getElementById("hud-top-reg-meta");
    if (regEl && tel.top_region) regEl.textContent = tel.top_region.name || "N/A";
    if (regMeta && tel.top_region) regMeta.textContent = `${money(tel.top_region.revenue)} · ${tel.top_region.share_pct}% Share`;

    // 8. Peak Sales Hour & Day
    const hourEl = document.getElementById("hud-peak-hour");
    const hourMeta = document.getElementById("hud-peak-hour-meta");
    if (hourEl && tel.peak_hour) hourEl.textContent = `${tel.peak_hour.hour}:00 Hours`;
    if (hourMeta && tel.peak_hour) hourMeta.textContent = `Peak Revenue: ${money(tel.peak_hour.revenue)}`;

    const dayEl = document.getElementById("hud-peak-day");
    const dayMeta = document.getElementById("hud-peak-day-meta");
    if (dayEl && tel.peak_weekday) dayEl.textContent = tel.peak_weekday.day || "Tuesday";
    if (dayMeta && tel.peak_weekday) dayMeta.textContent = `Top Day: ${money(tel.peak_weekday.revenue)}`;

    // 9. Key Sales Insights Stream
    const insightsContainer = document.getElementById("hud-ai-insights");
    if (insightsContainer && tel.ai_insights) {
      insightsContainer.innerHTML = "";
      tel.ai_insights.forEach((insight, idx) => {
        setTimeout(() => {
          const line = document.createElement("div");
          line.className = "ai-insight-line";
          line.innerHTML = `<i class="ri-check-double-line ai-bullet-icon"></i><span>${insight}</span>`;
          insightsContainer.appendChild(line);
          playCyberBeep(1100 + idx * 70, 0.03);
        }, idx * 140);
      });
    }

  } catch (err) {
    console.error("Failed to load telemetry:", err);
  }
}

// Expose functions globally to window for onclick handlers
window.switchTab = switchTab;
window.toggleTheme = toggleTheme;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.removeFilter = removeFilter;
window.debounceFilter = debounceFilter;
window.clearSearch = clearSearch;
window.loadTopProducts = loadTopProducts;
window.loadTransactions = loadTransactions;
window.goToPage = goToPage;
window.changePageSize = changePageSize;
window.handleTableSearch = handleTableSearch;
window.sortTable = sortTable;
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.handleCategoryChange = handleCategoryChange;
window.handleProductSelect = handleProductSelect;
window.calculateFormRevenue = calculateFormRevenue;
window.handleTransactionSubmit = handleTransactionSubmit;
window.confirmDeleteOrder = confirmDeleteOrder;
window.confirmDeleteAllOrders = confirmDeleteAllOrders;
window.openUploadModal = openUploadModal;
window.uploadModalFile = uploadModalFile;
window.handleFileSelected = handleFileSelected;
window.generateBenchmark = generateBenchmark;
window.confirmResetDataset = confirmResetDataset;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleDropdown = toggleDropdown;
window.openSciFiHUD = openSciFiHUD;
window.closeSciFiHUD = closeSciFiHUD;
window.toggleSciFiSound = toggleSciFiSound;
window.exportCleanedCSV = exportCleanedCSV;
window.launchCockpit = launchCockpit;
window.showHUDTelemetryManual = showHUDTelemetryManual;
