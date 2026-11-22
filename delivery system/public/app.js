// public/app.js - Mobile-Optimized Full Simulation Controller

// Global Application State
let state = {
  city: null,
  config: { speedMultiplier: 1, weather: 'CLEAR', traffic: 'MODERATE', autoOrderEnabled: false },
  metrics: { totalOrdersPlaced: 0, totalOrdersDelivered: 0, totalRevenue: 0, totalRiderPayout: 0 },
  restaurants: [],
  riders: [],
  customers: [],
  orders: [],
  recentEvents: []
};

let currentTab = 'customer';
let selectedCuisine = 'ALL';
let activeRestaurantModal = null;
let selectedRestaurantForKOT = null;
let selectedRiderId = null;
let activeKOTMobileLane = 'INCOMING';

// Cart State
let cart = {
  restaurant: null,
  items: [], // { id, name, price, veg, quantity }
  appliedCoupon: null,
  discountAmount: 0
};

// Web Audio API Synthesizer
let soundEnabled = true;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;

    if (type === 'ORDER_PLACED') {
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.setValueAtTime(783.99, now + 0.12);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);
    } else if (type === 'DELIVERED') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
    } else if (type === 'DISPATCH') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (err) {
    console.warn('Audio error', err);
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-icon').textContent = soundEnabled ? '🔊' : '🔇';
}

// -------------------------------------------------------------
// REAL-TIME SERVER-SENT EVENTS (SSE)
// -------------------------------------------------------------
function setupSSE() {
  const eventSource = new EventSource('/api/events');

  eventSource.onopen = () => {
    const el = document.getElementById('connection-status');
    if (el) {
      el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live SSE`;
      el.className = 'inline-flex items-center gap-1 text-emerald-600 font-semibold';
    }
  };

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'STATE_UPDATE' || data.type === 'INIT') {
        const previousOrders = state.orders;
        state = { ...state, ...data.state };

        // Celebrate delivery chime
        if (previousOrders && previousOrders.length) {
          data.state.orders.forEach(newOrd => {
            const oldOrd = previousOrders.find(o => o.id === newOrd.id);
            if (oldOrd && oldOrd.status !== 'DELIVERED' && newOrd.status === 'DELIVERED') {
              playSound('DELIVERED');
            }
          });
        }

        renderUI();
      } else if (data.type === 'ORDER_PLACED') {
        playSound('ORDER_PLACED');
        state = { ...state, ...data.state };
        renderUI();
      }
    } catch (err) {
      console.error('SSE Error', err);
    }
  };

  eventSource.onerror = () => {
    const el = document.getElementById('connection-status');
    if (el) {
      el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Reconnecting`;
      el.className = 'inline-flex items-center gap-1 text-amber-600 font-semibold';
    }
  };
}

async function fetchInitialState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    state = data;
    if (state.restaurants?.length) selectedRestaurantForKOT = state.restaurants[0].id;
    if (state.riders?.length) selectedRiderId = state.riders[0].id;
    renderUI();
  } catch (err) {
    console.error('Fetch state error', err);
  }
}

// -------------------------------------------------------------
// RESPONSIVE TAB & BOTTOM NAVIGATION
// -------------------------------------------------------------
function switchTab(tab) {
  currentTab = tab;

  // Toggle sections
  ['customer', 'restaurant', 'rider', 'ops'].forEach(t => {
    const el = document.getElementById(`view-${t}`);
    const deskBtn = document.getElementById(`tab-btn-${t}`);
    const mobBtn = document.getElementById(`mob-nav-${t}`);

    if (t === tab) {
      el?.classList.remove('hidden');
      deskBtn?.classList.add('active');
      if (mobBtn) {
        mobBtn.classList.add('active', 'text-orange-600');
        mobBtn.classList.remove('text-slate-500');
      }
    } else {
      el?.classList.add('hidden');
      deskBtn?.classList.remove('active');
      if (mobBtn) {
        mobBtn.classList.remove('active', 'text-orange-600');
        mobBtn.classList.add('text-slate-500');
      }
    }
  });

  // Scroll to top on tab switch for smooth mobile UX
  window.scrollTo({ top: 0, behavior: 'smooth' });

  renderUI();
}

// -------------------------------------------------------------
// CUSTOMER APP LOGIC
// -------------------------------------------------------------
function filterCuisine(cuisine) {
  selectedCuisine = cuisine;
  document.querySelectorAll('.cuisine-btn').forEach(btn => {
    if (btn.dataset.cuisine === cuisine) {
      btn.className = 'cuisine-btn active px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold transition shadow-sm shrink-0';
    } else {
      btn.className = 'cuisine-btn px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition shrink-0';
    }
  });
  renderRestaurants();
}

