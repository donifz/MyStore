const assert = require('node:assert/strict');
const http = require('node:http');
const { after, test } = require('node:test');
let runLoadProbe;
try {
  ({ runLoadProbe } = require('./ops-load-probe.cjs'));
} catch {}

const servers = [];

async function startServer(handler) {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}/api/public/products`;
}

after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
});

test('counts scheduled requests and reports latency percentiles', async () => {
  assert.equal(typeof runLoadProbe, 'function');
  const url = await startServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"items":[]}');
  });

  const result = await runLoadProbe({
    url,
    durationSeconds: 0.11,
    requestsPerSecond: 20,
    concurrency: 2,
  });

  assert.equal(result.requestCount, 3);
  assert.equal(result.statusCounts['200'], 3);
  assert.equal(result.errorCount, 0);
  assert.ok(result.maxConcurrentRequests <= 2);
  assert.ok(result.latencyMs.p50 >= 0);
  assert.ok(result.latencyMs.p95 >= result.latencyMs.p50);
  assert.ok(result.latencyMs.p99 >= result.latencyMs.p95);
  assert.ok(result.latencyMs.max >= result.latencyMs.p99);
});

test('counts non-success responses as errors', async () => {
  assert.equal(typeof runLoadProbe, 'function');
  const url = await startServer((_request, response) => {
    response.writeHead(503);
    response.end('unavailable');
  });

  const result = await runLoadProbe({
    url,
    durationSeconds: 0.06,
    requestsPerSecond: 20,
    concurrency: 1,
  });

  assert.equal(result.requestCount, 2);
  assert.equal(result.statusCounts['503'], 2);
  assert.equal(result.errorCount, 2);
});

test('rejects remote URLs before sending requests', async () => {
  assert.equal(typeof runLoadProbe, 'function');
  let requestCount = 0;

  await assert.rejects(
    runLoadProbe({
      url: 'https://example.com/api/public/products',
      durationSeconds: 0.1,
      requestsPerSecond: 10,
      concurrency: 1,
      fetchImpl: async () => {
        requestCount++;
      },
    }),
    /loopback URL/,
  );
  assert.equal(requestCount, 0);
});
