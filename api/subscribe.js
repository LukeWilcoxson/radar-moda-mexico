const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const DEFAULT_TAGS = ['radar-minisite', 'radar-moda-mexico'];

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function normalizeShopDomain(value = '') {
  return value
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { success: false, message: 'Method not allowed' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { success: false, message: 'Invalid request' });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (body.website) {
    return json(res, 200, { success: true });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return json(res, 400, { success: false, message: 'Email inválido' });
  }

  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  const shopDomain = normalizeShopDomain(process.env.SHOPIFY_SHOP_DOMAIN || 'cocoloco.mx');

  if (!token || !shopDomain) {
    return json(res, 500, { success: false, message: 'Signup is not configured yet' });
  }

  const endpoint = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers.json`;

  const shopifyResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      customer: {
        email,
        tags: DEFAULT_TAGS.join(', '),
        email_marketing_consent: {
          state: 'subscribed',
          opt_in_level: 'single_opt_in'
        }
      }
    })
  });

  const data = await shopifyResponse.json().catch(() => ({}));

  // If the customer already exists, don't show an error to the visitor.
  // We can upgrade this later to update existing customer consent once read_customers is granted.
  const alreadyExists = shopifyResponse.status === 422 && JSON.stringify(data).toLowerCase().includes('taken');
  if (shopifyResponse.ok || alreadyExists) {
    return json(res, 200, { success: true });
  }

  console.error('Shopify signup failed', {
    status: shopifyResponse.status,
    errors: data.errors || data.error || data
  });

  return json(res, 502, {
    success: false,
    message: 'No se pudo guardar el email. Intenta de nuevo.'
  });
}
