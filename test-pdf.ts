import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function testPdf() {
  const horse = await prisma.horse.findFirst();
  if (!horse) return console.log("No horses");
  
  const res = await fetch(`http://localhost:3000/api/horses/${horse.id}/pdf-clinico`, {
    headers: {
      // Mock session for testing? Can't mock easily from external fetch if it relies on cookies.
      // But we can check if it returns 500 or 401.
    }
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

testPdf().catch(console.error).finally(() => prisma.$disconnect());
