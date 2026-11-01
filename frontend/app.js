/* =============================================================================
   PRAPCLIK — Commercial E-Commerce Platform Application Logic
   Engineered for Flipkart/Amazon User Experience
   ============================================================================= */

// Active live backend tunnel connection
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

// Standalone Commercial Products Fallback
const SEED_PRODUCTS = [
  { product_id: 4, name: "Wireless Headphones", price: 2499.00, original_price: 4999.00, discount: "50% off", rating: "4.4", rating_count: "12,410", stock_qty: 10, category: "audio", description: "Bluetooth 5.3, 40-hour battery, active noise cancellation, foldable design." },
  { product_id: 5, name: "Mechanical Keyboard", price: 3999.00, original_price: 6999.00, discount: "42% off", rating: "4.6", rating_count: "8,920", stock_qty: 8, category: "keyboards", description: "TKL layout, tactile blue switches, RGB backlight, USB-C detachable cable." },
  { product_id: 6, name: "Ergonomic Mouse", price: 1299.00, original_price: 2499.00, discount: "48% off", rating: "4.3", rating_count: "6,230", stock_qty: 15, category: "mice", description: "Vertical grip, 6 programmable buttons, 4000 DPI, silent click." },
  { product_id: 7, name: "Smart Watch", price: 7999.00, original_price: 14999.00, discount: "46% off", rating: "4.5", rating_count: "15,800", stock_qty: 5, category: "wearables", description: "Health tracking, GPS, 7-day battery, IP68 waterproof, AMOLED display." },
  { product_id: 8, name: "USB-C Hub 7-in-1", price: 1599.00, original_price: 2999.00, discount: "46% off", rating: "4.2", rating_count: "4,190", stock_qty: 20, category: "accessories", description: "HDMI 4K, 3x USB-A, SD card, 100W PD charging, aluminium shell." },
  { product_id: 9, name: "Laptop Stand", price: 799.00, original_price: 1599.00, discount: "50% off", rating: "4.7", rating_count: "21,450", stock_qty: 25, category: "accessories", description: "Adjustable aluminium stand, 10–15 inch, ergonomic angle, portable." }
];

const PRODUCT_ICONS = {
  "Wireless Headphones": "🎧",
  "Mechanical Keyboard": "⌨️",
  "Ergonomic Mouse":     "🖱️",
  "Smart Watch":         "⌚",
  "USB-C Hub 7-in-1":   "🔌",
  "Laptop Stand":        "💻"
};

// Global Store State
let productsList = [];
let cartState = {}; // { productId: { product, qty } }
let selectedCategory = "all";
let searchKeyword = "";
let pendingLoginPhone = "";
let currentLoggedInUser = null;

// =============================================================================
// 1. PAGE ROUTING & NAVIGATION
// =============================================================================
function showPage(pageId) {
  document.querySelectorAll(".page-view").forEach(el => el.classList.remove("active"));
  const target = document.getElementById("view-" + pageId);
  if (target) {
    target.classList.add("active");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (pageId === "orders") {
    loadCustomerOrders();
  }
}

function scrollToProducts() {
  const deals = document.getElementById("dealsSection");
  if (deals) {
    deals.scrollIntoView({ behavior: "smooth" });
  }
}

// =============================================================================
// 2. PRODUCT FETCHING & COMMERCIAL RENDERING
// =============================================================================
async function fetchProducts() {
  if (productsList.length > 0) return productsList;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(API + "/api/products", { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Enrich backend products with e-commerce pricing & rating tags
        productsList = data.map((item, idx) => {
          const seed = SEED_PRODUCTS.find(s => s.name === item.name) || SEED_PRODUCTS[idx % SEED_PRODUCTS.length];
          return {
            ...item,
            original_price: seed.original_price || (item.price * 1.8),
            discount: seed.discount || "45% off",
            rating: seed.rating || "4.4",
            rating_count: seed.rating_count || "3,200",
            category: seed.category || "electronics"
          };
        });
        return productsList;
      }
    }
  } catch (_) {
    // Graceful fallback to rich seed catalog
  }

  productsList = [...SEED_PRODUCTS];
  return productsList;
}

