import { Module } from "@nestjs/common";
import { GameGateway } from "./game.gateway";
import {
  LOBBY,
  lobby,
  MATCH,
  matches,
  SESSION,
  sessions,
} from "./providers";

@Module({
  providers: [
    { provide: SESSION, useValue: sessions },
    { provide: LOBBY, useValue: lobby },
    { provide: MATCH, useValue: matches },
    GameGateway,
  ],
})
export class AppModule {}
