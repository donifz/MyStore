// jsdom has no Web Locks. Serialize requests like the real same-origin API.
const tails = new Map<string, Promise<unknown>>();
Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: {
    request(name: string, work: () => unknown) {
      const result = (tails.get(name) ?? Promise.resolve())
        .catch(() => {})
        .then(work);
      tails.set(name, result);
      return result;
    },
  },
});
