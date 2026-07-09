import { describe, expect, it } from 'vitest';
import {
  assertSafeFetchUrl,
  isBlockedIpAddress,
  SSRF_BLOCKED_MESSAGE,
  UrlValidationError,
} from '@/lib/url-validation';

describe('isBlockedIpAddress', () => {
  it('blocks loopback IPv4', () => {
    expect(isBlockedIpAddress('127.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('127.255.255.255')).toBe(true);
  });

  it('blocks private IPv4 ranges', () => {
    expect(isBlockedIpAddress('10.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('172.16.0.1')).toBe(true);
    expect(isBlockedIpAddress('192.168.1.1')).toBe(true);
    expect(isBlockedIpAddress('169.254.169.254')).toBe(true);
  });

  it('allows public IPv4', () => {
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false);
    expect(isBlockedIpAddress('93.184.216.34')).toBe(false);
  });

  it('blocks loopback IPv6', () => {
    expect(isBlockedIpAddress('::1')).toBe(true);
  });
});

describe('assertSafeFetchUrl', () => {
  it('rejects non-http protocols', async () => {
    await expect(assertSafeFetchUrl('ftp://example.com/job')).rejects.toThrow(
      UrlValidationError,
    );
    await expect(assertSafeFetchUrl('file:///etc/passwd')).rejects.toThrow(
      UrlValidationError,
    );
  });

  it('rejects localhost hostnames', async () => {
    await expect(
      assertSafeFetchUrl('http://localhost/jobs/123'),
    ).rejects.toThrow(SSRF_BLOCKED_MESSAGE);
  });

  it('rejects literal private IPs', async () => {
    await expect(assertSafeFetchUrl('http://127.0.0.1/jobs')).rejects.toThrow(
      SSRF_BLOCKED_MESSAGE,
    );
    await expect(assertSafeFetchUrl('http://10.0.0.5/jobs')).rejects.toThrow(
      SSRF_BLOCKED_MESSAGE,
    );
    await expect(
      assertSafeFetchUrl('http://192.168.0.10/jobs'),
    ).rejects.toThrow(SSRF_BLOCKED_MESSAGE);
  });

  it('allows public URLs', async () => {
    const url = await assertSafeFetchUrl('https://example.com/jobs/123');
    expect(url.hostname).toBe('example.com');
  });
});
