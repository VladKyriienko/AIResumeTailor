export function isJobPostingUrl(input: string): boolean {
  const trimmed = input.trim();

  if (!trimmed || trimmed.includes('\n')) {
    return false;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
