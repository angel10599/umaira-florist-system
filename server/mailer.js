// Umaira Florist outgoing transactional email service. Providers, in order of preference:
// 1. SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, optional SMTP_FROM) — e.g. Gmail with an App Password.
//    Delivers to any recipient without owning a domain.
// 2. Resend API (RESEND_API_KEY, MAIL_FROM). Without a domain verified in Resend, its test sender
//    onboarding@resend.dev can only deliver to the Resend account owner's own address.
// 3. Webhook relay (MAIL_WEBHOOK_URL, optional MAIL_WEBHOOK_TOKEN).
// Test runs (UMAIRA_TEST=1) never send real email.

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_FROM = process.env.MAIL_FROM || 'Umaira Florist Atelier <onboarding@resend.dev>';

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function isConfigured() {
  if (process.env.UMAIRA_TEST === '1') return true;
  if (smtpConfigured()) return true;
  if (process.env.RESEND_API_KEY) return true;
  if (process.env.MAIL_WEBHOOK_URL) return true;
  return false;
}

let smtpTransport = null;
function getSmtpTransport() {
  if (!smtpTransport) {
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 465;
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465 && process.env.SMTP_REQUIRE_TLS !== 'false',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
  }
  return smtpTransport;
}

// Resolves only after the SMTP server has accepted the message for delivery.
async function sendViaSmtp({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || `Umaira Florist <${process.env.SMTP_USER}>`;
  let info;
  try {
    info = await getSmtpTransport().sendMail({ from, to, subject, text, html });
  } catch (e) {
    const err = new Error(`SMTP error${e.responseCode ? ' (' + e.responseCode + ')' : ''}: ${e.message}`);
    err.code = e.code === 'EAUTH' ? 'EMAIL_AUTH_FAILED' : 'EMAIL_SEND_FAILED';
    throw err;
  }
  if (info.rejected && info.rejected.length) {
    const err = new Error('SMTP server rejected the recipient address.');
    err.code = 'EMAIL_RECIPIENT_REJECTED';
    throw err;
  }
  return { delivered: true, via: 'smtp', id: info.messageId };
}

/**
 * Send email via Resend REST API
 */
async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const payload = JSON.stringify({
    from: DEFAULT_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: html || undefined,
    text: text || undefined
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'api.resend.com',
      path: '/emails',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ delivered: true, via: 'resend', id: data });
        } else {
          const err = new Error(`Resend API error (${res.statusCode}): ${data}`);
          // Resend's test sender only reaches the account owner until a domain is verified.
          err.code = res.statusCode === 403 && /only send testing emails/i.test(data) ? 'EMAIL_PROVIDER_RESTRICTED' : 'EMAIL_SEND_FAILED';
          reject(err);
        }
      });
    });

    req.setTimeout(12000, () => req.destroy(new Error('Resend request timed out')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send email via Webhook URL
 */
async function sendViaWebhook({ to, subject, text, html }) {
  const hook = process.env.MAIL_WEBHOOK_URL;
  if (!hook) throw new Error('MAIL_WEBHOOK_URL not set');

  const u = new URL(hook);
  const payload = JSON.stringify({ to, subject, text, html });
  const isHttps = u.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request({
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || (isHttps ? 443 : 80),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(process.env.MAIL_WEBHOOK_TOKEN ? { Authorization: 'Bearer ' + process.env.MAIL_WEBHOOK_TOKEN } : {})
      }
    }, (res) => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode < 300) resolve({ delivered: true, via: 'webhook' });
        else reject(new Error('Webhook returned status ' + res.statusCode));
      });
    });

    req.setTimeout(15000, () => req.destroy(new Error('Webhook timed out')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Universal send router
 */
async function send({ to, subject, text, html }) {
  // Test mode: short-circuit before any real delivery attempt.
  // UMAIRA_TEST is set by the test harness; it must be checked first so that a
  // RESEND_API_KEY in .env is never called against synthetic test addresses.
  if (process.env.UMAIRA_TEST === '1') {
    console.log(`[mail:test] ${subject} -> ${to}`);
    return { delivered: true, via: 'console' };
  }

  if (smtpConfigured()) {
    return sendViaSmtp({ to, subject, text, html });
  }

  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ to, subject, html, text });
  }

  if (process.env.MAIL_WEBHOOK_URL) {
    return sendViaWebhook({ to, subject, text, html });
  }

  const err = new Error('Email delivery service is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY.');
  err.code = 'EMAIL_NOT_CONFIGURED';
  throw err;
}

