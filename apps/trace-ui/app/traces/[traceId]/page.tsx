import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Cpu, Layers, Network, Timer } from "lucide-react";
import { fetchTrace, fetchTraceSpans } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type TraceDetailPageProps = {
  params: Promise<{ traceId: string }>;
};

const formatter = {
  duration: (value?: number) => (value ? `${value.toFixed(2)} ms` : "—"),
  cost: (value?: number) => (value ? `$${value.toFixed(4)}` : "—"),
  date: (value?: string) => (value ? new Date(value).toLocaleString() : "—")
};

type SpanNode = Awaited<ReturnType<typeof fetchTraceSpans>>[number] & {
  children: SpanNode[];
};

const buildSpanTree = (spans: Awaited<ReturnType<typeof fetchTraceSpans>>): SpanNode[] => {
  const nodes = new Map<string, SpanNode>();
  spans.forEach((span) => nodes.set(span.span_id, { ...span, children: [] }));

  const roots: SpanNode[] = [];
  nodes.forEach((node) => {
    if (node.parent_span_id && nodes.has(node.parent_span_id)) {
      nodes.get(node.parent_span_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

const buildTimeline = (spans: Awaited<ReturnType<typeof fetchTraceSpans>>) => {
  const sorted = spans
    .map((span) => {
      const start = span.start_time ? new Date(span.start_time).getTime() : 0;
      const end = span.end_time ? new Date(span.end_time).getTime() : start + (span.duration_ms ?? 0);
      return {
        id: span.span_id,
        name: span.name,
        start,
        end,
        duration: span.duration_ms ?? end - start,
        status: span.status_code ?? "OK"
      };
    })
    .sort((a, b) => a.start - b.start);

  if (!sorted.length) return [];
  const min = sorted[0].start;
  const max = sorted.reduce((acc, span) => Math.max(acc, span.end), sorted[0].end);
  const total = max - min || 1;

  return sorted.map((span) => ({
    ...span,
    offset: ((span.start - min) / total) * 100,
    width: ((span.end - span.start) / total) * 100
  }));
};

const renderSpanNode = (node: SpanNode): ReactNode => (
  <li key={node.span_id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-slate-200">
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">{node.span_id.slice(0, 10)}…</span>
          <span className="text-sm font-semibold text-white">{node.name}</span>
          <Badge className="bg-white/10 text-slate-200 border border-white/10">{node.kind ?? "SPAN"}</Badge>
        </div>
        <Badge className="bg-cyan-500/20 text-cyan-200 border border-cyan-500/30">{formatter.duration(node.duration_ms)}</Badge>
      </div>
      <p className="text-xs text-slate-500">
        Status: {node.status_code ?? "OK"} · parent {node.parent_span_id ? node.parent_span_id.slice(0, 8) : "root"}
      </p>
    </div>
    {node.children.length > 0 && (
      <ul className="mt-3 space-y-2 border-l border-dashed border-white/20 pl-4">{node.children.map((child) => renderSpanNode(child))}</ul>
    )}
  </li>
);

export default async function TraceDetail({ params }: TraceDetailPageProps) {
  const resolvedParams = await params;
  const [trace, spans] = await Promise.all([
    fetchTrace(resolvedParams.traceId),
    fetchTraceSpans(resolvedParams.traceId)
  ]);
  const spanTree = buildSpanTree(spans);
  const timeline = buildTimeline(spans);

  const attributes = [
    { label: "Environment", value: trace.environment ?? "demo" },
    { label: "Model", value: trace.model ?? "n/a" },
    { label: "Tokens", value: `${trace.token_in ?? 0}/${trace.token_out ?? 0}` },
    { label: "Span count", value: trace.span_count ?? spans.length },
    { label: "Cost", value: formatter.cost(trace.cost_usd_estimate) },
    { label: "Started", value: formatter.date(trace.started_at) }
  ];

  return (
    <section className="space-y-8 text-slate-200">
      <div className="bento-card glass-highlight p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Trace detail</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-white">{trace.root_span_name ?? "Agent run"}</h1>
            <p className="mt-2 font-mono text-xs text-slate-500">{trace.trace_id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              className={trace.error_type ? "bg-rose-500/20 text-rose-200 border border-rose-500/40" : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"}
            >
              {trace.error_type ? trace.error_type : trace.status_code ?? "OK"}
            </Badge>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to explorer
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Service</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
              <Network className="h-4 w-4 text-cyan-400" />
              {trace.service_name ?? "Unknown"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Duration</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
              <Timer className="h-4 w-4 text-emerald-400" />
              {formatter.duration(trace.duration_ms)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Cost</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
              <Layers className="h-4 w-4 text-amber-400" />
              {formatter.cost(trace.cost_usd_estimate)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="bento-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-white">Runtime anatomy</h2>
            <p className="text-xs text-slate-500">A combined timeline + depth map for every persisted span.</p>
          </div>
          {timeline.length ? (
            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              {timeline.map((span) => (
                <div key={span.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{span.name}</span>
                    <span>{formatter.duration(span.duration)}</span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-white/10">
                    <div
                      className="absolute h-2 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                      style={{ left: `${span.offset}%`, width: `${Math.max(span.width, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              No span timeline available for this trace.
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-white">Span hierarchy</p>
            {spanTree.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                No spans were persisted for this trace.
              </div>
            ) : (
              <ScrollArea className="mt-4 h-[420px] rounded-3xl border border-white/10 bg-white/5 p-4">
                <ul className="space-y-3">{spanTree.map((node) => renderSpanNode(node))}</ul>
              </ScrollArea>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="bento-card p-6">
            <h2 className="text-lg font-medium text-white">Trace metadata</h2>
            <p className="text-xs text-slate-500 mb-4">Key-value pairs extracted from the source payload.</p>
            <div className="grid gap-4">
              {attributes.map((attribute) => (
                <div key={attribute.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{attribute.label}</p>
                  <p className="mt-2 font-mono text-sm text-slate-200 break-all">{attribute.value ?? "n/a"}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bento-card p-6 space-y-4">
            <h2 className="text-lg font-medium text-white">Agent runtime</h2>
            <p className="text-xs text-slate-500">CPU/memory costs are approximated per span.</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">CPU Allocation</p>
              <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
                <Cpu className="h-4 w-4 text-cyan-400" />
                1 vCPU burst
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Memory</p>
              <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
                <Network className="h-4 w-4 text-cyan-400" />
                512 MB reserved
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
