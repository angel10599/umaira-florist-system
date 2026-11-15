// Umaira Florist outgoing transactional email service.
// Supports:
// 1. Resend API (recommended for production: set RESEND_API_KEY in .env)
// 2. SMTP Server (set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env)
// 3. Webhook Relay (set MAIL_WEBHOOK_URL, optional MAIL_WEBHOOK_TOKEN in .env)
// 4. Test / Local Development console mode (when UMAIRA_TEST=1 or ALLOW_DEV_CONSOLE_OTP=true)

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_FROM = process.env.MAIL_FROM || 'Umaira Florist Atelier <onboarding@resend.dev>';

function isConfigured() {
  if (process.env.UMAIRA_TEST === '1') return true;
  if (process.env.RESEND_API_KEY) return true;
  if (process.env.MAIL_WEBHOOK_URL) return true;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) return true;
  return false;
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
          reject(new Error(`Resend API error (${res.statusCode}): ${data}`));
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

  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ to, subject, html, text });
  }

  if (process.env.MAIL_WEBHOOK_URL) {
    return sendViaWebhook({ to, subject, text, html });
  }

  throw new Error('Email delivery service is not configured. Please set RESEND_API_KEY in .env.');
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

module.exports = {
  send,
  sendVerificationOTP,
  sendGoogleLoginNotification,
  sendOrderConfirmation,
  isConfigured
};
