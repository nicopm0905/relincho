import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const res = await prisma.verificationToken.create({
      data: {
        identifier: "test@equigest.es",
        token: "test-token-123",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });
    console.log("Created token:", res);
  } catch (e) {
    console.error("Error creating token:", e);
  }
}
main().finally(() => prisma.$disconnect());
