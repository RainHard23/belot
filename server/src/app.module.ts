import { Module } from "@nestjs/common";
import { GameGateway } from "./game.gateway";
import {
  BOT,
  bot,
  LOBBY,
  lobby,
  MATCH,
  matches,
  SESSION,
  sessions,
  TURN_TIMER,
  turnTimer,
} from "./providers";

@Module({
  providers: [
    { provide: SESSION, useValue: sessions },
    { provide: LOBBY, useValue: lobby },
    { provide: MATCH, useValue: matches },
    { provide: BOT, useValue: bot },
    { provide: TURN_TIMER, useValue: turnTimer },
    GameGateway,
  ],
})
export class AppModule {}
