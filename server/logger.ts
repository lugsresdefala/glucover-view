import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  traceId?: string;
  context?: Record<string, any>;
  error?: Error;
}

interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  service: string;
  version: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name: string;
  };
}

interface RequestContext {
  traceId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

class Logger {
  private service = "glucover";
  private version = "1.0.0";

  generateTraceId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  runWithTraceId<T>(traceId: string, fn: () => T): T {
    return asyncLocalStorage.run({ traceId }, fn);
  }

  setTraceId(_traceId: string): void {
    // No-op for backwards compatibility - use runWithTraceId instead
  }

  clearTraceId(): void {
    // No-op for backwards compatibility
  }

  getTraceId(): string | null {
    return asyncLocalStorage.getStore()?.traceId || null;
  }

  private formatLog(entry: LogEntry): string {
    const structured: StructuredLog = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      service: this.service,
      version: this.version,
      traceId: entry.traceId || this.getTraceId() || undefined,
      context: entry.context,
    };

    if (entry.error) {
      structured.error = {
        message: entry.error.message,
        stack: entry.error.stack,
        name: entry.error.name,
      };
    }

    if (process.env.NODE_ENV === "production") {
      return JSON.stringify(structured);
    }

    const traceStr = structured.traceId ? ` [trace:${structured.traceId.slice(0, 8)}]` : "";
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const errorStr = entry.error ? ` | Error: ${entry.error.message}` : "";
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}]${traceStr} ${entry.message}${contextStr}${errorStr}`;
  }

  info(message: string, context?: Record<string, any>, traceId?: string) {
    const entry: LogEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      traceId,
      context,
    };
    console.log(this.formatLog(entry));
  }

  warn(message: string, context?: Record<string, any>, traceId?: string) {
    const entry: LogEntry = {
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      traceId,
      context,
    };
    console.warn(this.formatLog(entry));
  }

  error(message: string, error?: Error, context?: Record<string, any>, traceId?: string) {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      traceId,
      context,
      error,
    };
    console.error(this.formatLog(entry));
  }

  debug(message: string, context?: Record<string, any>, traceId?: string) {
    if (process.env.NODE_ENV === "development") {
      const entry: LogEntry = {
        level: "debug",
        message,
        timestamp: new Date().toISOString(),
        traceId,
        context,
      };
      console.debug(this.formatLog(entry));
    }
  }

  child(defaultContext: Record<string, any>): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: Record<string, any>
  ) {}

  private mergeContext(context?: Record<string, any>): Record<string, any> {
    return { ...this.defaultContext, ...context };
  }

  info(message: string, context?: Record<string, any>) {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, any>) {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.parent.error(message, error, this.mergeContext(context));
  }

  debug(message: string, context?: Record<string, any>) {
    this.parent.debug(message, this.mergeContext(context));
  }
}

export const logger = new Logger();
