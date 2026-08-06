import { Controller, Get } from "@nestjs/common";
import { prisma } from "./db/prisma";

@Controller("health")
export class HealthController {
  @Get()
  async check() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: "up" };
    }
    catch {
      return { ok: false, db: "down" };
    }
  }
}