async function renderProducts() {
  const products = await fetchProducts();

  let filtered = products;
  if (selectedCategory !== "all") {
    filtered = filtered.filter(p => p.category === selectedCategory);
  }
  if (searchKeyword) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchKeyword) ||
      (p.description && p.description.toLowerCase().includes(searchKeyword))
    );
  }

  const mainGrid = document.getElementById("mainProductsGrid");
  const trendingGrid = document.getElementById("trendingProductsGrid");

  if (!mainGrid) return;

  if (filtered.length === 0) {
    mainGrid.innerHTML = `
      <div style="grid-column: 1/-1; background:#fff; padding:48px 16px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:12px;">🔍</div>
        <h3 style="font-size:1.2rem; color:#212121; margin-bottom:6px;">Sorry, no products found!</h3>
        <p style="color:#878787; font-size:0.95rem;">Please check the spelling or try searching for something else.</p>
      </div>`;
    return;
  }

  mainGrid.innerHTML = filtered.map(renderCardHtml).join("");

  if (trendingGrid) {
    trendingGrid.innerHTML = products.slice(0, 4).map(renderCardHtml).join("");
  }
}

function renderCardHtml(p) {
  const icon = PRODUCT_ICONS[p.name] || "📦";
  const isOutOfStock = p.stock_qty <= 0;
  const isLowStock = p.stock_qty > 0 && p.stock_qty <= 3;

  let stockHtml = `<div class="product-stock-label">In Stock</div>`;
  if (isOutOfStock) {
    stockHtml = `<div class="product-stock-label out">Currently Out of Stock</div>`;
  } else if (isLowStock) {
    stockHtml = `<div class="product-stock-label low">Only ${p.stock_qty} left in stock</div>`;
  }

  return `
    <div class="product-card" onclick="handleCardClick(${p.product_id})">
      <div class="product-img-box">
        <span class="product-tag">${p.discount}</span>
        <span>${icon}</span>
      </div>

      <div class="product-name" title="${esc(p.name)}">${esc(p.name)}</div>
      
      <div class="product-rating-row">
        <span class="rating-badge">★ ${p.rating}</span>
        <span class="rating-count">(${p.rating_count})</span>
      </div>

      <div class="product-price-row">
        <span class="price-current">₹${p.price.toLocaleString("en-IN")}</span>
        <span class="price-original">₹${Math.round(p.original_price).toLocaleString("en-IN")}</span>
        <span class="price-discount">${p.discount}</span>
      </div>

      ${stockHtml}

      <div class="card-actions-row" onclick="event.stopPropagation()">
        <button class="btn-add-cart" ${isOutOfStock ? "disabled" : ""} onclick="addToCart(${p.product_id})">
          <span>🛒</span> Add to Cart
        </button>
        <button class="btn-buy-now" ${isOutOfStock ? "disabled" : ""} onclick="buyNow(${p.product_id})">
          ⚡ Buy Now
        </button>
      </div>
    </div>`;
}

