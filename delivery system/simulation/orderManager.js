// simulation/orderManager.js - Order state machine & calculations
import { calculateDistanceKm } from './engine.js';

export class OrderManager {
  constructor(initialOrders = []) {
    this.orders = initialOrders;
    this.orderCounter = 1001;
  }

  createOrder({ restaurant, customer, items, paymentMethod = 'UPI', notes = '', weatherSurge = false }) {
    const id = `ORD-${this.orderCounter++}`;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    let itemTotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const gst = Math.round(itemTotal * 0.05); // 5% GST
    const baseDeliveryFee = 35;
    const distanceKm = calculateDistanceKm(
      restaurant.location.lat,
      restaurant.location.lng,
      customer.location.lat,
      customer.location.lng
    );
    const distanceFee = Math.round(Math.max(0, distanceKm - 2) * 12);
    const surgeFee = weatherSurge ? 30 : 0;
    const deliveryFee = baseDeliveryFee + distanceFee + surgeFee;
    const platformFee = 6;
    const grandTotal = itemTotal + gst + deliveryFee + platformFee;

    const newOrder = {
      id,
      otp,
      status: 'PLACED', // PLACED, ACCEPTED, PREPARING, READY_FOR_PICKUP, RIDER_ASSIGNED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantLocation: restaurant.location,
      customerId: customer.id,
      customerName: customer.name,
      customerLocation: customer.location,
      items: items.map(it => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity || 1,
        veg: it.veg
      })),
      pricing: {
        itemTotal,
        gst,
        deliveryFee,
        surgeFee,
        platformFee,
        grandTotal
      },
      paymentMethod,
      notes,
      assignedRiderId: null,
      riderLocation: null,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      estimatedDeliveryMinutes: Math.max(15, Math.round(restaurant.prepTimeMinutes + distanceKm * 4)),
      timeline: [
        { status: 'PLACED', timestamp: new Date().toISOString(), note: 'Order placed by customer' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prepProgress: 0, // 0 - 100%
      transitProgress: 0 // 0 - 100%
    };

    this.orders.unshift(newOrder);
    return newOrder;
  }

  getOrder(id) {
    return this.orders.find(o => o.id === id);
  }

  updateOrderStatus(id, newStatus, extraData = {}) {
    const order = this.getOrder(id);
    if (!order) return null;

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    Object.assign(order, extraData);

    let note = `Status changed to ${newStatus}`;
    if (newStatus === 'ACCEPTED') note = 'Restaurant confirmed order';
    if (newStatus === 'PREPARING') note = 'Kitchen is preparing food';
    if (newStatus === 'READY_FOR_PICKUP') note = 'Food packaged and ready for pickup';
    if (newStatus === 'RIDER_ASSIGNED') note = `Delivery partner assigned: ${extraData.riderName || 'Rider'}`;
    if (newStatus === 'PICKED_UP') note = 'Order picked up from restaurant';
    if (newStatus === 'OUT_FOR_DELIVERY') note = 'Rider is on the way to delivery address';
    if (newStatus === 'DELIVERED') note = 'Order delivered successfully';
    if (newStatus === 'CANCELLED') note = 'Order was cancelled';

    order.timeline.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      note
    });

    return order;
  }

  getAll() {
    return this.orders;
  }
}
