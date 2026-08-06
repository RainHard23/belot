import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { GameGateway } from "./game.gateway";
import { restorePersistedMatches } from "./match/restore-matches";
import "reflect-metadata";

async function bootstrap() {
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
    throw new Error("JWT_SECRET is required in production");

  const app = await NestFactory.create(AppModule);
  const origins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  app.use(cookieParser());
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.warn(`Belote server on http://localhost:${port}`);

  try {
    const gateway = app.get(GameGateway);
    // Socket.IO Server is attached after listen; retry briefly if racey.
    for (let i = 0; i < 20 && !gateway.server; i++)
      await new Promise(r => setTimeout(r, 50));
    if (!gateway.server)
      throw new Error("Socket.IO server not ready for match restore");
    await restorePersistedMatches(gateway.server);
  }
  catch (err) {
    console.error("match restore failed", err);
    if (process.env.NODE_ENV === "production")
      throw err;
  }
}

bootstrap();
