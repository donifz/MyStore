const { performance } = require('node:perf_hooks');

const DEFAULT_URL =
  'http://127.0.0.1:3001/api/public/products?page=1&pageSize=20';
const MAX_DURATION_SECONDS = 300;
const MAX_REQUESTS_PER_SECOND = 1000;
const MAX_CONCURRENCY = 500;

function validateOptions({
  url,
  durationSeconds,
  requestsPerSecond,
  concurrency,
  allowRemote,
}) {
  const parsedUrl = new URL(url);
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  const isLoopback = loopbackHosts.has(parsedUrl.hostname);

  if (!isLoopback && !allowRemote)
    throw new Error(
      'LOAD_URL must use a loopback URL unless remote access is explicit',
    );
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')
    throw new Error('LOAD_URL must use HTTP or HTTPS');
  if (!isLoopback && parsedUrl.protocol !== 'https:')
    throw new Error('Remote LOAD_URL must use HTTPS');
  if (parsedUrl.username || parsedUrl.password)
    throw new Error('LOAD_URL must not contain credentials');
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    throw new Error('durationSeconds must be a positive number');
  if (durationSeconds > MAX_DURATION_SECONDS)
    throw new Error(`durationSeconds must not exceed ${MAX_DURATION_SECONDS}`);
  if (!Number.isInteger(requestsPerSecond) || requestsPerSecond < 1)
    throw new Error('requestsPerSecond must be a positive integer');
  if (requestsPerSecond > MAX_REQUESTS_PER_SECOND)
    throw new Error(
      `requestsPerSecond must not exceed ${MAX_REQUESTS_PER_SECOND}`,
    );
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new Error('concurrency must be a positive integer');
  if (concurrency > MAX_CONCURRENCY)
    throw new Error(`concurrency must not exceed ${MAX_CONCURRENCY}`);

  return parsedUrl;
}

function percentile(samples, percentileValue) {
  if (samples.length === 0) return null;
  const index = Math.max(
    0,
    Math.ceil((percentileValue / 100) * samples.length) - 1,
  );
  return Number(samples[index].toFixed(2));
}

async function runLoadProbe({
  url = DEFAULT_URL,
  durationSeconds = 30,
  requestsPerSecond = 50,
  concurrency = 200,
  fetchImpl = fetch,
  allowRemote = false,
}) {
  const parsedUrl = validateOptions({
    url,
    durationSeconds,
    requestsPerSecond,
    concurrency,
    allowRemote,
  });
  const startAt = performance.now();
  const deadline = startAt + durationSeconds * 1000;
  const samples = [];
  const statusCounts = {};
  let nextRequestIndex = 0;
  let errorCount = 0;
  let networkErrorCount = 0;
  let activeRequests = 0;
  let maxConcurrentRequests = 0;

  async function worker() {
    while (true) {
      const requestIndex = nextRequestIndex++;
      const scheduledAt = startAt + (requestIndex * 1000) / requestsPerSecond;
      if (scheduledAt >= deadline) return;

      const delay = scheduledAt - performance.now();
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

      const requestStart = performance.now();
      activeRequests++;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
      try {
        const response = await fetchImpl(parsedUrl, {
          headers: { 'user-agent': 'mystore-ops-load-probe/1.0' },
          signal: AbortSignal.timeout(10000),
        });
        statusCounts[response.status] =
          (statusCounts[response.status] ?? 0) + 1;
        if (!response.ok) errorCount++;
        await response.body?.cancel().catch(() => {});
        samples.push(performance.now() - requestStart);
      } catch {
        networkErrorCount++;
        errorCount++;
        statusCounts.network_error = (statusCounts.network_error ?? 0) + 1;
        samples.push(performance.now() - requestStart);
      } finally {
        activeRequests--;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSeconds = (performance.now() - startAt) / 1000;
  samples.sort((left, right) => left - right);
  const latencyMs = {
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    max: samples.length ? Number(samples.at(-1).toFixed(2)) : null,
  };

  return {
    origin: parsedUrl.origin,
    durationSeconds,
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    targetRequestsPerSecond: requestsPerSecond,
    actualRequestsPerSecond: Number(
      (samples.length / elapsedSeconds).toFixed(2),
    ),
    concurrency,
    maxConcurrentRequests,
    requestCount: samples.length,
    statusCounts,
    networkErrorCount,
    errorCount,
    latencyMs,
  };
}

async function main() {
  const result = await runLoadProbe({
    url: process.env.LOAD_URL ?? DEFAULT_URL,
    durationSeconds: Number(process.env.LOAD_DURATION_SECONDS ?? 30),
    requestsPerSecond: Number(process.env.LOAD_REQUESTS_PER_SECOND ?? 50),
    concurrency: Number(process.env.LOAD_CONCURRENCY ?? 200),
    allowRemote: process.env.LOAD_ALLOW_REMOTE === '1',
  });
  console.log(JSON.stringify(result, null, 2));

  const maxP95Ms = Number(process.env.LOAD_MAX_P95_MS ?? 1000);
  if (result.errorCount > 0 || result.latencyMs.p95 > maxP95Ms)
    process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_URL, runLoadProbe };
