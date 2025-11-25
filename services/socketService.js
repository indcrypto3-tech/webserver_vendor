let io = null;
const vendorSockets = new Map(); // Map vendorId -> Set of socket IDs

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} - Socket.IO instance
 */
function initializeSocket(server) {
  if (io) {
    return io;
  }

  const socketIO = require('socket.io');
  io = socketIO(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Handle vendor authentication
    socket.on('auth:vendor', (data) => {
      const { vendorId } = data;
      if (!vendorId) {
        socket.emit('auth:error', { message: 'vendorId is required' });
        return;
      }

      // Register vendor socket
      if (!vendorSockets.has(vendorId)) {
        vendorSockets.set(vendorId, new Set());
      }
      vendorSockets.get(vendorId).add(socket.id);
      socket.vendorId = vendorId;

      console.log(`✅ Vendor ${vendorId} authenticated on socket ${socket.id}`);
      socket.emit('auth:success', { vendorId, socketId: socket.id });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      
      // Remove from vendor sockets map
      if (socket.vendorId) {
        const sockets = vendorSockets.get(socket.vendorId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            vendorSockets.delete(socket.vendorId);
          }
        }
      }
    });

    // Handle ping for connection keep-alive
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('✅ Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
  if (!io) {
    console.warn('⚠️  Socket.IO not initialized');
  }
  return io;
}

/**
 * Emit event to specific vendor(s)
 * @param {String|Array<String>} vendorIds - Single vendor ID or array of vendor IDs
 * @param {String} event - Event name
 * @param {Object} data - Event payload
 */
function emitToVendor(vendorIds, event, data) {
  if (!io) {
    console.warn('⚠️  Socket.IO not initialized, cannot emit event');
    return;
  }

  const ids = Array.isArray(vendorIds) ? vendorIds : [vendorIds];
  let totalEmissions = 0;

  ids.forEach(vendorId => {
    const sockets = vendorSockets.get(vendorId.toString());
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        io.to(socketId).emit(event, data);
        totalEmissions++;
      });
      console.log(`📡 Emitted '${event}' to vendor ${vendorId} (${sockets.size} socket(s))`);
    } else {
      console.log(`⚠️  No active sockets for vendor ${vendorId}`);
    }
  });

  return totalEmissions;
}

/**
 * Emit new order event to vendor
 * @param {String} vendorId - Vendor ObjectId
 * @param {Object} order - Order document
 */
function emitNewOrderToVendor(vendorId, order) {
  const payload = {
    orderId: order._id.toString(),
    status: order.status,
    fare: order.fare,
    pickup: {
      lat: order.pickup.coordinates[1],
      lng: order.pickup.coordinates[0],
      address: order.pickup.address,
    },
    drop: {
      lat: order.drop.coordinates[1],
      lng: order.drop.coordinates[0],
      address: order.drop.address,
    },
    items: order.items,
    paymentMethod: order.paymentMethod,
    scheduledAt: order.scheduledAt,
    createdAt: order.createdAt,
  };

  emitToVendor(vendorId, 'order:new', payload);
}

/**
 * Emit order status update event
 * @param {String} vendorId - Vendor ObjectId
 * @param {Object} order - Order document
 * @param {String} status - New status
 */
function emitOrderStatusUpdate(vendorId, order, status) {
  const payload = {
    orderId: order._id.toString(),
    status,
    updatedAt: new Date(),
  };

  emitToVendor(vendorId, 'order:update', payload);
}

/**
 * Broadcast event to all connected sockets
 * @param {String} event - Event name
 * @param {Object} data - Event payload
 */
function broadcastEvent(event, data) {
  if (!io) {
    console.warn('⚠️  Socket.IO not initialized, cannot broadcast');
    return;
  }

  io.emit(event, data);
  console.log(`📡 Broadcasted '${event}' to all connected sockets`);
}

/**
 * Get list of online vendors (vendors with active socket connections)
 * @returns {Array<String>} - Array of vendor IDs
 */
function getOnlineVendors() {
  return Array.from(vendorSockets.keys());
}

/**
 * Check if vendor is online (has active socket connection)
 * @param {String} vendorId - Vendor ObjectId
 * @returns {Boolean}
 */
function isVendorOnline(vendorId) {
  const sockets = vendorSockets.get(vendorId.toString());
  return sockets && sockets.size > 0;
}

module.exports = {
  initializeSocket,
  getIO,
  emitToVendor,
  emitNewOrderToVendor,
  emitOrderStatusUpdate,
  broadcastEvent,
  getOnlineVendors,
  isVendorOnline,
};