/**
 * Generate luxury branded Umaira Florist verification email
 */
function buildVerificationEmailHtml({ name, otp }) {
  const safeName = String(name || 'Customer').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const otpChars = String(otp).split('').map(d => `<span style="display:inline-block; width:36px; height:44px; line-height:44px; margin:0 4px; font-size:26px; font-family:'Courier New', monospace; font-weight:bold; color:#1C281F; background:#FFF9F5; border:1px solid #E5ECE6; border-radius:8px; text-align:center;">${d}</span>`).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Your Umaira Florist Verification Code</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#F7FAF8; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#302C2A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7FAF8; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px; background-color:#FFFFFF; border:1px solid #E5ECE6; border-radius:24px; box-shadow:0 12px 32px rgba(48,44,42,0.06); overflow:hidden;">
          
          <!-- Atelier Header -->
          <tr>
            <td style="background-color:#FFF9F5; padding:36px 32px 24px 32px; text-align:center; border-bottom:1px solid #E5ECE6;">
              <span style="font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#647D69; display:block; margin-bottom:6px;">UMAIRA FLORIST ATELIER</span>
              <h1 style="margin:0; font-family:Georgia, serif; font-size:24px; font-weight:700; color:#302C2A;">Email Verification</h1>
              <p style="margin:6px 0 0 0; font-size:12px; color:#6E6864;">Thoughtfully arranged flowers & bespoke bouquets · Manila</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px; text-align:center;">
              <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#302C2A;">
                Hello <strong>${safeName}</strong>,
              </p>
              <p style="margin:0 0 24px 0; font-size:13px; line-height:1.6; color:#55504C;">
                Thank you for creating an account with Umaira Florist Atelier. To complete your registration and activate your customer account, please enter the 6-digit verification code below:
              </p>

              <!-- OTP Box -->
              <div style="margin:28px 0; text-align:center;">
                ${otpChars}
              </div>

              <div style="background-color:#FFF9F5; border:1px solid #F0E6DE; border-radius:12px; padding:12px 16px; margin:24px 0; display:inline-block;">
                <p style="margin:0; font-size:12px; color:#8C3D52; font-weight:600;">
                  ⏱ This code expires in <strong>5 minutes</strong> and can only be used once.
                </p>
              </div>

              <p style="margin:24px 0 0 0; font-size:12px; line-height:1.6; color:#6E6864; text-align:left; border-top:1px solid #F0EDE8; pt-4; padding-top:16px;">
                <strong>Why did you receive this?</strong><br>
                This code was requested to verify the email address for an Umaira Florist customer account. If you did not make this request, you can safely disregard this email — no account will be created without this verification.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#FFF9F5; padding:20px 32px; text-align:center; border-top:1px solid #E5ECE6;">
              <p style="margin:0; font-size:11px; color:#6E6864;">
                &copy; 2026 Umaira Florist Atelier · BGC, Taguig & Metro Manila, Philippines
              </p>
              <p style="margin:4px 0 0 0; font-size:10px; color:#9E9894;">
                Handcrafted daily with fresh blooms. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Build Google login notification email HTML
 */
function buildGoogleLoginEmailHtml({ name, email, loginAt }) {
  const safeName = String(name || 'Customer').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeEmail = String(email || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeDate = String(loginAt || new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'short' }));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New Login to Your Umaira Florist Account</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#F7FAF8; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#302C2A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7FAF8; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px; background-color:#FFFFFF; border:1px solid #E5ECE6; border-radius:24px; box-shadow:0 12px 32px rgba(48,44,42,0.06); overflow:hidden;">
          <tr>
            <td style="background-color:#FFF9F5; padding:36px 32px 24px 32px; text-align:center; border-bottom:1px solid #E5ECE6;">
              <span style="font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#647D69; display:block; margin-bottom:6px;">UMAIRA FLORIST ATELIER</span>
              <h1 style="margin:0; font-family:Georgia, serif; font-size:24px; font-weight:700; color:#302C2A;">New Sign-In Detected</h1>
              <p style="margin:6px 0 0 0; font-size:12px; color:#6E6864;">Thoughtfully arranged flowers &amp; bespoke bouquets &middot; Manila</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#302C2A;">Hello <strong>${safeName}</strong>,</p>
              <p style="margin:0 0 20px 0; font-size:13px; line-height:1.6; color:#55504C;">
                Your Umaira Florist account was successfully accessed using Google Sign-In.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7FAF8; border:1px solid #E5ECE6; border-radius:14px; padding:0; margin:0 0 20px 0;">
                <tr><td style="padding:16px 20px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:6px 0; font-size:12px; color:#6E6864; width:40%;">Account</td>
                      <td style="padding:6px 0; font-size:12px; color:#302C2A; font-weight:600;">${safeEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:12px; color:#6E6864;">Login Method</td>
                      <td style="padding:6px 0; font-size:12px; color:#302C2A; font-weight:600;">Google</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0; font-size:12px; color:#6E6864;">Date &amp; Time</td>
                      <td style="padding:6px 0; font-size:12px; color:#302C2A; font-weight:600;">${safeDate}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>
              <div style="background-color:#FFF9F5; border:1px solid #F0E6DE; border-radius:12px; padding:14px 16px; margin:0 0 20px 0;">
                <p style="margin:0; font-size:12px; color:#55504C;">
                  <strong>If this was you</strong>, no further action is needed.<br><br>
                  <strong>If you don't recognise this activity</strong>, please secure your Google account and contact us at Umaira Florist immediately.
                </p>
              </div>
              <p style="margin:0; font-size:12px; color:#6E6864; line-height:1.6;">
                Thank you for choosing Umaira Florist.<br>
                <strong>Warm regards,<br>Umaira Florist Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFF9F5; padding:20px 32px; text-align:center; border-top:1px solid #E5ECE6;">
              <p style="margin:0; font-size:11px; color:#6E6864;">&copy; 2026 Umaira Florist Atelier &middot; BGC, Taguig &amp; Metro Manila, Philippines</p>
              <p style="margin:4px 0 0 0; font-size:10px; color:#9E9894;">Handcrafted daily with fresh blooms. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send Google login notification email to the customer
 */
async function sendGoogleLoginNotification({ to, name }) {
  const loginAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'short' });
  const subject = 'New Login to Your Umaira Florist Account';
  const text = `Hello ${name || 'Valued Customer'},\n\nYour Umaira Florist account was successfully accessed using Google Sign-In.\n\nLogin details:\n- Account: ${to}\n- Login Method: Google\n- Date and Time: ${loginAt}\n\nIf this was you, no further action is needed.\n\nIf you don't recognise this activity, please secure your Google account and contact us.\n\nThank you for choosing Umaira Florist.\n\nBest regards,\nUmaira Florist Team`;
  const html = buildGoogleLoginEmailHtml({ name, email: to, loginAt });
  return send({ to, subject, text, html });
}

