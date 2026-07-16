export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = `https://cctv-service-system.nyinyimin2007.workers.dev${url.pathname}${url.search}`;

  // Clone the request headers
  const headers = new Headers(context.request.headers);

  // Clean up any host/origin headers to match target endpoint requirements
  headers.delete('host');

  const method = context.request.method;
  const isSafeMethod = method === 'GET' || method === 'HEAD';

  try {
    const res = await fetch(targetUrl, {
      method: method,
      headers: headers,
      body: isSafeMethod ? null : await context.request.arrayBuffer(),
    });

    return res;
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
