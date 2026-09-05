import { PrismaClient, Prisma, SlackConnection } from '@prisma/client';

const prisma = new PrismaClient();

export class SlackConnectionRepository {
  async upsertConnection(userId: string, data: Omit<Prisma.SlackConnectionCreateInput, 'user' | 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<SlackConnection> {
    return prisma.slackConnection.upsert({
      where: { userId },
      update: {
        ...data,
        connected: true,
      },
      create: {
        ...data,
        user: { connect: { id: userId } }
      }
    });
  }

  async findByUserId(userId: string): Promise<SlackConnection | null> {
    return prisma.slackConnection.findUnique({
      where: { userId }
    });
  }

  async disconnect(userId: string): Promise<SlackConnection | null> {
    try {
      return await prisma.slackConnection.update({
        where: { userId },
        data: {
          connected: false,
          accessToken: '', // optionally clear token on disconnect
        }
      });
    } catch (e) {
      return null;
    }
  }
}
