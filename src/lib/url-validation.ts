import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const SSRF_BLOCKED_MESSAGE =
  'This URL cannot be loaded. Paste the job description manually.';

export class UrlValidationError extends Error {
  constructor(message = SSRF_BLOCKED_MESSAGE) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return octets;
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;

  const [a, b] = octets;

  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;

  return false;
}

function expandIpv6(address: string): string[] | null {
  const normalized = address.toLowerCase();
  const [head, tail] = normalized.split('::');

  if (normalized.split('::').length > 2) return null;

  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - headParts.length - tailParts.length;

  if (missing < 0) return null;

  const parts = [
    ...headParts,
    ...Array.from({ length: missing }, () => '0'),
    ...tailParts,
  ];

  if (parts.length !== 8) return null;

  return parts.map((part) => part.padStart(4, '0'));
}

function isBlockedIpv6(address: string): boolean {
  const lower = address.toLowerCase();

  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

  if (lower.startsWith('::ffff:')) {
    const mappedIpv4 = lower.slice('::ffff:'.length);
    return isBlockedIpv4(mappedIpv4);
  }

  const parts = expandIpv6(lower);
  if (!parts) return false;

  const first = Number.parseInt(parts[0], 16);

  if ((first & 0xff00) === 0xfe80) return true;
  if ((first & 0xfe00) === 0xfc00) return true;

  return false;
}

export function isBlockedIpAddress(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) return isBlockedIpv4(address);
  if (ipVersion === 6) return isBlockedIpv6(address);
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '');

  if (lower === 'localhost') return true;
  if (lower.endsWith('.localhost')) return true;
  if (lower === 'metadata.google.internal') return true;
  if (lower.endsWith('.local')) return true;

  return false;
}

export async function assertSafeFetchUrl(urlString: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    throw new UrlValidationError();
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlValidationError();
  }

  const hostname = url.hostname.replace(/^\[/, '').replace(/\]$/, '');

  if (isBlockedHostname(hostname)) {
    throw new UrlValidationError();
  }

  if (isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new UrlValidationError();
    }
    return url;
  }

  try {
    const results = await lookup(hostname, { all: true });
    if (results.length === 0) {
      throw new UrlValidationError();
    }

    for (const result of results) {
      if (isBlockedIpAddress(result.address)) {
        throw new UrlValidationError();
      }
    }
  } catch (error) {
    if (error instanceof UrlValidationError) throw error;
    throw new UrlValidationError();
  }

  return url;
}
