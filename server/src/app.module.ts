import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller";
import { GameGateway } from "./game.gateway";
import { HealthController } from "./health.controller";
import {
  AUTH,
  auth,
  BOT,
  bot,
  LOBBY,
  lobby,
  MATCH,
  matches,
  mockDeposit,
  SESSION,
  sessions,
  TURN_TIMER,
  turnTimer,
  WALLET,
  wallet,
} from "./providers";
import { MockDepositProvider } from "./wallet/mock-deposit.provider";
import { WalletController } from "./wallet/wallet.controller";
import { WalletService } from "./wallet/wallet.service";

@Module({
  controllers: [AuthController, WalletController, HealthController],
  providers: [
    { provide: AUTH, useValue: auth },
    { provide: WALLET, useValue: wallet },
    { provide: WalletService, useValue: wallet },
    { provide: MockDepositProvider, useValue: mockDeposit },
    { provide: SESSION, useValue: sessions },
    { provide: LOBBY, useValue: lobby },
    { provide: MATCH, useValue: matches },
    { provide: BOT, useValue: bot },
    { provide: TURN_TIMER, useValue: turnTimer },
    GameGateway,
  ],
})
export class AppModule {}
