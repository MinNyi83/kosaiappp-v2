/**
 * Gemini AI API helper with fallback support.
 */
export async function fetchGeminiWithFallback(apiKey, payloadBody, model = 'gemini-2.5-flash') {
  const primaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const fallbackUrl = `https://api.gemini.tams.tech/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let lastError = null;

  try {
    const res = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadBody),
    });
    const data = (await res.json() as any);
    if (res.ok && !data.error) {
      return data;
    }
    const errMsg = data.error ? data.error.message : 'Unknown error';
    const isGeoBlocked =
      errMsg.toLowerCase().includes('location') ||
      errMsg.toLowerCase().includes('supported') ||
      res.status === 400 ||
      res.status === 403;
    if (!isGeoBlocked) {
      return data;
    }
    lastError = new Error(`Primary failed with geo-block: ${errMsg}`);
  } catch (err) {
    lastError = err;
  }

  try {
    const res = await fetch(fallbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadBody),
    });
    const data = (await res.json() as any);
    return data;
  } catch (err) {
    throw new Error(
      `Both Gemini endpoints failed. Primary error: ${lastError ? lastError.message : 'none'}. Proxy error: ${err.message}`
    );
  }
}

