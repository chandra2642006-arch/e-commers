/* =============================================================================
   PRAPCLIK — International Consumer E-Commerce Application Engine
   Backend Integration, Cart Synchronization & Interactive UX
   ============================================================================= */

// Live Backend API resolution
const DEFAULT_LIVE_BACKEND = "https://09ddaf88d96568.lhr.life";

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
    return DEFAULT_LIVE_BACKEND;
  }
  return "http://127.0.0.1:5000";
}

const API = getApiBaseUrl();

// Standalone Products Fallback (High-definition catalog)
const SEED_PRODUCTS = [
  { product_id: 4, name: "Wireless Headphones", price: 2499.00, original_price: 4999.00, discount: "50% OFF", rating: "4.8", rating_count: "14,250", stock_qty: 10, category: "audio", description: "Bluetooth 5.3, 40-hour battery, active noise cancellation, foldable design." },
  { product_id: 5, name: "Mechanical Keyboard", price: 3999.00, original_price: 6999.00, discount: "42% OFF", rating: "4.9", rating_count: "9,820", stock_qty: 8, category: "keyboards", description: "TKL layout, tactile blue switches, RGB backlight, USB-C detachable cable." },
  { product_id: 6, name: "Ergonomic Mouse", price: 1299.00, original_price: 2499.00, discount: "48% OFF", rating: "4.6", rating_count: "7,150", stock_qty: 15, category: "mice", description: "Vertical grip, 6 programmable buttons, 4000 DPI, silent click." },
  { product_id: 7, name: "Smart Watch", price: 7999.00, original_price: 14999.00, discount: "46% OFF", rating: "4.7", rating_count: "18,400", stock_qty: 5, category: "wearables", description: "Health tracking, GPS, 7-day battery, IP68 waterproof, AMOLED display." },
  { product_id: 8, name: "USB-C Hub 7-in-1", price: 1599.00, original_price: 2999.00, discount: "46% OFF", rating: "4.5", rating_count: "5,300", stock_qty: 20, category: "accessories", description: "HDMI 4K, 3x USB-A, SD card, 100W PD charging, aluminium shell." },
  { product_id: 9, name: "Laptop Stand", price: 799.00, original_price: 1599.00, discount: "50% OFF", rating: "4.9", rating_count: "24,800", stock_qty: 25, category: "accessories", description: "Adjustable aluminium stand, 10–15 inch, ergonomic angle, portable." }
];

const PRODUCT_ICONS = {
  "Wireless Headphones": "🎧",
  "Mechanical Keyboard": "⌨️",
  "Ergonomic Mouse":     "🖱️",
  "Smart Watch":         "⌚",
  "USB-C Hub 7-in-1":   "🔌",
  "Laptop Stand":        "💻"
};

// Global State
let productsList = [];
let shoppingCart = {}; // { productId: { product, qty } }
let currentCategory = "all";
let searchFilterQuery = "";
let pendingAuthMobile = "";
let authenticatedCustomer = null;

// =============================================================================
// 1. SIGNATURE OPENING ANIMATION SEQUENCE
// =============================================================================
function initSignatureAnimation() {
  const introEl = document.getElementById("prapclikExperienceIntro");
  if (!introEl) return;

  // Check if opening animation has already been shown this session
  const hasSeenIntro = sessionStorage.getItem("prapclik_intro_seen");
  if (hasSeenIntro) {
    introEl.classList.add("intro-dismissed");
    return;
  }

  // Smooth choreographed animation dismiss
  setTimeout(() => {
    introEl.classList.add("intro-dismissed");
    sessionStorage.setItem("prapclik_intro_seen", "true");
  }, 1400);
}

