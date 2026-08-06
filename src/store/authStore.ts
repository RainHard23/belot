import { create } from "zustand";
import {
  type AuthUser,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  mockDeposit,
  refresh as apiRefresh,
  register as apiRegister,
} from "@/net/authApi";
import { disconnectSocket, resetSocket } from "@/net/socket";

const TOKEN_KEY = "bilot_token";
const REFRESH_KEY = "bilot_refresh";
const USER_KEY = "bilot_user";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  ready: boolean;
  busy: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccess: () => Promise<string | null>;
  depositMock: (amount: number) => Promise<void>;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
}

function persist(token: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem("bilot_name", user.displayName);
}

function clearPersist() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem("bilot_session");
  sessionStorage.removeItem("bilot_name");
}

export const useAuthStore = create<AuthState>(set => ({
  token: null,
  refreshToken: null,
  user: null,
  ready: false,
  busy: false,
  error: null,

  hydrate: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!token) {
      set({ token: null, refreshToken: null, user: null, ready: true });
      return;
    }
    try {
      const user = await fetchMe(token);
      persist(token, refreshToken ?? "", user);
      set({ token, refreshToken, user, ready: true, error: null });
    }
    catch {
      if (refreshToken) {
        try {
          const res = await apiRefresh(refreshToken);
          persist(res.accessToken, res.refreshToken, res.user);
          resetSocket(res.accessToken, res.user.displayName);
          set({
            token: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user,
            ready: true,
            error: null,
          });
          return;
        }
        catch {
          /* fallthrough */
        }
      }
      clearPersist();
      set({ token: null, refreshToken: null, user: null, ready: true });
    }
  },

  login: async (email, password) => {
    set({ busy: true, error: null });
    try {
      const res = await apiLogin({ email, password });
      persist(res.accessToken, res.refreshToken, res.user);
      disconnectSocket();
      resetSocket(res.accessToken, res.user.displayName);
      set({
        token: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
        busy: false,
        error: null,
      });
    }
    catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "Не удалось войти",
      });
      throw e;
    }
  },

  register: async (email, password, displayName) => {
    set({ busy: true, error: null });
    try {
      const res = await apiRegister({ email, password, displayName });
      persist(res.accessToken, res.refreshToken, res.user);
      disconnectSocket();
      resetSocket(res.accessToken, res.user.displayName);
      set({
        token: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
        busy: false,
        error: null,
      });
    }
    catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "Не удалось зарегистрироваться",
      });
      throw e;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY) ?? undefined;
    try {
      await apiLogout(refreshToken);
    }
    catch {
      /* ignore */
    }
    clearPersist();
    disconnectSocket();
    set({ token: null, refreshToken: null, user: null, error: null });
  },

  refreshAccess: async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken)
      return null;
    try {
      const res = await apiRefresh(refreshToken);
      persist(res.accessToken, res.refreshToken, res.user);
      resetSocket(res.accessToken, res.user.displayName);
      set({
        token: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      return res.accessToken;
    }
    catch {
      clearPersist();
      disconnectSocket();
      set({ token: null, refreshToken: null, user: null });
      return null;
    }
  },

  depositMock: async (amount) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token)
      throw new Error("Нужна авторизация");
    set({ busy: true, error: null });
    try {
      const res = await mockDeposit(token, amount);
      set(state => ({
        busy: false,
        user: state.user
          ? { ...state.user, balance: res.balance }
          : state.user,
      }));
    }
    catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "Депозит не удался",
      });
      throw e;
    }
  },

  refreshBalance: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token)
      return;
    try {
      const user = await fetchMe(token);
      set(state => ({
        user: state.user ? { ...state.user, balance: user.balance } : user,
      }));
    }
    catch {
      /* ignore */
    }
  },

  clearError: () => set({ error: null }),
}));
