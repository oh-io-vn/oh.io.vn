import type { Env } from "./types";
export interface Usage {
  at: number;
  requests: number;
  reads: number;
  writes: number;
  databaseBytes: number;
  level: number;
  warning: boolean;
}
export function resourceLevel(
  requests: number,
  reads: number,
  writes: number,
  bytes: number,
) {
  const fraction = Math.max(
    requests / 100000,
    reads / 5000000,
    writes / 100000,
    bytes / 500000000,
  );
  return {
    level:
      fraction >= 0.9 ? 90 : fraction >= 0.8 ? 80 : fraction >= 0.7 ? 70 : 0,
    warning: fraction >= 0.7,
  };
}
export async function monitor(env: Env): Promise<Usage | null> {
  if (!env.CF_METRICS_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_DATABASE_ID)
    return null;
  const now = Date.now(),
    start = new Date(now).toISOString().slice(0, 10) + "T00:00:00Z";
  const query = `query Usage($account:string!,$start:Time!){viewer{accounts(filter:{accountTag:$account}){workersInvocationsAdaptive(limit:1,filter:{datetime_geq:$start}){sum{requests errors}}d1AnalyticsAdaptiveGroups(limit:1,filter:{datetime_geq:$start}){sum{rowsRead rowsWritten}}}}}`;
  const headers = {
    Authorization: "Bearer " + env.CF_METRICS_TOKEN,
    "Content-Type": "application/json",
  };
  const [graphResponse, dbResponse] = await Promise.all([
    fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: { account: env.CF_ACCOUNT_ID, start },
      }),
      signal: AbortSignal.timeout(10000),
    }),
    fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}`,
      { headers, signal: AbortSignal.timeout(10000) },
    ),
  ]);
  if (!graphResponse.ok || !dbResponse.ok) throw new Error("metrics_http");
  const graph = (await graphResponse.json()) as any,
    db = (await dbResponse.json()) as any;
  if (graph.errors?.length || !db.success)
    throw new Error("metrics_permission");
  const account = graph.data?.viewer?.accounts?.[0];
  if (!account) throw new Error("metrics_missing");
  const requests = account.workersInvocationsAdaptive.reduce(
    (n: number, r: any) => n + r.sum.requests,
    0,
  );
  const reads = account.d1AnalyticsAdaptiveGroups.reduce(
    (n: number, r: any) => n + r.sum.rowsRead,
    0,
  );
  const writes = account.d1AnalyticsAdaptiveGroups.reduce(
    (n: number, r: any) => n + r.sum.rowsWritten,
    0,
  );
  const databaseBytes = db.result.file_size;
  if (![requests, reads, writes, databaseBytes].every(Number.isFinite))
    throw new Error("metrics_invalid");
  const result = {
    at: now,
    requests,
    reads,
    writes,
    databaseBytes,
    ...resourceLevel(requests, reads, writes, databaseBytes),
  };
  const previous = await env.DB.prepare(
    "SELECT automatic_level FROM policy WHERE id=1",
  ).first<{ automatic_level: number }>();
  await env.DB.prepare(
    "UPDATE policy SET automatic_level=?,metrics_at=?,monitoring=? WHERE id=1",
  )
    .bind(result.level, now, JSON.stringify(result))
    .run();
  if (result.level >= 80 && (previous?.automatic_level ?? 0) < 80)
    await env.DB.prepare(
      "INSERT INTO analytics_gaps(started_at,reason) VALUES(?, 'Tự động giảm thống kê do tài nguyên đạt ngưỡng')",
    )
      .bind(now)
      .run();
  else if (result.level < 80 && (previous?.automatic_level ?? 0) >= 80)
    await env.DB.prepare(
      "UPDATE analytics_gaps SET ended_at=? WHERE ended_at IS NULL AND reason=?",
    )
      .bind(now, "Tự động giảm thống kê do tài nguyên đạt ngưỡng")
      .run();
  return result;
}