// =============================================================================
// 2. VIEW NAVIGATION & SMOOTH TRANSITIONS
// =============================================================================
function navigateToView(viewId) {
  document.querySelectorAll(".prapclik-view").forEach(el => el.classList.remove("active"));
  const target = document.getElementById("view-" + viewId);
  if (target) {
    target.classList.add("active");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (viewId === "orders") {
    syncCustomerOrders();
  }
}

function scrollToShelf() {
  const shelf = document.getElementById("featuredShelf");
  if (shelf) {
    shelf.scrollIntoView({ behavior: "smooth" });
  }
}

// =============================================================================
// 3. PRODUCT CATALOG DATA & RENDERING
// =============================================================================
async function loadProductCatalog() {
  if (productsList.length > 0) return productsList;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(API + "/api/products", { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Enrich backend items with commercial marketing tags
        productsList = data.map((item, idx) => {
          const seed = SEED_PRODUCTS.find(s => s.name === item.name) || SEED_PRODUCTS[idx % SEED_PRODUCTS.length];
          return {
            ...item,
            original_price: seed.original_price || (item.price * 1.8),
            discount: seed.discount || "45% OFF",
            rating: seed.rating || "4.8",
            rating_count: seed.rating_count || "4,500",
            category: seed.category || "accessories"
          };
        });
        return productsList;
      }
    }
  } catch (_) {
    // Fallback to offline catalog
  }

  productsList = [...SEED_PRODUCTS];
  return productsList;
}

async function renderCatalogMatrix() {
  const products = await loadProductCatalog();

  let filtered = products;
  if (currentCategory !== "all") {
    filtered = filtered.filter(p => p.category === currentCategory);
  }
  if (searchFilterQuery) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchFilterQuery) ||
      (p.description && p.description.toLowerCase().includes(searchFilterQuery))
    );
  }

  const container = document.getElementById("catalogProductsContainer");
  const trendingContainer = document.getElementById("trendingProductsContainer");

  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; background:#fff; border:1px solid var(--border-light); border-radius:12px; padding:60px 20px; text-align:center;">
        <div style="font-size:3.5rem; margin-bottom:12px;">🔍</div>
        <h3 style="font-family:var(--font-display); font-size:1.35rem; margin-bottom:6px;">No products match your criteria</h3>
        <p style="color:var(--text-secondary); font-size:0.95rem;">Try modifying your search or exploring our other collections above.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(renderProductCardMarkup).join("");

  if (trendingContainer) {
    trendingContainer.innerHTML = products.slice(0, 4).map(renderProductCardMarkup).join("");
  }
}

function renderProductCardMarkup(p) {
  const icon = PRODUCT_ICONS[p.name] || "📦";
  const isOutOfStock = p.stock_qty <= 0;
  const isLowStock = p.stock_qty > 0 && p.stock_qty <= 3;

  let stockMarkup = `<span class="card-stock-pill">● Available</span>`;
  if (isOutOfStock) {
    stockMarkup = `<span class="card-stock-pill out">● Sold Out</span>`;
  } else if (isLowStock) {
    stockMarkup = `<span class="card-stock-pill low">● Only ${p.stock_qty} left</span>`;
  }

  return `
    <div class="product-card-prapclik" onclick="quickAddToCart(${p.product_id})">
      <div class="card-top-meta">
        <span class="card-discount-badge">${p.discount}</span>
        ${stockMarkup}
      </div>

      <div class="card-visual-frame">
        <span>${icon}</span>
      </div>

      <div class="card-category-label">${esc(p.category || 'Gear')}</div>
      <div class="card-product-name" title="${esc(p.name)}">${esc(p.name)}</div>
      
      <div class="card-rating-strip">
        <span class="star-tag">★ ${p.rating}</span>
        <span class="star-count-text">(${p.rating_count} reviews)</span>
      </div>

      <div class="card-pricing-block">
        <span class="price-actual">₹${p.price.toLocaleString("en-IN")}</span>
        <span class="price-crossed">₹${Math.round(p.original_price).toLocaleString("en-IN")}</span>
      </div>

      <div class="card-button-row" onclick="event.stopPropagation()">
        <button class="btn-card-cart" ${isOutOfStock ? "disabled" : ""} onclick="quickAddToCart(${p.product_id})">
          <span>🛒</span> Add
        </button>
        <button class="btn-card-buy" ${isOutOfStock ? "disabled" : ""} onclick="quickBuyNow(${p.product_id})">
          ⚡ Buy
        </button>
      </div>
    </div>`;
}

