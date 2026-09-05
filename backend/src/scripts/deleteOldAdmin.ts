import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const oldEmail = 'evaluator@example.com';
  try {
    const user = await prisma.user.findUnique({ where: { email: oldEmail } });
    if (user) {
      await prisma.user.delete({ where: { email: oldEmail } });
      console.log(`Deleted old admin account: ${oldEmail}`);
    } else {
      console.log(`Old admin account ${oldEmail} not found.`);
    }
  } catch (error) {
    console.error('Error deleting old admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
