import { DurableObject } from "cloudflare:workers";
import set, { version } from "virtual:kakuzuke/answers";
import { version as publicVersion } from "virtual:kakuzuke/public";
import { PING, PONG } from "./protocol.ts";
import { VenueRoom } from "./room.ts";

/** virtual:kakuzuke/answers を読むのはこのファイルだけ */
export class Venue extends DurableObject<Env> {
  readonly #room: VenueRoom;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#room = new VenueRoom(ctx, { set, version, publicVersion });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  override fetch(request: Request): Response {
    return this.#room.fetch(request);
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.#room.webSocketMessage(ws, message);
  }
}