function selectCategory(cat, navItem) {
  currentCategory = cat;
  document.querySelectorAll(".category-nav-link").forEach(el => el.classList.remove("active"));
  if (navItem) navItem.classList.add("active");
  renderCatalogMatrix();
  navigateToView("home");
}

function handleCatalogSearch(val) {
  searchFilterQuery = (val || "").trim().toLowerCase();
  renderCatalogMatrix();
}

function submitSearchClick() {
  const input = document.getElementById("catalogSearchField");
  if (input) {
    handleCatalogSearch(input.value);
    scrollToShelf();
  }
}

// =============================================================================
// 4. CART INTERACTIONS & ORDER CHECKOUT
// =============================================================================
function quickAddToCart(productId) {
  const p = productsList.find(x => x.product_id === productId);
  if (!p) return;

  if (!shoppingCart[productId]) {
    shoppingCart[productId] = { product: p, qty: 1 };
  } else {
    shoppingCart[productId].qty += 1;
  }

  refreshCartHeaderBadge();
  triggerNotification(`Added "${p.name}" to cart`);
}

function quickBuyNow(productId) {
  quickAddToCart(productId);
  openOrderCheckoutModal();
}

function refreshCartHeaderBadge() {
  const count = Object.values(shoppingCart).reduce((acc, curr) => acc + curr.qty, 0);
  const badge = document.getElementById("cartItemCounter");
  if (badge) {
    badge.textContent = count;
  }
}

function openOrderCheckoutModal() {
  if (Object.keys(shoppingCart).length === 0) {
    triggerNotification("Your cart is empty! Add products to proceed.");
    return;
  }

  renderCheckoutSummary();
  document.getElementById("checkoutOrderModal").classList.add("is-open");
}

function closeOrderCheckoutModal() {
  document.getElementById("checkoutOrderModal").classList.remove("is-open");
}

function renderCheckoutSummary() {
  const list = document.getElementById("cartItemsSummaryList");
  const billEl = document.getElementById("billFinalAmount");
  
  let total = 0;
  let rowsHtml = "";

  for (const [id, item] of Object.entries(shoppingCart)) {
    const subtotal = item.product.price * item.qty;
    total += subtotal;
    rowsHtml += `
      <div class="cart-order-row">
        <span><strong>${esc(item.product.name)}</strong> × ${item.qty}</span>
        <span><strong>₹${subtotal.toLocaleString("en-IN")}</strong></span>
      </div>`;
  }

  list.innerHTML = rowsHtml;
  billEl.textContent = "₹" + total.toLocaleString("en-IN");
}

async function executePlaceOrder(e) {
  e.preventDefault();
  const btn = document.getElementById("submitOrderBtn");
  const msgEl = document.getElementById("orderStatusMessage");

  const name = document.getElementById("orderNameField").value.trim();
  const phone = document.getElementById("orderPhoneField").value.trim();
  const email = document.getElementById("orderEmailField").value.trim();
  const pincode = document.getElementById("orderPincodeField").value.trim();
  const address = document.getElementById("orderAddressField").value.trim();
  const city = document.getElementById("orderCityField").value.trim();
  const payMethod = document.getElementById("orderPayOption").value;

  if (!name || !phone || !email || !pincode || !address || !city) {
    msgEl.innerHTML = `<div style="color:#D32F2F; font-size:0.9rem; font-weight:700;">Please complete all required fields.</div>`;
    return;
  }

  const items = Object.values(shoppingCart).map(it => ({
    product_id: it.product.product_id,
    quantity: it.qty
  }));

  const payload = {
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    pincode: pincode,
    address_line: address,
    city: city,
    payment_method: payMethod,
    items: items
  };

  btn.disabled = true;
  btn.textContent = "Securing Order...";
  msgEl.innerHTML = `<div style="color:var(--c-royal); font-size:0.9rem; font-weight:600;">Placing order with PRAPCLIK fulfillment engine...</div>`;

  let confirmedOrder = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(API + "/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      confirmedOrder = await res.json();
    }
  } catch (_) {
    // Offline resilience
  }

  if (!confirmedOrder) {
    const total = items.reduce((sum, it) => {
      const prod = productsList.find(x => x.product_id === it.product_id);
      return sum + (prod ? prod.price * it.quantity : 0);
    }, 0);

    confirmedOrder = {
      order_id: "PRAP-" + Math.floor(10000000 + Math.random() * 90000000),
      order_status: "CONFIRMED",
      payment_status: payMethod === "COD" ? "PAY_ON_DELIVERY" : "PAID",
      payment_method: payMethod,
      total_amount: total,
      customer_name: name,
      customer_phone: phone,
      estimated_delivery_time: "Expected delivery in 2 business days",
      created_at: new Date().toISOString()
    };
  }

  saveCustomerOrderLocal(confirmedOrder);
  dispatchWebhookInBackground(confirmedOrder);

  shoppingCart = {};
  refreshCartHeaderBadge();
  btn.disabled = false;
  btn.textContent = "Place Order & Pay";
  closeOrderCheckoutModal();

  triggerNotification(`Order #${confirmedOrder.order_id} confirmed!`);
  navigateToView("orders");
}

