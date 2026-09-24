/**
 * Lightweight Prometheus-style metrics (no prom-client dependency).
 */

type Counter = { name: string; help: string; labels: Map<string, number> };
type Histogram = {
  name: string;
  help: string;
  buckets: number[];
  counts: Map<string, number[]>;
  sums: Map<string, number>;
};

const counters = new Map<string, Counter>();
const histograms = new Map<string, Histogram>();

function labelKey(labels: Record<string, string>): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(",");
}

export function incCounter(name: string, help: string, labels: Record<string, string> = {}, by = 1) {
  let c = counters.get(name);
  if (!c) {
    c = { name, help, labels: new Map() };
    counters.set(name, c);
  }
  const key = labelKey(labels);
  c.labels.set(key, (c.labels.get(key) ?? 0) + by);
}

export function observeHistogram(
  name: string,
  help: string,
  valueMs: number,
  labels: Record<string, string> = {},
  buckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
) {
  let h = histograms.get(name);
  if (!h) {
    h = { name, help, buckets, counts: new Map(), sums: new Map() };
    histograms.set(name, h);
  }
  const key = labelKey(labels);
  let arr = h.counts.get(key);
  if (!arr) {
    arr = buckets.map(() => 0);
    h.counts.set(key, arr);
  }
  for (let i = 0; i < buckets.length; i++) {
    if (valueMs <= buckets[i]!) arr[i]! += 1;
  }
  h.sums.set(key, (h.sums.get(key) ?? 0) + valueMs);
}

export function renderPrometheus(): string {
  const lines: string[] = [];
  for (const c of counters.values()) {
    lines.push(`# HELP ${c.name} ${c.help}`);
    lines.push(`# TYPE ${c.name} counter`);
    for (const [key, val] of c.labels) {
      const lbl = key ? `{${key}}` : "";
      lines.push(`${c.name}${lbl} ${val}`);
    }
  }
  for (const h of histograms.values()) {
    lines.push(`# HELP ${h.name} ${h.help}`);
    lines.push(`# TYPE ${h.name} histogram`);
    for (const [key, arr] of h.counts) {
      const base = key ? `${key},` : "";
      let cumulative = 0;
      for (let i = 0; i < h.buckets.length; i++) {
        cumulative += arr[i] ?? 0;
        const lbl = `{${base}le="${h.buckets[i]}"}`;
        lines.push(`${h.name}_bucket${lbl} ${cumulative}`);
      }
      const infLbl = `{${base}le="+Inf"}`;
      const total = arr.reduce((a, b) => a + b, 0);
      lines.push(`${h.name}_bucket${infLbl} ${total}`);
      const sumLbl = key ? `{${key}}` : "";
      lines.push(`${h.name}_sum${sumLbl} ${h.sums.get(key) ?? 0}`);
      lines.push(`${h.name}_count${sumLbl} ${total}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function recordHttpRequest(route: string, status: number, durationMs: number) {
  incCounter("hrsign_http_requests_total", "HTTP requests", {
    route,
    status: String(status),
  });
  observeHistogram("hrsign_http_request_duration_ms", "HTTP request duration ms", durationMs, {
    route,
  });
}

export function recordJobFailure(job: string) {
  incCounter("hrsign_job_failures_total", "Background job failures", { job });
}
