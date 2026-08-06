import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AUTH } from "../providers";
import type { AuthService } from "./auth.service";

const REFRESH_COOKIE = "belote_refresh";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AUTH) private readonly auth: AuthService) {}

  @Post("register")
  async register(
    @Body() body: { email?: string; password?: string; displayName?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(body);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Post("login")
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token
      = body?.refreshToken
        ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Post("logout")
  async logout(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token
      = body?.refreshToken
        ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    const token = bearer(authorization);
    if (!token)
      throw new UnauthorizedException("Нужна авторизация");
    return this.auth.me(token);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const secure = process.env.NODE_ENV === "production";
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}

function bearer(authorization?: string): string {
  if (!authorization)
    return "";
  const [kind, token] = authorization.split(" ");
  if (kind?.toLowerCase() !== "bearer" || !token)
    return "";
  return token;
}
