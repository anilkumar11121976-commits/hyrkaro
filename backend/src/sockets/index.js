import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from '../utils/helpers.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';

let io = null;
const online = new Map(); // userId -> number of sockets on THIS process

export const isOnline = (userId) => (online.get(String(userId)) || 0) > 0;

/**
 * Report M10: with more than one backend instance, rooms must be shared.
 * Set REDIS_URL and the adapter is attached; without it the server runs
 * single-instance exactly as before.
 */
async function attachAdapter(server) {
  if (!env.redisUrl) return;
  try {
    const [{ createAdapter }, { createClient }] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('redis'),
    ]);
    const pub = createClient({ url: env.redisUrl });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    server.adapter(createAdapter(pub, sub));
    console.log('[socket] Redis adapter attached');
  } catch (e) {
    console.warn('[socket] Redis adapter not attached:', e.message);
    console.warn('[socket] Running single-instance. Install @socket.io/redis-adapter + redis to scale out.');
  }
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrls, credentials: true },
    pingInterval: 25000,
    pingTimeout: 20000,
  });
  attachAdapter(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('_id role isBlocked name');
      if (!user || user.isBlocked) return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = String(socket.user._id);
    socket.join(`user:${uid}`);
    online.set(uid, (online.get(uid) || 0) + 1);
    if (online.get(uid) === 1) announcePresence(uid, true);

    socket.on('conversation:join', async (conversationId, ack) => {
      try {
        const conv = await Conversation.findById(conversationId).select('client freelancer');
        if (!conv || !conv.hasMember(uid)) return ack?.({ ok: false });
        socket.join(`conv:${conversationId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('conversation:leave', (conversationId) => socket.leave(`conv:${conversationId}`));

    socket.on('typing', async ({ conversationId, typing } = {}) => {
      if (!conversationId || !socket.rooms.has(`conv:${conversationId}`)) return;
      socket.to(`conv:${conversationId}`).emit('typing', { conversationId, userId: uid, typing: Boolean(typing) });
    });

    socket.on('disconnect', async () => {
      const n = (online.get(uid) || 1) - 1;
      if (n <= 0) {
        online.delete(uid);
        announcePresence(uid, false);
        User.updateOne({ _id: uid }, { lastSeenAt: new Date() }).catch(() => {});
      } else online.set(uid, n);
    });
  });

  return io;
}

/**
 * Report H2: presence goes only to the people this user actually chats with,
 * not to every socket on the server.
 */
async function announcePresence(userId, isUp) {
  if (!io) return;
  try {
    const convs = await Conversation.find({ $or: [{ client: userId }, { freelancer: userId }] })
      .select('client freelancer')
      .limit(200)
      .lean();
    const peers = new Set();
    for (const c of convs) {
      const other = String(c.client) === String(userId) ? c.freelancer : c.client;
      if (other) peers.add(String(other));
    }
    if (!peers.size) return;
    const payload = { userId: String(userId), online: isUp, at: new Date().toISOString() };
    for (const p of peers) io.to(`user:${p}`).emit('presence', payload);
  } catch (e) {
    console.warn('[socket] presence fan-out failed:', e.message);
  }
}

export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  const seen = new Set();
  for (const id of userIds) {
    const key = String(id?._id || id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    io.to(`user:${key}`).emit(event, payload);
  }
}

export function emitToConversation(conversationId, event, payload) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit(event, payload);
}

export const getIO = () => io;
