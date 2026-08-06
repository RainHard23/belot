import type { LedgerType, Prisma } from "@prisma/client";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "../db/prisma";

const HOUSE_EMAIL = process.env.HOUSE_EMAIL ?? "house@belot.local";

@Injectable()
export class WalletService {
  async getBalance(userId: string): Promise<number> {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet)
      throw new NotFoundException("Кошелёк не найден");
    return wallet.balance;
  }

  async ensureWallet(userId: string) {
    return prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }

  async houseUserId(): Promise<string> {
    const house = await prisma.user.findUnique({ where: { email: HOUSE_EMAIL } });
    if (!house)
      throw new NotFoundException("House аккаунт не создан — запустите seed");
    await this.ensureWallet(house.id);
    return house.id;
  }

  /**
   * Credit (+) or debit (−). Debits require sufficient balance.
   * Idempotent on `idempotencyKey`.
   */
  async apply(input: {
    userId: string;
    amount: number;
    type: LedgerType;
    idempotencyKey: string;
    refType?: string;
    refId?: string;
  }): Promise<{ balance: number; created: boolean }> {
    if (!Number.isInteger(input.amount) || input.amount === 0)
      throw new BadRequestException("Некорректная сумма");

    const existing = await prisma.ledgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      const balance = await this.getBalance(input.userId);
      return { balance, created: false };
    }

    return prisma.$transaction(async (tx) => {
      await this.ensureWalletTx(tx, input.userId);
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: input.userId },
      });

      if (input.amount < 0 && wallet.balance + input.amount < 0)
        throw new BadRequestException("insufficient_funds");

      const updated = await tx.wallet.update({
        where: { userId: input.userId },
        data: { balance: { increment: input.amount } },
      });

      await tx.ledgerEntry.create({
        data: {
          userId: input.userId,
          amount: input.amount,
          type: input.type,
          refType: input.refType,
          refId: input.refId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return { balance: updated.balance, created: true };
    });
  }

  async credit(input: {
    userId: string;
    amount: number;
    type: LedgerType;
    idempotencyKey: string;
    refType?: string;
    refId?: string;
  }) {
    if (input.amount <= 0)
      throw new BadRequestException("Сумма должна быть положительной");
    return this.apply({ ...input, amount: input.amount });
  }

  async debit(input: {
    userId: string;
    amount: number;
    type: LedgerType;
    idempotencyKey: string;
    refType?: string;
    refId?: string;
  }) {
    if (input.amount <= 0)
      throw new BadRequestException("Сумма должна быть положительной");
    return this.apply({ ...input, amount: -input.amount });
  }

  /** Winner 90%, house remainder (incl. rounding). */
  async settleMatch(input: {
    matchId: string;
    pot: number;
    winnerUserId: string;
  }) {
    if (input.pot <= 0)
      return { winnerPayout: 0, rake: 0 };

    const winnerPayout = Math.floor(input.pot * 0.9);
    const rake = input.pot - winnerPayout;
    const houseId = await this.houseUserId();

    if (winnerPayout > 0) {
      await this.credit({
        userId: input.winnerUserId,
        amount: winnerPayout,
        type: "payout",
        idempotencyKey: `payout:${input.matchId}:${input.winnerUserId}`,
        refType: "match",
        refId: input.matchId,
      });
    }
    if (rake > 0) {
      await this.credit({
        userId: houseId,
        amount: rake,
        type: "rake",
        idempotencyKey: `rake:${input.matchId}`,
        refType: "match",
        refId: input.matchId,
      });
    }
    return { winnerPayout, rake };
  }

  private async ensureWalletTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }
}
