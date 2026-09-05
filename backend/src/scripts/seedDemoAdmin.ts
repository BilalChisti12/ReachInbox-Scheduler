import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load the appropriate env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Try root first
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Try backend/

const prisma = new PrismaClient();

async function seedDemoAdmin() {
  const email = process.env.DEMO_ADMIN_EMAIL;
  const password = process.env.DEMO_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD must be defined in the environment.');
    process.exit(1);
  }

  // Validate password strength (e.g. min 8 chars as a basic project rule)
  if (password.length < 8) {
    console.error('❌ Error: DEMO_ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      console.log(`ℹ️ User ${email} already exists.`);

      // Update existing user safely
      // We explicitly override the password hash to ensure the demo password config matches
      // and we ensure they have platform admin rights.
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          isPlatformAdmin: true,
          passwordHash,
        }
      });

      console.log(`✅ Success: Updated ${email} to have Demo Platform Admin privileges.`);
    } else {
      console.log(`ℹ️ Creating new user ${email}...`);

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: 'Evaluator Outbox Labs',
          isPlatformAdmin: true,
        }
      });

      console.log(`✅ Success: Created new Demo Platform Admin account for ${email}.`);
    }
  } catch (error) {
    console.error('❌ Failed to seed Demo Admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoAdmin();
