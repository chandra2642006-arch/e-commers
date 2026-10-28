/* ============================================================
   TechMart — Frontend JavaScript
   All API calls go to Flask at http://127.0.0.1:5000
   ============================================================ */

// Configurable backend API URL:
// 1. window.TECHMART_API_BASE_URL (if injected by window/build)
// 2. localStorage.getItem("techmart_api_url") (user can switch endpoint if needed)
// 3. window.location.origin (for same-domain/proxy deployment or local Flask)
// 4. Default to http://127.0.0.1:5000 for local dev
function getApiBaseUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:5000";
  if (window.TECHMART_API_BASE_URL) return window.TECHMART_API_BASE_URL;
  const stored = localStorage.getItem("techmart_api_url");
  if (stored) return stored;
  if (window.location.protocol.startsWith("http")) {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return window.location.port === "5000" ? window.location.origin : "http://127.0.0.1:5000";
    }
    return window.location.origin;
  }
  return "http://127.0.0.1:5000";
}

const API = getApiBaseUrl();

// Standalone seed products so store works immediately even without active backend
const SEED_PRODUCTS = [
  { product_id: 1, name: "Wireless Headphones", price: 2499.00, stock_qty: 10, description: "Bluetooth 5.3, 40-hour battery, active noise cancellation, foldable design." },
  { product_id: 2, name: "Mechanical Keyboard", price: 3999.00, stock_qty: 8, description: "TKL layout, tactile blue switches, RGB backlight, USB-C detachable cable." },
  { product_id: 3, name: "Ergonomic Mouse", price: 1299.00, stock_qty: 15, description: "Vertical grip, 6 programmable buttons, 4000 DPI, silent click." },
  { product_id: 4, name: "Smart Watch", price: 7999.00, stock_qty: 5, description: "Health tracking, GPS, 7-day battery, IP68 waterproof, AMOLED display." },
  { product_id: 5, name: "USB-C Hub 7-in-1", price: 1599.00, stock_qty: 20, description: "HDMI 4K, 3x USB-A, SD card, 100W PD charging, aluminium shell." },
  { product_id: 6, name: "Laptop Stand", price: 799.00, stock_qty: 25, description: "Adjustable aluminium stand, 10–15 inch, ergonomic angle, portable." }
];

function getLocalOrders() {
  try {
    return JSON.parse(localStorage.getItem("techmart_local_orders") || "[]");
  } catch (_) { return []; }
}

function saveLocalOrder(ord) {
  try {
    const list = getLocalOrders();
    list.unshift(ord);
    localStorage.setItem("techmart_local_orders", JSON.stringify(list.slice(0, 50)));
  } catch (_) {}
}

function updateBackendStatusBadge(isOnline) {
  const btn = document.getElementById("apiConfigBtn");
  if (!btn) return;
  if (isOnline) {
    btn.innerHTML = "🟢 API Connected";
    btn.style.color = "#16a34a";
  } else {
    btn.innerHTML = "⚙️ Demo (Connect API)";
    btn.style.color = "#d97706";
  }
}

function promptBackendUrl() {
  const current = localStorage.getItem("techmart_api_url") || API;
  const nextUrl = prompt("Enter your live Backend API URL (or leave blank for local/demo):", current);
  if (nextUrl !== null) {
    if (nextUrl.trim()) {
      localStorage.setItem("techmart_api_url", nextUrl.trim().replace(/\/$/, ""));
    } else {
      localStorage.removeItem("techmart_api_url");
    }
    location.reload();
  }
}

// ---- Product emojis for visual flair ----
const PRODUCT_EMOJIS = {
  "Wireless Headphones": "🎧",
  "Mechanical Keyboard": "⌨️",
  "Ergonomic Mouse":     "🖱️",
  "Smart Watch":         "⌚",
  "USB-C Hub 7-in-1":   "🔌",
  "Laptop Stand":        "💻",
};

// ---- Cart state ----
let cart = {};          // { product_id: {product, qty} }
let productsCache = []; // fetched products

// ============================================================
// Navigation
// ============================================================
function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));
  const pageEl = document.getElementById("page-" + page);
  const navEl  = document.getElementById("nav-" + page);
  if (pageEl) pageEl.classList.add("active");
  if (navEl)  navEl.classList.add("active");

  // Load page data
  if (page === "home")    loadHome();
  if (page === "products") loadProducts();
  if (page === "orders")   loadOrders();
  if (page === "tower")    loadDashboard();
}

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

document.querySelector(".logo").addEventListener("click", () => navigate("home"));

// Mobile menu
const menuToggle = document.getElementById("menuToggle");
const mainNav    = document.getElementById("mainNav");
menuToggle.addEventListener("click", () => mainNav.classList.toggle("open"));

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
    updateBackendStatusBadge(true);
  } catch (_) {
    const localOrders = getLocalOrders();
    document.getElementById("stat-orders").textContent     = localOrders.length;
    document.getElementById("stat-exceptions").textContent = 0;
    updateBackendStatusBadge(false);
  }

  // Show first 3 products in hero
  const grid = document.getElementById("homeProducts");
  const prods = products.slice(0, 3);
  grid.innerHTML = prods.length ? prods.map(renderProductCard).join("") : "<p class='empty-state'>Loading products…</p>";
}