function renderRestaurants() {
  const grid = document.getElementById('restaurants-grid');
  if (!grid || !state.restaurants) return;

  const vegOnly = document.getElementById('veg-only-filter')?.checked || false;

  let filtered = state.restaurants.filter(r => {
    if (selectedCuisine !== 'ALL' && !r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase())) {
      return false;
    }
    if (vegOnly && !r.menu.some(m => m.veg)) {
      return false;
    }
    return true;
  });

  const countText = `${filtered.length} outlets open now`;
  const countEl = document.getElementById('restaurants-count');
  const countMobileEl = document.getElementById('restaurants-count-mobile');
  if (countEl) countEl.textContent = countText;
  if (countMobileEl) countMobileEl.textContent = countText;

  grid.innerHTML = filtered.map(r => `
    <div onclick="openMenuModal('${r.id}')" class="restaurant-card bg-white rounded-2xl border border-slate-200/90 overflow-hidden cursor-pointer group flex flex-col justify-between">
      <div>
        <div class="relative h-36 sm:h-44 overflow-hidden bg-slate-100">
          <img src="${r.image}" alt="${r.name}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
          
          <div class="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white">
            <span class="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider bg-orange-500 px-2 py-0.5 rounded-md shadow-sm">
              ${r.category}
            </span>
            <span class="text-[10px] sm:text-xs font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md">
              ⚡ ${r.prepTimeMinutes + 12} mins
            </span>
          </div>
        </div>

        <div class="p-3 sm:p-4 space-y-1">
          <div class="flex items-center justify-between">
            <h3 class="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-orange-600 transition-colors">${r.name}</h3>
            <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md text-[11px] font-extrabold border border-emerald-200">
              ★ ${r.rating}
            </span>
          </div>
          <p class="text-[11px] sm:text-xs text-slate-500 line-clamp-1">${r.cuisine}</p>
          <div class="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            <span class="truncate max-w-[150px]">📍 ${r.location.address}</span>
            <span class="font-bold text-slate-800">₹${r.priceForTwo} for 2</span>
          </div>
        </div>
      </div>

      <div class="px-3 pb-3 sm:px-4 sm:pb-4">
        <button class="w-full py-2 rounded-xl bg-orange-50 group-hover:bg-orange-500 group-hover:text-white text-orange-600 text-xs font-bold transition-all text-center">
          Browse Menu & Order →
        </button>
      </div>
    </div>
  `).join('');
}

function openMenuModal(restaurantId) {
  const restaurant = state.restaurants.find(r => r.id === restaurantId);
  if (!restaurant) return;

  activeRestaurantModal = restaurant;
  document.getElementById('modal-restaurant-name').textContent = restaurant.name;
  document.getElementById('modal-restaurant-address').textContent = restaurant.location.address;
  document.getElementById('modal-cuisine').textContent = restaurant.cuisine;
  document.getElementById('modal-banner-img').style.backgroundImage = `url('${restaurant.image}')`;

  const list = document.getElementById('modal-menu-list');
  list.innerHTML = restaurant.menu.map(item => {
    const existingInCart = (cart.restaurant?.id === restaurant.id) 
      ? cart.items.find(i => i.id === item.id) 
      : null;
    const qty = existingInCart ? existingInCart.quantity : 0;

    return `
      <div class="flex items-start justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-slate-200 hover:border-orange-200 transition bg-white">
        <div class="space-y-1 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="${item.veg ? 'veg-badge' : 'non-veg-badge'}"></span>
            ${item.bestSeller ? '<span class="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded uppercase">Bestseller</span>' : ''}
          </div>
          <h4 class="font-bold text-xs sm:text-sm text-slate-900">${item.name}</h4>
          <span class="font-extrabold text-xs sm:text-sm text-slate-800">₹${item.price}</span>
          <p class="text-[11px] text-slate-500 leading-snug line-clamp-2">${item.description}</p>
        </div>

        <div class="flex flex-col items-center gap-1.5 shrink-0">
          ${qty === 0 ? `
            <button onclick="addToCart('${restaurant.id}', '${item.id}')" class="px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl border border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white font-extrabold text-xs transition shadow-sm active:scale-95">
              ADD +
            </button>
          ` : `
            <div class="flex items-center bg-orange-500 text-white rounded-xl shadow-sm overflow-hidden text-xs font-bold">
              <button onclick="updateCartQuantity('${item.id}', -1)" class="px-2 py-1 hover:bg-orange-600 transition">-</button>
              <span class="px-2 font-mono">${qty}</span>
              <button onclick="updateCartQuantity('${item.id}', 1)" class="px-2 py-1 hover:bg-orange-600 transition">+</button>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  updateModalCartCount();
  document.getElementById('menu-modal').classList.remove('hidden');
}

function closeMenuModal() {
  document.getElementById('menu-modal').classList.add('hidden');
}

function updateModalCartCount() {
  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  const el = document.getElementById('modal-cart-count');
  if (el) el.textContent = `${count} item${count === 1 ? '' : 's'}`;
}

// -------------------------------------------------------------
// CART & BILLING
// -------------------------------------------------------------
function addToCart(restaurantId, itemId) {
  const restaurant = state.restaurants.find(r => r.id === restaurantId);
  const dish = restaurant?.menu.find(m => m.id === itemId);
  if (!restaurant || !dish) return;

  if (cart.restaurant && cart.restaurant.id !== restaurant.id) {
    if (!confirm(`Your cart already contains items from ${cart.restaurant.name}. Reset cart to order from ${restaurant.name}?`)) {
      return;
    }
    cart.restaurant = restaurant;
    cart.items = [];
    cart.appliedCoupon = null;
  }

  cart.restaurant = restaurant;
  const existing = cart.items.find(i => i.id === dish.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.items.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      veg: dish.veg,
      quantity: 1
    });
  }

  renderCartUI();
  if (activeRestaurantModal?.id === restaurant.id) {
    openMenuModal(restaurant.id);
  }
}

