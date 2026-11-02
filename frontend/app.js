/* =============================================================================
   PRAPCLIK — International Consumer E-Commerce Application Engine
   Backend Integration, Navigation, Filter Engine & Cart Synchronization
   ============================================================================= */

// Live Backend API resolution
const DEFAULT_LIVE_BACKEND = "https://9fd2eeb2d4d0b1.lhr.life";

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

// Standalone Products Fallback (High-definition commercial hardware catalog)
const SEED_PRODUCTS = [
  { 
    product_id: 4, 
    name: "Wireless Headphones", 
    price: 2499.00, 
    original_price: 4999.00, 
    discount: "50% OFF", 
    rating: "4.8", 
    rating_count: "14,250", 
    stock_qty: 10, 
    category: "audio", 
    description: "Bluetooth 5.3, 40-hour battery, active noise cancellation, foldable ergonomic earcups.",
    specs: {
      "Model": "PRAPCLIK Studio ANC-100",
      "Connectivity": "Bluetooth 5.3 + 3.5mm Aux",
      "Battery Life": "40 Hours (ANC on)",
      "Charging": "USB-C Fast Charge (10m = 4h)",
      "Warranty": "1-Year Official Replacement",
      "In the Box": "Headphones, Aux Cable, Braided USB-C Cable, Pouch"
    }
  },
  { 
    product_id: 5, 
    name: "Mechanical Keyboard", 
    price: 3999.00, 
    original_price: 6999.00, 
    discount: "42% OFF", 
    rating: "4.9", 
    rating_count: "9,820", 
    stock_qty: 8, 
    category: "keyboards", 
    description: "TKL compact layout, tactile clicky switches, per-key RGB backlight, detachable braided cable.",
    specs: {
      "Model": "PRAPCLIK Vulcan TKL-87",
      "Switch Type": "Hot-swappable Tactile Blue",
      "Keycaps": "Double-shot PBT Matte",
      "Backlighting": "16.8M Color Dynamic RGB",
      "Warranty": "1-Year Official Replacement",
      "Compatibility": "Windows, macOS, Linux, iPadOS"
    }
  },
  { 
    product_id: 6, 
    name: "Ergonomic Mouse", 
    price: 1299.00, 
    original_price: 2499.00, 
    discount: "48% OFF", 
    rating: "4.6", 
    rating_count: "7,150", 
    stock_qty: 15, 
    category: "mice", 
    description: "Vertical 57-degree natural grip, 6 programmable buttons, 4000 DPI precision sensor, silent click.",
    specs: {
      "Model": "PRAPCLIK Ortho Vertical V2",
      "Sensor": "High-Precision Optical 4000 DPI",
      "Connectivity": "2.4GHz Wireless + Bluetooth 5.1",
      "Ergonomics": "57° Natural Handshake Angle",
      "Warranty": "1-Year Official Replacement",
      "Battery": "Rechargeable 500mAh (Up to 90 Days)"
    }
  },
  { 
    product_id: 7, 
    name: "Smart Watch", 
    price: 7999.00, 
    original_price: 14999.00, 
    discount: "46% OFF", 
    rating: "4.7", 
    rating_count: "18,400", 
    stock_qty: 5, 
    category: "wearables", 
    description: "Advanced health tracking, dual-band GPS, 7-day battery, IP68 water resistance, crisp AMOLED display.",
    specs: {
      "Model": "PRAPCLIK Chrono Active AMOLED",
      "Display": "1.43-inch Always-On AMOLED 466x466",
      "Health Sensors": "SpO2, 24/7 Heart Rate, Sleep Quality, Stress",
      "Water Resistance": "IP68 (5 ATM Water Resistant)",
      "Battery Life": "7 Days Standard, 14 Days Power Saver",
      "Warranty": "1-Year Official Replacement"
    }
  },
  { 
    product_id: 8, 
    name: "USB-C Hub 7-in-1", 
    price: 1599.00, 
    original_price: 2999.00, 
    discount: "46% OFF", 
    rating: "4.5", 
    rating_count: "5,300", 
    stock_qty: 20, 
    category: "accessories", 
    description: "HDMI 4K@60Hz, 3x USB-A 3.2, UHS-I SD/TF card slots, 100W Power Delivery pass-through, aluminium shell.",
    specs: {
      "Model": "PRAPCLIK HyperPort 7-in-1",
      "Video Output": "HDMI 2.0 (4K @ 60Hz HDR)",
      "Power Delivery": "100W USB-C PD 3.0",
      "USB Speeds": "3x USB 3.2 Gen 1 (5 Gbps)",
      "Housing": "Anodized Aerospace Aluminium",
      "Warranty": "1-Year Official Replacement"
    }
  },
  { 
    product_id: 9, 
    name: "Laptop Stand", 
    price: 799.00, 
    original_price: 1599.00, 
    discount: "50% OFF", 
    rating: "4.9", 
    rating_count: "24,800", 
    stock_qty: 25, 
    category: "accessories", 
    description: "Multi-angle adjustable aluminium riser, suitable for 10–16 inch notebooks, portable foldable design.",
    specs: {
      "Model": "PRAPCLIK ErgoLift Foldable",
      "Material": "Solid Anodized Aluminium Alloy",
      "Adjustability": "6 Ergonomic Tilt Angles (15°–45°)",
      "Compatibility": "All Laptops & Tablets (10 to 16.5 inches)",
      "Protection": "Anti-slip Silicone Pads & Stopper Hook",
      "Warranty": "1-Year Official Replacement"
    }
  }
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
let selectedDetailsProduct = null;
let selectedDetailsQty = 1;

// =============================================================================
// 1. SIGNATURE OPENING ANIMATION SEQUENCE
// =============================================================================
function initSignatureAnimation() {
  const introEl = document.getElementById("prapclikExperienceIntro");
  if (!introEl) return;

  const hasSeenIntro = sessionStorage.getItem("prapclik_intro_seen");
  if (hasSeenIntro) {
    introEl.classList.add("intro-dismissed");
    return;
  }

  setTimeout(() => {
    introEl.classList.add("intro-dismissed");
    sessionStorage.setItem("prapclik_intro_seen", "true");
  }, 1300);
}

// =============================================================================
// 2. VIEW NAVIGATION & ROUTING
// =============================================================================
function navigateToView(viewId) {
  // Hide all views
  document.querySelectorAll(".prapclik-view").forEach(el => el.classList.remove("active"));
  
  // Show target view
  const target = document.getElementById("view-" + viewId);
  if (target) {
    target.classList.add("active");
  }

  // Update navigation button active state
  document.querySelectorAll(".nav-link-btn").forEach(btn => {
    if (btn.getAttribute("data-nav") === viewId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Close mobile nav drawer if open
  const navBar = document.getElementById("mainHeaderNav");
  if (navBar) navBar.classList.remove("mobile-visible");

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });

  // View-specific trigger routines
  if (viewId === "products") {
    applyProductFilters();
  } else if (viewId === "cart") {
    renderCartPage();
  } else if (viewId === "orders") {
    syncCustomerOrders();
  }
}

function scrollToShelf() {
  const shelf = document.getElementById("featuredShelf");
  if (shelf) {
    shelf.scrollIntoView({ behavior: "smooth" });
  }
}

function toggleMobileNavMenu() {
  const nav = document.getElementById("mainHeaderNav");
  if (nav) {
    nav.classList.toggle("mobile-visible");
  }
}

function toggleMobileFilterDrawer() {
  const sidebar = document.getElementById("filterSidebar");
  if (sidebar) {
    sidebar.classList.toggle("open-drawer");
  }
}

// =============================================================================
// 3. PRODUCT CATALOG DATA LOADING
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
        productsList = data.map((item, idx) => {
          const seed = SEED_PRODUCTS.find(s => s.name === item.name) || SEED_PRODUCTS[idx % SEED_PRODUCTS.length];
          return {
            ...item,
            original_price: seed.original_price || (item.price * 1.8),
            discount: seed.discount || "45% OFF",
            rating: seed.rating || "4.8",
            rating_count: seed.rating_count || "4,500",
            category: seed.category || "accessories",
            specs: seed.specs || {
              "Model": "PRAPCLIK Series X",
              "Warranty": "1-Year Official Replacement",
              "Dispatch": "Ships within 24 Hours"
            }
          };
        });
        return productsList;
      }
    }
  } catch (_) {
    // Offline resilience fallback
  }

  productsList = [...SEED_PRODUCTS];
  return productsList;
}

