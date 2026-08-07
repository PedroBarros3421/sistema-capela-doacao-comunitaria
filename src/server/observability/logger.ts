type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;
type LogSink = (line: string) => void;

const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|document|cpf|cnpj|card|email|phone|ip)/i;
const REDACTED = "[REDACTED]";

export function redactSensitive(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) return { name: value.name };
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, seen));
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);
  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    redacted[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(item, seen);
  }
  return redacted;
}

export function createLogger(sink: LogSink = console.log) {
  const write = (level: LogLevel, event: string, context: LogContext = {}) => {
    sink(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        context: redactSensitive(context),
      }),
    );
  };

  return {
    debug: (event: string, context?: LogContext) => write("debug", event, context),
    info: (event: string, context?: LogContext) => write("info", event, context),
    warn: (event: string, context?: LogContext) => write("warn", event, context),
    error: (event: string, context?: LogContext) => write("error", event, context),
  };
}

export const logger = createLogger();
