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

    return prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { userId: input.userId },
        });
        return { balance: wallet.balance, created: false };
      }

      await this.ensureWalletTx(tx, input.userId);

      // Atomic debit: refuse if balance would go negative (closes TOCTOU race).
      if (input.amount < 0) {
        const gated = await tx.wallet.updateMany({
          where: {
            userId: input.userId,
            balance: { gte: -input.amount },
          },
          data: { balance: { increment: input.amount } },
        });
        if (gated.count === 0)
          throw new BadRequestException("insufficient_funds");
      }
      else {
        await tx.wallet.update({
          where: { userId: input.userId },
          data: { balance: { increment: input.amount } },
        });
      }

      const updated = await tx.wallet.findUniqueOrThrow({
        where: { userId: input.userId },
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

  /** Winner 90%, house remainder — both legs in one transaction. */
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
    const payoutKey = `payout:${input.matchId}:${input.winnerUserId}`;
    const rakeKey = `rake:${input.matchId}`;

    return prisma.$transaction(async (tx) => {
      const existingPayout = await tx.ledgerEntry.findUnique({
        where: { idempotencyKey: payoutKey },
      });
      if (!existingPayout && winnerPayout > 0) {
        await this.ensureWalletTx(tx, input.winnerUserId);
        await tx.wallet.update({
          where: { userId: input.winnerUserId },
          data: { balance: { increment: winnerPayout } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId: input.winnerUserId,
            amount: winnerPayout,
            type: "payout",
            refType: "match",
            refId: input.matchId,
            idempotencyKey: payoutKey,
          },
        });
      }

      const existingRake = await tx.ledgerEntry.findUnique({
        where: { idempotencyKey: rakeKey },
      });
      if (!existingRake && rake > 0) {
        await this.ensureWalletTx(tx, houseId);
        await tx.wallet.update({
          where: { userId: houseId },
          data: { balance: { increment: rake } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId: houseId,
            amount: rake,
            type: "rake",
            refType: "match",
            refId: input.matchId,
            idempotencyKey: rakeKey,
          },
        });
      }

      return { winnerPayout, rake };
    });
  }

  /** True if a match already paid the winner (blocks emergency buy-in refunds). */
  async hasMatchPayout(matchId: string): Promise<boolean> {
    const row = await prisma.ledgerEntry.findFirst({
      where: { refType: "match", refId: matchId, type: "payout" },
    });
    return Boolean(row);
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
