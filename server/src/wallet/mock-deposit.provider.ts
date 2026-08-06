import {
  BadRequestException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import type { DepositProvider } from "./deposit.provider";
import { WalletService } from "./wallet.service";

const MIN = 1;
const MAX = 10_000;

@Injectable()
export class MockDepositProvider implements DepositProvider {
  readonly name = "mock";

  constructor(@Inject(WalletService) private readonly wallet: WalletService) {}

  async createOrder(input: { userId: string; amount: number }) {
    const amount = Math.floor(input.amount);
    if (!Number.isFinite(amount) || amount < MIN || amount > MAX)
      throw new BadRequestException(`Сумма от ${MIN} до ${MAX} коинов`);

    // Pending first — credit, then confirm. Failed credit leaves unpaid order.
    const order = await prisma.depositOrder.create({
      data: {
        userId: input.userId,
        amountExpected: amount,
        amountReceived: amount,
        provider: this.name,
        status: "pending",
        externalRef: `mock:${randomUUID()}`,
      },
    });

    try {
      await this.wallet.credit({
        userId: input.userId,
        amount,
        type: "deposit_mock",
        idempotencyKey: `deposit_mock:${order.id}`,
        refType: "deposit",
        refId: order.id,
      });
    }
    catch (err) {
      await prisma.depositOrder.update({
        where: { id: order.id },
        data: { status: "failed" },
      });
      throw err;
    }

    await prisma.depositOrder.update({
      where: { id: order.id },
      data: { status: "confirmed", confirmedAt: new Date() },
    });

    return { orderId: order.id, status: "confirmed" as const };
  }
}
