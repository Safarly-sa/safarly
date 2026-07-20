/**
 * Minimal Server-Sent Events helper, shared by /api/trip/generate and
 * /api/concierge/chat — both need identical framing (event: name, data: json,
 * blank-line terminator) and the same header/flush/close dance.
 *
 * SSE over a bare JSON stream because it's a native browser API (EventSource /
 * fetch + ReadableStream, no client library), degrades to "just wait for the
 * final event" if a proxy buffers it, and — unlike WebSockets — is naturally
 * one-directional, which is all a generation or chat *response* stream needs.
 */
import type { Response } from "express";

export class SseWriter {
  private readonly res: Response;
  private closed = false;

  constructor(res: Response) {
    this.res = res;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables buffering on nginx-style proxies that would otherwise hold
      // the whole response until it ends, defeating the point of streaming.
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
  }

  send(event: string, data: unknown): void {
    if (this.closed) return;
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  /** Call when the client disconnects mid-stream, so later writes are no-ops instead of throwing. */
  onClientClose(handler: () => void): void {
    this.res.req?.on("close", () => {
      this.closed = true;
      handler();
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }
}
