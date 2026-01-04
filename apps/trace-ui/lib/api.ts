const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const BASIC_AUTH = process.env.NEXT_PUBLIC_BASIC_AUTH || "viewer:viewer";

const authHeader = `Basic ${Buffer.from(BASIC_AUTH).toString("base64")}`;

type TraceSummary = {
  trace_id: string;
  service_name?: string;
  environment?: string;
  started_at?: string;
  duration_ms?: number;
  root_span_name?: string;
  status_code?: string;
  error_type?: string;
  model?: string;
  token_in?: number;
  token_out?: number;
  cost_usd_estimate?: number;
  span_count?: number;
};

export type SpanRead = {
  span_id: string;
  trace_id: string;
  parent_span_id?: string;
  name: string;
  kind?: string;
  start_time?: string;
  end_time?: string;
  duration_ms?: number;
  status_code?: string;
  attributes?: Record<string, unknown>;
  resource?: Record<string, unknown>;
};

async function request(path: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: authHeader
    },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchTraces(): Promise<TraceSummary[]> {
  return request("/api/traces");
}

export async function fetchTrace(traceId: string): Promise<TraceSummary> {
  return request(`/api/traces/${traceId}`);
}

export async function fetchTraceSpans(traceId: string): Promise<SpanRead[]> {
  return request(`/api/traces/${traceId}/spans`);
}