function updateCartQuantity(itemId, delta) {
  const existingIndex = cart.items.findIndex(i => i.id === itemId);
  if (existingIndex === -1) return;

  cart.items[existingIndex].quantity += delta;
  if (cart.items[existingIndex].quantity <= 0) {
    cart.items.splice(existingIndex, 1);
  }

  if (cart.items.length === 0) {
    cart.restaurant = null;
    cart.appliedCoupon = null;
    closeCartDrawer();
  }

  renderCartUI();
  if (activeRestaurantModal) {
    openMenuModal(activeRestaurantModal.id);
  }
}

function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const code = input.value.trim().toUpperCase();
  const msgEl = document.getElementById('coupon-message');

  const itemTotal = cart.items.reduce((sum, it) => sum + it.price * it.quantity, 0);

  if (code === 'SWIGGY50' || code === 'ZOMATO50') {
    cart.appliedCoupon = { code, discount: Math.min(100, Math.round(itemTotal * 0.5)) };
    msgEl.textContent = `🎉 ₹${cart.appliedCoupon.discount} savings applied with ${code}!`;
    msgEl.className = 'text-[11px] font-semibold text-emerald-600 block';
  } else if (code === 'ZOMATOFEAST') {
    if (itemTotal < 400) {
      alert('Minimum order of ₹400 required for ZOMATOFEAST');
      return;
    }
    cart.appliedCoupon = { code, discount: 150 };
    msgEl.textContent = `🎉 Flat ₹150 off applied!`;
    msgEl.className = 'text-[11px] font-semibold text-emerald-600 block';
  } else if (code === 'FREEDEL') {
    cart.appliedCoupon = { code, discount: 35, freeDelivery: true };
    msgEl.textContent = `🎉 Free delivery applied!`;
    msgEl.className = 'text-[11px] font-semibold text-emerald-600 block';
  } else {
    alert('Invalid coupon code. Try SWIGGY50 or ZOMATOFEAST');
    return;
  }

  renderCartUI();
}

