import Link from "next/link";
import { fetchTraces } from "@/lib/api";

type TracesPageProps = {
  searchParams?: Promise<{
    service?: string;
    env?: string;
    status?: string;
    model?: string;
  }>;
};

const formatter = {
  date: (value?: string) => (value ? new Date(value).toLocaleString() : "—"),
  duration: (value?: number) => (value ? `${value.toFixed(2)} ms` : "—"),
  cost: (value?: number) => (value ? `$${value.toFixed(4)}` : "—")
};

export default async function TracesPage({ searchParams }: TracesPageProps) {
  const params = await searchParams;
  const traces = await fetchTraces();
  const filters = {
    service: params?.service ?? "",
    env: params?.env ?? "",
    status: params?.status ?? "",
    model: params?.model ?? ""
  };

  const filtered = traces.filter((trace) => {
    if (filters.service && trace.service_name !== filters.service) return false;
    if (filters.env && trace.environment !== filters.env) return false;
    if (filters.status && trace.status_code !== filters.status) return false;
    if (filters.model && trace.model !== filters.model) return false;
    return true;
  });

  const uniques = {
    services: Array.from(new Set(traces.map((trace) => trace.service_name).filter(Boolean))),
    envs: Array.from(new Set(traces.map((trace) => trace.environment).filter(Boolean))),
    statuses: Array.from(new Set(traces.map((trace) => trace.status_code).filter(Boolean))),
    models: Array.from(new Set(traces.map((trace) => trace.model).filter(Boolean)))
  };

  const errorCount = filtered.filter((trace) => trace.status_code?.toLowerCase().includes("error") || trace.error_type).length;
  const successRate = filtered.length ? ((filtered.length - errorCount) / filtered.length) * 100 : 0;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 text-slate-300 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/70 font-mono">Trace explorer</p>
          <h1 className="text-3xl font-extralight tracking-tight text-white">Trace catalog</h1>
          <p className="text-sm text-slate-500">Inspect and filter the latest ingested traces.</p>
          <p className="text-xs text-slate-600 font-mono mt-2">
            {filtered.length} results · success rate {successRate.toFixed(1)}%
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-mono font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 backdrop-blur-sm"
        >
          <span className="material-symbols-outlined text-[16px]">dashboard</span>
          BACK TO DASHBOARD
        </Link>
      </div>

      <form className="bento-card p-6 grid gap-4 md:grid-cols-4 text-sm text-slate-400" method="get">
        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Service</span>
          <select
            name="service"
            defaultValue={filters.service}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400/50"
          >
            <option value="">All services</option>
            {uniques.services.map((service) => (
              <option key={service} value={service ?? ""}>
                {service}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Environment</span>
          <select
            name="env"
            defaultValue={filters.env}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400/50"
          >
            <option value="">All environments</option>
            {uniques.envs.map((env) => (
              <option key={env} value={env ?? ""}>
                {env}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Status</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400/50"
          >
            <option value="">All statuses</option>
            {uniques.statuses.map((status) => (
              <option key={status} value={status ?? ""}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-mono text-slate-500">Model</span>
          <select
            name="model"
            defaultValue={filters.model}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400/50"
          >
            <option value="">All models</option>
            {uniques.models.map((model) => (
              <option key={model} value={model ?? ""}>
                {model}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-4 flex items-center justify-end gap-3 pt-2 text-xs font-mono">
          <Link href="/traces" className="text-slate-500 hover:text-slate-200">
            Reset
          </Link>
          <button
            type="submit"
            className="px-4 py-2 bg-cyan-950/30 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-900/40 hover:border-cyan-400/50 transition"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="bento-card p-6">
        <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
          <div className="col-span-3">Trace</div>
          <div className="col-span-2">Service</div>
          <div className="col-span-2">Environment</div>
          <div className="col-span-2">Started</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-1 text-right">Cost</div>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 px-6 py-4">No traces match the selected filters.</p>
        ) : (
          filtered.map((trace) => (
            <Link
              key={trace.trace_id}
              href={`/traces/${trace.trace_id}`}
              className="grid grid-cols-12 px-6 py-3 rounded-xl border border-white/5 bg-white/5 mb-2 text-sm text-slate-200 hover:border-cyan-500/30 transition"
            >
              <span className="col-span-3 font-mono text-[10px] text-cyan-500/80">{trace.trace_id}</span>
              <span className="col-span-2">{trace.service_name ?? "demo"}</span>
              <span className="col-span-2 uppercase tracking-widest text-[10px]">{trace.environment ?? "demo"}</span>
              <span className="col-span-2 text-slate-400">{formatter.date(trace.started_at)}</span>
              <span className="col-span-2 text-slate-400">{formatter.duration(trace.duration_ms)}</span>
              <span className="col-span-1 text-right font-mono text-xs text-slate-400">{formatter.cost(trace.cost_usd_estimate)}</span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
