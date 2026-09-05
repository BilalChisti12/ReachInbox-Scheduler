import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log("Revoking unauthorized platform admins...");

  const ownerEmail = process.env.OWNER_EMAIL;
  const demoEmail = process.env.DEMO_ADMIN_EMAIL;

  const keepAdminEmails = [];
  if (ownerEmail) keepAdminEmails.push(ownerEmail);
  if (demoEmail) keepAdminEmails.push(demoEmail);

  if (keepAdminEmails.length === 0) {
    console.log("Warning: No OWNER_EMAIL or DEMO_ADMIN_EMAIL found. Revoking all admins.");
  }

  const result = await prisma.user.updateMany({
    where: {
      isPlatformAdmin: true,
      email: {
        notIn: keepAdminEmails
      }
    },
    data: {
      isPlatformAdmin: false
    }
  });

  console.log(`Revoked admin access from ${result.count} users.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
