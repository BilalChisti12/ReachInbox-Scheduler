import { PrismaClient, Prisma, Campaign, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class CampaignRepository {
  async create(
    userId: string, 
    senderId: string, 
    data: Omit<Prisma.CampaignCreateInput, 'user' | 'sender' | 'id' | 'createdAt' | 'updatedAt' | 'emailJobs' | 'attachments'>,
    attachments?: Array<{ filename: string, content: string, contentType: string }>
  ): Promise<Campaign> {
    return prisma.campaign.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
        sender: { connect: { id: senderId } },
        ...(attachments && attachments.length > 0 && {
          attachments: {
            create: attachments
          }
        })
      }
    });
  }

  async findAllByUserId(userId: string): Promise<Campaign[]> {
    return prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Campaign | null> {
    return prisma.campaign.findFirst({
      where: { id, userId }
    });
  }

  async updateStatus(id: string, userId: string, status: CampaignStatus): Promise<Campaign | null> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return null;
    
    return prisma.campaign.update({
      where: { id },
      data: { status }
    });
  }

  async incrementCounts(id: string, counts: { scheduled?: number, sent?: number, failed?: number }) {
    return prisma.campaign.update({
      where: { id },
      data: {
        scheduledCount: counts.scheduled ? { increment: counts.scheduled } : undefined,
        sentCount: counts.sent ? { increment: counts.sent } : undefined,
        failedCount: counts.failed ? { increment: counts.failed } : undefined,
      }
    });
  }
}
