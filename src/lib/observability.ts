type MetricValue = string | number | boolean | null;

export interface TimingResult {
  name: string;
  durationMs: number;
  meta?: Record<string, MetricValue>;
}

const metricsBuffer: Record<string, unknown>[] = [];

export function createTimer(name: string, meta?: Record<string, MetricValue>) {
  const start = Date.now();
  return {
    end(extra?: Record<string, MetricValue>): TimingResult {
      const result: TimingResult = {
        name,
        durationMs: Date.now() - start,
        meta: { ...meta, ...extra },
      };
      logMetric('timing', { ...result });
      return result;
    },
  };
}

export function logMetric(event: string, data: Record<string, unknown>): void {
  const entry = { event, ts: new Date().toISOString(), ...data };
  metricsBuffer.push(entry);
  if (process.env.NODE_ENV !== 'test') {
    console.info(JSON.stringify(entry));
  }
}

export function recordTokenUsage(
  operation: string,
  promptTokens: number,
  completionTokens: number
): void {
  logMetric('token_usage', {
    operation,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  });
}

export function recordCitationClick(documentId: string, chunkId: string): void {
  logMetric('citation_click', { documentId, chunkId });
}

export function getRecentMetrics(limit = 50): Record<string, unknown>[] {
  return metricsBuffer.slice(-limit);
}
