const assert = require('node:assert/strict');
const http = require('node:http');
const { performance } = require('node:perf_hooks');
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
    durationSeconds: 0.22,
    requestsPerSecond: 20,
    concurrency: 2,
  });

  assert.ok(result.requestCount >= 3);
  assert.equal(result.statusCounts['200'], result.requestCount);
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

test('does not follow redirects to another server', async () => {
  let redirectedRequests = 0;
  const destination = await startServer((_request, response) => {
    redirectedRequests++;
    response.writeHead(200);
    response.end('should not be reached');
  });
  const redirect = await startServer((_request, response) => {
    response.writeHead(302, { location: destination });
    response.end();
  });

  const result = await runLoadProbe({
    url: redirect,
    durationSeconds: 0.05,
    requestsPerSecond: 20,
    concurrency: 1,
  });

  assert.equal(redirectedRequests, 0);
  assert.equal(result.networkErrorCount, 1);
  assert.equal(result.errorCount, 1);
});

test('does not start scheduled requests after the duration deadline', async () => {
  const url = await startServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200);
      response.end('{}');
    }, 80);
  });

  const result = await runLoadProbe({
    url,
    durationSeconds: 0.11,
    requestsPerSecond: 20,
    concurrency: 1,
  });

  assert.equal(result.requestCount, 2);
  assert.ok(result.elapsedSeconds < 0.35);
});

test('counts a response body that terminates early as a network error', async () => {
  const url = await startServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'application/json',
      'content-length': '100',
    });
    response.write('{"items":');
    setTimeout(() => response.destroy(), 30);
  });

  const result = await runLoadProbe({
    url,
    durationSeconds: 0.05,
    requestsPerSecond: 20,
    concurrency: 1,
  });

  assert.equal(result.statusCounts['200'], 1);
  assert.equal(result.networkErrorCount, 1);
  assert.equal(result.errorCount, 1);
});

test('does not bunch overdue slots after the event loop stalls', async () => {
  const requestStarts = [];
  let stallScheduled = false;
  const url = await startServer((_request, response) => {
    requestStarts.push(performance.now());
    response.writeHead(200);
    response.end('{}');
    if (!stallScheduled) {
      stallScheduled = true;
      setTimeout(() => {
        const until = performance.now() + 200;
        while (performance.now() < until) {}
      }, 100);
    }
  });

  const result = await runLoadProbe({
    url,
    durationSeconds: 0.55,
    requestsPerSecond: 20,
    concurrency: 10,
  });

  const gaps = requestStarts
    .slice(1)
    .map((startedAt, index) => startedAt - requestStarts[index]);
  assert.ok(result.requestCount >= 5);
  assert.ok(
    gaps.every((gap) => gap >= 10),
    `request gaps: ${gaps.join(', ')}`,
  );
});

test('preserves the request interval after a short event loop stall', async () => {
  const requestStarts = [];
  let stallScheduled = false;
  const url = await startServer((_request, response) => {
    requestStarts.push(performance.now());
    response.writeHead(200);
    response.end('{}');
    if (!stallScheduled) {
      stallScheduled = true;
      setTimeout(() => {
        const until = performance.now() + 65;
        while (performance.now() < until) {}
      }, 30);
    }
  });

  const result = await runLoadProbe({
    url,
    durationSeconds: 0.3,
    requestsPerSecond: 20,
    concurrency: 10,
  });

  const gaps = requestStarts
    .slice(1)
    .map((startedAt, index) => startedAt - requestStarts[index]);
  assert.ok(result.requestCount >= 4);
  assert.ok(
    gaps.every((gap) => gap >= 35),
    `request gaps: ${gaps.join(', ')}`,
  );
});

test('counts a truncated HTTP failure only once', async () => {
  const url = await startServer((_request, response) => {
    response.writeHead(503, { 'content-length': '100' });
    response.write('unavailable');
    setTimeout(() => response.destroy(), 30);
  });

  const result = await runLoadProbe({
    url,
    durationSeconds: 0.05,
    requestsPerSecond: 20,
    concurrency: 1,
  });

  assert.equal(result.statusCounts['503'], 1);
  assert.equal(result.networkErrorCount, 1);
  assert.equal(result.errorCount, 1);
});
