import { vi } from "vitest";

export interface TelegramCall {
  method: string;
  payload: TelegramPayload;
}

interface TelegramPayload {
  entities?: unknown[];
  link_preview_options?: unknown;
  reply_markup?: unknown;
  show_alert?: boolean;
  text?: string;
  [key: string]: unknown;
}

export class TelegramFake {
  readonly calls: TelegramCall[] = [];
  readonly failureDescriptions = new Map<string, string>();
  readonly failures = new Set<string>();
  readonly networkFailures = new Set<string>();
  readonly fetch: typeof globalThis.fetch;

  constructor() {
    this.fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      const method = new URL(request.url).pathname.split("/").at(-1) ?? "";
      const payload = request.body
        ? ((await request.json()) as TelegramPayload)
        : {};
      this.calls.push({ method, payload });
      if (this.networkFailures.has(method)) {
        throw new TypeError(`${method} network failed`);
      }
      if (this.failures.has(method)) {
        return Response.json({
          description:
            this.failureDescriptions.get(method) ?? `${method} failed`,
          error_code: 400,
          ok: false,
        });
      }
      return Response.json({ ok: true, result: true });
    });
  }

  all(method: string): TelegramCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  last(method: string): TelegramCall | undefined {
    return this.all(method).at(-1);
  }

  required(method: string): TelegramCall {
    const call = this.last(method);
    if (!call) {
      throw new Error(`Expected Telegram method ${method} to be called`);
    }
    return call;
  }
}
