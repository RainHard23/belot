import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { prisma } from "../db/prisma";
import { sanitizeName } from "../session/session.service";
import { WalletService } from "../wallet/wallet.service";

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  balance: number;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production")
      throw new Error("JWT_SECRET is required in production");
    return "dev-only-change-me-in-production";
  }
  return secret;
}

function accessTtl(): string {
  return process.env.JWT_ACCESS_TTL ?? "15m";
}

function refreshTtlMs(): number {
  const raw = process.env.JWT_REFRESH_TTL ?? "30d";
  if (raw.endsWith("d"))
    return Number.parseInt(raw, 10) * 24 * 60 * 60 * 1000;
  if (raw.endsWith("h"))
    return Number.parseInt(raw, 10) * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private readonly wallet: WalletService) {}

  async register(input: {
    email?: string;
    password?: string;
    displayName?: string;
  }): Promise<AuthTokens> {
    const email = (input.email ?? "").trim().toLowerCase();
    const password = input.password ?? "";
    const displayName = sanitizeName(input.displayName) ?? "";

    if (!EMAIL_RE.test(email))
      throw new BadRequestException("Некорректный email");
    if (password.length < 6)
      throw new BadRequestException("Пароль не короче 6 символов");
    if (!displayName)
      throw new BadRequestException("Укажите имя");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new ConflictException("Email уже зарегистрирован");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        wallet: { create: { balance: 0 } },
      },
      include: { wallet: true },
    });

    return this.issueTokens(user.id, user.email, user.displayName, user.wallet?.balance ?? 0);
  }

  async login(input: {
    email?: string;
    password?: string;
  }): Promise<AuthTokens> {
    const email = (input.email ?? "").trim().toLowerCase();
    const password = input.password ?? "";
    if (!email || !password)
      throw new UnauthorizedException("Неверный email или пароль");
    const user = await prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    });
    if (!user)
      throw new UnauthorizedException("Неверный email или пароль");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      throw new UnauthorizedException("Неверный email или пароль");

    if (!user.wallet)
      await this.wallet.ensureWallet(user.id);

    const balance = user.wallet?.balance
      ?? (await this.wallet.getBalance(user.id));

    return this.issueTokens(user.id, user.email, user.displayName, balance);
  }

  async refresh(refreshToken?: string): Promise<AuthTokens> {
    if (!refreshToken)
      throw new UnauthorizedException("Нет refresh-токена");
    const tokenHash = hashToken(refreshToken);
    const row = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { wallet: true } } },
    });
    if (!row)
      throw new UnauthorizedException("Сессия истекла — войдите снова");

    await prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    const balance = row.user.wallet?.balance ?? 0;
    return this.issueTokens(
      row.user.id,
      row.user.email,
      row.user.displayName,
      balance,
    );
  }

  async logout(refreshToken?: string) {
    if (!refreshToken)
      return { ok: true };
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, jwtSecret()) as AuthTokenPayload;
      if (!payload?.sub || !payload.email)
        throw new Error("bad");
      return payload;
    }
    catch {
      throw new UnauthorizedException("Сессия истекла — войдите снова");
    }
  }

  async me(token: string): Promise<AuthUserDto> {
    const payload = this.verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { wallet: true },
    });
    if (!user)
      throw new UnauthorizedException("Пользователь не найден");
    if (!user.wallet)
      await this.wallet.ensureWallet(user.id);
    const balance = user.wallet?.balance ?? await this.wallet.getBalance(user.id);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      balance,
    };
  }

  private async issueTokens(
    userId: string,
    email: string,
    name: string,
    balance: number,
  ): Promise<AuthTokens> {
    const payload: AuthTokenPayload = { sub: userId, email, name };
    const accessToken = jwt.sign(payload, jwtSecret(), {
      expiresIn: accessTtl(),
    } as jwt.SignOptions);

    const refreshToken = randomBytes(48).toString("hex");
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlMs()),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, displayName: name, balance },
    };
  }
}
