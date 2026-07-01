/** Format a byte count into a human-readable size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  // No decimals for plain bytes; one decimal for KB and up.
  const formatted = i === 0 ? String(Math.round(value)) : value.toFixed(value >= 100 ? 0 : 1);
  return `${formatted} ${units[i]}`;
}
