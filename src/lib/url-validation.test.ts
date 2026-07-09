import { describe, expect, it } from 'vitest';
import {
  assertSafeFetchUrl,
  isAllowedJobHostname,
  isBlockedIpAddress,
  normalizeIpv6Address,
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
    expect(isBlockedIpAddress('0.0.0.0')).toBe(true);
  });

  it('allows public IPv4', () => {
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false);
    expect(isBlockedIpAddress('93.184.216.34')).toBe(false);
  });

  it('blocks loopback IPv6', () => {
    expect(isBlockedIpAddress('::1')).toBe(true);
    expect(isBlockedIpAddress('0:0:0:0:0:0:0:1')).toBe(true);
  });

  it('blocks expanded IPv6 loopback', () => {
    expect(isBlockedIpAddress('0:0:0:0:0:0:0:1')).toBe(true);
    expect(normalizeIpv6Address('::1')).toBe('0:0:0:0:0:0:0:1');
  });

  it('blocks IPv4-mapped IPv6 loopback', () => {
    expect(isBlockedIpAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('0:0:0:0:0:ffff:7f00:1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 private IP', () => {
    expect(isBlockedIpAddress('0:0:0:0:0:ffff:0a00:1')).toBe(true);
    expect(isBlockedIpAddress('::ffff:10.0.0.1')).toBe(true);
  });

  it('blocks link-local IPv6', () => {
    expect(isBlockedIpAddress('fe80::1')).toBe(true);
    expect(isBlockedIpAddress('fe80::abcd')).toBe(true);
  });

  it('blocks unique-local IPv6', () => {
    expect(isBlockedIpAddress('fc00::1')).toBe(true);
    expect(isBlockedIpAddress('fd12:3456:789a:1::1')).toBe(true);
  });

  it('blocks unspecified IPv6', () => {
    expect(isBlockedIpAddress('::')).toBe(true);
    expect(isBlockedIpAddress('0:0:0:0:0:0:0:0')).toBe(true);
  });
});

describe('isAllowedJobHostname', () => {
  it('allows popular job platforms and subdomains', () => {
    expect(isAllowedJobHostname('linkedin.com')).toBe(true);
    expect(isAllowedJobHostname('www.linkedin.com')).toBe(true);
    expect(isAllowedJobHostname('jobs.lever.co')).toBe(true);
    expect(isAllowedJobHostname('boards.greenhouse.io')).toBe(true);
  });

  it('rejects unknown domains', () => {
    expect(isAllowedJobHostname('example.com')).toBe(false);
    expect(isAllowedJobHostname('evil.local')).toBe(false);
  });
});

describe('assertSafeFetchUrl', () => {
  it('rejects non-http protocols', async () => {
    await expect(assertSafeFetchUrl('ftp://linkedin.com/job')).rejects.toThrow(
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
    await expect(
      assertSafeFetchUrl('http://169.254.169.254/latest/meta-data'),
    ).rejects.toThrow(SSRF_BLOCKED_MESSAGE);
  });

  it('rejects unknown public domains', async () => {
    await expect(
      assertSafeFetchUrl('https://example.com/jobs/123'),
    ).rejects.toThrow(SSRF_BLOCKED_MESSAGE);
  });

  it('allows allowlisted public job URLs', async () => {
    const url = await assertSafeFetchUrl(
      'https://www.linkedin.com/jobs/view/123',
    );
    expect(url.hostname).toBe('www.linkedin.com');
  });
});
