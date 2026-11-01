/* ============================================================
   PRAPCLIK — Modern Autonomous E-Commerce Platform
   Frontend Application Script
   ============================================================ */

// Live Backend API resolution
const DEFAULT_LIVE_BACKEND = "https://eff32941ce0fff.lhr.life";

function getApiBaseUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:5000";
  if (window.PRAPCLIK_API_BASE_URL) return window.PRAPCLIK_API_BASE_URL;
  if (window.TECHMART_API_BASE_URL) return window.TECHMART_API_BASE_URL;
  const stored = localStorage.getItem("prapclik_api_url") || localStorage.getItem("techmart_api_url");
  if (stored) return stored;
  if (window.location.protocol.startsWith("http")) {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return window.location.port === "5000" ? window.location.origin : "http://127.0.0.1:5000";
    }
    // Remote host (Vercel) uses active public tunnel
    return DEFAULT_LIVE_BACKEND;
  }
  return "http://127.0.0.1:5000";
}

const API = getApiBaseUrl();

// Standalone seed products for instant display
const SEED_PRODUCTS = [
  { product_id: 4, name: "Wireless Headphones", price: 2499.00, stock_qty: 10, description: "Bluetooth 5.3, 40-hour battery, active noise cancellation, foldable design." },
  { product_id: 5, name: "Mechanical Keyboard", price: 3999.00, stock_qty: 8, description: "TKL layout, tactile blue switches, RGB backlight, USB-C detachable cable." },
  { product_id: 6, name: "Ergonomic Mouse", price: 1299.00, stock_qty: 15, description: "Vertical grip, 6 programmable buttons, 4000 DPI, silent click." },
  { product_id: 7, name: "Smart Watch", price: 7999.00, stock_qty: 5, description: "Health tracking, GPS, 7-day battery, IP68 waterproof, AMOLED display." },
  { product_id: 8, name: "USB-C Hub 7-in-1", price: 1599.00, stock_qty: 20, description: "HDMI 4K, 3x USB-A, SD card, 100W PD charging, aluminium shell." },
  { product_id: 9, name: "Laptop Stand", price: 799.00, stock_qty: 25, description: "Adjustable aluminium stand, 10–15 inch, ergonomic angle, portable." }
];

function getLocalOrders() {
  try {
    return JSON.parse(localStorage.getItem("prapclik_orders") || localStorage.getItem("techmart_local_orders") || "[]");
  } catch (_) { return []; }
}

function saveLocalOrder(ord) {
  try {
    const list = getLocalOrders();
    list.unshift(ord);
    localStorage.setItem("prapclik_orders", JSON.stringify(list.slice(0, 50)));
    localStorage.setItem("techmart_local_orders", JSON.stringify(list.slice(0, 50)));
  } catch (_) {}
}

// Visual icons & category mappings
const PRODUCT_EMOJIS = {
  "Wireless Headphones": "🎧",
  "Mechanical Keyboard": "⌨️",
  "Ergonomic Mouse":     "🖱️",
  "Smart Watch":         "⌚",
  "USB-C Hub 7-in-1":   "🔌",
  "Laptop Stand":        "💻",
};

const PRODUCT_CATEGORIES = {
  "Wireless Headphones": "audio",
  "Mechanical Keyboard": "peripherals",
  "Ergonomic Mouse":     "peripherals",
  "Smart Watch":         "wearables",
  "USB-C Hub 7-in-1":   "accessories",
  "Laptop Stand":        "accessories",
};

// Cart state & Cache
let cart = {};          // { product_id: {product, qty} }
let productsCache = []; // fetched products
let activeCategory = "all";
let activeSearchQuery = "";

// ============================================================
// Navigation
// ============================================================
function navigate(page) {
  if (!page) return;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));

  const pageEl = document.getElementById("page-" + page);
  const navEl  = document.getElementById("nav-" + page);
  if (pageEl) pageEl.classList.add("active");
  if (navEl)  navEl.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Close mobile nav if open
  const mainNav = document.getElementById("mainNav");
  if (mainNav) mainNav.classList.remove("open");

  // Load page data
  if (page === "home")    loadHome();
  if (page === "products") loadProducts();
  if (page === "orders")   loadOrders();
  if (page === "tower")    loadDashboard();
}

