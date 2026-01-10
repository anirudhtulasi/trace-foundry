import Link from "next/link";
import { fetchTraces } from "@/lib/api";
import { cn } from "@/lib/utils";

const formatter = {
  date: (value?: string) => (value ? new Date(value).toLocaleString() : "—"),
  duration: (value?: number) => (value ? `${value.toFixed(2)} ms` : "—"),
  cost: (value?: number) => (value ? `$${value.toFixed(4)}` : "—")
};

const statusTone = (status?: string | null, hasError?: boolean) => {
  if (hasError || status?.toLowerCase().includes("error")) {
    return {
      dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]",
      ping: "bg-rose-500",
      label: "Error"
    };
  }
  if (status?.toLowerCase().includes("retry")) {
    return {
      dot: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
      ping: "bg-amber-400",
      label: "Retrying"
    };
  }
  return {
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    ping: "bg-emerald-500",
    label: "Success"
  };
};

type HomePageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

type TraceList = Awaited<ReturnType<typeof fetchTraces>>;
type VolumePoint = { timestamp: number; count: number };

const viewPresets = [
  { id: "all", label: "All traffic", description: "Every trace emitted by demo-agent fleet" },
  { id: "errors", label: "Erroring", description: "status_code or error_type populated" },
  { id: "slow", label: "Slow (>2s)", description: "bubbles up potential latency regressions" }
] as const;

const VOLUME_BUCKET_MS = 5 * 60 * 1000;

const filterTraces = (collection: TraceList, view: string) => {
  if (view === "errors") {
    return collection.filter((trace) => Boolean(trace.error_type || trace.status_code?.toLowerCase().includes("error")));
  }
  if (view === "slow") {
    return collection.filter((trace) => (trace.duration_ms ?? 0) > 2000);
  }
  return collection;
};

