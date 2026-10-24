// Sends transactional authentication emails (verification, OTP, password reset) through
// Brevo's HTTPS API. HTTPS is used instead of SMTP because Render's free
// tier blocks SMTP ports.
//
// Legacy OTP/reset flows can fall back to logs locally; new-account
// verification requires a real delivery so the UI never claims a false send.
import { env } from "../config/env.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function isEmailDeliveryConfigured() {
  return Boolean(env.brevo.apiKey && env.brevo.fromAddress);
}

async function send({ to, subject, html, devFallbackLabel, devFallbackValue, requireDelivery = false }) {
  if (!isEmailDeliveryConfigured()) {
    if (requireDelivery) throw new Error('Email delivery is not configured');
    console.warn(
      `[mailer] Brevo not configured (BREVO_API_KEY/BREVO_FROM_ADDRESS missing) — not sending "${subject}" to ${to}.\n` +
        `[mailer] ${devFallbackLabel}: ${devFallbackValue}`,
    );
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": env.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: { name: env.brevo.fromName, email: env.brevo.fromAddress },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      // Brevo's message (unverified sender, bad key, daily cap) is more useful than the status.
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Brevo responded ${res.status}`);
    }
  } catch (err) {
    // Verification sends fail explicitly; legacy email flows keep their local fallback.
    console.error(
      `[mailer] Brevo send failed for "${subject}" to ${to}:`,
      err.message,
    );
    if (requireDelivery) throw new Error('Email delivery failed');
    console.warn(`[mailer] ${devFallbackLabel}: ${devFallbackValue}`);
  }
}

export async function sendVerificationEmail(to, verificationUrl) {
  await send({
    to,
    subject: 'Verify your email — Escrit',
    html: `
      <p>Welcome to Escrit. Confirm your email address to finish setting up your account.</p>
      <p><a href="${verificationUrl}">Verify my email</a></p>
      <p>This link expires in 24 hours. If you didn't create an Escrit account, you can ignore this email.</p>
    `,
    requireDelivery: true,
  });
}

export async function sendOtpEmail(to, code) {
  await send({
    to,
    subject: "Verify your email — Escrit",
    html: `
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    `,
    devFallbackLabel: "OTP code",
    devFallbackValue: code,
  });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  await send({
    to,
    subject: "Reset your password — Escrit",
    html: `
      <p>Someone requested a password reset for this account.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a> (expires in 30 minutes).</p>
      <p>If you didn't request this, you can ignore this email — your password won't change.</p>
    `,
    devFallbackLabel: "Reset URL",
    devFallbackValue: resetUrl,
  });
}

export async function sendMessageNotificationEmail(to, { senderName, serviceName, messageText, conversationUrl }) {
  await send({
    to,
    subject: `New message from ${senderName} — Escrit`,
    html: `
      <p>You have a new message from <strong>${escapeHtml(senderName)}</strong> about <strong>${escapeHtml(serviceName)}</strong>.</p>
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #0092A0;background:#f4f7f8">
        ${escapeHtml(messageText)}
      </blockquote>
      <p><a href="${escapeHtml(conversationUrl)}">Open your conversation</a></p>
      <p>You received this email because someone sent you a message on Escrit.</p>
    `,
    devFallbackLabel: 'Message notification',
    devFallbackValue: 'New message (message content omitted)',
  });
}

export async function sendImportantNotificationEmail(to, { subject, title, message, href }) {
  await send({
    to,
    subject,
    html: `
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="${escapeHtml(href)}">Open Escrit</a></p>
      <p>This is an important account update from Escrit.</p>
    `,
    devFallbackLabel: 'Important notification',
    devFallbackValue: title,
  });
}

export async function sendPromotionEmail(to, { subject, title, message, href }) {
  await send({
    to,
    subject,
    html: `
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${href ? `<p><a href="${escapeHtml(href)}">Learn more</a></p>` : ''}
      <p>You receive these emails because you opted in to Escrit promotions. You can turn them off in Notification settings.</p>
    `,
    devFallbackLabel: 'Promotion email',
    devFallbackValue: title,
    requireDelivery: true,
  });
}