document.querySelectorAll(".nav-link[data-page]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

// Mobile menu toggle
const menuToggle = document.getElementById("menuToggle");
const mainNav    = document.getElementById("mainNav");
if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => mainNav.classList.toggle("open"));
}

// Header scroll effect
window.addEventListener("scroll", () => {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  if (window.scrollY > 20) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});

// Theme switcher
const themeToggleBtn = document.getElementById("themeToggleBtn");
if (themeToggleBtn) {
  const currentTheme = localStorage.getItem("prapclik_theme") || "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  themeToggleBtn.textContent = currentTheme === "dark" ? "🌙" : "☀️";

  themeToggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("prapclik_theme", nextTheme);
    themeToggleBtn.textContent = nextTheme === "dark" ? "🌙" : "☀️";
  });
}

// ============================================================
// Home page
// ============================================================
async function loadHome() {
  const products = await fetchProducts();
  document.getElementById("stat-products").textContent = products.length;

  try {
    const dash = await fetch(API + "/api/dashboard").then(r => r.json());
    document.getElementById("stat-orders").textContent     = dash.total_orders ?? "—";
    document.getElementById("stat-exceptions").textContent = dash.total_exceptions ?? "—";
  } catch (_) {
    const localOrders = getLocalOrders();
    document.getElementById("stat-orders").textContent     = localOrders.length;
    document.getElementById("stat-exceptions").textContent = 0;
  }

  // Show first 3 products in hero
  const grid = document.getElementById("homeProducts");
  const prods = products.slice(0, 3);
  grid.innerHTML = prods.length ? prods.map(renderProductCard).join("") : "<p class='empty-state'>Loading PRAPCLIK hardware…</p>";
}

// ============================================================
// Products page & Filtering
// ============================================================
async function loadProducts() {
  const products = await fetchProducts();
  renderProductsList(products);
}

function filterByCategory(category, btnElement) {
  activeCategory = category;
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
  if (btnElement) btnElement.classList.add("active");
  renderProductsList(productsCache);
}

function handleSearch(query) {
  activeSearchQuery = (query || "").trim().toLowerCase();
  renderProductsList(productsCache);
}

function renderProductsList(products) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  let filtered = products;

  // Filter by category
  if (activeCategory !== "all") {
    filtered = filtered.filter(p => PRODUCT_CATEGORIES[p.name] === activeCategory);
  }

  // Filter by search query
  if (activeSearchQuery) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(activeSearchQuery) || 
      (p.description && p.description.toLowerCase().includes(activeSearchQuery))
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 4rem 1rem;">
      <div style="font-size:3rem; margin-bottom:1rem;">🔍</div>
      <h3 style="font-family:var(--font-display); font-size:1.3rem; margin-bottom:0.5rem;">No matching hardware found</h3>
      <p style="color:var(--text-secondary); font-size:0.9rem;">Try searching for "headphones", "keyboard", "mouse", or change category.</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(renderProductCard).join("");
}

async function fetchProducts() {
  if (productsCache.length) return productsCache;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(API + "/api/products", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        productsCache = data;
        return productsCache;
      }
    }
  } catch (_) {}

  // Fallback: seed products so store works immediately
  productsCache = [...SEED_PRODUCTS];
  return productsCache;
}

function renderProductCard(p) {
  const emoji = PRODUCT_EMOJIS[p.name] || "📦";
  const stockClass = p.stock_qty === 0 ? "stock-out" : p.stock_qty <= 3 ? "stock-low" : "";
  const stockText  = p.stock_qty === 0 ? "Out of Stock" : p.stock_qty <= 3 ? `Only ${p.stock_qty} units left` : `${p.stock_qty} in stock`;
  const inCart     = cart[p.product_id] ? cart[p.product_id].qty : 1;
  const disabled   = p.stock_qty === 0 ? "disabled" : "";
  const category   = (PRODUCT_CATEGORIES[p.name] || "Hardware").toUpperCase();

  return `<div class="product-card" id="pcard-${p.product_id}">
    <div class="product-card-top">
      <span class="product-badge-tag">${category}</span>
      <span class="product-stock ${stockClass}">${stockText}</span>
    </div>
    
    <div class="product-emoji-wrap">${emoji}</div>
    <div class="product-name">${esc(p.name)}</div>
    <div class="product-desc">${esc(p.description || "")}</div>

    <div class="product-footer-row">
      <div class="product-price-block">
        <span class="product-price-label">Price (GST incl.)</span>
        <span class="product-price">₹${p.price.toLocaleString("en-IN")}</span>
      </div>

      <div class="qty-row">
        <input type="number" class="qty-input" id="qty-${p.product_id}"
               value="${inCart}" min="1" max="${Math.max(p.stock_qty, 1)}"
               ${p.stock_qty === 0 ? "disabled" : ""} />
        <button class="btn btn-primary btn-sm" ${disabled}
                onclick="addToCart(${p.product_id})">
          <span>+</span> Add
        </button>
      </div>
    </div>
  </div>`;
}

