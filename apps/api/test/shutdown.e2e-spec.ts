import { closeResources } from '../src/shutdown';
it('continues cleanup in order after a resource fails and reports unsuccessful shutdown', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const closed: string[] = [];
  try {
    const code = await closeResources([
      async () => {
        closed.push('email');
        throw new Error('private failure');
      },
      async () => {
        closed.push('http');
      },
      async () => {
        closed.push('database');
      },
    ]);
    expect(code).toBe(1);
    expect(closed).toEqual(['email', 'http', 'database']);
    expect(log).toHaveBeenCalledWith('Service shutdown cleanup failed');
    expect(await closeResources([async () => {}])).toBe(0);
  } finally {
    log.mockRestore();
  }
});
