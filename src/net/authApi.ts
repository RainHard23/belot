const URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  balance: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  if (typeof data?.message === "string")
    return data.message;
  if (Array.isArray(data?.message))
    return data.message.join(", ");
  return res.statusText || "Ошибка";
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export function register(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  return postJson<AuthResponse>("/auth/register", input);
}

export function login(input: { email: string; password: string }) {
  return postJson<AuthResponse>("/auth/login", input);
}

export function refresh(refreshToken?: string) {
  return postJson<AuthResponse>("/auth/refresh", { refreshToken });
}

export function logout(refreshToken?: string) {
  return postJson<{ ok: boolean }>("/auth/logout", { refreshToken });
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(await parseError(res));
  return res.json() as Promise<AuthUser>;
}

export async function fetchWallet(token: string): Promise<{ balance: number }> {
  const res = await fetch(`${URL}/wallet`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(await parseError(res));
  return res.json() as Promise<{ balance: number }>;
}

export async function mockDeposit(token: string, amount: number) {
  const res = await fetch(`${URL}/wallet/deposit/mock`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ amount }),
  });
  if (!res.ok)
    throw new Error(await parseError(res));
  return res.json() as Promise<{ balance: number; orderId: string }>;
}