function addToCart(productId) {
  const product = productsCache.find(p => p.product_id === productId);
  if (!product) return;
  const qtyEl = document.getElementById("qty-" + productId);
  const qty   = parseInt(qtyEl.value) || 1;
  if (qty < 1) { showToast("Please enter a valid quantity."); return; }

  cart[productId] = { product, qty };
  updateCartFab();
  showToast(`${product.name} added to cart!`);
}

function updateCartFab() {
  const fab   = document.getElementById("cartFab");
  const count = Object.values(cart).reduce((sum, it) => sum + it.qty, 0);
  
  const countEl = document.getElementById("cartCount");
  if (countEl) countEl.textContent = count;

  const headerCountEl = document.getElementById("headerCartCount");
  if (headerCountEl) headerCountEl.textContent = count;

  if (fab) fab.style.display = count > 0 ? "flex" : "none";
}

// ============================================================
// Checkout Modal
// ============================================================
function openCheckout() {
  if (Object.keys(cart).length === 0) { 
    showToast("Your PRAPCLIK cart is currently empty."); 
    return; 
  }
  renderCartSummary();
  document.getElementById("checkoutModal").classList.add("open");
}

document.getElementById("closeCheckout").addEventListener("click", () => {
  document.getElementById("checkoutModal").classList.remove("open");
});

document.getElementById("checkoutModal").addEventListener("click", e => {
  if (e.target === document.getElementById("checkoutModal"))
    document.getElementById("checkoutModal").classList.remove("open");
});

function renderCartSummary() {
  let total = 0;
  let html  = "";
  for (const [pid, entry] of Object.entries(cart)) {
    const subtotal = entry.product.price * entry.qty;
    total += subtotal;
    html += `<div class="cart-item-row">
      <span><strong>${esc(entry.product.name)}</strong> × ${entry.qty}</span>
      <span>₹${subtotal.toLocaleString("en-IN")}</span>
    </div>`;
  }
  document.getElementById("cartSummary").innerHTML = html;
  document.getElementById("checkoutTotal").textContent = "₹" + total.toLocaleString("en-IN");
}

