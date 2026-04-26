export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/hackmd/')) {
      return proxyHackMD(request, url);
    }

    if (url.pathname.startsWith('/anthropic/')) {
      return proxyAnthropic(request, url, env);
    }

    if (url.pathname.startsWith('/perplexity/')) {
      return proxyPerplexity(request, url, env);
    }

    if (url.pathname === '/proxy') {
      return proxyArticle(request, url);
    }

    return new Response('Bad Request', { status: 400 });
  },
};

async function proxyHackMD(request, url) {
  const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'OPTIONS'];
  if (!ALLOWED_METHODS.includes(request.method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const targetUrl = 'https://api.hackmd.io/v1' + url.pathname.replace('/hackmd', '');

  if (request.method === 'OPTIONS') {
    return corsResponse();
  }

  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('Host', 'api.hackmd.io');

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.body,
  });

  const response = await fetch(modifiedRequest);
  return addCORSHeaders(response);
}

async function proxyAnthropic(request, url, env) {
  const ALLOWED_METHODS = ['POST', 'OPTIONS'];
  if (!ALLOWED_METHODS.includes(request.method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const targetUrl = 'https://api.anthropic.com/v1/' + url.pathname.replace('/anthropic/', '');

  if (request.method === 'OPTIONS') {
    return corsResponse(['Content-Type', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access']);
  }

  const proxyHeaders = {};
  for (const [k, v] of request.headers.entries()) {
    proxyHeaders[k] = v;
  }
  // Strip headers that make Anthropic treat the request as a browser CORS request
  delete proxyHeaders['host'];
  delete proxyHeaders['origin'];
  delete proxyHeaders['referer'];
  delete proxyHeaders['anthropic-dangerous-direct-browser-access'];

  // Inject server-side key — overrides any browser-sent key
  if (env.ANTHROPIC_KEY) {
    proxyHeaders['x-api-key'] = env.ANTHROPIC_KEY;
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.body,
  });

  return addCORSHeaders(response, ['Content-Type', 'x-api-key', 'anthropic-version']);
}

async function proxyPerplexity(request, url, env) {
  const ALLOWED_METHODS = ['POST', 'OPTIONS'];
  if (!ALLOWED_METHODS.includes(request.method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const targetUrl = 'https://api.perplexity.ai/' + url.pathname.replace('/perplexity/', '');

  if (request.method === 'OPTIONS') {
    return corsResponse(['Content-Type', 'Authorization']);
  }

  const proxyHeaders = {};
  for (const [k, v] of request.headers.entries()) {
    proxyHeaders[k] = v;
  }
  delete proxyHeaders['host'];
  delete proxyHeaders['origin'];
  delete proxyHeaders['referer'];

  // Inject server-side key — overrides any browser-sent key
  if (env.PERPLEXITY_KEY) {
    proxyHeaders['authorization'] = `Bearer ${env.PERPLEXITY_KEY}`;
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.body,
  });

  return addCORSHeaders(response, ['Content-Type', 'Authorization']);
}

async function proxyArticle(request, url) {
  if (request.method === 'OPTIONS') return corsResponse();

  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return new Response('Missing url param', { status: 400 });

  // Validate URL — only allow http(s) to prevent SSRF to internal/metadata endpoints
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return new Response('Invalid url param', { status: 400 });
  }
  if (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') {
    return new Response('URL scheme not allowed', { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (!res.ok) {
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' },
      });
    }
    const body = await res.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Proxy fetch failed: ' + err.message, { status: 502 });
  }
}

function corsResponse(extraHeaders) {
  const allowHeaders = ['Authorization', 'Content-Type'];
  if (extraHeaders) allowHeaders.push(...extraHeaders);
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': allowHeaders.join(', '),
      'Access-Control-Max-Age': '86400',
    },
  });
}

function addCORSHeaders(response, extraHeaders) {
  const allowHeaders = ['Authorization', 'Content-Type'];
  if (extraHeaders) allowHeaders.push(...extraHeaders);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', allowHeaders.join(', '));
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}