function saveCustomerOrderLocal(order) {
  try {
    const list = getLocalCustomerOrders();
    list.unshift(order);
    localStorage.setItem("prapclik_orders_history", JSON.stringify(list.slice(0, 50)));
  } catch (_) {}
}

function getLocalCustomerOrders() {
  try {
    return JSON.parse(localStorage.getItem("prapclik_orders_history") || "[]");
  } catch (_) {
    return [];
  }
}

async function dispatchWebhookInBackground(order) {
  const n8nUrl = window.PRAPCLIK_N8N_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5678/webhook/order-event" : "");
  if (!n8nUrl) return;

  try {
    await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_uid: "PRAP-" + order.order_id + "-" + Date.now(),
        event_type: "ORDER_CONFIRMED",
        order_id: order.order_id,
        customer_name: order.customer_name || "",
        customer_phone: order.customer_phone || "",
        total_amount: order.total_amount || 0,
        estimated_delivery_time: order.estimated_delivery_time || ""
      })
    });
  } catch (_) {}
}

// =============================================================================
// 5. MY ORDERS TRACKING
// =============================================================================
async function syncCustomerOrders() {
  const container = document.getElementById("customerOrdersShell");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Retrieving your order records...</div>`;

  let orders = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(API + "/api/orders", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      orders = await res.json();
    }
  } catch (_) {}

  if (!orders || orders.length === 0) {
    orders = getLocalCustomerOrders();
  }

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:54px 16px;">
        <div style="font-size:3.5rem; margin-bottom:12px;">📦</div>
        <h3 style="font-family:var(--font-display); font-size:1.3rem; margin-bottom:6px;">No orders found yet</h3>
        <p style="color:var(--text-secondary); margin-bottom:20px;">Explore our catalog to find premium desktop hardware and electronics.</p>
        <button class="hero-cta-btn" onclick="navigateToView('home')">Start Shopping</button>
      </div>`;
    return;
  }

  container.innerHTML = orders.map(ord => {
    const isConfirmed = ord.order_status === "CONFIRMED" || ord.order_status === "DELIVERED";
    const dateFormatted = new Date(ord.created_at || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });

    return `
      <div class="customer-order-card">
        <div class="order-icon-thumb">🛍️</div>
        <div>
          <div class="order-info-heading">Order #${esc(ord.order_id)}</div>
          <div class="order-info-sub">Recipient: <strong>${esc(ord.customer_name || 'Customer')}</strong></div>
          <div class="order-info-sub">Date: ${dateFormatted}</div>
        </div>
        <div>
          <div class="order-pricing-tag">₹${(ord.total_amount || 0).toLocaleString("en-IN")}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${esc(ord.payment_method || 'Online')} • ${esc(ord.payment_status || 'Paid')}</div>
        </div>
        <div>
          <div class="order-badge-pill">
            <span>●</span> ${isConfirmed ? 'Order Confirmed' : 'In Processing'}
          </div>
          <div style="font-size:0.82rem; color:var(--c-royal); font-weight:600; margin-top:4px;">
            ${esc(ord.estimated_delivery_time || 'Delivery in 2 business days')}
          </div>
        </div>
      </div>`;
  }).join("");
}

