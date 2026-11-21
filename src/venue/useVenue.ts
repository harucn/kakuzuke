import { useCallback, useSyncExternalStore } from "react";
import { version } from "virtual:kakuzuke/public";
import { venueUrl, type Role } from "./protocol.ts";
import { openVenueSocket, type HostVenueConnection, type VenueConnection, type VenueSocket } from "./socket.ts";

const SERVER_SNAPSHOT: HostVenueConnection = { view: null, connection: "connecting", celebration: null, operate: null };
const getServerSnapshot = () => SERVER_SNAPSHOT;

const sockets = new Map<Role, VenueSocket>();

/** SSR では getServerSnapshot しか呼ばれないので、location に触れるのはブラウザだけになる */
function socketFor(role: Role): VenueSocket {
  let socket = sockets.get(role);
  if (socket === undefined) {
    socket = openVenueSocket(venueUrl(location.origin, role), {
      WebSocket,
      document,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (timer) => clearTimeout(timer),
      random: Math.random,
      reload: () => location.reload(),
      storage: {
        getItem: (key) => sessionStorage.getItem(key),
        setItem: (key, value) => sessionStorage.setItem(key, value),
      },
      publicVersion: version,
    });
    sockets.set(role, socket);
  }
  return socket;
}

export function useVenue(role: "guest"): VenueConnection;
export function useVenue(role: "host"): HostVenueConnection;
export function useVenue(role: Role): VenueConnection | HostVenueConnection {
  const subscribe = useCallback((listener: () => void) => socketFor(role).subscribe(listener), [role]);
  const getSnapshot = useCallback(() => socketFor(role).snapshot(), [role]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
