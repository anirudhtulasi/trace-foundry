import Link from "next/link";
import { Activity, AlertTriangle, CircleDollarSign, Filter, LineChart, Network, Timer } from "lucide-react";
import { fetchTraces } from "@/lib/api";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const formatter = {
  date: (value?: string) => (value ? new Date(value).toLocaleString() : "—"),
  duration: (value?: number) => (value ? `${value.toFixed(2)} ms` : "—"),
  cost: (value?: number) => (value ? `$${value.toFixed(4)}` : "—")
};

const statusTone = (status?: string | null) => {
  if (!status) return "outline";
  if (status?.toLowerCase().includes("error")) return "destructive";
  if (status?.toLowerCase().includes("retry")) return "warning";
  return "info";
};

type HomePageProps = {
  searchParams?: {
    view?: string;
  };
};

const viewPresets = [
  { id: "all", label: "All traffic", description: "Every trace emitted by demo-agent fleet" },
  { id: "errors", label: "Erroring", description: "status_code or error_type populated" },
  { id: "slow", label: "Slow (>2s)", description: "bubbles up potential latency regressions" }
] as const;

export default async function HomePage({ searchParams }: HomePageProps) {
  const activeView = searchParams?.view ?? "all";
  const traces = await fetchTraces();
  const filteredTraces = traces.filter((trace) => {
    if (activeView === "errors") {
      return Boolean(trace.error_type || trace.status_code?.toLowerCase().includes("error"));
    }
    if (activeView === "slow") {
      return (trace.duration_ms ?? 0) > 2000;
    }
    return true;
  });

  const totalTraces = traces.length;
  const avgDuration = totalTraces ? traces.reduce((acc, t) => acc + (t.duration_ms ?? 0), 0) / totalTraces : 0;
  const avgCost = totalTraces ? traces.reduce((acc, t) => acc + (t.cost_usd_estimate ?? 0), 0) / totalTraces : 0;
  const errorCount = traces.filter((trace) => trace.status_code?.toLowerCase().includes("error") || trace.error_type).length;
  const successRate = totalTraces ? ((totalTraces - errorCount) / totalTraces) * 100 : 100;
  const latestTrace = traces[0];

  const serviceBreakdown = Object.entries(
    traces.reduce<Record<string, number>>((acc, trace) => {
      if (!trace.service_name) return acc;
      acc[trace.service_name] = (acc[trace.service_name] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const environmentCounts = Object.entries(
    traces.reduce<Record<string, number>>((acc, trace) => {
      const env = trace.environment ?? "unknown";
      acc[env] = (acc[env] ?? 0) + 1;
      return acc;
    }, {})
  );

  return (
    <section className="space-y-12">
      <div className="overflow-hidden rounded-[32px] border border-white/60 bg-gradient-to-br from-white via-white to-brand-50/40 p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Live analytics</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Trace Explorer for deterministic agent workloads
            </h1>
            <p className="text-base text-slate-600">
              Each row streaming into this surface originated from the OTLP collector and is synced into the TraceFoundry
              Postgres store with payload redaction enforced.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="http://localhost:8000/docs" target="_blank" className={buttonClass()}>
                View ingest API docs
              </Link>
              <Link href="/" className={buttonClass("ghost", "text-slate-700 hover:text-slate-900")}>
                Refresh data
              </Link>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Last trace: {latestTrace ? formatter.date(latestTrace.started_at) : "n/a"}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-slate-900 text-white">
              <CardHeader className="pb-3">
                <CardDescription className="text-slate-300">Success rate</CardDescription>
                <CardTitle className="text-3xl">{successRate.toFixed(1)}%</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300">
                {errorCount} traces surfaced errors in the last ingest window.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardDescription>Avg latency</CardDescription>
                  <CardTitle className="text-3xl">{formatter.duration(avgDuration)}</CardTitle>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <Timer className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="text-sm text-slate-500">
                {formatter.cost(avgCost)} per trace · {totalTraces} traces inspected
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-white/90 shadow-lg shadow-brand-200/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardDescription>Active traces</CardDescription>
              <CardTitle className="text-3xl">{totalTraces}</CardTitle>
            </div>
            <div className="rounded-2xl bg-brand-50 p-3 text-brand-600">
              <Activity className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">Streaming from deterministic demo agent runs.</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardDescription>Cost posture</CardDescription>
              <CardTitle className="text-3xl">{formatter.cost(avgCost)}</CardTitle>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm text-slate-500">
            <span>{errorCount} traces surfaced errors</span>
            <span className="inline-flex items-center text-rose-500">
              <AlertTriangle className="mr-1 h-4 w-4" />
              {((errorCount / Math.max(totalTraces, 1)) * 100).toFixed(0)}%
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardDescription>Environments</CardDescription>
              <CardTitle className="text-3xl">{environmentCounts.length}</CardTitle>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Network className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            {environmentCounts.map(([env, count]) => (
              <div key={env} className="flex items-center justify-between">
                <span>{env}</span>
                <span className="font-semibold text-slate-700">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-brand-100/80 bg-white/80">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Signal filters</CardTitle>
              <CardDescription>Slice the dataset to focus on specific anomalies or latency buckets.</CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              View: {activeView}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {viewPresets.map((preset) => {
              const href = preset.id === "all" ? "/" : `/?view=${preset.id}`;
              const isActive = activeView === preset.id;
              return (
                <Link
                  key={preset.id}
                  href={href}
                  className={cn(
                    "min-w-[200px] rounded-2xl border px-4 py-3 text-sm transition hover:shadow-md",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  <p className="font-semibold">{preset.label}</p>
                  <p className="text-xs text-slate-500">{preset.description}</p>
                </Link>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-xl">Latest traces</CardTitle>
            <CardDescription>Ingest events are idempotent and synced with the Postgres trace store.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trace</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTraces.map((trace) => (
                    <TableRow key={trace.trace_id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold">
                        <Link href={`/traces/${trace.trace_id}`} className="text-brand-600 hover:underline">
                          {trace.trace_id.slice(0, 12)}…
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-600">{trace.service_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{trace.environment ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">{formatter.date(trace.started_at)}</TableCell>
                      <TableCell>{formatter.duration(trace.duration_ms)}</TableCell>
                      <TableCell>
                        {(() => {
                          const label = trace.status_code ?? trace.error_type ?? "OK";
                          return <Badge variant={statusTone(label)}>{label}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell>{trace.model ?? "—"}</TableCell>
                      <TableCell className="text-right text-slate-500">
                        {trace.token_in ?? 0}/{trace.token_out ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <LineChart className="h-4 w-4" />
              Fleet focus
            </CardTitle>
            <CardDescription className="text-slate-300">
              Quick insight into which agents are producing the most telemetry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-slate-200">
            <div className="space-y-3">
              {serviceBreakdown.map(([service, count], idx) => (
                <div key={service} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{service}</span>
                    <span className="text-slate-300">{count} traces</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                      style={{ width: `${(count / Math.max(totalTraces, 1)) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Rank {idx + 1}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Quality window</p>
              <p className="mt-2 text-3xl font-semibold">{successRate.toFixed(1)}%</p>
              <p className="text-sm text-slate-300">
                Success calculated using OTLP status codes across the filtered slice.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Latest anomaly</p>
              <p className="mt-1 text-base">
                {filteredTraces.find((trace) => trace.error_type)?.error_type ?? "No errors in current filter"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
