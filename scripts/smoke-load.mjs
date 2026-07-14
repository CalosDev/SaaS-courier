import { performance } from "node:perf_hooks";

const baseUrl = (process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const total = Number.parseInt(process.env.LOAD_REQUESTS || "200", 10);
const concurrency = Number.parseInt(process.env.LOAD_CONCURRENCY || "20", 10);
const maxErrorRate = Number.parseFloat(process.env.LOAD_MAX_ERROR_RATE || "0.01");
const maxP95Ms = Number.parseInt(process.env.LOAD_MAX_P95_MS || "750", 10);
const paths = ["/health/live", "/health/ready"];
const latencies = [];
let errors = 0;
let cursor = 0;

async function worker() {
  while (cursor < total) {
    const index = cursor++;
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${paths[index % paths.length]}`);
      if (!response.ok) errors += 1;
      await response.arrayBuffer();
    } catch {
      errors += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
latencies.sort((left, right) => left - right);
const p95 = latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] || 0;
const errorRate = errors / total;

console.log(JSON.stringify({ baseUrl, total, concurrency, errors, errorRate, p95Ms: Math.round(p95) }, null, 2));
if (errorRate > maxErrorRate || p95 > maxP95Ms) process.exitCode = 1;
