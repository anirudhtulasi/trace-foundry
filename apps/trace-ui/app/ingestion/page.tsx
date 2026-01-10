import Link from "next/link";

export default function IngestionPage() {
  return (
    <section className="space-y-6 pt-8 text-slate-300">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/70 font-mono">Collector</p>
        <h1 className="text-3xl font-extralight tracking-tight text-white">Ingestion surface</h1>
        <p className="text-sm text-slate-500">Monitor OTLP entrypoints and jump into docs when you need deeper detail.</p>
      </div>
      <div className="bento-card p-6">
        <p className="text-sm text-slate-400">
          Use the TraceFoundry ingest API to push deterministic demo traffic or wire up your own collector.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-mono">
          <Link
            href="http://localhost:8000/docs"
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-200 hover:bg-white/10 transition"
          >
            Open API docs
          </Link>
          <Link
            href="http://localhost:8000/healthz"
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-200 hover:bg-white/10 transition"
          >
            Check health
          </Link>
        </div>
      </div>
    </section>
  );
}
