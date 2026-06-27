// src/providers/websocket/socket-server.js — inicialização e API do Socket.io.
// Encapsula o servidor de WebSocket para que services emitam eventos sem
// conhecer detalhes de transporte. Persistência de presença em WebSocketConnection.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.WS_CORS_ORIGIN, credentials: true },
  });

  // Autenticação do handshake via JWT (token em auth.token).
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('UNAUTHORIZED'));
      const payload = jwt.verify(token, env.JWT_SECRET);
      socket.userId = payload.sub;
      return next();
    } catch (err) {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket) => {
    // Cada usuário entra numa "room" própria -> envio direcionado por user_id.
    socket.join(`user:${socket.userId}`);
    await persistConnection(socket).catch((e) => console.error('[ws] persist', e));

    socket.on('disconnect', async () => {
      await closeConnection(socket).catch((e) => console.error('[ws] close', e));
    });
  });

  console.log('[ws] Socket.io inicializado.');
  return io;
}

// Persistência opcional de presença (carregada de forma tardia para evit
// dependência circular com models -> sequelize no boot).
async function persistConnection(socket) {
  const { WebSocketConnection } = require('../../models');
  await WebSocketConnection.create({
    userId: socket.userId,
    socketId: socket.id,
    isActive: true,
  });
}

async function closeConnection(socket) {
  const { WebSocketConnection } = require('../../models');
  await WebSocketConnection.update(
    { isActive: false, disconnectedAt: new Date() },
    { where: { socketId: socket.id } },
  );
}

// Emite um evento para todas as conexões de um usuário.
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function getIO() {
  if (!io) throw new Error('Socket.io ainda não inicializado.');
  return io;
}

module.exports = { initSocket, emitToUser, getIO };