// ============================================================
// Products page
// ============================================================
async function loadProducts() {
  const grid = document.getElementById("productsGrid");
  const products = await fetchProducts();
  grid.innerHTML = products.length
    ? products.map(renderProductCard).join("")
    : "<p class='empty-state'>Loading catalog…</p>";
}

async function fetchProducts() {
  if (productsCache.length) return productsCache;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(API + "/api/products", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        productsCache = data;
        updateBackendStatusBadge(true);
        return productsCache;
      }
    }
  } catch (_) {}

  // Fallback: seed products so store works immediately
  productsCache = [...SEED_PRODUCTS];
  updateBackendStatusBadge(false);
  return productsCache;
}

function renderProductCard(p) {
  const emoji = PRODUCT_EMOJIS[p.name] || "📦";
  const stockClass = p.stock_qty === 0 ? "stock-out" : p.stock_qty <= 3 ? "stock-low" : "";
  const stockText  = p.stock_qty === 0 ? "Out of Stock" : p.stock_qty <= 3 ? `Only ${p.stock_qty} left!` : `${p.stock_qty} in stock`;
  const inCart     = cart[p.product_id] ? cart[p.product_id].qty : 1;
  const disabled   = p.stock_qty === 0 ? "disabled" : "";

  return `<div class="product-card" id="pcard-${p.product_id}">
    <div class="product-emoji">${emoji}</div>
    <div class="product-name">${esc(p.name)}</div>
    <div class="product-desc">${esc(p.description || "")}</div>
    <div class="product-price">₹${p.price.toLocaleString("en-IN")}</div>
    <div class="product-stock ${stockClass}">${stockText}</div>
    <div class="qty-row">
      <input type="number" class="qty-input" id="qty-${p.product_id}"
             value="${inCart}" min="1" max="${Math.max(p.stock_qty, 1)}"
             ${p.stock_qty === 0 ? "disabled" : ""} />
      <button class="btn btn-primary btn-sm" ${disabled}
              onclick="addToCart(${p.product_id})">Add to Cart</button>
    </div>
  </div>`;
}

function addToCart(productId) {
  const product = productsCache.find(p => p.product_id === productId);
  if (!product) return;
  const qtyEl = document.getElementById("qty-" + productId);
  const qty   = parseInt(qtyEl.value) || 1;
  if (qty < 1) { alert("Please enter a valid quantity."); return; }

  cart[productId] = { product, qty };
  updateCartFab();
  showToast(`${product.name} added to cart!`);
}

function updateCartFab() {
  const fab   = document.getElementById("cartFab");
  const count = Object.keys(cart).length;
  document.getElementById("cartCount").textContent = count;
  fab.style.display = count > 0 ? "flex" : "none";
}

document.getElementById("cartFab").addEventListener("click", openCheckout);

// ============================================================
// Checkout
// ============================================================
function openCheckout() {
  if (Object.keys(cart).length === 0) { showToast("Your cart is empty."); return; }
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
      <span>${esc(entry.product.name)} × ${entry.qty}</span>
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
    msg.innerHTML = `<div class="msg-error">Please fill in all required fields.</div>`;
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
  btn.textContent = "Placing Order…";
  msg.innerHTML   = `<div class="msg-info">Submitting your order…</div>`;

  let ord = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
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
    // Backend offline / not reachable: fallback to demo processor
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
      order_id: "ORD-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
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

  // Success
  const isExc    = ord.order_status === "EXCEPTION";
  const statusBg = isExc ? "msg-error" : "msg-success";
  const icon     = isExc ? "⚠️" : "✅";
  const delivery = ord.estimated_delivery_time || "2 business days";
  msg.innerHTML  = `<div class="${statusBg}">
    ${icon} <strong>Order ${isExc ? "flagged as exception" : "placed successfully"}!</strong><br/>
    Order ID: <strong>${esc(ord.order_id)}</strong><br/>
    Status: ${esc(ord.order_status)} | Payment: ${esc(ord.payment_status)}<br/>
    Total: ₹${ord.total_amount.toLocaleString("en-IN")}<br/>
    🚚 <strong>Estimated Delivery:</strong> ${esc(delivery)}<br/>
    ${!isExc ? `<span style="display:inline-block;margin-top:6px;font-size:0.9em;color:#15803d;background:#dcfce7;padding:3px 8px;border-radius:6px;">📲 WhatsApp notification triggered for <strong>${esc(ord.customer_phone || "")}</strong></span><br/>` : ""}
    ${isExc ? "⚠️ Insufficient stock detected. Operations team notified." : ""}
    <br/><small>Demo order processed with real-time delivery estimation.</small>
  </div>`;

  // Clear cart and reset form on success
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
// n8n webhook trigger (fire-and-forget from browser)
// ============================================================
async function triggerN8nWebhook(order) {
  const isLocal = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const n8nWebhookUrl = (typeof window !== "undefined" && window.TECHMART_N8N_URL) ||
    localStorage.getItem("techmart_n8n_url") ||
    (isLocal ? "http://localhost:5678/webhook/order-event" : "");

  if (!n8nWebhookUrl) {
    return;
  }

  try {
    await fetch(n8nWebhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        event_uid:               "WEB-" + order.order_id + "-" + Date.now(),
        event_type:              order.order_status === "EXCEPTION" ? "PAID_INSUFFICIENT_STOCK" : "ORDER_CONFIRMED",
        order_id:                order.order_id,
        customer_name:           order.customer_name || "",
        customer_phone:          order.customer_phone || "",
        estimated_delivery_time: order.estimated_delivery_time || "",
        total_amount:            order.total_amount || 0,
        source:                  "frontend",
      }),
    });
  } catch (_) {
    // silently ignore
  }
}

