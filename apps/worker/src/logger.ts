import pino from "pino";

/**
 * Structured logger (NFR-11). In production this is JSON for ingestion; Sentry
 * capture is wired separately for errors. Child loggers carry job context.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "rootspun-worker" },
});

export type Logger = typeof logger;