function renderCartUI() {
  const floatingBtn = document.getElementById('floating-cart-btn');
  const floatingBadge = document.getElementById('floating-cart-badge');
  const floatingTotal = document.getElementById('floating-cart-total');
  const mobNavBadge = document.getElementById('mob-nav-cart-badge');

  const totalCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const itemTotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);

  if (totalCount > 0) {
    floatingBtn?.classList.remove('hidden');
    if (floatingBadge) floatingBadge.textContent = totalCount;
    if (floatingTotal) floatingTotal.textContent = `₹${itemTotal}`;
    if (mobNavBadge) {
      mobNavBadge.textContent = totalCount;
      mobNavBadge.classList.remove('hidden');
    }
  } else {
    floatingBtn?.classList.add('hidden');
    if (mobNavBadge) mobNavBadge.classList.add('hidden');
  }

  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (cart.items.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 space-y-2">
        <span class="text-4xl block">🍲</span>
        <h4 class="font-bold text-slate-700 text-sm">Your cart is empty</h4>
        <p class="text-xs">Add delicious dishes from Bengaluru's kitchens.</p>
      </div>
    `;
    document.getElementById('cart-checkout-section')?.classList.add('opacity-50', 'pointer-events-none');
    return;
  }

  document.getElementById('cart-checkout-section')?.classList.remove('opacity-50', 'pointer-events-none');

  container.innerHTML = `
    <div class="p-2.5 bg-orange-50 rounded-xl border border-orange-100 flex items-center justify-between mb-2">
      <div>
        <h4 class="font-extrabold text-xs sm:text-sm text-slate-900">${cart.restaurant.name}</h4>
        <p class="text-[10px] sm:text-xs text-slate-500 truncate max-w-[220px]">${cart.restaurant.location.address}</p>
      </div>
      <span class="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Outlet</span>
    </div>

    <div class="divide-y divide-slate-100">
      ${cart.items.map(item => `
        <div class="py-2.5 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="${item.veg ? 'veg-badge' : 'non-veg-badge'}"></span>
            <div>
              <h5 class="text-xs font-bold text-slate-800">${item.name}</h5>
              <span class="text-[10px] text-slate-500">₹${item.price} each</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="flex items-center bg-slate-100 rounded-lg text-xs font-bold">
              <button onclick="updateCartQuantity('${item.id}', -1)" class="px-2 py-0.5 text-slate-600 hover:text-slate-900">-</button>
              <span class="px-1.5 text-slate-900">${item.quantity}</span>
              <button onclick="updateCartQuantity('${item.id}', 1)" class="px-2 py-0.5 text-slate-600 hover:text-slate-900">+</button>
            </div>
            <span class="text-xs font-bold text-slate-900 w-10 text-right">₹${item.price * item.quantity}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const gst = Math.round(itemTotal * 0.05);
  const isSurge = state.config.weather !== 'CLEAR';
  const baseDeliveryFee = cart.appliedCoupon?.freeDelivery ? 0 : (isSurge ? 65 : 35);
  const platformFee = 6;
  const discount = cart.appliedCoupon?.discount || 0;
  const grandTotal = Math.max(0, itemTotal + gst + baseDeliveryFee + platformFee - discount);

  document.getElementById('bill-item-total').textContent = `₹${itemTotal}`;
  document.getElementById('bill-gst').textContent = `₹${gst}`;
  document.getElementById('bill-delivery-fee').textContent = `₹${baseDeliveryFee}`;
  document.getElementById('bill-grand-total').textContent = `₹${grandTotal}`;

  const surgeTag = document.getElementById('bill-surge-tag');
  if (isSurge) surgeTag?.classList.remove('hidden');
  else surgeTag?.classList.add('hidden');

  const discountRow = document.getElementById('bill-discount-row');
  if (discount > 0) {
    discountRow?.classList.remove('hidden');
    document.getElementById('bill-discount').textContent = `-₹${discount}`;
  } else {
    discountRow?.classList.add('hidden');
  }

  const custSelect = document.getElementById('checkout-customer-select');
  if (custSelect && state.customers) {
    custSelect.innerHTML = state.customers.map(c => `
      <option value="${c.id}">${c.name} - ${c.location.address}</option>
    `).join('');
  }
}

function openCartDrawer() {
  closeMenuModal();
  renderCartUI();
  document.getElementById('cart-drawer-overlay').classList.remove('hidden');
  // Handle mobile bottom-sheet vs desktop drawer
  const drawer = document.getElementById('cart-drawer');
  drawer.classList.remove('translate-y-full', 'md:translate-x-full');
}

function closeCartDrawer() {
  document.getElementById('cart-drawer-overlay').classList.add('hidden');
  const drawer = document.getElementById('cart-drawer');
  drawer.classList.add('translate-y-full', 'md:translate-x-full');
}

async function placeOrder() {
  if (!cart.restaurant || cart.items.length === 0) return;

  const customerId = document.getElementById('checkout-customer-select').value;
  const placeBtn = document.getElementById('btn-place-order');
  placeBtn.disabled = true;
  placeBtn.innerHTML = `<span>Processing...</span>`;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: cart.restaurant.id,
        customerId: customerId,
        items: cart.items,
        paymentMethod: 'UPI'
      })
    });
    const data = await res.json();
    if (data.success) {
      playSound('ORDER_PLACED');
      cart = { restaurant: null, items: [], appliedCoupon: null, discountAmount: 0 };
      closeCartDrawer();
      renderCartUI();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert(data.error || 'Failed to place order');
    }
  } catch (err) {
    console.error('Order error', err);
    alert('Network error placing order');
  } finally {
    placeBtn.disabled = false;
    placeBtn.innerHTML = `<span>Place Order Now</span><span>⚡</span>`;
  }
}

// -------------------------------------------------------------
// ACTIVE ORDER TRACKER BANNER (Mobile-Optimized)
// -------------------------------------------------------------
function renderCustomerActiveOrderBanner() {
  const banner = document.getElementById('customer-active-order-banner');
  if (!banner) return;

  const activeOrder = state.orders.find(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  if (!activeOrder) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');

  const steps = [
    { key: 'PLACED', label: 'Placed', icon: '📝' },
    { key: 'PREPARING', label: 'Cooking', icon: '🍳' },
    { key: 'READY_FOR_PICKUP', label: 'Ready', icon: '🛍️' },
    { key: 'OUT_FOR_DELIVERY', label: 'En Route', icon: '🛵' },
    { key: 'DELIVERED', label: 'Delivered', icon: '🎉' }
  ];

  let currentStepIdx = 0;
  if (activeOrder.status === 'ACCEPTED' || activeOrder.status === 'PREPARING') currentStepIdx = 1;
  if (activeOrder.status === 'READY_FOR_PICKUP' || activeOrder.status === 'RIDER_ASSIGNED') currentStepIdx = 2;
  if (activeOrder.status === 'PICKED_UP' || activeOrder.status === 'OUT_FOR_DELIVERY') currentStepIdx = 3;
  if (activeOrder.status === 'DELIVERED') currentStepIdx = 4;

  banner.innerHTML = `
    <div class="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-orange-500/25 shadow-xl space-y-4 sm:space-y-6">
      
      <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div class="space-y-0.5">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span class="text-[10px] sm:text-xs font-bold text-orange-600 uppercase tracking-wider">Live Tracking</span>
            <span class="text-[10px] font-mono bg-slate-100 px-1.5 py-0.2 rounded font-bold text-slate-700">#${activeOrder.id}</span>
          </div>
          <h3 class="text-base sm:text-xl font-extrabold text-slate-900">${activeOrder.restaurantName}</h3>
          <p class="text-[11px] text-slate-500 truncate max-w-[200px] sm:max-w-none">Delivering to: <strong class="text-slate-800">${activeOrder.customerName}</strong></p>
        </div>

        <!-- Secret Delivery OTP -->
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-2 sm:p-3 text-right shrink-0">
          <span class="text-[9px] font-bold text-amber-800 uppercase tracking-wider block">Delivery OTP</span>
          <span class="text-xl sm:text-2xl font-black font-mono text-amber-900 tracking-widest">${activeOrder.otp}</span>
        </div>
      </div>

      <!-- 5-Step Progress Indicators (Scrollable on small mobile) -->
      <div class="grid grid-cols-5 gap-1.5 sm:gap-3">
        ${steps.map((st, idx) => {
          const isDone = idx <= currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          return `
            <div class="flex flex-col items-center text-center p-1.5 sm:p-3 rounded-xl ${isCurrent ? 'bg-orange-50 border border-orange-300 ring-2 ring-orange-400/20' : (isDone ? 'bg-slate-50 border border-slate-200' : 'opacity-40 border border-transparent')}">
              <span class="text-base sm:text-2xl">${st.icon}</span>
              <span class="text-[9px] sm:text-xs font-bold ${isCurrent ? 'text-orange-600' : 'text-slate-800'} mt-0.5">${st.label}</span>
              <span class="text-[8px] sm:text-[10px] font-semibold ${isDone ? 'text-emerald-600' : 'text-slate-400'} hidden sm:block mt-1">
                ${isDone ? '✓ Done' : 'Wait'}
              </span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Rider Info Banner -->
      ${activeOrder.assignedRiderId ? `
        <div class="bg-slate-900 text-white rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-xl font-bold shadow-md shadow-orange-500/30 shrink-0">
              🛵
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="font-extrabold text-xs sm:text-sm">${activeOrder.riderName}</h4>
                <span class="text-[9px] font-bold bg-white/20 px-1.5 py-0.2 rounded-full">★ ${activeOrder.riderRating}</span>
              </div>
              <p class="text-[10px] sm:text-xs text-slate-400 truncate max-w-[160px] sm:max-w-none">${activeOrder.riderVehicle}</p>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-[10px] text-slate-400">ETA</span>
            <div class="text-sm sm:text-base font-black text-emerald-400 font-mono">
              ${activeOrder.status === 'OUT_FOR_DELIVERY' ? `${Math.max(2, Math.round((100 - (activeOrder.transitProgress || 0)) * 0.15))} mins` : 'Pickup'}
            </div>
          </div>
        </div>
      ` : `
        <div class="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center gap-2 border border-slate-200">
          <span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          <span>Assigning nearest delivery partner...</span>
        </div>
      `}

    </div>
  `;
}

// -------------------------------------------------------------
// RESTAURANT PARTNER & KITCHEN (KOT)
// -------------------------------------------------------------
function switchKOTMobileTab(lane) {
  activeKOTMobileLane = lane;
  ['INCOMING', 'PREPARING', 'READY'].forEach(l => {
    const tabBtn = document.getElementById(`kot-m-tab-${l}`);
    const colEl = document.getElementById(`kot-col-${l.toLowerCase()}`);
    if (l === lane) {
      tabBtn?.classList.add('bg-white', 'text-orange-600', 'shadow-sm');
      tabBtn?.classList.remove('text-slate-600');
      colEl?.classList.remove('max-md:hidden');
    } else {
      tabBtn?.classList.remove('bg-white', 'text-orange-600', 'shadow-sm');
      tabBtn?.classList.add('text-slate-600');
      colEl?.classList.add('max-md:hidden');
    }
  });
}

function renderRestaurantDashboard() {
  const selector = document.getElementById('restaurant-selector');
  if (!selector || !state.restaurants.length) return;

  if (selector.children.length === 0) {
    selector.innerHTML = state.restaurants.map(r => `
      <option value="${r.id}">${r.name}</option>
    `).join('');
  }

  selectedRestaurantForKOT = selector.value || state.restaurants[0].id;
  const restaurant = state.restaurants.find(r => r.id === selectedRestaurantForKOT);
  if (!restaurant) return;

  const ordersForThisRest = state.orders.filter(o => o.restaurantId === restaurant.id);
  const incoming = ordersForThisRest.filter(o => o.status === 'PLACED');
  const preparing = ordersForThisRest.filter(o => o.status === 'ACCEPTED' || o.status === 'PREPARING');
  const ready = ordersForThisRest.filter(o => o.status === 'READY_FOR_PICKUP' || o.status === 'RIDER_ASSIGNED' || o.status === 'PICKED_UP' || o.status === 'OUT_FOR_DELIVERY');

  const delivered = ordersForThisRest.filter(o => o.status === 'DELIVERED');
  const revenue = delivered.reduce((s, o) => s + o.pricing.grandTotal, 0);

  document.getElementById('restaurant-outlet-stats').innerHTML = `
    <div class="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
      <span class="text-[11px] text-slate-500 font-semibold">Today's Orders</span>
      <h4 class="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">${ordersForThisRest.length}</h4>
    </div>
    <div class="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
      <span class="text-[11px] text-slate-500 font-semibold">In Kitchen</span>
      <h4 class="text-xl sm:text-2xl font-black text-orange-600 mt-0.5">${preparing.length}</h4>
    </div>
    <div class="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
      <span class="text-[11px] text-slate-500 font-semibold">Delivered</span>
      <h4 class="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">${delivered.length}</h4>
    </div>
    <div class="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
      <span class="text-[11px] text-slate-500 font-semibold">Net Sales</span>
      <h4 class="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">₹${revenue}</h4>
    </div>
  `;

  document.getElementById('kot-count-incoming').textContent = incoming.length;
  document.getElementById('kot-count-preparing').textContent = preparing.length;
  document.getElementById('kot-count-ready').textContent = ready.length;

  // Mobile lane counts
  const incM = document.getElementById('kot-count-incoming-m');
  const prepM = document.getElementById('kot-count-preparing-m');
  const rdyM = document.getElementById('kot-count-ready-m');
  if (incM) incM.textContent = incoming.length;
  if (prepM) prepM.textContent = preparing.length;
  if (rdyM) rdyM.textContent = ready.length;

  renderKOTColumn('kot-list-incoming', incoming, 'INCOMING');
  renderKOTColumn('kot-list-preparing', preparing, 'PREPARING');
  renderKOTColumn('kot-list-ready', ready, 'READY');
}

function renderKOTColumn(containerId, orders, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-6">No tickets in this lane</p>`;
    return;
  }

  container.innerHTML = orders.map(ord => `
    <div class="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm space-y-2.5">
      <div class="flex items-center justify-between pb-2 border-b border-slate-100">
        <span class="text-xs font-mono font-bold text-slate-900">#${ord.id}</span>
        <span class="text-[10px] text-slate-400 font-mono">${new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div class="space-y-1 text-xs">
        ${ord.items.map(it => `
          <div class="flex justify-between text-slate-800">
            <span class="truncate max-w-[170px]">${it.quantity}x ${it.name}</span>
            <span class="font-mono text-slate-500">₹${it.price * it.quantity}</span>
          </div>
        `).join('')}
      </div>

      ${type === 'PREPARING' ? `
        <div class="space-y-1">
          <div class="flex justify-between text-[10px] text-slate-500 font-bold">
            <span>Cooking Progress</span>
            <span>${Math.round(ord.prepProgress || 0)}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-orange-500 transition-all duration-300" style="width: ${ord.prepProgress || 0}%"></div>
          </div>
        </div>
      ` : ''}

      <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        ${type === 'INCOMING' ? `
          <button onclick="triggerOrderAction('${ord.id}', 'accept')" class="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold transition shadow-sm">
            Accept & Cook →
          </button>
        ` : (type === 'PREPARING' ? `
          <button onclick="triggerOrderAction('${ord.id}', 'ready')" class="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition shadow-sm">
            Mark Food Ready ✓
          </button>
        ` : `
          <span class="text-[11px] font-semibold text-slate-600">
            ${ord.assignedRiderId ? `Rider: ${ord.riderName}` : 'Awaiting Rider'}
          </span>
        `)}
      </div>
    </div>
  `).join('');
}

async function triggerOrderAction(orderId, action) {
  try {
    const res = await fetch(`/api/orders/${orderId}/action`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      playSound('DISPATCH');
    }
  } catch (err) {
    console.error('Trigger action error', err);
  }
}

// -------------------------------------------------------------
// RIDER FLEET & DRIVER APP
// -------------------------------------------------------------
function selectRider(riderId) {
  selectedRiderId = riderId;
  const sel = document.getElementById('rider-selector');
  if (sel) sel.value = riderId;
  renderRiderDashboard();
}

function renderRiderDashboard() {
  const selector = document.getElementById('rider-selector');
  if (!selector || !state.riders.length) return;

  if (selector.children.length === 0) {
    selector.innerHTML = state.riders.map(r => `
      <option value="${r.id}">${r.name} (${r.status})</option>
    `).join('');
  }

  selectedRiderId = selector.value || state.riders[0].id;
  const rider = state.riders.find(r => r.id === selectedRiderId);
  if (!rider) return;

  document.getElementById('phone-rider-avatar').textContent = rider.name.split(' ').map(n => n[0]).join('');
  document.getElementById('phone-rider-name').textContent = rider.name;
  document.getElementById('phone-rider-vehicle').textContent = rider.vehicle;
  document.getElementById('phone-rider-earnings').textContent = `₹${rider.earnings || 0}`;

  const phoneTrip = document.getElementById('phone-trip-content');
  if (rider.status === 'IDLE' || !rider.currentOrderId) {
    phoneTrip.innerHTML = `
      <div class="my-auto text-center space-y-2 sm:space-y-3">
        <span class="text-3xl sm:text-4xl block">🛵</span>
        <h5 class="font-extrabold text-xs sm:text-sm text-slate-200">You are Online & Ready</h5>
        <p class="text-[11px] sm:text-xs text-slate-400">Waiting for dispatch algorithm to assign high-priority delivery...</p>
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-bold border border-emerald-500/30">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live GPS Tracking
        </div>
      </div>
    `;
  } else {
    const order = state.orders.find(o => o.id === rider.currentOrderId);
    if (!order) return;

    phoneTrip.innerHTML = `
      <div class="space-y-3 sm:space-y-4">
        <div class="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-700">
          <div>
            <span class="text-[9px] uppercase font-bold text-orange-400 tracking-wider">Active Trip</span>
            <h5 class="text-xs sm:text-sm font-bold text-white">${order.id}</h5>
          </div>
          <span class="text-[10px] sm:text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-emerald-800">
            ₹${45 + Math.round(order.distanceKm * 12)} Payout
          </span>
        </div>

        <div class="space-y-2 sm:space-y-3 text-xs">
          <!-- Step 1: Pickup -->
          <div class="flex items-start gap-2">
            <span class="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">1</span>
            <div>
              <span class="text-[9px] text-slate-400 block uppercase">Pickup</span>
              <strong class="text-white text-xs">${order.restaurantName}</strong>
              <p class="text-[10px] text-slate-400 truncate max-w-[200px]">${order.restaurantLocation.address}</p>
            </div>
          </div>

          <!-- Step 2: Dropoff -->
          <div class="flex items-start gap-2">
            <span class="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">2</span>
            <div>
              <span class="text-[9px] text-slate-400 block uppercase">Drop-off</span>
              <strong class="text-white text-xs">${order.customerName}</strong>
              <p class="text-[10px] text-slate-400 truncate max-w-[200px]">${order.customerLocation.address}</p>
            </div>
          </div>
        </div>

        <!-- Transit Progress Bar -->
        <div class="bg-slate-800 p-2.5 sm:p-3 rounded-xl border border-slate-700/80 space-y-1">
          <div class="flex justify-between text-[10px] text-slate-300">
            <span>${rider.leg === 'TO_RESTAURANT' ? 'Heading to Outlet' : 'Heading to Customer'}</span>
            <span class="font-mono font-bold text-orange-400">${order.transitProgress || 0}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-400 transition-all duration-300" style="width: ${order.transitProgress || 0}%"></div>
          </div>
        </div>
      </div>

      <div class="pt-2 sm:pt-3 border-t border-slate-700 space-y-2">
        ${order.status === 'OUT_FOR_DELIVERY' || order.status === 'PICKED_UP' ? `
          <div class="flex items-center gap-1.5">
            <input type="text" id="phone-otp-input" placeholder="Enter Customer OTP (${order.otp})" class="flex-1 bg-slate-800 text-white text-xs font-mono font-bold px-2.5 py-2 rounded-xl border border-slate-600 focus:outline-none" />
            <button onclick="verifyDeliveryOTP('${order.id}')" class="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition">
              Verify
            </button>
          </div>
        ` : `
          <div class="text-[10px] sm:text-[11px] text-slate-400 text-center py-2 bg-slate-800/80 rounded-xl">
            Autonomous rider navigation active
          </div>
        `}
      </div>
    `;
  }

  // Render Desktop Table
  const tbody = document.getElementById('fleet-table-body');
  if (tbody) {
    tbody.innerHTML = state.riders.map(r => `
      <tr class="hover:bg-slate-50 transition cursor-pointer ${r.id === selectedRiderId ? 'bg-orange-50/50' : ''}" onclick="selectRider('${r.id}')">
        <td class="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full ${r.status === 'IDLE' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}"></span>
          ${r.name}
        </td>
        <td class="py-3 px-3 text-slate-500">${r.vehicle}</td>
        <td class="py-3 px-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${r.status === 'IDLE' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}">
            ${r.status}
          </span>
        </td>
        <td class="py-3 px-3 text-slate-600 font-mono text-[11px]">${r.currentOrderId ? `#${r.currentOrderId}` : 'Idle'}</td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-mono font-bold">${r.battery}%</span>
            <div class="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full ${r.battery > 30 ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${r.battery}%"></div>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 font-semibold text-slate-800">
          ${r.tripsCompleted || 0} trips (₹${r.earnings || 0})
        </td>
      </tr>
    `).join('');
  }

  // Render Mobile Cards
  const mobileCards = document.getElementById('fleet-mobile-cards');
  if (mobileCards) {
    mobileCards.innerHTML = state.riders.map(r => `
      <div onclick="selectRider('${r.id}')" class="p-3 rounded-xl border ${r.id === selectedRiderId ? 'border-orange-500 bg-orange-50/30' : 'border-slate-200 bg-slate-50/50'} cursor-pointer space-y-1.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${r.status === 'IDLE' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}"></span>
            <span class="text-xs font-bold text-slate-900">${r.name}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${r.status === 'IDLE' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}">
            ${r.status}
          </span>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-500">
          <span>${r.vehicle}</span>
          <span class="font-mono font-bold text-slate-800">Bat: ${r.battery}%</span>
        </div>
        <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 font-semibold text-slate-700">
          <span>Task: ${r.currentOrderId ? `#${r.currentOrderId}` : 'None'}</span>
          <span class="text-emerald-700">₹${r.earnings || 0} earned</span>
        </div>
      </div>
    `).join('');
  }
}

async function verifyDeliveryOTP(orderId) {
  const input = document.getElementById('phone-otp-input');
  const otp = input ? input.value.trim() : '';

  try {
    const res = await fetch(`/api/orders/${orderId}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    });
    const data = await res.json();
    if (data.success) {
      playSound('DELIVERED');
      alert('🎉 Order delivered successfully! Customer verified via OTP.');
    } else {
      alert(data.error || 'Invalid OTP code');
    }
  } catch (err) {
    console.error('OTP error', err);
  }
}

// -------------------------------------------------------------
// LIVE CITY CANVAS MAP (Mobile Optimized)
// -------------------------------------------------------------
function drawCityMap() {
  const canvas = document.getElementById('city-map-canvas');
  if (!canvas || !state.city) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const width = rect.width;
  const height = rect.height;

  // Dark City Background
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, width, height);

  // Roads Grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const gridSize = 35;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Ring Road
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.5, Math.min(width, height) * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  // Coordinates projection
  const bounds = state.city.bounds;
  function project(lat, lng) {
    const padding = 35;
    const x = padding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - padding * 2);
    const y = height - (padding + ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - padding * 2));
    return { x, y };
  }

  // Delivery Polylines
  state.orders.forEach(order => {
    if (order.status !== 'DELIVERED' && order.status !== 'CANCELLED') {
      const restPos = project(order.restaurantLocation.lat, order.restaurantLocation.lng);
      const custPos = project(order.customerLocation.lat, order.customerLocation.lng);

      ctx.strokeStyle = 'rgba(234, 88, 12, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(restPos.x, restPos.y);
      ctx.lineTo(custPos.x, custPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (order.riderLocation) {
        const riderPos = project(order.riderLocation.lat, order.riderLocation.lng);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(riderPos.x, riderPos.y);
        ctx.lineTo(order.status === 'OUT_FOR_DELIVERY' ? custPos.x : restPos.x, order.status === 'OUT_FOR_DELIVERY' ? custPos.y : restPos.y);
        ctx.stroke();
      }
    }
  });

  // Customer destinations
  state.customers.forEach(cust => {
    const pos = project(cust.location.lat, cust.location.lng);
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#93c5fd';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText(cust.name.split(' ')[0], pos.x + 7, pos.y + 3);
  });

  // Restaurants
  state.restaurants.forEach(rest => {
    const pos = project(rest.location.lat, rest.location.lng);

    ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fdba74';
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(rest.name.split(' ')[0], pos.x + 8, pos.y + 3);
  });

  // Riders
  state.riders.forEach(rider => {
    const pos = project(rider.location.lat, rider.location.lng);
    const isBusy = rider.status !== 'IDLE';

    if (isBusy) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = isBusy ? '#10b981' : '#64748b';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isBusy ? '#ffffff' : '#94a3b8';
    ctx.font = 'bold 8px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`🛵 ${rider.name.split(' ')[0]}`, pos.x + 6, pos.y - 5);
  });
}

// -------------------------------------------------------------
// EVENT TERMINAL
// -------------------------------------------------------------
function renderEventsTerminal() {
  const terminal = document.getElementById('events-terminal');
  if (!terminal || !state.recentEvents) return;

  terminal.innerHTML = state.recentEvents.map(evt => {
    let badgeColor = 'text-slate-400 bg-slate-800';
    if (evt.category === 'ORDER') badgeColor = 'text-orange-400 bg-orange-950/80';
    if (evt.category === 'DISPATCH') badgeColor = 'text-blue-400 bg-blue-950/80';
    if (evt.category === 'RIDER') badgeColor = 'text-emerald-400 bg-emerald-950/80';
    if (evt.category === 'RESTAURANT') badgeColor = 'text-amber-400 bg-amber-950/80';

    return `
      <div class="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
        <div class="flex items-center justify-between gap-1 mb-0.5">
          <span class="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded ${badgeColor}">${evt.category}</span>
          <span class="text-[9px] text-slate-500">${evt.timestamp}</span>
        </div>
        <p class="text-slate-300 text-[10px] leading-snug">${evt.message}</p>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// SIMULATION TUNING CONTROLS
// -------------------------------------------------------------
async function setSimulationSpeed(speed) {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    if (parseInt(btn.dataset.speed) === speed) {
      btn.className = 'speed-btn px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white font-bold text-orange-600 shadow-sm';
    } else {
      btn.className = 'speed-btn px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-slate-600 hover:text-slate-900';
    }
  });

  await updateSimConfig('speedMultiplier', speed);
}

async function updateSimConfig(key, value) {
  try {
    const res = await fetch('/api/simulation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
    const data = await res.json();
    if (data.success) {
      state.config = data.config;
      renderKPIs();
    }
  } catch (err) {
    console.error('Config error', err);
  }
}

async function triggerAutoOrder() {
  try {
    const res = await fetch('/api/simulation/auto-order', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      playSound('ORDER_PLACED');
    }
  } catch (err) {
    console.error('Auto order error', err);
  }
}

async function resetSimulation() {
  if (!confirm('Reset simulation to initial seed data?')) return;
  try {
    const res = await fetch('/api/simulation/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      state = data.state;
      renderUI();
    }
  } catch (err) {
    console.error('Reset error', err);
  }
}

// -------------------------------------------------------------
// GLOBAL UI RENDER LOOP
// -------------------------------------------------------------
function renderKPIs() {
  const activeOrdersCount = state.orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
  const busyRidersCount = state.riders.filter(r => r.status !== 'IDLE').length;

  const activeEl = document.getElementById('kpi-active-orders');
  const delEl = document.getElementById('kpi-delivered-orders');
  const fleetEl = document.getElementById('kpi-fleet-busy');
  const revEl = document.getElementById('kpi-total-revenue');

  if (activeEl) activeEl.textContent = activeOrdersCount;
  if (delEl) delEl.textContent = state.metrics.totalOrdersDelivered || 0;
  if (fleetEl) fleetEl.textContent = `${busyRidersCount}/${state.riders.length}`;
  if (revEl) revEl.textContent = `₹${state.metrics.totalRevenue || 0}`;

  const weatherIcons = { CLEAR: '☀️', RAIN: '🌧️', STORM: '⛈️' };
  const weatherLabels = { CLEAR: 'Clear', RAIN: 'Rain (+Surge)', STORM: 'Storm' };
  const wIcon = document.getElementById('weather-icon');
  const wText = document.getElementById('weather-text');
  if (wIcon) wIcon.textContent = weatherIcons[state.config.weather] || '☀️';
  if (wText) wText.textContent = weatherLabels[state.config.weather] || 'Clear';

  const weatherSelect = document.getElementById('sim-weather-select');
  if (weatherSelect && weatherSelect.value !== state.config.weather) {
    weatherSelect.value = state.config.weather;
  }
  const trafficSelect = document.getElementById('sim-traffic-select');
  if (trafficSelect && trafficSelect.value !== state.config.traffic) {
    trafficSelect.value = state.config.traffic;
  }
  const autoCheckbox = document.getElementById('sim-auto-order-checkbox');
  if (autoCheckbox) {
    autoCheckbox.checked = state.config.autoOrderEnabled;
  }
}

function renderUI() {
  renderKPIs();

  if (currentTab === 'customer') {
    renderRestaurants();
    renderCustomerActiveOrderBanner();
  } else if (currentTab === 'restaurant') {
    renderRestaurantDashboard();
  } else if (currentTab === 'rider') {
    renderRiderDashboard();
  } else if (currentTab === 'ops') {
    drawCityMap();
    renderEventsTerminal();
  }
}

window.addEventListener('resize', () => {
  if (currentTab === 'ops') {
    drawCityMap();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  fetchInitialState();
  setupSSE();
});