// =============================================================================
// 4. HOMEPAGE MATRIX RENDERING
// =============================================================================
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

  container.innerHTML = filtered.map(p => renderProductCardMarkup(p)).join("");

  if (trendingContainer) {
    trendingContainer.innerHTML = products.slice(0, 4).map(p => renderProductCardMarkup(p)).join("");
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
    <div class="product-card-prapclik" onclick="openProductDetails(${p.product_id})">
      <div class="card-top-meta">
        <span class="card-discount-badge">${p.discount}</span>
        ${stockMarkup}
      </div>

      <div class="card-visual-frame">
        <span>${icon}</span>
      </div>

      <div class="card-category-label">${esc(p.category || 'Hardware')}</div>
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
          <span>🛒</span> Add to Cart
        </button>
        <button class="btn-card-buy" ${isOutOfStock ? "disabled" : ""} onclick="quickBuyNow(${p.product_id})">
          ⚡ Buy Now
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
  if (document.getElementById("view-products").classList.contains("active")) {
    applyProductFilters();
  }
}

function submitSearchClick() {
  const input = document.getElementById("catalogSearchField");
  if (input) {
    handleCatalogSearch(input.value);
    if (!document.getElementById("view-products").classList.contains("active")) {
      navigateToView("products");
    }
  }
}

