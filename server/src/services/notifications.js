import { Notification } from '../models/Notification.js';
import { sendImportantNotificationEmail } from './mailer.js';

export async function notifyUser({
  io,
  recipientId,
  type,
  title,
  message,
  href,
  dedupeKey,
  email,
}) {
  let notification;
  try {
    notification = await Notification.create({
      recipientId,
      type,
      title,
      message,
      href,
      dedupeKey,
    });
  } catch (error) {
    if (error.code === 11000 && dedupeKey) return null;
    console.error(`[notifications] Could not save "${type}" notification:`, error.message);
  }

  if (notification) {
    io?.to(`user:${recipientId}`).emit('notification:new', {
      notificationId: String(notification._id),
    });
  }

  if (email?.to) {
    void sendImportantNotificationEmail(email.to, {
      subject: email.subject,
      title,
      message,
      href: email.href || href,
    }).catch((error) => console.error(`[notifications] Could not email "${type}" notification:`, error.message));
  }

  return notification;
}

export async function notifyUsers(recipients, event) {
  return Promise.all(recipients.filter(Boolean).map((recipientId) => (
    notifyUser({ ...event, recipientId })
  )));
}
