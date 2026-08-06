import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const TOKEN_KEY = "bilot_token";

let socket: Socket | null = null;
let authErrorHandler: (() => void) | null = null;

function authPayload(token?: string | null, name?: string) {
  return {
    token: token ?? localStorage.getItem(TOKEN_KEY) ?? undefined,
    name: name ?? sessionStorage.getItem("bilot_name") ?? undefined,
    sessionId: sessionStorage.getItem("bilot_session") ?? undefined,
  };
}

function persistSession(s: { id: string; name: string }) {
  try {
    sessionStorage.setItem("bilot_session", s.id);
    sessionStorage.setItem("bilot_name", s.name);
  }
  catch { /* private mode */ }
}

function attachCoreHandlers(sock: Socket) {
  sock.on("session", persistSession);
  sock.on("auth:error", () => {
    // Prefer refresh via authStore; only wipe access token here so refresh can run.
    localStorage.removeItem(TOKEN_KEY);
    authErrorHandler?.();
  });
}

/** Let authStore clear Zustand when the server rejects the token. */
export function setAuthErrorHandler(fn: (() => void) | null) {
  authErrorHandler = fn;
}

export function getSocket() {
  if (!socket) {
    socket = io(URL, {
      autoConnect: true,
      auth: authPayload(),
    });
    attachCoreHandlers(socket);
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
  attachCoreHandlers(socket);
}

/**
 * Refresh JWT without tearing down listeners (match/lobby stay bound).
 * Auth is applied on the next handshake / reconnect.
 */
export function updateSocketAuth(token: string, name: string) {
  sessionStorage.setItem("bilot_name", name);
  if (!socket) {
    resetSocket(token, name);
    return;
  }
  socket.auth = authPayload(token, name);
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
