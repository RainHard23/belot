import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
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
}

bootstrap();