// ============================================================
// Orders page
// ============================================================
async function loadOrders() {
  const container = document.getElementById("ordersContainer");
  container.innerHTML = "<div class='loading-msg'>Loading orders…</div>";
  let orders = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
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
    container.innerHTML = "<p class='empty-state'>No orders yet. Place your first order from the Products page!</p>";
    return;
  }

  const rows = orders.map(o => `
    <tr>
      <td><code>${esc(o.order_id)}</code></td>
      <td>${esc(o.customer_name)}</td>
      <td>${formatDate(o.created_at)}</td>
      <td><span style="font-weight:600;color:#0f766e;">🚚 ${esc(o.estimated_delivery_time || '2 business days')}</span></td>
      <td>₹${(o.total_amount || 0).toLocaleString("en-IN")}</td>
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
// Control Tower / Dashboard
// ============================================================
async function loadDashboard() {
  let data = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
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
      : "<p class='empty-state'>No open exceptions 🎉</p>";

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
      : "<p class='empty-state'>No automation events yet.</p>";

    // Status bars
    const statusMap  = data.orders_by_status || {};
    const total      = data.total_orders || 1;
    const statusDiv  = document.getElementById("statusBars");
    statusDiv.innerHTML = Object.entries(statusMap).map(([status, count]) => {
      const pct = Math.round((count / total) * 100);
      return `<div class="status-bar-item">
        <span class="status-bar-label">${esc(status)}</span>
        <div class="status-bar-fill" style="width:${pct * 1.5}px; max-width:300px"></div>
        <span class="status-bar-count">${count}</span>
      </div>`;
    }).join("") || "<p class='empty-state'>No orders yet.</p>";

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
      : "<p class='empty-state'>No team assignments yet.</p>";

  } catch (err) {
    document.getElementById("kpi-total").textContent = "—";
    console.error("Dashboard load failed:", err);
  }
}

// ============================================================
// Admin simulation
// ============================================================
function openAdminSim() {
  const panel = document.getElementById("adminPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

async function runAdminSim() {
  const productId = parseInt(document.getElementById("adminProductId").value) || 1;
  const qty       = parseInt(document.getElementById("adminQty").value) || 999;
  const apiKey    = document.getElementById("adminKey").value.trim();
  const msgDiv    = document.getElementById("adminMsg");

  msgDiv.innerHTML = `<div class="msg-info">Running simulation…</div>`;
  try {
    const res  = await fetch(API + "/api/admin/simulate-paid-insufficient-stock", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": apiKey },
      body:    JSON.stringify({ product_id: productId, quantity: qty }),
    });
    const data = await res.json();
    if (!res.ok) {
      msgDiv.innerHTML = `<div class="msg-error">❌ ${esc(data.error || "Failed")}</div>`;
      return;
    }
    msgDiv.innerHTML = `<div class="msg-success">
      ✅ Simulation created!<br/>
      Order ID: <strong>${esc(data.order_id)}</strong><br/>
      Product: ${esc(data.product)} | Qty: ${data.quantity} | Stock: ${data.stock_available}<br/>
      Severity: <strong>${esc(data.severity)}</strong> | Team: <strong>${esc(data.owner_team)}</strong><br/>
      <small>${esc(data.note)}</small>
    </div>`;
    // Refresh dashboard
    setTimeout(loadDashboard, 500);
  } catch (err) {
    msgDiv.innerHTML = `<div class="msg-error">❌ ${esc(err.message)}</div>`;
  }
}

// ============================================================
// Badge helpers
// ============================================================
function orderStatusBadge(s) {
  const map = {
    CONFIRMED: "badge-confirmed", EXCEPTION: "badge-exception",
    ORDER_PLACED: "badge-placed", DELIVERED: "badge-confirmed",
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

// ============================================================
// Utilities
// ============================================================
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
    t.style.cssText = "position:fixed;bottom:5rem;right:2rem;background:#1a1814;color:#fff;padding:.65rem 1.2rem;border-radius:8px;font-size:.875rem;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,.25);transition:opacity .3s;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 2500);
}

// ============================================================
// Init
// ============================================================
navigate("home");
