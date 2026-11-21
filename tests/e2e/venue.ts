import { test } from "@playwright/test";
import { parseServerFrame, venueUrl, type Intent, type Role, type ServerFrame } from "../../src/venue/protocol.ts";

/** BASE_URL はデプロイ先。そこへ流すときは本番の会場を動かさない */
const remote = process.env.BASE_URL !== undefined;

export function skipIfRemote() {
  test.skip(remote, "BASE_URL の会場は動かさない");
}

export interface VenueClient {
  /** 受け取ったフレームすべて */
  readonly frames: readonly ServerFrame[];
  /** まだ読んでいない次のフレーム */
  next(timeoutMs?: number): Promise<ServerFrame>;
  send(intent: Intent): void;
  close(): void;
}

/** Node の WebSocket で会場につなぐ。届いたフレームは取りこぼさないよう、つないだ時点から溜める */
export function connectVenue(baseURL: string, role: Role): VenueClient {
  const socket = new WebSocket(venueUrl(baseURL, role));
  const frames: ServerFrame[] = [];
  let read = 0;
  let wake: (() => void) | null = null;
  let failure: Error | null = null;
  const fail = (error: Error) => {
    failure ??= error;
    wake?.();
  };
  socket.addEventListener("message", (event) => {
    const frame = typeof event.data === "string" ? parseServerFrame(event.data) : null;
    if (frame === null) return fail(new Error(`読めないフレーム: ${String(event.data)}`));
    frames.push(frame);
    wake?.();
  });
  socket.addEventListener("error", () => fail(new Error(`${role} の接続に失敗した`)));
  socket.addEventListener("close", () => fail(new Error(`${role} の接続が閉じた`)));

  return {
    frames,
    async next(timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (read >= frames.length) {
        if (failure !== null) throw failure;
        const left = deadline - Date.now();
        if (left <= 0) throw new Error(`${role} に ${timeoutMs}ms 以内にフレームが届かない`);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, left);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        wake = null;
      }
      return frames[read++];
    },
    send(intent) {
      socket.send(JSON.stringify(intent));
    },
    close() {
      socket.close();
    },
  };
}

/** 司会としてつなぎ、タイトル画面になるまで前へを送る。テスト専用の口は使わない */
export async function resetVenue(baseURL: string) {
  const host = connectVenue(baseURL, "host");
  const deadline = Date.now() + 5000;
  const left = () => Math.max(1, deadline - Date.now());
  try {
    let frame = await host.next(left());
    while (frame.view.phase !== "title") {
      host.send({ type: "prev" });
      frame = await host.next(left());
    }
  } finally {
    host.close();
  }
}

/** 既存の spec の beforeEach。BASE_URL へ流すときは会場を戻さない */
export async function freshVenue({ baseURL }: { baseURL?: string }) {
  if (!remote) await resetVenue(baseURL!);
}