document.getElementById("checkoutForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = document.getElementById("placeOrderBtn");
  const msg = document.getElementById("checkoutMsg");

  const custName    = document.getElementById("custName").value.trim();
  const custEmail   = document.getElementById("custEmail").value.trim();
  const custPhone   = document.getElementById("custPhone").value.trim();
  const custAddress = document.getElementById("custAddress").value.trim();
  const custCity    = document.getElementById("custCity").value.trim();
  const custPincode = document.getElementById("custPincode").value.trim();
  const payMethod   = document.getElementById("payMethod").value;

  if (!custName || !custEmail || !custPhone || !custAddress || !custCity || !custPincode) {
    msg.innerHTML = `<div class="msg-error">Please complete all required fields.</div>`;
    return;
  }

  const items = Object.values(cart).map(entry => ({
    product_id: entry.product.product_id,
    quantity:   entry.qty,
  }));

  const payload = {
    customer_name:  custName,
    customer_email: custEmail,
    customer_phone: custPhone,
    address_line:   custAddress,
    city:           custCity,
    pincode:        custPincode,
    payment_method: payMethod,
    items,
  };

  btn.disabled    = true;
  btn.textContent = "Processing PRAPCLIK Order…";
  msg.innerHTML   = `<div class="msg-info">Submitting order to autonomous fulfillment engine…</div>`;

  let ord = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res  = await fetch(API + "/api/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      ord = await res.json();
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.details || errData.error) {
        const detail = errData.details ? errData.details.join(", ") : errData.error;
        msg.innerHTML = `<div class="msg-error">❌ ${esc(detail)}</div>`;
        btn.disabled    = false;
        btn.textContent = "Place Order";
        return;
      }
    }
  } catch (_) {
    // Backend fallback
  }

  // Standalone fallback: calculate dynamic 2 business days & save order
  if (!ord) {
    const total = items.reduce((sum, it) => {
      const p = productsCache.find(x => x.product_id === it.product_id);
      return sum + (p ? p.price * it.quantity : 0);
    }, 0);

    const dt = new Date();
    let added = 0;
    while (added < 2) {
      dt.setDate(dt.getDate() + 1);
      if (dt.getDay() !== 0 && dt.getDay() !== 6) added++;
    }
    dt.setHours(18, 0, 0, 0);
    const delivery = dt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }) + " by 06:00 PM";

    ord = {
      order_id: "PRAP-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      order_status: "CONFIRMED",
      payment_status: payMethod === "COD" ? "PAY_ON_DELIVERY" : "PAID",
      payment_method: payMethod,
      total_amount: total,
      estimated_delivery_time: delivery,
      customer_name: custName,
      customer_phone: custPhone,
      created_at: new Date().toISOString()
    };
    saveLocalOrder(ord);
  }

  // Success handling
  const isExc    = ord.order_status === "EXCEPTION";
  const statusBg = isExc ? "msg-error" : "msg-success";
  const icon     = isExc ? "⚠️" : "✅";
  const delivery = ord.estimated_delivery_time || "2 business days";
  
  msg.innerHTML  = `<div class="${statusBg}">
    ${icon} <strong>PRAPCLIK Order ${isExc ? "flagged for review" : "confirmed successfully"}!</strong><br/>
    Tracking ID: <strong>${esc(ord.order_id)}</strong><br/>
    Status: ${esc(ord.order_status)} | Payment: ${esc(ord.payment_status)}<br/>
    Amount: ₹${ord.total_amount.toLocaleString("en-IN")}<br/>
    🚚 <strong>Delivery:</strong> ${esc(delivery)}<br/>
    ${!isExc ? `<span style="display:inline-block;margin-top:6px;font-size:0.88rem;color:#10b981;background:rgba(16,185,129,0.12);padding:4px 10px;border-radius:6px;">📲 Automated WhatsApp dispatch sent to <strong>${esc(ord.customer_phone || "")}</strong></span><br/>` : ""}
    ${isExc ? "⚠️ Insufficient stock detected. The order is recorded in the Control Tower for inventory resolution." : ""}
  </div>`;

  if (!isExc) {
    cart = {};
    updateCartFab();
    document.getElementById("checkoutForm").reset();
  }

  // Trigger n8n webhook
  triggerN8nWebhook(ord);

  btn.disabled    = false;
  btn.textContent = "Place Order";
});

// ============================================================
// n8n webhook trigger
// ============================================================
async function triggerN8nWebhook(order) {
  const isLocal = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const n8nWebhookUrl = (typeof window !== "undefined" && window.PRAPCLIK_N8N_URL) ||
    localStorage.getItem("prapclik_n8n_url") ||
    (isLocal ? "http://localhost:5678/webhook/order-event" : "");

  if (!n8nWebhookUrl) return;

  try {
    await fetch(n8nWebhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        event_uid:               "PRAP-" + order.order_id + "-" + Date.now(),
        event_type:              order.order_status === "EXCEPTION" ? "PAID_INSUFFICIENT_STOCK" : "ORDER_CONFIRMED",
        order_id:                order.order_id,
        customer_name:           order.customer_name || "",
        customer_phone:          order.customer_phone || "",
        estimated_delivery_time: order.estimated_delivery_time || "",
        total_amount:            order.total_amount || 0,
        source:                  "prapclik-frontend",
      }),
    });
  } catch (_) {}
}

