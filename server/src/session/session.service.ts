import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface Session {
  id: string;
  name: string;
}

const MAX_NAME = 24;

export function sanitizeName(name?: string): string | undefined {
  if (!name)
    return undefined;
  const cleaned = name
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, MAX_NAME);
  return cleaned.length > 0 ? cleaned : undefined;
}

@Injectable()
export class SessionService {
  private sessions = new Map<string, Session>();

  create(name?: string): Session {
    const session: Session = {
      id: randomUUID(),
      name: sanitizeName(name) || `Игрок-${Math.floor(Math.random() * 9000 + 1000)}`,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  ensure(id?: string, name?: string): Session {
    if (id && this.sessions.has(id)) {
      const existing = this.sessions.get(id)!;
      const next = sanitizeName(name);
      if (next && next !== existing.name)
        existing.name = next;
      return existing;
    }
    return this.create(name);
  }

  setName(id: string, name: string): Session | undefined {
    const s = this.sessions.get(id);
    if (!s)
      return undefined;
    const next = sanitizeName(name);
    if (next)
      s.name = next;
    return s;
  }
}
