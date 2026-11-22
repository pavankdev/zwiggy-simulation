// server.js - Node.js Backend Server with REST API & SSE Real-time Updates
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { INITIAL_CITY, INITIAL_RESTAURANTS, INITIAL_RIDERS, INITIAL_CUSTOMERS } from './simulation/data.js';
import { OrderManager } from './simulation/orderManager.js';
import { SimulationEngine } from './simulation/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize State & Engine
let orderManager = new OrderManager();
let simulationEngine = new SimulationEngine({
  city: INITIAL_CITY,
  restaurants: INITIAL_RESTAURANTS,
  riders: INITIAL_RIDERS,
  customers: INITIAL_CUSTOMERS,
  orderManager
});

// Seed an initial demo order so the UI has immediate activity to display
const initialDemoOrder = orderManager.createOrder({
  restaurant: INITIAL_RESTAURANTS[0],
  customer: INITIAL_CUSTOMERS[1],
  items: [
    { ...INITIAL_RESTAURANTS[0].menu[0], quantity: 2 },
    { ...INITIAL_RESTAURANTS[0].menu[2], quantity: 1 }
  ],
  paymentMethod: 'UPI'
});
simulationEngine.logEvent('ORDER', `Initial demo order ${initialDemoOrder.id} placed at ${INITIAL_RESTAURANTS[0].name}`);

// List of connected SSE clients
const sseClients = new Set();

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (err) {
      sseClients.delete(res);
    }
  }
}

// 1-second simulation tick interval
setInterval(() => {
  simulationEngine.tick();
  broadcastSSE({
    type: 'STATE_UPDATE',
    state: simulationEngine.getState()
  });
}, 1000);

// MIME type map for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // --- API ROUTING ---
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // 1. GET /api/state - Current snapshot
    if (req.method === 'GET' && pathname === '/api/state') {
      res.writeHead(200);
      res.end(JSON.stringify(simulationEngine.getState()));
      return;
    }

    // 2. GET /api/events - Server-Sent Events stream
    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`data: ${JSON.stringify({ type: 'INIT', state: simulationEngine.getState() })}\n\n`);

      sseClients.add(res);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 3. POST /api/orders - Create new customer order
    if (req.method === 'POST' && pathname === '/api/orders') {
      try {
        const body = await parseJsonBody(req);
        const { restaurantId, customerId, items, paymentMethod, notes } = body;

        const restaurant = simulationEngine.restaurants.find(r => r.id === restaurantId);
        const customer = simulationEngine.customers.find(c => c.id === customerId) || simulationEngine.customers[0];

        if (!restaurant || !items || !items.length) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid order request: restaurant and items required' }));
          return;
        }

        const isSurge = simulationEngine.config.weather !== 'CLEAR';
        const newOrder = orderManager.createOrder({
          restaurant,
          customer,
          items,
          paymentMethod: paymentMethod || 'UPI',
          notes: notes || '',
          weatherSurge: isSurge
        });

        simulationEngine.logEvent('ORDER', `🛒 Customer ${customer.name} placed order ${newOrder.id} at ${restaurant.name} (₹${newOrder.pricing.grandTotal})`);

        broadcastSSE({
          type: 'ORDER_PLACED',
          order: newOrder,
          state: simulationEngine.getState()
        });

        res.writeHead(201);
        res.end(JSON.stringify({ success: true, order: newOrder }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 4. PATCH /api/orders/:id/action - Manual state progression (Accept, Food Ready, etc.)
    const actionMatch = pathname.match(/^\/api\/orders\/([^/]+)\/action$/);
    if (req.method === 'PATCH' && actionMatch) {
      try {
        const orderId = actionMatch[1];
        const body = await parseJsonBody(req);
        const { action } = body; // 'accept', 'ready', 'cancel'

        const order = orderManager.getOrder(orderId);
        if (!order) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Order not found' }));
          return;
        }

        if (action === 'accept') {
          orderManager.updateOrderStatus(orderId, 'ACCEPTED');
          simulationEngine.logEvent('RESTAURANT', `Chef accepted order ${orderId} at ${order.restaurantName}`);
        } else if (action === 'ready') {
          order.prepProgress = 100;
          orderManager.updateOrderStatus(orderId, 'READY_FOR_PICKUP');
          simulationEngine.logEvent('RESTAURANT', `Order ${orderId} marked ready for pickup by kitchen!`);
        } else if (action === 'cancel') {
          orderManager.updateOrderStatus(orderId, 'CANCELLED');
          simulationEngine.logEvent('ORDER', `Order ${orderId} was cancelled.`);
        }

        broadcastSSE({
          type: 'STATE_UPDATE',
          state: simulationEngine.getState()
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, order: orderManager.getOrder(orderId) }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 5. POST /api/orders/:id/verify-otp - Delivery OTP verification
    const otpMatch = pathname.match(/^\/api\/orders\/([^/]+)\/verify-otp$/);
    if (req.method === 'POST' && otpMatch) {
      try {
        const orderId = otpMatch[1];
        const body = await parseJsonBody(req);
        const order = orderManager.getOrder(orderId);

        if (!order) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Order not found' }));
          return;
        }

        if (order.otp !== String(body.otp).trim()) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Invalid delivery OTP entered' }));
          return;
        }

        simulationEngine.completeDelivery(order.id, order.assignedRiderId);

        broadcastSSE({
          type: 'STATE_UPDATE',
          state: simulationEngine.getState()
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Delivery confirmed with OTP!' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 6. POST /api/simulation/config - Update config (speed, weather, traffic, autoOrder)
    if (req.method === 'POST' && pathname === '/api/simulation/config') {
      try {
        const body = await parseJsonBody(req);
        simulationEngine.updateConfig(body);
        broadcastSSE({
          type: 'CONFIG_UPDATE',
          config: simulationEngine.config,
          state: simulationEngine.getState()
        });
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, config: simulationEngine.config }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 7. POST /api/simulation/auto-order - Generate single test order
    if (req.method === 'POST' && pathname === '/api/simulation/auto-order') {
      const order = simulationEngine.generateRandomOrder();
      broadcastSSE({
        type: 'ORDER_PLACED',
        order,
        state: simulationEngine.getState()
      });
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, order }));
      return;
    }

    // 8. POST /api/simulation/reset - Reset everything
    if (req.method === 'POST' && pathname === '/api/simulation/reset') {
      orderManager = new OrderManager();
      simulationEngine = new SimulationEngine({
        city: INITIAL_CITY,
        restaurants: INITIAL_RESTAURANTS,
        riders: INITIAL_RIDERS,
        customers: INITIAL_CUSTOMERS,
        orderManager
      });
      simulationEngine.logEvent('SYSTEM', 'Simulation reset to fresh factory state');
      broadcastSSE({
        type: 'STATE_UPDATE',
        state: simulationEngine.getState()
      });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, state: simulationEngine.getState() }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
    return;
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routing
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallbackContent) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            res.end(fallbackContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Zwiggy Food Delivery Simulation Server Running!`);
  console.log(`📍 Web Dashboard: http://localhost:${PORT}`);
  console.log(`⚡ REST API & Real-time SSE active`);
  console.log(`=======================================================`);
});
