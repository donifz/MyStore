// Keep later resources reachable even when an earlier cleanup rejects.
export async function closeResources(resources: (() => Promise<unknown>)[]) {
  let failed = false;
  for (const close of resources) {
    try {
      await close();
    } catch {
      failed = true;
      console.error('Service shutdown cleanup failed');
    }
  }
  return failed ? 1 : 0;
}