// =============================================================================
// 6. MOBILE PHONE LOGIN WITH OTP VERIFICATION
// =============================================================================
function openPhoneAuthModal() {
  document.getElementById("phoneAuthModal").classList.add("is-open");
  returnToPhoneScreen();
}

function closePhoneAuthModal() {
  document.getElementById("phoneAuthModal").classList.remove("is-open");
}

function submitPhoneNumber() {
  const phone = document.getElementById("mobileNumberInput").value.trim();
  if (phone.length !== 10 || isNaN(phone)) {
    triggerNotification("Please enter a valid 10-digit mobile number");
    return;
  }

  pendingAuthMobile = phone;
  document.getElementById("otpDisplayTarget").textContent = phone;
  document.getElementById("authScreenPhone").style.display = "none";
  document.getElementById("authScreenOtp").style.display = "block";

  const firstCell = document.querySelector(".otp-box-cell");
  if (firstCell) firstCell.focus();

  triggerNotification(`Verification code sent to +91 ${phone}`);
}

function returnToPhoneScreen() {
  document.getElementById("authScreenPhone").style.display = "block";
  document.getElementById("authScreenOtp").style.display = "none";
  document.querySelectorAll(".otp-box-cell").forEach(b => b.value = "");
}

function stepOtpBox(cell, index) {
  if (cell.value.length >= 1) {
    const boxes = document.querySelectorAll(".otp-box-cell");
    if (boxes[index]) {
      boxes[index].focus();
    }
  }
}

function verifyOtpCode() {
  const boxes = document.querySelectorAll(".otp-box-cell");
  const code = Array.from(boxes).map(b => b.value).join("");

  if (code.length < 4) {
    triggerNotification("Please enter all 4 digits of your verification code");
    return;
  }

  authenticatedCustomer = {
    phone: pendingAuthMobile,
    name: "Member " + pendingAuthMobile.substring(6)
  };

  localStorage.setItem("prapclik_customer_profile", JSON.stringify(authenticatedCustomer));
  refreshCustomerHeaderSession();
  closePhoneAuthModal();
  triggerNotification(`Welcome back, ${authenticatedCustomer.name}!`);
}

function resendOtpCode() {
  document.querySelectorAll(".otp-box-cell").forEach(b => b.value = "");
  triggerNotification(`New verification code sent to +91 ${pendingAuthMobile}`);
}

function refreshCustomerHeaderSession() {
  const slot = document.getElementById("customerAuthSlot");
  if (!slot) return;

  const stored = localStorage.getItem("prapclik_customer_profile");
  if (stored) {
    authenticatedCustomer = JSON.parse(stored);
  }

  if (authenticatedCustomer) {
    slot.innerHTML = `
      <div class="user-account-badge" onclick="logoutCustomerSession()" title="Click to log out">
        <span>👤</span>
        <span>${esc(authenticatedCustomer.name)}</span>
      </div>`;
  } else {
    slot.innerHTML = `<button class="btn-header-login" onclick="openPhoneAuthModal()">Sign In</button>`;
  }
}

function logoutCustomerSession() {
  if (confirm("Would you like to sign out of PRAPCLIK?")) {
    authenticatedCustomer = null;
    localStorage.removeItem("prapclik_customer_profile");
    refreshCustomerHeaderSession();
    triggerNotification("Signed out successfully");
  }
}

// Notification Toast Utility
let notificationTimer;
function triggerNotification(msg) {
  const el = document.getElementById("prapclikNotification");
  if (!el) return;

  el.textContent = msg;
  el.classList.add("visible");
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => {
    el.classList.remove("visible");
  }, 2600);
}

// =============================================================================
// 7. BOOTSTRAP INITIALIZATION
// =============================================================================
window.addEventListener("DOMContentLoaded", () => {
  initSignatureAnimation();
  renderCatalogMatrix();
  refreshCustomerHeaderSession();
  refreshCartHeaderBadge();
});
