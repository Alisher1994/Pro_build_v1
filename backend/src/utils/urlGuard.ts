const privateIpv4 = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/;
const loopbackIpv4 = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;
const loopbackHostnames = new Set(['localhost']);

function isLoopback(host: string): boolean {
  return loopbackHostnames.has(host) || loopbackIpv4.test(host) || host === '::1';
}

function isPrivate(host: string): boolean {
  return privateIpv4.test(host);
}

export function assertSafeFetchTarget(urlStr: string, allowHosts: string[] = []): void {
  const parsed = new URL(urlStr);
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('Unsupported protocol for fetch');
  }

  const host = parsed.hostname.toLowerCase();
  if (allowHosts.map(h => h.toLowerCase().trim()).filter(Boolean).includes(host)) {
    return;
  }

  if (isLoopback(host)) {
    return; // allow loopback for local services
  }

  if (isPrivate(host)) {
    throw new Error('Blocked fetch to private address');
  }
}

export default assertSafeFetchTarget;