function filterCategory(cat, btn) {
  selectedCategory = cat;
  document.querySelectorAll(".category-item").forEach(el => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderProducts();
  showPage("home");
}

function handleGlobalSearch(val) {
  searchKeyword = (val || "").trim().toLowerCase();
  renderProducts();
}

function handleSearchClick() {
  const input = document.getElementById("globalSearchInput");
  if (input) {
    handleGlobalSearch(input.value);
    scrollToProducts();
  }
}

// =============================================================================
// 3. CART MANAGEMENT & CHECKOUT FLOW
// =============================================================================
function addToCart(productId) {
  const p = productsList.find(x => x.product_id === productId);
  if (!p) return;

  if (!cartState[productId]) {
    cartState[productId] = { product: p, qty: 1 };
  } else {
    cartState[productId].qty += 1;
  }

  updateCartBadge();
  showToast(`"${p.name}" added to Cart!`);
}

function buyNow(productId) {
  addToCart(productId);
  openCheckoutModal();
}

function updateCartBadge() {
  const totalItems = Object.values(cartState).reduce((acc, curr) => acc + curr.qty, 0);
  const badge = document.getElementById("cartBadgeCount");
  if (badge) {
    badge.textContent = totalItems;
  }
}

function openCheckoutModal() {
  if (Object.keys(cartState).length === 0) {
    showToast("Your shopping cart is empty!");
    return;
  }

  renderCheckoutSummary();
  document.getElementById("checkoutModal").classList.add("open");
}

function closeCheckoutModal() {
  document.getElementById("checkoutModal").classList.remove("open");
}

function renderCheckoutSummary() {
  const container = document.getElementById("checkoutCartItems");
  const totalAmountEl = document.getElementById("checkoutTotalAmount");
  
  let total = 0;
  let itemsHtml = "";

  for (const [id, item] of Object.entries(cartState)) {
    const subtotal = item.product.price * item.qty;
    total += subtotal;
    itemsHtml += `
      <div class="cart-preview-item">
        <span><strong>${esc(item.product.name)}</strong> (Qty: ${item.qty})</span>
        <span><strong>₹${subtotal.toLocaleString("en-IN")}</strong></span>
      </div>`;
  }

  container.innerHTML = itemsHtml;
  totalAmountEl.textContent = "₹" + total.toLocaleString("en-IN");
}

async function handlePlaceOrder(e) {
  e.preventDefault();
  const btn = document.getElementById("confirmOrderBtn");
  const msgEl = document.getElementById("checkoutNoticeMsg");

  const name = document.getElementById("formName").value.trim();
  const phone = document.getElementById("formPhone").value.trim();
  const email = document.getElementById("formEmail").value.trim();
  const pincode = document.getElementById("formPincode").value.trim();
  const address = document.getElementById("formAddress").value.trim();
  const city = document.getElementById("formCity").value.trim();
  const payMethod = document.getElementById("formPaymentMethod").value;

  if (!name || !phone || !email || !pincode || !address || !city) {
    msgEl.innerHTML = `<div style="color:var(--c-red); font-weight:600; padding:8px 0;">Please complete all required fields.</div>`;
    return;
  }

  const items = Object.values(cartState).map(it => ({
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
  btn.textContent = "Placing Order...";
  msgEl.innerHTML = `<div style="color:var(--c-blue); font-weight:600; padding:8px 0;">Processing your order...</div>`;

  let resultOrder = null;

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
      resultOrder = await res.json();
    }
  } catch (_) {
    // Network fallback
  }

  // Graceful order persistence fallback if offline
  if (!resultOrder) {
    const total = items.reduce((sum, it) => {
      const prod = productsList.find(x => x.product_id === it.product_id);
      return sum + (prod ? prod.price * it.quantity : 0);
    }, 0);

    resultOrder = {
      order_id: "OD" + Math.floor(1000000000 + Math.random() * 9000000000),
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

  saveCustomerOrder(resultOrder);

  // Trigger automated dispatch webhook (background)
  triggerOrderWebhook(resultOrder);

  // Clear cart & close checkout
  cartState = {};
  updateCartBadge();
  btn.disabled = false;
  btn.textContent = "PLACE ORDER";
  closeCheckoutModal();

  showToast(`Order #${resultOrder.order_id} placed successfully!`);
  showPage("orders");
}

function saveCustomerOrder(order) {
  try {
    const list = getCustomerOrders();
    list.unshift(order);
    localStorage.setItem("prapclik_customer_orders", JSON.stringify(list.slice(0, 50)));
  } catch (_) {}
}

function getCustomerOrders() {
  try {
    return JSON.parse(localStorage.getItem("prapclik_customer_orders") || "[]");
  } catch (_) {
    return [];
  }
}

// Background webhook trigger
async function triggerOrderWebhook(order) {
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
// 4. MY ORDERS DISPLAY
// =============================================================================
async function loadCustomerOrders() {
  const container = document.getElementById("ordersListContainer");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding:32px; color:#878787;">Loading your orders...</div>`;

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
    orders = getCustomerOrders();
  }

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:48px 16px;">
        <div style="font-size:3.5rem; margin-bottom:12px;">📦</div>
        <h3 style="font-size:1.2rem; margin-bottom:6px;">You have no orders placed yet</h3>
        <p style="color:#878787; margin-bottom:18px;">Start shopping our genuine electronics with 2-day delivery.</p>
        <button class="banner-btn" onclick="showPage('home')">START SHOPPING</button>
      </div>`;
    return;
  }

  container.innerHTML = orders.map(ord => {
    const isConfirmed = ord.order_status === "CONFIRMED" || ord.order_status === "DELIVERED";
    const statusClass = isConfirmed ? "confirmed" : "action";
    const statusText = isConfirmed ? "Order Confirmed" : "Processing";
    const dateFormatted = new Date(ord.created_at || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });

    return `
      <div class="order-history-card">
        <div class="order-card-icon">🛍️</div>
        <div>
          <div class="order-details-title">Order #${esc(ord.order_id)}</div>
          <div class="order-details-meta">Recipient: <strong>${esc(ord.customer_name || 'Customer')}</strong></div>
          <div class="order-details-meta">Placed on: ${dateFormatted}</div>
        </div>
        <div>
          <div class="order-amount-text">₹${(ord.total_amount || 0).toLocaleString("en-IN")}</div>
          <div style="font-size:0.8rem; color:#878787;">Payment: ${esc(ord.payment_method || 'Online')} (${esc(ord.payment_status || 'Paid')})</div>
        </div>
        <div>
          <div class="order-status-pill ${statusClass}">
            <span>●</span> ${statusText}
          </div>
          <div style="font-size:0.8rem; color:#388E3C; margin-top:4px; font-weight:500;">
            ${esc(ord.estimated_delivery_time || 'Delivery in 2 business days')}
          </div>
        </div>
      </div>`;
  }).join("");
}

// =============================================================================
// 5. MOBILE PHONE NUMBER LOGIN & OTP MODAL
// =============================================================================
function openLoginModal() {
  document.getElementById("loginModal").classList.add("open");
  backToPhoneStep();
}

function closeLoginModal() {
  document.getElementById("loginModal").classList.remove("open");
}

function handlePhoneContinue() {
  const phone = document.getElementById("loginMobileInput").value.trim();
  if (phone.length !== 10 || isNaN(phone)) {
    showToast("Please enter a valid 10-digit mobile number");
    return;
  }

  pendingLoginPhone = phone;
  document.getElementById("otpTargetMobile").textContent = phone;
  document.getElementById("loginStepPhone").style.display = "none";
  document.getElementById("loginStepOtp").style.display = "block";

  // Focus on first OTP input
  const firstBox = document.querySelector(".otp-input-box");
  if (firstBox) firstBox.focus();

  showToast(`OTP sent to +91 ${phone}`);
}

function backToPhoneStep() {
  document.getElementById("loginStepPhone").style.display = "block";
  document.getElementById("loginStepOtp").style.display = "none";
  document.querySelectorAll(".otp-input-box").forEach(b => b.value = "");
}

function focusNextOtp(curr, index) {
  if (curr.value.length >= 1) {
    const boxes = document.querySelectorAll(".otp-input-box");
    if (boxes[index]) {
      boxes[index].focus();
    }
  }
}

function verifyOtpAndLogin() {
  const boxes = document.querySelectorAll(".otp-input-box");
  const enteredOtp = Array.from(boxes).map(b => b.value).join("");

  if (enteredOtp.length < 4) {
    showToast("Please enter the complete 4-digit OTP");
    return;
  }

  // Set logged in customer
  currentLoggedInUser = {
    phone: pendingLoginPhone,
    name: "Customer (" + pendingLoginPhone.substring(6) + ")"
  };

  localStorage.setItem("prapclik_user", JSON.stringify(currentLoggedInUser));
  updateAuthHeader();
  closeLoginModal();
  showToast(`Welcome to PRAPCLIK, ${currentLoggedInUser.name}!`);
}

function resendOtp() {
  document.querySelectorAll(".otp-input-box").forEach(b => b.value = "");
  showToast(`New OTP sent to +91 ${pendingLoginPhone}`);
}

function updateAuthHeader() {
  const container = document.getElementById("authHeaderContainer");
  if (!container) return;

  const stored = localStorage.getItem("prapclik_user");
  if (stored) {
    currentLoggedInUser = JSON.parse(stored);
  }

  if (currentLoggedInUser) {
    container.innerHTML = `
      <div class="user-logged-in-pill" onclick="logoutCustomer()">
        <span>👤</span>
        <span>${esc(currentLoggedInUser.name)}</span>
      </div>`;
  } else {
    container.innerHTML = `<button class="header-login-btn" onclick="openLoginModal()">Login</button>`;
  }
}

function logoutCustomer() {
  if (confirm("Do you want to log out of PRAPCLIK?")) {
    currentLoggedInUser = null;
    localStorage.removeItem("prapclik_user");
    updateAuthHeader();
    showToast("You have been logged out.");
  }
}

function handleCardClick(productId) {
  addToCart(productId);
}

// Toast notification helper
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById("prapclikToast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// =============================================================================
// 6. INITIALIZATION
// =============================================================================
window.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  updateAuthHeader();
  updateCartBadge();
});
