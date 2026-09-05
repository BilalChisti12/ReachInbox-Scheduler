import { PrismaClient, Prisma, EmailJob, EmailStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class EmailJobRepository {
  async createMany(data: Prisma.EmailJobCreateManyInput[]) {
    return prisma.emailJob.createMany({
      data,
      skipDuplicates: true // Helpful for idempotencyKey conflicts at creation
    });
  }

  async findAllByCampaignId(campaignId: string, userId: string): Promise<EmailJob[]> {
    return prisma.emailJob.findMany({
      where: { campaignId, userId },
      orderBy: { scheduledAt: 'asc' }
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<EmailJob | null> {
    return prisma.emailJob.findFirst({
      where: { id, userId }
    });
  }

  async findByIdWithContext(id: string): Promise<(EmailJob & { sender: any, campaign: any }) | null> {
    return prisma.emailJob.findUnique({
      where: { id },
      include: { 
        sender: true, 
        campaign: {
          include: { attachments: true }
        }
      }
    });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<EmailJob | null> {
    return prisma.emailJob.findUnique({
      where: { idempotencyKey }
    });
  }

  // Idempotent state transition
  async transitionStatus(
    id: string, 
    userId: string, 
    fromStatus: EmailStatus, 
    toStatus: EmailStatus,
    extraData?: Partial<Prisma.EmailJobUpdateInput>
  ): Promise<EmailJob | null> {
    try {
      // Prisma does not have a direct "update where status = X" without throwing if not found, 
      // so we use updateMany and then fetch, or a safe transaction.
      const result = await prisma.emailJob.updateMany({
        where: { 
          id, 
          userId, 
          status: fromStatus 
        },
        data: {
          status: toStatus,
          ...extraData
        }
      });

      if (result.count === 0) return null;
      return this.findByIdAndUserId(id, userId);
    } catch (e) {
      console.error('Failed to transition email job status', e);
      return null;
    }
  }

  async updateBullmqJobId(id: string, userId: string, bullmqJobId: string): Promise<EmailJob | null> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return null;
    
    return prisma.emailJob.update({
      where: { id },
      data: { bullmqJobId }
    });
  }

  async markAsSent(id: string): Promise<EmailJob> {
    return prisma.emailJob.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date()
      }
    });
  }

  async markAsFailed(id: string, failureReason: string): Promise<EmailJob> {
    return prisma.emailJob.update({
      where: { id },
      data: {
        status: 'failed',
        failureReason
      }
    });
  }

  async deleteByIdAndUserId(id: string, userId: string): Promise<boolean> {
    const result = await prisma.emailJob.deleteMany({
      where: { id, userId }
    });
    return result.count > 0;
  }
}
