import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/db/prisma";

const HOUSE_EMAIL = process.env.HOUSE_EMAIL ?? "house@belot.local";

async function main() {
  const houseHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
  const house = await prisma.user.upsert({
    where: { email: HOUSE_EMAIL },
    update: {},
    create: {
      email: HOUSE_EMAIL,
      passwordHash: houseHash,
      displayName: "House",
      wallet: { create: { balance: 0 } },
    },
    include: { wallet: true },
  });

  if (!house.wallet) {
    await prisma.wallet.create({ data: { userId: house.id, balance: 0 } });
  }

  console.warn(`Seeded house user ${house.email} (${house.id})`);

  const adminHash = await bcrypt.hash("admin", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin" },
    update: {
      passwordHash: adminHash,
      displayName: "Admin",
    },
    create: {
      email: "admin",
      passwordHash: adminHash,
      displayName: "Admin",
      wallet: { create: { balance: 1000 } },
    },
    include: { wallet: true },
  });

  if (!admin.wallet) {
    await prisma.wallet.create({
      data: { userId: admin.id, balance: 1000 },
    });
  }
  else if (admin.wallet.balance < 100) {
    await prisma.wallet.update({
      where: { userId: admin.id },
      data: { balance: 1000 },
    });
  }

  console.warn(`Seeded admin / admin (${admin.id}), balance ready`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
