// simulation/engine.js - City Simulation & Dispatch Engine

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function interpolateCoordinates(from, to, fraction) {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction
  };
}

export class SimulationEngine {
  constructor({ city, restaurants, riders, customers, orderManager }) {
    this.city = city;
    this.restaurants = [...restaurants];
    this.riders = JSON.parse(JSON.stringify(riders));
    this.customers = [...customers];
    this.orderManager = orderManager;

    this.config = {
      speedMultiplier: 1, // 1x, 2x, 5x, 10x
      weather: 'CLEAR',   // CLEAR, RAIN, STORM
      traffic: 'MODERATE', // LIGHT, MODERATE, HEAVY
      autoOrderEnabled: false,
      autoOrderIntervalSec: 15,
      isPaused: false
    };

    this.metrics = {
      totalOrdersPlaced: 0,
      totalOrdersDelivered: 0,
      totalRevenue: 0,
      totalRiderPayout: 0,
      avgDeliveryMinutes: 24,
      simulationTicks: 0
    };

    this.events = [];
    this.lastAutoOrderTick = 0;
    this.logEvent('SYSTEM', 'Simulation engine initialized. Ready to accept orders.');
  }

  logEvent(category, message, metadata = {}) {
    const event = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString(),
      category, // 'ORDER', 'DISPATCH', 'RIDER', 'RESTAURANT', 'WEATHER', 'SYSTEM'
      message,
      metadata
    };
    this.events.unshift(event);
    if (this.events.length > 80) this.events.pop();
    return event;
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.logEvent('SYSTEM', `Simulation parameters updated: Weather=${this.config.weather}, Traffic=${this.config.traffic}, Speed=${this.config.speedMultiplier}x`);
  }

  // Get current speed factor based on weather and traffic
  getEffectiveSpeed() {
    let speed = 0.0035 * this.config.speedMultiplier; // base coordinates delta per tick (~200-300m per tick)

    // Weather impact
    if (this.config.weather === 'RAIN') speed *= 0.65;
    if (this.config.weather === 'STORM') speed *= 0.45;

    // Traffic impact
    if (this.config.traffic === 'LIGHT') speed *= 1.3;
    if (this.config.traffic === 'HEAVY') speed *= 0.55;

    return speed;
  }

  // Find nearest idle rider to restaurant
  dispatchRiderForOrder(order) {
    const idleRiders = this.riders.filter(r => r.status === 'IDLE');
    if (idleRiders.length === 0) {
      return null;
    }

    let bestRider = null;
    let minDistance = Infinity;

    for (const rider of idleRiders) {
      const dist = calculateDistanceKm(
        rider.location.lat,
        rider.location.lng,
        order.restaurantLocation.lat,
        order.restaurantLocation.lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        bestRider = rider;
      }
    }

    if (bestRider) {
      bestRider.status = 'PICKING_UP';
      bestRider.currentOrderId = order.id;
      bestRider.targetLocation = { ...order.restaurantLocation };
      bestRider.startLocation = { ...bestRider.location };
      bestRider.leg = 'TO_RESTAURANT';
      bestRider.totalDistance = minDistance;

      this.orderManager.updateOrderStatus(order.id, 'RIDER_ASSIGNED', {
        assignedRiderId: bestRider.id,
        riderName: bestRider.name,
        riderPhone: bestRider.phone,
        riderVehicle: bestRider.vehicle,
        riderRating: bestRider.rating,
        riderLocation: { ...bestRider.location }
      });

      this.logEvent('DISPATCH', `Assigned ${bestRider.name} to ${order.id} (${minDistance.toFixed(1)} km away from ${order.restaurantName})`, {
        orderId: order.id,
        riderId: bestRider.id
      });

      return bestRider;
    }

    return null;
  }

  // Advance simulation by 1 tick
  tick() {
    if (this.config.isPaused) return;

    this.metrics.simulationTicks++;
    const speed = this.getEffectiveSpeed();
    const orders = this.orderManager.getAll();

    // 1. Check for orders that need rider dispatch
    for (const order of orders) {
      if ((order.status === 'ACCEPTED' || order.status === 'PREPARING' || order.status === 'READY_FOR_PICKUP') && !order.assignedRiderId) {
        this.dispatchRiderForOrder(order);
      }

      // Simulate Kitchen Preparation progression
      if (order.status === 'ACCEPTED') {
        this.orderManager.updateOrderStatus(order.id, 'PREPARING');
        this.logEvent('RESTAURANT', `${order.restaurantName} started preparing items for ${order.id}`);
      } else if (order.status === 'PREPARING') {
        const prepIncrement = (100 / (order.estimatedDeliveryMinutes * 0.4)) * this.config.speedMultiplier;
        order.prepProgress = Math.min(100, (order.prepProgress || 0) + prepIncrement);
        if (order.prepProgress >= 100 && order.status !== 'READY_FOR_PICKUP') {
          this.orderManager.updateOrderStatus(order.id, 'READY_FOR_PICKUP');
          this.logEvent('RESTAURANT', `Order ${order.id} is packaged & ready for pickup at ${order.restaurantName}!`);
        }
      }
    }

    // 2. Update Riders in transit
    for (const rider of this.riders) {
      if (rider.status === 'IDLE' || !rider.currentOrderId) continue;

      const order = this.orderManager.getOrder(rider.currentOrderId);
      if (!order) {
        rider.status = 'IDLE';
        rider.currentOrderId = null;
        continue;
      }

      if (rider.leg === 'TO_RESTAURANT') {
        // Move towards restaurant
        const target = order.restaurantLocation;
        const dist = calculateDistanceKm(rider.location.lat, rider.location.lng, target.lat, target.lng);

        if (dist <= 0.05) {
          // Reached restaurant!
          rider.location = { lat: target.lat, lng: target.lng };
          order.riderLocation = { ...rider.location };

          // If food is ready, pick it up; otherwise wait at restaurant
          if (order.prepProgress >= 90 || order.status === 'READY_FOR_PICKUP') {
            rider.leg = 'TO_CUSTOMER';
            rider.status = 'DELIVERING';
            rider.targetLocation = { ...order.customerLocation };
            rider.startLocation = { ...target };

            this.orderManager.updateOrderStatus(order.id, 'PICKED_UP');
            this.orderManager.updateOrderStatus(order.id, 'OUT_FOR_DELIVERY');
            this.logEvent('RIDER', `${rider.name} picked up ${order.id} from ${order.restaurantName} and is en route to customer.`);
          }
        } else {
          // Interpolate position
          const stepRatio = Math.min(1, speed / Math.max(0.1, dist));
          rider.location = interpolateCoordinates(rider.location, target, stepRatio);
          order.riderLocation = { ...rider.location };
        }
      } else if (rider.leg === 'TO_CUSTOMER') {
        // Move towards customer
        const target = order.customerLocation;
        const dist = calculateDistanceKm(rider.location.lat, rider.location.lng, target.lat, target.lng);

        const totalDist = calculateDistanceKm(
          order.restaurantLocation.lat,
          order.restaurantLocation.lng,
          target.lat,
          target.lng
        );
        const covered = Math.max(0, totalDist - dist);
        order.transitProgress = Math.min(100, Math.round((covered / (totalDist || 1)) * 100));

        if (dist <= 0.05) {
          // Arrived at customer location
          rider.location = { lat: target.lat, lng: target.lng };
          order.riderLocation = { ...rider.location };
          order.transitProgress = 100;

          // Complete delivery
          this.completeDelivery(order.id, rider.id);
        } else {
          const stepRatio = Math.min(1, speed / Math.max(0.1, dist));
          rider.location = interpolateCoordinates(rider.location, target, stepRatio);
          order.riderLocation = { ...rider.location };
        }
      }
    }

    // 3. Handle Auto-Order Generation
    if (this.config.autoOrderEnabled) {
      const nowTick = this.metrics.simulationTicks;
      const ticksInterval = Math.max(3, Math.round(this.config.autoOrderIntervalSec / (this.config.speedMultiplier || 1)));
      if (nowTick - this.lastAutoOrderTick >= ticksInterval) {
        this.lastAutoOrderTick = nowTick;
        this.generateRandomOrder();
      }
    }

    // 4. Update aggregated metrics
    const delivered = orders.filter(o => o.status === 'DELIVERED');
    this.metrics.totalOrdersPlaced = orders.length;
    this.metrics.totalOrdersDelivered = delivered.length;
    this.metrics.totalRevenue = orders.reduce((sum, o) => sum + (o.pricing?.grandTotal || 0), 0);
    this.metrics.totalRiderPayout = this.riders.reduce((sum, r) => sum + (r.earnings || 0), 0);
  }

  completeDelivery(orderId, riderId) {
    const order = this.orderManager.getOrder(orderId);
    const rider = this.riders.find(r => r.id === riderId);
    if (!order) return;

    this.orderManager.updateOrderStatus(orderId, 'DELIVERED');

    if (rider) {
      const tripEarnings = 45 + Math.round(order.distanceKm * 12) + (this.config.weather !== 'CLEAR' ? 25 : 0);
      rider.status = 'IDLE';
      rider.currentOrderId = null;
      rider.targetLocation = null;
      rider.startLocation = null;
      rider.earnings = (rider.earnings || 0) + tripEarnings;
      rider.tripsCompleted = (rider.tripsCompleted || 0) + 1;
      rider.battery = Math.max(15, rider.battery - Math.floor(Math.random() * 4 + 2));

      this.logEvent('RIDER', `🎉 ${order.id} delivered by ${rider.name}! Customer OTP verified. Payout: ₹${tripEarnings}`);
    }
  }

  generateRandomOrder() {
    const randomRestaurant = this.restaurants[Math.floor(Math.random() * this.restaurants.length)];
    const randomCustomer = this.customers[Math.floor(Math.random() * this.customers.length)];
    const randomDish = randomRestaurant.menu[Math.floor(Math.random() * randomRestaurant.menu.length)];
    const extraDish = Math.random() > 0.5 ? randomRestaurant.menu[Math.floor(Math.random() * randomRestaurant.menu.length)] : null;

    const items = [{ ...randomDish, quantity: Math.floor(Math.random() * 2) + 1 }];
    if (extraDish && extraDish.id !== randomDish.id) {
      items.push({ ...extraDish, quantity: 1 });
    }

    const isSurge = this.config.weather !== 'CLEAR';
    const order = this.orderManager.createOrder({
      restaurant: randomRestaurant,
      customer: randomCustomer,
      items,
      paymentMethod: Math.random() > 0.4 ? 'UPI' : 'Credit Card',
      weatherSurge: isSurge
    });

    this.logEvent('ORDER', `New Order placed: ${order.id} at ${randomRestaurant.name} by ${randomCustomer.name} (Total: ₹${order.pricing.grandTotal})`);
    return order;
  }

  getState() {
    return {
      city: this.city,
      config: this.config,
      metrics: this.metrics,
      restaurants: this.restaurants,
      riders: this.riders,
      customers: this.customers,
      orders: this.orderManager.getAll(),
      recentEvents: this.events.slice(0, 30)
    };
  }
}