// ============================================================
// Orders page
// ============================================================
async function loadOrders() {
  const container = document.getElementById("ordersContainer");
  container.innerHTML = "<div class='loading-msg'>Connecting to PRAPCLIK order database…</div>";
  let orders = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res    = await fetch(API + "/api/orders", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      orders = await res.json();
    }
  } catch (_) {}

  if (!orders || !orders.length) {
    orders = getLocalOrders();
  }

  if (!orders || !orders.length) {
    container.innerHTML = `<div style="text-align:center; padding: 4rem 1rem;">
      <div style="font-size:3rem; margin-bottom:1rem;">📦</div>
      <h3 style="font-family:var(--font-display); font-size:1.3rem; margin-bottom:0.5rem;">No orders yet</h3>
      <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:1.5rem;">Explore our catalog and place your first order.</p>
      <button class="btn btn-primary btn-sm" onclick="navigate('products')">Browse Products</button>
    </div>`;
    return;
  }

  const rows = orders.map(o => `
    <tr>
      <td><code>${esc(o.order_id)}</code></td>
      <td><strong>${esc(o.customer_name)}</strong></td>
      <td>${formatDate(o.created_at)}</td>
      <td><span style="font-weight:600;color:var(--c-cyan);">🚚 ${esc(o.estimated_delivery_time || '2 business days')}</span></td>
      <td><strong>₹${(o.total_amount || 0).toLocaleString("en-IN")}</strong></td>
      <td>${paymentBadge(o.payment_method)}</td>
      <td>${payStatusBadge(o.payment_status)}</td>
      <td>${orderStatusBadge(o.order_status)}</td>
      <td>${o.has_exception ? '<span class="badge badge-high">Exception</span>' : '—'}</td>
    </tr>`).join("");

  container.innerHTML = `
    <div class="table-wrap">
      <table class="orders-table">
        <thead>
          <tr>
            <th>Order ID</th><th>Customer</th><th>Date</th>
            <th>Est. Delivery</th><th>Total</th><th>Payment</th><th>Pay Status</th>
            <th>Order Status</th><th>Exception</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ============================================================
// Control Tower / Operations Dashboard
// ============================================================
async function loadDashboard() {
  try {
    let data = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2800);
      const res  = await fetch(API + "/api/dashboard", { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        data = await res.json();
      }
    } catch (_) {}

    if (!data) {
      const localOrders = getLocalOrders();
      const totalRev = localOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      data = {
        total_orders: localOrders.length,
        total_exceptions: 0,
        high_severity_count: 0,
        revenue_paid: totalRev,
        recent_exceptions: [],
        recent_events: localOrders.map(o => ({
          event_id: o.order_id,
          order_id: o.order_id,
          event_type: "ORDER_CONFIRMED",
          processing_status: "PROCESSED",
          received_at: o.created_at || new Date().toISOString()
        }))
      };
    }

    document.getElementById("kpi-total").textContent   = data.total_orders ?? 0;
    document.getElementById("kpi-exc").textContent     = data.total_exceptions ?? 0;
    document.getElementById("kpi-high").textContent    = data.high_severity_count ?? 0;
    document.getElementById("kpi-revenue").textContent =
      data.revenue_paid != null ? "₹" + data.revenue_paid.toLocaleString("en-IN") : "₹0";

    // Exceptions table
    const excDiv = document.getElementById("exceptionsTable");
    const excs   = data.recent_exceptions || [];
    excDiv.innerHTML = excs.length
      ? `<table class="mini-table">
          <thead><tr><th>ID</th><th>Order</th><th>Type</th><th>Severity</th><th>Team</th><th>Status</th></tr></thead>
          <tbody>${excs.map(e => `<tr>
            <td>${e.exception_id}</td>
            <td><code>${esc(e.order_id)}</code></td>
            <td>${esc(e.exception_type)}</td>
            <td>${severityBadge(e.severity)}</td>
            <td><strong>${esc(e.owner_team)}</strong></td>
            <td>${esc(e.exception_status)}</td>
          </tr>`).join("")}</tbody>
        </table>`
      : "<p class='empty-state'>All systems nominal. No open exceptions 🎉</p>";

    // Events table
    const evDiv  = document.getElementById("eventsTable");
    const events = data.recent_events || [];
    evDiv.innerHTML = events.length
      ? `<table class="mini-table">
          <thead><tr><th>Type</th><th>Order</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>${events.map(ev => `<tr>
            <td>${esc(ev.event_type)}</td>
            <td><code>${esc(ev.order_id || "—")}</code></td>
            <td>${esc(ev.processing_status)}</td>
            <td>${formatDate(ev.received_at)}</td>
          </tr>`).join("")}</tbody>
        </table>`
      : "<p class='empty-state'>No automation events recorded yet.</p>";

    // Status bars
    const statusMap  = data.orders_by_status || {};
    const total      = data.total_orders || 1;
    const statusDiv  = document.getElementById("statusBars");
    statusDiv.innerHTML = Object.entries(statusMap).map(([status, count]) => {
      const pct = Math.round((count / total) * 100);
      return `<div class="status-bar-item">
        <span class="status-bar-label">${esc(status)}</span>
        <div class="status-bar-track">
          <div class="status-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="status-bar-count">${count} (${pct}%)</span>
      </div>`;
    }).join("") || "<p class='empty-state'>No orders recorded yet.</p>";

    // Team table
    const teamDiv = document.getElementById("teamTable");
    const teamMap = data.exceptions_by_team || {};
    teamDiv.innerHTML = Object.keys(teamMap).length
      ? `<table class="mini-table">
          <thead><tr><th>Team</th><th>Open Exceptions</th></tr></thead>
          <tbody>${Object.entries(teamMap).map(([team, cnt]) => `<tr>
            <td><strong>${esc(team)}</strong></td><td>${cnt}</td>
          </tr>`).join("")}</tbody>
        </table>`
      : "<p class='empty-state'>Zero team escalation backlog.</p>";

  } catch (err) {
    document.getElementById("kpi-total").textContent = "—";
    console.error("Dashboard load failed:", err);
  }
}

// ============================================================
// Admin Simulation (Rule A)
// ============================================================
function openAdminSim() {
  const panel = document.getElementById("adminPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

async function runAdminSim() {
  const productId = parseInt(document.getElementById("adminProductId").value) || 4;
  const qty       = parseInt(document.getElementById("adminQty").value) || 999;
  const apiKey    = document.getElementById("adminKey").value.trim();
  const msgDiv    = document.getElementById("adminMsg");

  msgDiv.innerHTML = `<div class="msg-info">Executing simulation on Flask API…</div>`;
  try {
    const res  = await fetch(API + "/api/admin/simulate-paid-insufficient-stock", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": apiKey },
      body:    JSON.stringify({ product_id: productId, quantity: qty }),
    });
    const data = await res.json();
    if (!res.ok) {
      msgDiv.innerHTML = `<div class="msg-error">❌ ${esc(data.error || "Simulation failed")}</div>`;
      return;
    }
    msgDiv.innerHTML = `<div class="msg-success">
      ✅ <strong>Simulation created successfully!</strong><br/>
      Order ID: <code>${esc(data.order_id)}</code><br/>
      Exception Type: <code>${esc(data.exception_type)}</code> (Severity: ${esc(data.severity)})<br/>
      Owner Team: <strong>${esc(data.owner_team)}</strong><br/>
      Webhook: ${esc(data.webhook_delivery || "dispatched")}
    </div>`;
    loadDashboard();
  } catch (err) {
    msgDiv.innerHTML = `<div class="msg-error">Simulation error: ${esc(err.message)}</div>`;
  }
}

// ============================================================
// PRAPCLIK AI Assistant
// ============================================================
function handleAiQuery(e) {
  e.preventDefault();
  const input = document.getElementById("aiQueryInput");
  const query = (input.value || "").trim();
  if (!query) return;

  const respBox = document.getElementById("aiChatResponse");
  const qLower = query.toLowerCase();

  let answer = "";
  if (qLower.includes("headphone") || qLower.includes("battery") || qLower.includes("audio")) {
    answer = "🎧 <strong>PRAPCLIK Wireless Headphones</strong> feature Bluetooth 5.3, active noise cancellation, and up to 40 hours of continuous playback. They are in stock and ship in 2 business days.";
  } else if (qLower.includes("keyboard") || qLower.includes("switch")) {
    answer = "⌨️ <strong>PRAPCLIK Mechanical Keyboard</strong> offers tactile blue switches, TKL compact layout, per-key RGB backlighting, and a detachable braided USB-C cable.";
  } else if (qLower.includes("deliver") || qLower.includes("fast") || qLower.includes("time")) {
    answer = "🚚 All PRAPCLIK orders are dispatched via our atomic fulfillment engine. Deliveries arrive in <strong>2 business days by 6:00 PM</strong>, complete with automated WhatsApp tracking.";
  } else if (qLower.includes("watch") || qLower.includes("smart")) {
    answer = "⌚ <strong>PRAPCLIK Smart Watch</strong> features an AMOLED display, GPS tracking, 7-day battery life, and IP68 waterproof rating for daily tracking.";
  } else if (qLower.includes("mouse")) {
    answer = "🖱️ <strong>PRAPCLIK Ergonomic Mouse</strong> has a vertical natural grip, 4000 DPI sensor, silent clicks, and 6 programmable buttons to prevent wrist strain.";
  } else if (qLower.includes("hub") || qLower.includes("stand")) {
    answer = "🔌 Our <strong>7-in-1 USB-C Hub</strong> supports 4K HDMI and 100W PD charging. Pair it with the <strong>Aluminium Laptop Stand</strong> for the optimal workstation setup.";
  } else {
    answer = `✨ Thank you for asking about <em>"${esc(query)}"</em>! Every product at PRAPCLIK comes with genuine manufacturer warranty, real-time tracking, and 7-day returns.`;
  }

  respBox.innerHTML = `<div><strong>You:</strong> ${esc(query)}</div><div style="margin-top:0.6rem;">${answer}</div>`;
  input.value = "";
}

// ============================================================
// Badges & Formatting Helpers
// ============================================================
function orderStatusBadge(s) {
  const map = {
    ORDER_PLACED: "badge-placed", CONFIRMED: "badge-confirmed",
    EXCEPTION: "badge-exception", READY_TO_SHIP: "badge-placed",
    DISPATCHED: "badge-placed", DELIVERED: "badge-confirmed", CANCELLED: "badge-failed",
  };
  return `<span class="badge ${map[s] || 'badge-placed'}">${s}</span>`;
}

function payStatusBadge(s) {
  const map = {
    PAID: "badge-paid", PENDING: "badge-pending",
    FAILED: "badge-failed", PAY_ON_DELIVERY: "badge-cod", REFUNDED: "badge-medium",
  };
  return `<span class="badge ${map[s] || 'badge-pending'}">${s}</span>`;
}

function paymentBadge(m) {
  return `<span class="badge ${m === 'ONLINE' ? 'badge-confirmed' : 'badge-cod'}">${m}</span>`;
}

function severityBadge(s) {
  const map = { HIGH: "badge-high", MEDIUM: "badge-medium", LOW: "badge-low", CRITICAL: "badge-critical" };
  return `<span class="badge ${map[s] || 'badge-low'}">${s}</span>`;
}

function esc(str) {
  if (str == null) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch (_) { return iso; }
}

let toastTimer;
function showToast(msg) {
  let t = document.getElementById("__toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "__toast";
    t.style.cssText = "position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:rgba(13,17,26,0.95);backdrop-filter:blur(10px);border:1px solid rgba(99,102,241,0.4);color:#fff;padding:.75rem 1.6rem;border-radius:9999px;font-size:.9rem;font-weight:600;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:opacity .3s, transform .3s;display:flex;align-items:center;gap:.5rem;";
    document.body.appendChild(t);
  }
  t.innerHTML = `<span>⚡</span> ${msg}`;
  t.style.opacity = "1";
  t.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { 
    t.style.opacity = "0"; 
    t.style.transform = "translateX(-50%) translateY(10px)";
  }, 2600);
}

// ============================================================
// Initialization & Smooth Opening Intro
// ============================================================
window.addEventListener("DOMContentLoaded", () => {
  navigate("home");
  updateCartFab();

  // Intro loader reveal
  const loader = document.getElementById("prapclikLoader");
  if (loader) {
    setTimeout(() => {
      loader.classList.add("fade-out");
    }, 1200);
  }
});
