const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';

function html(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

export default async function handler(req, res) {
  const { shop, code, error, error_description } = req.query || {};

  if (error) {
    return html(res, 400, `<h1>Shopify OAuth failed</h1><p>${error}: ${error_description || ''}</p>`);
  }

  if (!shop || !code) {
    return html(res, 400, '<h1>Missing Shopify OAuth parameters</h1>');
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return html(res, 500, '<h1>Shopify OAuth is not configured</h1><p>Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET.</p>');
  }

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.access_token) {
      console.error('Shopify token exchange failed', { status: response.status, data });
      return html(res, 502, '<h1>Shopify token exchange failed</h1><p>Tell Hermes to check Vercel logs.</p>');
    }

    return html(res, 200, `
      <main style="font-family: system-ui; max-width: 720px; margin: 60px auto; line-height: 1.45;">
        <h1>Shopify connected</h1>
        <p>This is the Admin API access token for <strong>${shop}</strong>. It is shown here so you can store it once in Vercel.</p>
        <p><strong>Do not paste it in Slack.</strong> Tell Hermes you see the token and use the secure local dialog.</p>
        <textarea readonly style="width:100%; min-height:130px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${data.access_token}</textarea>
        <p>Scopes: ${data.scope || 'not returned'}</p>
      </main>
    `);
  } catch (err) {
    console.error('Shopify OAuth callback error', err);
    return html(res, 500, '<h1>Shopify OAuth callback crashed</h1>');
  }
}
