import { PrismaClient, Prisma, User } from '@prisma/client';

const prisma = new PrismaClient();

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { googleId } });
  }

  async upsertGoogleUser(data: { googleId: string; name?: string; email: string; avatar?: string }): Promise<User> {
    const existingByEmail = await this.findByEmail(data.email);
    
    const isOwner = process.env.OWNER_EMAIL && data.email === process.env.OWNER_EMAIL;
    // The evaluator (demo admin) might also have a Google account with the same email if they chose to Google login
    const isEvaluator = process.env.DEMO_ADMIN_EMAIL && data.email === process.env.DEMO_ADMIN_EMAIL;
    const shouldBeAdmin = Boolean(isOwner || isEvaluator);

    if (existingByEmail) {
      // User exists, update their Google ID and correct their admin privileges
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: data.googleId,
          name: data.name || existingByEmail.name,
          avatar: data.avatar || existingByEmail.avatar,
          isPlatformAdmin: shouldBeAdmin // Revoke from regular users who got it previously
        }
      });
    }

    // Completely new user
    return prisma.user.create({
      data: {
        googleId: data.googleId,
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        isPlatformAdmin: shouldBeAdmin
      }
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async createUserWithPassword(data: { email: string; passwordHash: string; name?: string }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
      },
    });
  }

  async updateProfile(id: string, data: { name: string }): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { name: data.name },
    });
  }
}
