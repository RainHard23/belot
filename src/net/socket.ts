import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    const sessionId = sessionStorage.getItem("bilot_session");
    const name = sessionStorage.getItem("bilot_name") ?? undefined;
    socket = io(URL, {
      autoConnect: true,
      auth: { sessionId, name },
    });
    socket.on("session", (s: { id: string; name: string }) => {
      sessionStorage.setItem("bilot_session", s.id);
      sessionStorage.setItem("bilot_name", s.name);
    });
  }
  return socket;
}

/** Recreate socket with updated auth name (after NameGate). */
export function resetSocketAuth(name: string) {
  const sessionId = sessionStorage.getItem("bilot_session");
  sessionStorage.setItem("bilot_name", name);
  if (socket) {
    socket.auth = { sessionId, name };
    if (socket.connected) {
      socket.emit("session:name", { name });
    }
    else {
      socket.connect();
    }
  }
}
