// ===== api.js — HackMD API helpers =====

export function getFullApiUrl(path, config) {
  const baseUrl = 'https://api.hackmd.io/v1';
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  const fullUrl = baseUrl + normalizedPath;

  if (config && config.CORS_PROXY) {
    if (config.CORS_PROXY.includes('workers.dev')) {
      // Proxy URL may be ".../hackmd/" or ".../hackmd" — normalize to always end with /
      const proxyBase = config.CORS_PROXY.endsWith('/')
        ? config.CORS_PROXY
        : config.CORS_PROXY + '/';
      // If proxy already contains /hackmd, path goes after it; otherwise append hackmd/
      if (proxyBase.endsWith('/hackmd/')) {
        return proxyBase + normalizedPath.slice(1); // strip leading /
      }
      return `${proxyBase}hackmd${normalizedPath}`;
    }
    return config.CORS_PROXY + encodeURIComponent(fullUrl);
  }
  return fullUrl;
}

export async function fetchWithRetry(url, options, retries = 1, delayMs = 1500) {
  const res = await fetch(url, options);
  if (res.status >= 500 && retries > 0) {
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithRetry(url, options, retries - 1, delayMs);
  }
  return res;
}