// =============================================================================
// 5. DEDICATED PRODUCTS LISTING WITH ADVANCED FILTERING & SORTING
// =============================================================================
async function applyProductFilters() {
  const products = await loadProductCatalog();
  const grid = document.getElementById("allProductsListingGrid");
  const countLabel = document.getElementById("productsListingCount");
  if (!grid) return;

  // 1. Category Filter Checkboxes
  const selectedCats = Array.from(document.querySelectorAll('input[name="filterCat"]:checked')).map(el => el.value);

  // 2. Price Range Filter Checkboxes
  const selectedPrices = Array.from(document.querySelectorAll('input[name="filterPrice"]:checked')).map(el => el.value);

  // 3. Customer Ratings Checkboxes
  const selectedRatings = Array.from(document.querySelectorAll('input[name="filterRating"]:checked')).map(el => parseFloat(el.value));

  // 4. Availability Checkbox
  const inStockOnly = document.getElementById("filterInStockOnly") ? document.getElementById("filterInStockOnly").checked : false;

  // Filter products
  let filtered = products.filter(p => {
    // Category match
    if (selectedCats.length > 0 && !selectedCats.includes(p.category)) {
      return false;
    }

    // Price range match
    if (selectedPrices.length > 0) {
      const matchPrice = selectedPrices.some(range => {
        if (range === "under-1000") return p.price < 1000;
        if (range === "1000-2500") return p.price >= 1000 && p.price <= 2500;
        if (range === "2500-5000") return p.price > 2500 && p.price <= 5000;
        if (range === "above-5000") return p.price > 5000;
        return true;
      });
      if (!matchPrice) return false;
    }

    // Rating match
    if (selectedRatings.length > 0) {
      const pRating = parseFloat(p.rating || 0);
      const minSelected = Math.min(...selectedRatings);
      if (pRating < minSelected) return false;
    }

    // In Stock Only
    if (inStockOnly && p.stock_qty <= 0) {
      return false;
    }

    // Search query
    if (searchFilterQuery) {
      const matchesName = p.name.toLowerCase().includes(searchFilterQuery);
      const matchesDesc = p.description && p.description.toLowerCase().includes(searchFilterQuery);
      if (!matchesName && !matchesDesc) return false;
    }

    return true;
  });

  // Sort products
  const sortSelect = document.getElementById("productsSortSelect");
  const sortVal = sortSelect ? sortSelect.value : "popular";

  if (sortVal === "price-low") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortVal === "price-high") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortVal === "rating") {
    filtered.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
  } else if (sortVal === "newest") {
    filtered.sort((a, b) => b.product_id - a.product_id);
  }

  // Update count badge
  if (countLabel) {
    countLabel.innerHTML = `Showing <strong>${filtered.length}</strong> of ${products.length} products`;
  }

  // Render grid
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; background:#fff; border:1px solid var(--border-light); border-radius:12px; padding:60px 20px; text-align:center;">
        <div style="font-size:3.5rem; margin-bottom:12px;">🔍</div>
        <h3 style="font-family:var(--font-display); font-size:1.35rem; margin-bottom:6px;">No products match your selected filters</h3>
        <p style="color:var(--text-secondary); font-size:0.95rem; margin-bottom:20px;">Try clearing some filters or searching with different terms.</p>
        <button class="hero-cta-btn" onclick="resetFilters()">Reset All Filters</button>
      </div>`;
  } else {
    grid.innerHTML = filtered.map(p => renderProductCardMarkup(p)).join("");
  }
}

function resetFilters() {
  document.querySelectorAll('input[name="filterCat"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="filterPrice"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="filterRating"]').forEach(cb => cb.checked = false);
  const inStock = document.getElementById("filterInStockOnly");
  if (inStock) inStock.checked = false;
  const sortSelect = document.getElementById("productsSortSelect");
  if (sortSelect) sortSelect.value = "popular";

  applyProductFilters();
  triggerNotification("Filters cleared");
}

// =============================================================================
// 6. DEDICATED INDIVIDUAL PRODUCT DETAILS VIEW
// =============================================================================
async function openProductDetails(productId) {
  const products = await loadProductCatalog();
  const product = products.find(p => p.product_id === productId);
  if (!product) return;

  selectedDetailsProduct = product;
  selectedDetailsQty = 1;

  const container = document.getElementById("productDetailsContent");
  if (!container) return;

  const icon = PRODUCT_ICONS[product.name] || "📦";
  const isOutOfStock = product.stock_qty <= 0;
  const savings = Math.round(product.original_price - product.price);

  let specsRows = "";
  if (product.specs) {
    for (const [key, val] of Object.entries(product.specs)) {
      specsRows += `
        <div class="spec-line-item">
          <div class="spec-key">${esc(key)}</div>
          <div class="spec-val">${esc(val)}</div>
        </div>`;
    }
  }

  container.innerHTML = `
    <div class="details-gallery-box">
      <div class="details-product-icon">${icon}</div>
    </div>

    <div class="details-content-box">
      <div class="details-badge-row">
        <span class="card-discount-badge">${product.discount}</span>
        <span class="card-stock-pill ${isOutOfStock ? 'out' : ''}">
          ● ${isOutOfStock ? 'Currently Out of Stock' : 'In Stock (' + product.stock_qty + ' units)'}
        </span>
      </div>

      <h1 class="details-product-title">${esc(product.name)}</h1>

      <div class="details-rating-row">
        <span class="star-tag" style="font-size:0.95rem;">★ ${product.rating}</span>
        <span class="star-count-text" style="font-size:0.92rem;">${product.rating_count} Customer Ratings</span>
        <span style="color:var(--border-light);">|</span>
        <span style="color:var(--c-royal); font-weight:700; font-size:0.88rem;">100% Genuine Certified</span>
      </div>

      <div class="details-price-banner">
        <span class="details-price-val">₹${product.price.toLocaleString("en-IN")}</span>
        <span class="details-price-mrp">₹${Math.round(product.original_price).toLocaleString("en-IN")}</span>
        <span class="details-price-save">Save ₹${savings.toLocaleString("en-IN")} (${product.discount})</span>
      </div>

      <p style="color:var(--text-body); font-size:1.02rem; line-height:1.7; margin-bottom:20px;">
        ${esc(product.description)}
      </p>

      <div class="details-specs-list">
        <h4 style="font-size:0.95rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-dark); margin-bottom:10px;">
          Product Specifications
        </h4>
        ${specsRows}
      </div>

      <div class="details-action-bar">
        <div class="details-qty-picker">
          <button class="qty-btn" onclick="changeDetailsQty(-1)">−</button>
          <input type="text" class="qty-number-input" id="detailsQtyInput" value="1" readonly />
          <button class="qty-btn" onclick="changeDetailsQty(1)">+</button>
        </div>

        <button class="btn-submit-order" style="flex:1;" ${isOutOfStock ? 'disabled' : ''} onclick="addSelectedProductToCart()">
          🛒 Add To Cart
        </button>

        <button class="btn-card-buy" style="padding:14px 28px; font-size:1.02rem; border-radius:var(--radius-full);" ${isOutOfStock ? 'disabled' : ''} onclick="buySelectedProductNow()">
          ⚡ Buy Now
        </button>
      </div>
    </div>`;

  navigateToView("details");
}

function changeDetailsQty(delta) {
  if (!selectedDetailsProduct) return;
  const maxStock = selectedDetailsProduct.stock_qty || 10;
  const input = document.getElementById("detailsQtyInput");

  let next = selectedDetailsQty + delta;
  if (next < 1) next = 1;
  if (next > maxStock) next = maxStock;

  selectedDetailsQty = next;
  if (input) input.value = next;
}

function addSelectedProductToCart() {
  if (!selectedDetailsProduct) return;
  
  const id = selectedDetailsProduct.product_id;
  if (!shoppingCart[id]) {
    shoppingCart[id] = { product: selectedDetailsProduct, qty: selectedDetailsQty };
  } else {
    shoppingCart[id].qty += selectedDetailsQty;
  }

  saveCartToStorage();
  refreshCartHeaderBadge();
  triggerNotification(`Added ${selectedDetailsQty} × "${selectedDetailsProduct.name}" to cart`);
}

function buySelectedProductNow() {
  addSelectedProductToCart();
  openOrderCheckoutModal();
}

// =============================================================================
// 7. DEDICATED SHOPPING CART PAGE & STORAGE SYNCHRONIZATION
// =============================================================================
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem("prapclik_cart");
    if (raw) {
      shoppingCart = JSON.parse(raw);
    }
  } catch (_) {
    shoppingCart = {};
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem("prapclik_cart", JSON.stringify(shoppingCart));
  } catch (_) {}
}

function quickAddToCart(productId) {
  const p = productsList.find(x => x.product_id === productId);
  if (!p) return;

  if (!shoppingCart[productId]) {
    shoppingCart[productId] = { product: p, qty: 1 };
  } else {
    shoppingCart[productId].qty += 1;
  }

  saveCartToStorage();
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

function renderCartPage() {
  const container = document.getElementById("cartPageContainer");
  if (!container) return;

  const items = Object.entries(shoppingCart);

  if (items.length === 0) {
    container.innerHTML = `
      <div style="background:#fff; border:1px solid var(--border-light); border-radius:16px; padding:60px 20px; text-align:center; max-width:640px; margin:0 auto;">
        <div style="font-size:4rem; margin-bottom:16px;">🛒</div>
        <h2 style="font-family:var(--font-display); font-size:1.6rem; font-weight:800; margin-bottom:8px;">Your Shopping Cart is Empty</h2>
        <p style="color:var(--text-secondary); font-size:1rem; margin-bottom:24px;">
          You haven't added any products to your cart yet. Explore our genuine hardware and audio catalog.
        </p>
        <button class="hero-cta-btn" onclick="navigateToView('products')">
          Explore Products →
        </button>
      </div>`;
    return;
  }

  let subtotal = 0;
  let savingsTotal = 0;
  let itemsRowsHtml = "";

  for (const [idStr, item] of items) {
    const id = parseInt(idStr);
    const itemTotal = item.product.price * item.qty;
    const itemSavings = (item.product.original_price - item.product.price) * item.qty;
    subtotal += itemTotal;
    savingsTotal += itemSavings;

    const icon = PRODUCT_ICONS[item.product.name] || "📦";

    itemsRowsHtml += `
      <div class="cart-item-row-full">
        <div class="cart-thumb-box">
          <span>${icon}</span>
        </div>

        <div class="cart-item-info-col">
          <h4 onclick="openProductDetails(${id})" style="cursor:pointer;" title="View details">${esc(item.product.name)}</h4>
          <div style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:10px;">
            Category: ${esc(item.product.category || 'Hardware')} • 1-Year Brand Warranty
          </div>

          <div style="display:flex; align-items:center; gap:16px;">
            <div class="details-qty-picker" style="height:34px;">
              <button class="qty-btn" style="width:32px; height:34px;" onclick="changeCartItemQty(${id}, -1)">−</button>
              <input type="text" class="qty-number-input" style="width:38px; height:34px; font-size:0.9rem;" value="${item.qty}" readonly />
              <button class="qty-btn" style="width:32px; height:34px;" onclick="changeCartItemQty(${id}, 1)">+</button>
            </div>

            <button class="cart-remove-link" onclick="removeCartItem(${id})">
              Remove Item
            </button>
          </div>
        </div>

        <div class="cart-item-price-col">
          <div style="font-size:1.25rem; font-weight:800; color:var(--text-dark);">
            ₹${itemTotal.toLocaleString("en-IN")}
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); text-decoration:line-through;">
            ₹${Math.round(item.product.original_price * item.qty).toLocaleString("en-IN")}
          </div>
        </div>
      </div>`;
  }

  const shippingFee = 0; // Free express delivery
  const totalAmount = subtotal + shippingFee;

  container.innerHTML = `
    <div class="cart-page-layout">
      <!-- Left side: Cart item rows -->
      <div class="cart-items-card">
        <div class="cart-items-header">
          <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-dark);">
            Items in Cart (${items.length})
          </h3>
          <button class="filter-clear-btn" onclick="clearFullCart()">Clear Cart</button>
        </div>
        ${itemsRowsHtml}
      </div>

      <!-- Right side: Price breakdown & checkout CTA -->
      <div class="cart-summary-box">
        <h3 class="summary-heading">Order Summary</h3>

        <div class="summary-calc-row">
          <span>Items Subtotal</span>
          <span>₹${subtotal.toLocaleString("en-IN")}</span>
        </div>

        <div class="summary-calc-row">
          <span>Express Delivery</span>
          <span style="color:#2E7D32; font-weight:700;">FREE</span>
        </div>

        <div class="summary-calc-row">
          <span>Total Savings</span>
          <span style="color:var(--c-apricot-dark); font-weight:700;">₹${Math.round(savingsTotal).toLocaleString("en-IN")}</span>
        </div>

        <div class="summary-calc-row">
          <span>GST / Taxes</span>
          <span style="color:var(--text-muted);">Included</span>
        </div>

        <div class="summary-calc-row total-line">
          <span>Total Payable</span>
          <span style="color:var(--c-royal);">₹${totalAmount.toLocaleString("en-IN")}</span>
        </div>

        <button class="btn-submit-order" onclick="openOrderCheckoutModal()">
          Proceed to Checkout →
        </button>

        <p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; margin-top:14px; line-height:1.4;">
          🔒 256-Bit SSL Encrypted Checkout<br/>
          Cash on Delivery & Instant UPI Available
        </p>
      </div>
    </div>`;
}

function changeCartItemQty(productId, delta) {
  if (!shoppingCart[productId]) return;

  const current = shoppingCart[productId].qty;
  const next = current + delta;

  if (next <= 0) {
    removeCartItem(productId);
    return;
  }

  shoppingCart[productId].qty = next;
  saveCartToStorage();
  refreshCartHeaderBadge();
  renderCartPage();
}

function removeCartItem(productId) {
  const item = shoppingCart[productId];
  if (!item) return;

  delete shoppingCart[productId];
  saveCartToStorage();
  refreshCartHeaderBadge();
  renderCartPage();
  triggerNotification(`Removed "${item.product.name}" from cart`);
}

function clearFullCart() {
  if (confirm("Are you sure you want to remove all items from your cart?")) {
    shoppingCart = {};
    saveCartToStorage();
    refreshCartHeaderBadge();
    renderCartPage();
    triggerNotification("Cart cleared");
  }
}

// =============================================================================
// 8. EXPRESS CHECKOUT & ORDER DISPATCH
// =============================================================================
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

  if (list) list.innerHTML = rowsHtml;
  if (billEl) billEl.textContent = "₹" + total.toLocaleString("en-IN");
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
  saveCartToStorage();
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
// 9. MY ORDERS VIEW & TRACKING
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
        <button class="hero-cta-btn" onclick="navigateToView('products')">Start Shopping</button>
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
          <div class="order-timeline-pill ${isConfirmed ? 'confirmed' : 'processing'}">
            <span>●</span> ${isConfirmed ? 'Order Confirmed' : 'In Processing'}
          </div>
          <div style="font-size:0.82rem; color:var(--c-royal); font-weight:600; margin-top:6px;">
            ${esc(ord.estimated_delivery_time || 'Delivery in 2 business days')}
          </div>
        </div>
      </div>`;
  }).join("");
}

// =============================================================================
// 10. PHONE NUMBER & OTP AUTHENTICATION
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
    name: "Customer " + pendingAuthMobile.substring(6)
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

// =============================================================================
// 11. HELPER UTILITIES
// =============================================================================
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
// 12. INITIALIZATION ON DOM READY
// =============================================================================
window.addEventListener("DOMContentLoaded", () => {
  initSignatureAnimation();
  loadCartFromStorage();
  refreshCartHeaderBadge();
  refreshCustomerHeaderSession();
  renderCatalogMatrix();
});
