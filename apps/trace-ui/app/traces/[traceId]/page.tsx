import Link from "next/link";
import { ArrowLeft, Cpu, Layers, Network, Timer } from "lucide-react";
import { fetchTrace, fetchTraceSpans } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type TraceDetailPageProps = {
  params: { traceId: string };
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

const renderSpanNode = (node: SpanNode): JSX.Element => (
  <li key={node.span_id} className="space-y-1 rounded-xl border border-slate-100 bg-white/90 p-3 shadow-sm">
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">{node.span_id.slice(0, 10)}…</span>
          <span className="text-sm font-semibold text-slate-900">{node.name}</span>
          <Badge variant="outline">{node.kind ?? "SPAN"}</Badge>
        </div>
        <Badge variant="info">{formatter.duration(node.duration_ms)}</Badge>
      </div>
      <p className="text-xs text-slate-500">
        Status: {node.status_code ?? "OK"} · parent {node.parent_span_id ? node.parent_span_id.slice(0, 8) : "root"}
      </p>
    </div>
    {node.children.length > 0 && (
      <ul className="mt-3 space-y-2 border-l border-dashed border-slate-200 pl-4">
        {node.children.map((child) => renderSpanNode(child))}
      </ul>
    )}
  </li>
);

export default async function TraceDetail({ params }: TraceDetailPageProps) {
  const [trace, spans] = await Promise.all([fetchTrace(params.traceId), fetchTraceSpans(params.traceId)]);
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
    <section className="space-y-10">
      <div className="rounded-[28px] border border-slate-100 bg-white/90 p-8 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.6)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Trace detail</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">
              {trace.root_span_name ?? "Agent run"}
            </h1>
            <p className="mt-2 font-mono text-xs text-slate-500">{trace.trace_id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={trace.error_type ? "destructive" : "success"}>
              {trace.error_type ? trace.error_type : trace.status_code ?? "OK"}
            </Badge>
            <Link href="/" className={buttonClass("ghost", "text-slate-600 hover:text-slate-900")}>
              <span className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to explorer
              </span>
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Service</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <Network className="h-4 w-4 text-brand-500" />
              {trace.service_name ?? "Unknown"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Duration</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <Timer className="h-4 w-4 text-emerald-500" />
              {formatter.duration(trace.duration_ms)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Cost</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <Layers className="h-4 w-4 text-amber-500" />
              {formatter.cost(trace.cost_usd_estimate)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-xl">Runtime anatomy</CardTitle>
            <CardDescription>A combined timeline + depth map for every persisted span.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-6">
            {timeline.length ? (
              <div className="space-y-3 rounded-3xl border border-slate-100 bg-white/90 p-4">
                {timeline.map((span) => (
                  <div key={span.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{span.name}</span>
                      <span>{formatter.duration(span.duration)}</span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="absolute h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        style={{ left: `${span.offset}%`, width: `${Math.max(span.width, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No span timeline available for this trace.
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-slate-900">Span hierarchy</p>
              {spanTree.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  No spans were persisted for this trace.
                </div>
              ) : (
                <ScrollArea className="mt-4 h-[420px] rounded-3xl border border-slate-100 bg-white/90 p-4">
                  <ul className="space-y-3">{spanTree.map((node) => renderSpanNode(node))}</ul>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white">
            <CardHeader>
              <CardTitle>Trace summary</CardTitle>
              <CardDescription className="text-slate-300">
                Snapshot of metadata stored alongside the trace document.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-200">
              {attributes.map((attr) => (
                <div key={attr.label} className="flex justify-between border-b border-white/10 pb-3">
                  <span>{attr.label}</span>
                  <span className="font-semibold text-white">{attr.value}</span>
                </div>
              ))}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Error metadata</p>
                <p className="text-sm leading-relaxed">
                  {trace.error_type ? `Reported as ${trace.error_type}` : "No errors propagated to root span."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-brand-500" />
                Resource attributes
              </CardTitle>
              <CardDescription>Quick peek at OTLP resource hints.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span>Idempotency</span>
                <Badge variant="success">trace_id + span_id</Badge>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Payload policy</p>
                <p className="mt-1 text-sm text-slate-700">
                  Prompts/tool payloads stored via blob refs (see ingest payload store on disk).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