/**
 * Send customer verification OTP email
 */
async function sendVerificationOTP({ to, name, otp }) {
  const subject = `Your Umaira Florist Verification Code: ${otp}`;
  const text = `Hello ${name || 'Valued Customer'},\n\nThank you for creating an account with Umaira Florist Atelier.\n\nYour 6-digit verification code is:\n${otp}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this account registration, please ignore this email.\n\nWarm regards,\nUmaira Florist Atelier`;
  const html = buildVerificationEmailHtml({ name, otp });

  return send({ to, subject, text, html });
}

/**
 * Build order confirmation email HTML
 */
function buildOrderConfirmationEmailHtml({ name, orderNumber, fulfillment, date, time, paymentMethod, paymentMethodLabel, total, items, giftMessage }) {
  const safeName = String(name || 'Customer').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeOrder = String(orderNumber || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeGift = giftMessage ? String(giftMessage).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : null;
  const peso = (n) => '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fulfillmentLabel = fulfillment === 'pickup' ? 'Store Pickup' : 'Delivery';

  const itemRows = (items || []).map(item => {
    const itemName = String(item.name || item.productName || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const qty = item.quantity || item.qty || 1;
    const price = item.unitPrice || item.price || 0;
    return `<tr><td style="padding:6px 0;font-size:12px;color:#302C2A;border-bottom:1px solid #F0EDE8;">${itemName}${item.isCustom ? ' <em style="color:#647D69;font-size:11px;">(Custom)</em>' : ''}</td><td style="padding:6px 0;font-size:12px;color:#55504C;text-align:center;border-bottom:1px solid #F0EDE8;">${qty}</td><td style="padding:6px 0;font-size:12px;color:#302C2A;text-align:right;border-bottom:1px solid #F0EDE8;">${peso(price * qty)}</td></tr>`;
  }).join('');

  const gcashNote = paymentMethod === 'GCash'
    ? `<div style="background-color:#FFF9F5;border:1px solid #F0E6DE;border-radius:12px;padding:12px 16px;margin:20px 0;"><p style="margin:0;font-size:12px;color:#8C3D52;font-weight:600;">💳 Next Step: Submit Payment</p><p style="margin:6px 0 0;font-size:12px;color:#55504C;">Send <strong>${peso(total)}</strong> to our GCash account and upload your receipt from your order tracking page.</p></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Order Confirmation — Umaira Florist</title><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F7FAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#302C2A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7FAF8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background-color:#FFFFFF;border:1px solid #E5ECE6;border-radius:24px;box-shadow:0 12px 32px rgba(48,44,42,0.06);overflow:hidden;">
        <tr><td style="background-color:#FFF9F5;padding:36px 32px 24px;text-align:center;border-bottom:1px solid #E5ECE6;">
          <span style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#647D69;display:block;margin-bottom:6px;">UMAIRA FLORIST ATELIER</span>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#302C2A;">Order Confirmed</h1>
          <p style="margin:6px 0 0;font-size:12px;color:#6E6864;">Thoughtfully arranged flowers &amp; bespoke bouquets · Manila</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:14px;color:#302C2A;">Hello <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#55504C;">Thank you for your order! We've received it and will begin preparing your arrangement. Here's a summary:</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7FAF8;border:1px solid #E5ECE6;border-radius:14px;margin-bottom:20px;">
            <tr><td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;width:42%;">Order Number</td><td style="padding:5px 0;font-size:12px;color:#302C2A;font-weight:700;">${safeOrder}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;">Fulfillment</td><td style="padding:5px 0;font-size:12px;color:#302C2A;font-weight:600;">${fulfillmentLabel}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;">Date &amp; Time</td><td style="padding:5px 0;font-size:12px;color:#302C2A;font-weight:600;">${String(date || '')} · ${String(time || '')}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;">Payment</td><td style="padding:5px 0;font-size:12px;color:#302C2A;font-weight:600;">${String(paymentMethodLabel || paymentMethod || '')}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;">Total</td><td style="padding:5px 0;font-size:13px;color:#302C2A;font-weight:700;">${peso(total)}</td></tr>
              </table>
            </td></tr>
          </table>
          ${itemRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;"><tr><th style="padding:0 0 6px;font-size:11px;font-weight:600;color:#6E6864;text-align:left;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E5ECE6;">Item</th><th style="padding:0 0 6px;font-size:11px;font-weight:600;color:#6E6864;text-align:center;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E5ECE6;">Qty</th><th style="padding:0 0 6px;font-size:11px;font-weight:600;color:#6E6864;text-align:right;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E5ECE6;">Amount</th></tr>${itemRows}</table>` : ''}
          ${safeGift ? `<div style="background-color:#FFF9F5;border-left:3px solid #B76E79;padding:10px 14px;margin-bottom:20px;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:12px;color:#55504C;font-style:italic;">"${safeGift}"</p><p style="margin:4px 0 0;font-size:10px;color:#9E9894;text-transform:uppercase;letter-spacing:1px;">Gift Message</p></div>` : ''}
          ${gcashNote}
          <p style="margin:0;font-size:12px;color:#6E6864;line-height:1.6;">Track your order at any time using your order number on our website.<br><strong>Warm regards,<br>Umaira Florist Atelier</strong></p>
        </td></tr>
        <tr><td style="background-color:#FFF9F5;padding:20px 32px;text-align:center;border-top:1px solid #E5ECE6;">
          <p style="margin:0;font-size:11px;color:#6E6864;">&copy; 2026 Umaira Florist Atelier · BGC, Taguig &amp; Metro Manila, Philippines</p>
          <p style="margin:4px 0 0;font-size:10px;color:#9E9894;">Handcrafted daily with fresh blooms. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send order confirmation email to the customer
 */
async function sendOrderConfirmation({ to, name, orderNumber, fulfillment, date, time, paymentMethod, paymentMethodLabel, total, items, giftMessage }) {
  const subject = `Order Confirmed — ${orderNumber} · Umaira Florist`;
  const peso = (n) => '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fulfillmentLabel = fulfillment === 'pickup' ? 'Store Pickup' : 'Delivery';
  const itemLines = (items || []).map(i => `  - ${i.name || i.productName || 'Item'} x${i.quantity || 1} — ${peso((i.unitPrice || i.price || 0) * (i.quantity || 1))}`).join('\n');
  const text = `Hello ${name || 'Valued Customer'},\n\nThank you for your order!\n\nOrder Number: ${orderNumber}\nFulfillment: ${fulfillmentLabel}\nDate & Time: ${date || ''} · ${time || ''}\nPayment: ${paymentMethodLabel || paymentMethod || ''}\nTotal: ${peso(total)}\n\nItems:\n${itemLines}${giftMessage ? `\n\nGift Message: "${giftMessage}"` : ''}\n\nTrack your order using your order number on our website.\n\nWarm regards,\nUmaira Florist Atelier`;
  const html = buildOrderConfirmationEmailHtml({ name, orderNumber, fulfillment, date, time, paymentMethod, paymentMethodLabel, total, items, giftMessage });
  return send({ to, subject, text, html });
}

function buildOrderStatusEmailHtml({ name, orderNumber, status, fulfillment, reason }) {
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeName = esc(name) || 'Valued Customer';
  const safeOrder = esc(orderNumber);
  const safeReason = esc(reason);
  const isPickup = fulfillment === 'pickup';
  const fulfillmentLabel = isPickup ? 'Store Pickup' : 'Delivery';

  const configs = {
    'Confirmed':                       { icon: '✅', headline: 'Order Confirmed',                   color: '#647D69', message: `Great news, <strong>${safeName}</strong>! Your order has been reviewed and confirmed by Umaira Florist Atelier. Our florists will begin preparing your beautiful arrangement soon.` },
    'Preparing':                       { icon: '🌸', headline: 'Preparing Your Blooms',              color: '#B76E79', message: `Hello <strong>${safeName}</strong>, our florists have begun handcrafting your arrangement with the freshest blooms. Every petal is placed with care and artistry.` },
    'Ready for Pickup':                { icon: '🏪', headline: 'Ready for Pickup',                   color: '#4A7C59', message: `Hello <strong>${safeName}</strong>, your arrangement is freshly made and waiting for you at Umaira Florist Atelier. Please come pick it up at your earliest convenience.` },
    'Rider Assigned':                  { icon: '🛵', headline: 'Rider Assigned',                     color: '#5B7FA6', message: `Hello <strong>${safeName}</strong>, a delivery rider has been assigned to your order and will pick it up shortly for delivery to your address.` },
    'On the Way':                      { icon: '🚀', headline: 'On the Way',                         color: '#5B7FA6', message: `Hello <strong>${safeName}</strong>, your flowers are on their way! Our rider is heading to your address now. Please be ready to receive your beautiful arrangement.` },
    'Out for Delivery':                { icon: '🚀', headline: 'Out for Delivery',                   color: '#5B7FA6', message: `Hello <strong>${safeName}</strong>, your flowers are out for delivery! Our rider is heading to your address. Please be ready to receive your beautiful arrangement.` },
    'Awaiting Customer Confirmation':  { icon: '📋', headline: 'Please Confirm Your Pickup',         color: '#8C6D3F', message: `Hello <strong>${safeName}</strong>, your order is ready for handover at our Atelier. Please confirm receipt through your order tracking page when you pick it up.` },
    'Delivered — Awaiting Confirmation': { icon: '📦', headline: 'Order Delivered',                  color: '#4A7C59', message: `Hello <strong>${safeName}</strong>, your flowers have been delivered! Our rider has uploaded a proof-of-delivery photo. Please check your order tracking page to confirm receipt.` },
    'Picked Up':                       { icon: '🌷', headline: 'Order Complete — Thank You!',        color: '#4A7C59', message: `Hello <strong>${safeName}</strong>, your order has been successfully picked up. Thank you for choosing Umaira Florist Atelier — we hope your blooms bring joy and beauty!` },
    'Rejected/Cancelled':              { icon: '❌', headline: 'Order Cancelled',                    color: '#8C3D52', message: `Hello <strong>${safeName}</strong>, we're sorry to inform you that your order has been cancelled.${safeReason ? ` <strong>Reason:</strong> ${safeReason}` : ' Please contact us if you have any questions.'}` }
  };

  const cfg = configs[status] || {
    icon: '📋',
    headline: `Order Update: ${esc(status)}`,
    color: '#647D69',
    message: `Hello <strong>${safeName}</strong>, your order status has been updated to: <strong>${esc(status)}</strong>.`
  };

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${cfg.headline} — Umaira Florist</title><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F7FAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#302C2A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7FAF8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background-color:#FFFFFF;border:1px solid #E5ECE6;border-radius:24px;box-shadow:0 12px 32px rgba(48,44,42,0.06);overflow:hidden;">
        <tr><td style="background-color:#FFF9F5;padding:36px 32px 24px;text-align:center;border-bottom:1px solid #E5ECE6;">
          <span style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#647D69;display:block;margin-bottom:6px;">UMAIRA FLORIST ATELIER</span>
          <div style="font-size:32px;margin:8px 0 10px;">${cfg.icon}</div>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#302C2A;">${cfg.headline}</h1>
          <p style="margin:6px 0 0;font-size:12px;color:#6E6864;">Thoughtfully arranged flowers &amp; bespoke bouquets · Manila</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#302C2A;">${cfg.message}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7FAF8;border:1px solid #E5ECE6;border-radius:14px;margin-bottom:20px;">
            <tr><td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;width:42%;">Order Number</td><td style="padding:5px 0;font-size:12px;color:#302C2A;font-weight:700;">${safeOrder}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;">Status</td><td style="padding:5px 0;font-size:12px;font-weight:600;"><span style="background-color:${cfg.color};color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;">${esc(status)}</span></td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#6E6864;">Fulfillment</td><td style="padding:5px 0;font-size:12px;color:#302C2A;font-weight:600;">${fulfillmentLabel}</td></tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#6E6864;line-height:1.6;">Track your order at any time using your order number on our website.</p>
          <p style="margin:0;font-size:12px;color:#302C2A;line-height:1.6;"><strong>Warm regards,<br>Umaira Florist Atelier</strong></p>
        </td></tr>
        <tr><td style="background-color:#FFF9F5;padding:20px 32px;text-align:center;border-top:1px solid #E5ECE6;">
          <p style="margin:0;font-size:11px;color:#6E6864;">&copy; 2026 Umaira Florist Atelier · BGC, Taguig &amp; Metro Manila, Philippines</p>
          <p style="margin:4px 0 0;font-size:10px;color:#9E9894;">Handcrafted daily with fresh blooms. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendOrderStatusEmail({ to, name, orderNumber, status, fulfillment, reason }) {
  const subjects = {
    'Confirmed':                         `Your Order is Confirmed — ${orderNumber} · Umaira Florist`,
    'Preparing':                         `We're Preparing Your Blooms — ${orderNumber} · Umaira Florist`,
    'Ready for Pickup':                  `Your Order is Ready for Pickup — ${orderNumber} · Umaira Florist`,
    'Rider Assigned':                    `Rider Assigned to Your Order — ${orderNumber} · Umaira Florist`,
    'On the Way':                        `Your Order is On the Way — ${orderNumber} · Umaira Florist`,
    'Out for Delivery':                  `Your Order is Out for Delivery — ${orderNumber} · Umaira Florist`,
    'Awaiting Customer Confirmation':    `Please Confirm Your Pickup — ${orderNumber} · Umaira Florist`,
    'Delivered — Awaiting Confirmation': `Your Order Has Been Delivered — ${orderNumber} · Umaira Florist`,
    'Picked Up':                         `Order Complete — Thank You! · ${orderNumber} · Umaira Florist`,
    'Rejected/Cancelled':                `Order Cancelled — ${orderNumber} · Umaira Florist`
  };
  const textMessages = {
    'Confirmed':                         `Great news! Your order has been reviewed and confirmed by Umaira Florist Atelier. Our florists will begin preparing your arrangement soon.`,
    'Preparing':                         `Our florists have begun handcrafting your arrangement with the freshest blooms.`,
    'Ready for Pickup':                  `Your arrangement is freshly made and waiting for you at Umaira Florist Atelier.`,
    'Rider Assigned':                    `A delivery rider has been assigned to your order and will pick it up shortly.`,
    'On the Way':                        `Your flowers are on their way! Our rider is heading to your address now.`,
    'Out for Delivery':                  `Your flowers are out for delivery! Our rider is heading to your address.`,
    'Awaiting Customer Confirmation':    `Your order is ready for handover. Please confirm receipt through your order tracking page.`,
    'Delivered — Awaiting Confirmation': `Your flowers have been delivered! Please confirm receipt on your order tracking page.`,
    'Picked Up':                         `Your order has been successfully picked up. Thank you for choosing Umaira Florist Atelier!`,
    'Rejected/Cancelled':                `We're sorry, your order has been cancelled.${reason ? ' Reason: ' + reason : ''}`
  };
  const isPickup = fulfillment === 'pickup';
  const subject = subjects[status] || `Order Update: ${status} — ${orderNumber} · Umaira Florist`;
  const msg = textMessages[status] || `Your order status has been updated to: ${status}.`;
  const text = `Hello ${name || 'Valued Customer'},\n\n${msg}\n\nOrder Number: ${orderNumber}\nStatus: ${status}\nFulfillment: ${isPickup ? 'Store Pickup' : 'Delivery'}\n\nTrack your order using your order number on our website.\n\nWarm regards,\nUmaira Florist Atelier`;
  const html = buildOrderStatusEmailHtml({ name, orderNumber, status, fulfillment, reason });
  return send({ to, subject, text, html });
}

module.exports = {
  send,
  sendVerificationOTP,
  sendGoogleLoginNotification,
  sendOrderConfirmation,
  sendOrderStatusEmail,
  isConfigured
};
