# 🛵 Zwiggy - Food Delivery System Simulation (Swiggy / Zomato)

An interactive, real-time food delivery simulation platform modeling the full logistics ecosystem of modern hyper-local food delivery services (like **Swiggy** and **Zomato**).

---

## 📱 Mobile Phone & Responsive Compatibility

The platform is designed to look, feel, and function like a native mobile app on smartphones (iOS & Android) as well as desktop screens:

### 1. 📱 Native Mobile App Navigation
- **Sticky Bottom Tab Bar**: Quick thumb-reach navigation between **Food** (Customer App), **Kitchen** (KOT), **Rider** (Fleet), **Live Map** (Operations), and **Cart** (with live quantity badge).
- **Safe Area Insets**: Automatically conforms to mobile screen notches, dynamic islands, and home indicator gestures (`env(safe-area-inset-bottom)`).
- **Touch-Optimized Steppers**: Generous 44px+ tap targets for adding items, incrementing quantities, and verifying OTPs.

### 2. 📑 Bottom Sheet Drawers on Small Screens
- **Restaurant Menu**: On mobile, smoothly slides up as a **Mobile Bottom Sheet** with a drag handle, touch-scrollable dish list, and sticky bottom checkout pill.
- **Cart & Bill Breakdown**: Bottom-sheet checkout drawer with one-tap coupon application (`SWIGGY50`, `ZOMATOFEAST`, `FREEDEL`) and address selector.
- **Floating Cart Pill**: Positioned dynamically above the bottom navigation bar (`bottom-20 right-4`).

### 3. 👨‍🍳 Mobile Kitchen Order Tickets (KOT)
- Horizontal swipeable tabs (`Incoming`, `Cooking`, `Ready`) specifically designed for narrow phone viewports to prevent cramped columns.

### 4. 🛵 Driver Console & Telemetry Cards
- On mobile devices, the driver console expands into a full-bleed smartphone driver app interface.
- Fleet telemetry automatically adapts into touch-friendly rider cards.

---

## 🌟 System Overview & Key Features

### 1. 🍔 Customer App (Swiggy / Zomato Experience)
- **Restaurant Discovery**: Filter by cuisines (*Biryani, Burgers, Pizza, North Indian, Desserts, South Indian*), veg/non-veg toggle, ratings, and preparation time.
- **Interactive Menu**: Realistic dishes with Indian pricing, descriptions, and item quantity steppers.
- **Cart & Bill Breakdown**:
  - Item total, 5% GST, Base delivery fee, Distance fee, Platform fee, and Dynamic Rain Surge surcharge.
  - Coupon codes (`SWIGGY50`, `ZOMATOFEAST`, `FREEDEL`).
- **Live Order Tracking**:
  - 5-step visual order lifecycle: `Order Placed` ➔ `Kitchen Cooking` ➔ `Food Ready` ➔ `Out for Delivery` ➔ `Delivered`.
  - Delivery OTP security code display (e.g. `4821`).
  - Real-time rider avatar, contact, and live ETA countdown.

### 2. 👨‍🍳 Restaurant Partner & Kitchen Dashboard (KOT)
- **Kitchen Order Tickets (KOT)**: Real-time board categorized by *Incoming*, *Kitchen Cooking*, and *Ready for Pickup / Dispatched*.
- **Chef Actions**: `Accept Order`, `Fast-Forward Cooking`, and `Mark Food Ready`.
- **Outlet Metrics**: Real-time sales volume, active kitchen tickets, and outlet revenue.

### 3. 🛵 Delivery Fleet & Rider Mobile App
- **Rider Telemetry**: Monitor battery/fuel percentage, vehicle license plate, customer rating, and total earnings.
- **Mobile Smartphone Mockup**: Experience the driver's perspective with turn-by-turn route legs:
  - Leg 1: Drive to restaurant for pickup.
  - Leg 2: Drive to customer address for drop-off.
  - OTP verification: Enter customer's 4-digit secret PIN to confirm delivery and credit trip payout.

### 4. 🛰️ Central Logistics & City Simulation Engine
- **City Grid Vector Canvas Map**:
  - Models Bengaluru's central tech hub (Koramangala, Indiranagar, Domlur).
  - Real-time coordinates projection with animated motorcycle riders moving along route vectors.
- **Nearest-Neighbor Dispatch Algorithm**:
  - Uses spherical trigonometry (Haversine formula) to dynamically pair orders with the closest idle rider.
- **Chaos & Environmental Factors**:
  - **Weather Simulator**: `Clear`, `Heavy Rain` (+₹30 surge pricing, 35% slower speeds), `Storm` (55% slower).
  - **Traffic Conditions**: `Light`, `Moderate`, `Peak Rush Hour`.
  - **Simulation Speed**: Toggle between `1x`, `2x`, `5x` speed.
  - **Auto Order Generator**: Continuously triggers customer demand to test platform throughput.
- **Event Stream**: Live Server-Sent Events (SSE) audit trail.

---

## 🚀 How to Run the Simulation

### ⚡ Quick Start (Double-Click)
Just double-click **`start.bat`** in this folder!
It will:
1. Start the simulation server
2. Automatically launch your default web browser to **`http://localhost:3000`**

---

### Manual Terminal Command
```bash
node server.js
```
*(Or `npm start`)*

### 2. Open on Desktop or Mobile Phone
- **On this computer**: [http://localhost:3000](http://localhost:3000)
- **On your mobile phone**: Open your phone browser and go to `http://<YOUR_LOCAL_IP>:3000` (while connected to the same WiFi network), or inspect using Chrome DevTools Device Mode (iPhone, Pixel, Galaxy).
