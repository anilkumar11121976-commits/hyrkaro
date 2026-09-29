import Notification from '../models/Notification.js';
import { emitToUsers } from '../sockets/index.js';

/**
 * PDF §15: every event that needs attention leaves a notification the user can
 * see later, plus a live socket push if they happen to be online.
 * Never throws — a failed notification must not roll back the action.
 */
export async function notify(userId, { type, title, body = '', link = '', meta } = {}) {
  if (!userId || !type || !title) return null;
  try {
    const doc = await Notification.create({ user: userId, type, title, body, link, meta });
    emitToUsers([userId], 'notification:new', {
      _id: String(doc._id),
      type,
      title,
      body,
      link,
      createdAt: doc.createdAt,
    });
    return doc;
  } catch (e) {
    console.warn('[notify] failed:', e.message);
    return null;
  }
}

/** Same notification to several people (e.g. both sides of an order). */
export async function notifyMany(userIds, payload) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  return Promise.all(ids.map((id) => notify(id, payload)));
}

export async function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, readAt: null });
}
