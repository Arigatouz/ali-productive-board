export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/hackmd/')) {
      return new Response('Bad Request', { status: 400 });
    }

    const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'OPTIONS'];
    if (!ALLOWED_METHODS.includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const targetUrl = 'https://api.hackmd.io/v1' + url.pathname.replace('/hackmd', '');

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Create a new request to HackMD
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set('Host', 'api.hackmd.io');

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
    });

    const response = await fetch(modifiedRequest);

    // Return the response with CORS headers added so your browser allows it
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    return new Response(response.body, { status: response.status, headers: responseHeaders });
  }
};
