import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const TOKEN_KEY = "bilot_token";

let socket: Socket | null = null;

function authPayload(token?: string | null, name?: string) {
  return {
    token: token ?? localStorage.getItem(TOKEN_KEY) ?? undefined,
    name: name ?? sessionStorage.getItem("bilot_name") ?? undefined,
    sessionId: sessionStorage.getItem("bilot_session") ?? undefined,
  };
}

export function getSocket() {
  if (!socket) {
    socket = io(URL, {
      autoConnect: true,
      auth: authPayload(),
    });
    socket.on("session", (s: { id: string; name: string }) => {
      sessionStorage.setItem("bilot_session", s.id);
      sessionStorage.setItem("bilot_name", s.name);
    });
    socket.on("auth:error", () => {
      // Token rejected — force re-login on next paint via missing token clear
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("bilot_user");
    });
  }
  return socket;
}

/** Tear down socket so next getSocket() rebuilds with fresh auth. */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Create / reconnect socket after login or register. */
export function resetSocket(token: string, name: string) {
  sessionStorage.setItem("bilot_name", name);
  disconnectSocket();
  socket = io(URL, {
    autoConnect: true,
    auth: authPayload(token, name),
  });
  socket.on("session", (s: { id: string; name: string }) => {
    sessionStorage.setItem("bilot_session", s.id);
    sessionStorage.setItem("bilot_name", s.name);
  });
}

/** Update display name on live socket (profile edit). */
export function resetSocketAuth(name: string) {
  sessionStorage.setItem("bilot_name", name);
  if (socket) {
    socket.auth = authPayload(undefined, name);
    if (socket.connected)
      socket.emit("session:name", { name });
    else
      socket.connect();
  }
}
