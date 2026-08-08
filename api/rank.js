export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: { code: 'method_not_allowed', message: 'Only POST is supported on /api/rank.' },
    });
  }

  const backendBaseUrl = process.env.BACKEND_BASE_URL;
  const backendApiKey = process.env.BACKEND_API_KEY;

  if (!backendBaseUrl || !backendApiKey) {
    // Fail loud, not silent — a misconfigured proxy should never look
    // like a working one that happens to return empty results.
    console.error('Proxy misconfigured: BACKEND_BASE_URL or BACKEND_API_KEY missing.');
    return res.status(500).json({
      success: false,
      error: { code: 'proxy_misconfigured', message: 'Server is misconfigured. Try again later.' },
    });
  }

  try {
    const upstream = await fetch(`${backendBaseUrl.replace(/\/+$/, '')}/api/rank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': backendApiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error('Proxy → backend request failed:', err);
    return res.status(502).json({
      success: false,
      error: { code: 'bad_gateway', message: 'Could not reach the scraping backend.' },
    });
  }
}