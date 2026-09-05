import { PrismaClient, Prisma, Sender } from '@prisma/client';

const prisma = new PrismaClient();

export class SenderRepository {
  async create(userId: string, data: Omit<Prisma.SenderCreateInput, 'user' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Sender> {
    return prisma.sender.create({
      data: {
        ...data,
        user: { connect: { id: userId } }
      }
    });
  }

  async findAllByUserId(userId: string): Promise<Sender[]> {
    return prisma.sender.findMany({
      where: { userId }
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Sender | null> {
    return prisma.sender.findFirst({
      where: { id, userId }
    });
  }

  async update(id: string, userId: string, data: Prisma.SenderUpdateInput): Promise<Sender> {
    return prisma.sender.update({
      where: { id } as any, // using safeUpdate instead for strict checking
      data
    });
  }
  
  // A safer update for multitenancy without compound unique index
  async safeUpdate(id: string, userId: string, data: Prisma.SenderUpdateInput): Promise<Sender | null> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return null;
    return prisma.sender.update({
      where: { id },
      data
    });
  }
}
