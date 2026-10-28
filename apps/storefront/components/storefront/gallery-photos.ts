/** Return distinct product photos, even when different URLs serve identical bytes. */
export async function distinctPhotoUrls(
  urls: string[],
  getBytes: (url: string) => Promise<ArrayBuffer>,
  digest: (bytes: ArrayBuffer) => Promise<ArrayBuffer>,
): Promise<string[]> {
  const uniqueUrls = [...new Set(urls.filter(Boolean))].slice(0, 8);
  const fingerprints = await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const bytes = await getBytes(url);
        const hash = await digest(bytes);
        return Array.from(new Uint8Array(hash))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
      } catch {
        // A photo request may fail independently; keep its URL rather than
        // silently losing a potentially useful photo.
        return url;
      }
    }),
  );
  const seen = new Set<string>();
  return uniqueUrls.filter((_, index) => {
    const fingerprint = fingerprints[index];
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}