const buildVolumeSeries = (traces: TraceList): VolumePoint[] => {
  const buckets: Record<number, number> = {};
  traces.forEach((trace) => {
    if (!trace.started_at) return;
    const timestamp = new Date(trace.started_at).getTime();
    if (Number.isNaN(timestamp)) return;
    const bucket = Math.floor(timestamp / VOLUME_BUCKET_MS) * VOLUME_BUCKET_MS;
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  });
  return Object.entries(buckets)
    .map(([key, count]) => ({ timestamp: Number(key), count }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const buildSparkline = (points: VolumePoint[]) => {
  if (!points.length) {
    return { line: "", fill: "", dots: [] as { cx: number; cy: number }[] };
  }
  const maxCount = Math.max(...points.map((point) => point.count));
  const width = Math.max(points.length - 1, 1);
  const minY = 20;
  const maxY = 90;

  const commands = points.map((point, idx) => {
    const x = (idx / width) * 100;
    const normalized = point.count / maxCount;
    const y = maxY - normalized * (maxY - minY);
    return { command: `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`, cx: x, cy: y };
  });

  return {
    line: commands.map((entry) => entry.command).join(" "),
    fill: `${commands.map((entry) => entry.command).join(" ")} L 100 100 L 0 100 Z`,
    dots: commands.map((entry) => ({ cx: entry.cx, cy: entry.cy }))
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const activeView = resolvedSearchParams?.view ?? "all";
  const traces = await fetchTraces();
  const filteredTraces = filterTraces(traces, activeView);
  const totalTraces = traces.length;
  const dataset = filteredTraces;
  const datasetCount = dataset.length;
  const presetMeta = viewPresets.find((preset) => preset.id === activeView);

  const errorCount = dataset.filter((trace) => trace.status_code?.toLowerCase().includes("error") || trace.error_type).length;
  const successRate = datasetCount ? ((datasetCount - errorCount) / datasetCount) * 100 : 0;
  const slowTraces = dataset.filter((trace) => (trace.duration_ms ?? 0) > 2000).length;
  const avgDuration = datasetCount ? dataset.reduce((acc, t) => acc + (t.duration_ms ?? 0), 0) / datasetCount : 0;
  const totalCost = dataset.reduce((acc, trace) => acc + (trace.cost_usd_estimate ?? 0), 0);
  const avgCost = datasetCount ? totalCost / datasetCount : 0;
  const totalTokens = dataset.reduce(
    (acc, trace) => acc + ((trace.token_in ?? 0) + (trace.token_out ?? 0)),
    0
  );
  const avgTokens = datasetCount ? Math.round(totalTokens / datasetCount) : 0;
  const latestTrace = dataset[0] ?? traces[0];

  const serviceBreakdown = Object.entries(
    dataset.reduce<Record<string, number>>((acc, trace) => {
      if (!trace.service_name) return acc;
      acc[trace.service_name] = (acc[trace.service_name] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const latestAnomaly = dataset.find((trace) => trace.error_type || trace.status_code?.toLowerCase().includes("error"));
  const volumeSeries = buildVolumeSeries(dataset);
  const sparkline = buildSparkline(volumeSeries);
  const viewSummaries = viewPresets.map((preset) => ({
    ...preset,
    count: filterTraces(traces, preset.id).length
  }));
  const healthLabel = datasetCount ? (successRate >= 95 ? "Optimal" : successRate >= 80 ? "Watch" : "Critical") : "No data";

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 text-slate-300 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/70 font-mono">{presetMeta?.label ?? "All traffic"}</p>
          <h1 className="text-3xl font-extralight tracking-tight text-white">Ops Console</h1>
          <p className="text-sm text-slate-500">
            {presetMeta?.description ?? "Real-time observability and ingestion health monitoring."}
          </p>
          <p className="text-xs text-slate-600 font-mono mt-2">
            Showing {datasetCount} of {totalTraces} traces · Last trace{" "}
            {latestTrace ? formatter.date(latestTrace.started_at) : "n/a"}
          </p>
          {datasetCount === 0 && (
            <p className="mt-1 text-xs text-rose-400">No traces match this preset — switch filters to see results.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="http://localhost:8000/docs"
            target="_blank"
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-mono font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            OPEN DOCS
          </Link>
          <Link
            href="http://localhost:8000/api/traces"
            target="_blank"
            className="px-4 py-2 bg-cyan-950/30 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            EXPORT JSON
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group glass-highlight">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-[0.2em] font-mono">Success Rate</p>
          </div>
          <div className="relative z-10 mt-4">
            <span className="text-4xl font-mono font-medium tracking-tight text-white neon-text-glow">
              {successRate.toFixed(1)}%
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {datasetCount ? `${datasetCount - errorCount} success · ${errorCount} errors` : "No data"}
            </p>
          </div>
          <div className="w-full h-12 relative z-10 mt-auto">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
              <defs>
                <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d="M0 30 C 10 32, 20 25, 30 28 S 50 15, 60 20 S 80 5, 100 10"
                stroke="#22d3ee"
                strokeWidth="2"
                fill="none"
                vectorEffect="non-scaling-stroke"
                filter="url(#glow-green)"
              />
            </svg>
          </div>
        </div>
        <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-30">
            <span className="material-symbols-outlined text-slate-400">timeline</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] font-mono">Active Traces</p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-mono font-medium tracking-tight text-slate-200">{datasetCount}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Filtered view from deterministic agent runs.</p>
          </div>
          <div className="w-full h-12 relative mt-auto opacity-60 group-hover:opacity-100 transition-opacity">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
              <path
                d="M0 20 Q 25 30, 50 15 T 100 25"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
        <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-30">
            <span className="material-symbols-outlined text-slate-400">schedule</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] font-mono">Avg Latency</p>
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-4xl font-mono font-medium tracking-tight text-slate-200">
                {Math.round(avgDuration)}
                <span className="text-lg text-slate-500 ml-1">ms</span>
              </span>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                {datasetCount ? `${slowTraces} slow` : "—"}
              </span>
            </div>
          </div>
          <div className="w-full h-12 relative mt-auto opacity-80">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
              <path
                d="M0 35 L 20 30 L 30 35 L 50 15 L 70 25 L 100 10"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
        <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-30">
            <span className="material-symbols-outlined text-slate-400">token</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] font-mono">Token Usage</p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-mono font-medium tracking-tight text-slate-200">{avgTokens}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Average per trace (in/out combined)</p>
          </div>
          <div className="w-full h-12 relative mt-auto opacity-60 group-hover:opacity-100 transition-opacity">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
              <path
                d="M0 35 C 30 35, 60 10, 100 5"
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="bento-card p-8 flex flex-col relative overflow-hidden col-span-1 lg:col-span-3">
          <div className="flex flex-wrap justify-between items-start mb-6 z-10 gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">Live Ingestion Pulse</h3>
              <p className="text-xs font-mono text-slate-500 mt-1">Event volume (5 min buckets)</p>
            </div>
            <div className="flex bg-slate-800/50 border border-white/5 p-1 rounded-lg backdrop-blur-md text-[10px] font-mono text-slate-500">
              <span className="px-3 py-1 rounded bg-white/10 text-white">Live</span>
            </div>
          </div>
          <div className="flex-1 w-full relative min-h-[280px] z-10">
            {volumeSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No datapoints for this filter yet.
              </div>
            ) : (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mainChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                  <filter id="glow-line" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <line x1="0" x2="100" y1="20" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" x2="100" y1="40" y2="40" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" x2="100" y1="60" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" x2="100" y1="80" y2="80" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <path d={sparkline.fill} fill="url(#mainChartGradient)" opacity="0.3" />
                <path d={sparkline.line} fill="none" stroke="#22d3ee" strokeWidth="1.5" vectorEffect="non-scaling-stroke" filter="url(#glow-line)" />
              </svg>
            )}
          </div>
        </div>
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bento-card p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20 shadow-[0_0_10px_rgba(251,146,60,0.1)]">
              <span className="material-symbols-outlined text-[20px]">monetization_on</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] font-mono">Est. Cost</p>
              <p className="text-xl font-mono font-medium text-slate-200 mt-0.5">{formatter.cost(totalCost)}</p>
            </div>
          </div>
          <div className="bento-card p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
              <span className="material-symbols-outlined text-[20px]">alt_route</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] font-mono">Services</p>
              <p className="text-xl font-mono font-medium text-slate-200 mt-0.5">{serviceBreakdown.length || 0} observed</p>
            </div>
          </div>
          <div className="bento-card p-6 flex items-center gap-4 bg-gradient-to-br from-cyan-950/40 to-slate-900/50 border-cyan-500/20 relative">
            <div className="absolute inset-0 bg-cyan-500/5 blur-xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                <span className="material-symbols-outlined text-[20px]">bolt</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-[0.2em] font-mono">Health</p>
                <p className="text-xl font-mono font-medium text-white mt-0.5 neon-text-glow">{healthLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bento-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Agent leaderboard</p>
              <p className="text-sm text-slate-400">Which services emit the most telemetry.</p>
            </div>
            <span className="text-xs font-mono text-slate-500">Top 3</span>
          </div>
          <div className="space-y-4">
            {serviceBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No services detected.</p>
            ) : (
              serviceBreakdown.map(([service, count], index) => (
                <Link
                  key={service}
                  href={`/traces?service=${encodeURIComponent(service)}`}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 hover:border-cyan-500/30 transition"
                >
                  <div>
                    <p className="text-slate-200">{service}</p>
                    <p className="text-xs text-slate-500">{count} traces</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-cyan-400">RANK {index + 1}</p>
                    <p className="text-xl font-mono text-slate-100">{count}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="bento-card p-6 space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Quality Window</p>
            <p className="text-3xl font-mono text-white mt-2">{successRate.toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Success calculated using OTLP status codes across the filtered slice.</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Latest Anomaly</p>
            <p className="text-sm text-slate-300 mt-2">
              {latestAnomaly ? `${latestAnomaly.service_name ?? "demo"} · ${latestAnomaly.status_code}` : "No errors in current filter"}
            </p>
          </div>
        </div>
        <div className="bento-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Signal Filters</p>
              <p className="text-xs text-slate-500">Slice the dataset to focus on anomaly buckets.</p>
            </div>
            <span className="material-symbols-outlined text-slate-500">tune</span>
          </div>
          <div className="space-y-3">
            {viewSummaries.map((preset) => {
              const href = preset.id === "all" ? "/" : `/?view=${preset.id}`;
              const isActive = activeView === preset.id;
              return (
                <Link
                  key={preset.id}
                  href={href}
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-white/5 px-4 py-3 transition",
                    isActive ? "bg-cyan-500/10 border-cyan-500/30 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{preset.label}</p>
                    <p className="text-xs text-slate-500">{preset.description}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{preset.count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bento-card p-6">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4 px-1">
          <div>
            <h3 className="text-lg font-medium text-slate-200">Recent Activity</h3>
            <p className="text-xs font-mono text-slate-500 mt-1">Live stream of agent interactions and spans</p>
          </div>
          <Link
            href="/traces"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
          >
            VIEW TRACE TABLE
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
            <div className="col-span-3">Trace / Service</div>
            <div className="col-span-2">Environment</div>
            <div className="col-span-2">Model</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Duration</div>
            <div className="col-span-1 text-right">Tokens</div>
          </div>
          {filteredTraces.length === 0 ? (
            <p className="text-sm text-slate-500 px-6 py-4">No traces match this filter.</p>
          ) : (
            filteredTraces.slice(0, 12).map((trace) => {
              const status = statusTone(trace.status_code, Boolean(trace.error_type));
              const tokenCount = (trace.token_in ?? 0) + (trace.token_out ?? 0);
              return (
                <Link
                  href={`/traces/${trace.trace_id}`}
                  key={trace.trace_id}
                  className="group relative bg-white/[0.02] border border-white/5 rounded-xl p-4 grid grid-cols-12 items-center hover:bg-white/[0.04] hover:border-white/10 hover:shadow-lg transition-all duration-300"
                >
                  <div className="col-span-3">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">hub</span>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-cyan-500/80 mb-0.5">
                          {trace.trace_id?.slice(0, 10)}...
                        </p>
                        <p className="text-sm font-medium text-slate-300 group-hover:text-white">
                          {trace.service_name ?? "demo"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-white/5 border border-white/5 uppercase tracking-widest">
                      {trace.environment ?? "demo"}
                    </span>
                  </div>
                  <div className="col-span-2 text-xs font-mono text-slate-400">{trace.model ?? "n/a"}</div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-2 w-2">
                        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", status.ping)} />
                        <span className={cn("relative inline-flex rounded-full h-2 w-2", status.dot)} />
                      </div>
                      <span className="text-xs font-medium text-slate-300">
                        {trace.error_type ?? trace.status_code ?? status.label}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2 font-mono text-xs text-slate-400">{formatter.duration(trace.duration_ms)}</div>
                  <div className="col-span-1 text-right font-mono text-xs text-slate-400">{tokenCount}</div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
