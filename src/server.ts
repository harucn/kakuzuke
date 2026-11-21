import handler from "@tanstack/react-start/server-entry";
import { VENUE_NAME, VENUE_PATH } from "./venue/protocol.ts";

export { Venue } from "./venue/durable-object.ts";

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    if (new URL(request.url).pathname === VENUE_PATH) return env.VENUE.getByName(VENUE_NAME).fetch(request);
    return handler.fetch(request);
  },
} satisfies ExportedHandler<Env>;
