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

    const order = await prisma.depositOrder.create({
      data: {
        userId: input.userId,
        amountExpected: amount,
        amountReceived: amount,
        provider: this.name,
        status: "confirmed",
        externalRef: `mock:${randomUUID()}`,
        confirmedAt: new Date(),
      },
    });

    await this.wallet.credit({
      userId: input.userId,
      amount,
      type: "deposit_mock",
      idempotencyKey: `deposit_mock:${order.id}`,
      refType: "deposit",
      refId: order.id,
    });

    return { orderId: order.id, status: "confirmed" as const };
  }
}
