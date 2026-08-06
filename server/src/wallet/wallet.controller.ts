import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthService } from "../auth/auth.service";
import { AUTH } from "../providers";
import { MockDepositProvider } from "./mock-deposit.provider";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(
    @Inject(AUTH) private readonly auth: AuthService,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(MockDepositProvider) private readonly mockDeposit: MockDepositProvider,
  ) {}

  @Get()
  async get(@Headers("authorization") authorization?: string) {
    const userId = this.userId(authorization);
    const balance = await this.wallet.getBalance(userId);
    return { balance, currency: "COIN", rate: "1 USD = 1 coin" };
  }

  @Post("deposit/mock")
  async depositMock(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: { amount?: number },
  ) {
    const userId = this.userId(authorization);
    const amount = Number(body?.amount);
    const result = await this.mockDeposit.createOrder({ userId, amount });
    const balance = await this.wallet.getBalance(userId);
    return { ...result, balance };
  }

  private userId(authorization?: string): string {
    const token = bearer(authorization);
    if (!token)
      throw new UnauthorizedException("Нужна авторизация");
    return this.auth.verifyToken(token).sub;
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
