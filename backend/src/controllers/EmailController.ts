import { Request, Response } from 'express';
import { ElasticsearchService, EmailSearchOptions } from '../services/ElasticsearchService';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import { emailQueue } from '../config/queue';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const elasticsearchService = new ElasticsearchService();
const emailJobRepo = new EmailJobRepository();

export class EmailController {
  async searchEmails(req: Request, res: Response): Promise<void> {
    try {
      // The user ID from the authenticated session
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const options: EmailSearchOptions = {
        q: req.query.q as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      };

      // Try Elasticsearch first; fall back to PostgreSQL if ES is unavailable
      try {
        const results = await elasticsearchService.searchEmails(userId, options);
        res.json(results);
        return;
      } catch (esError: any) {
        console.warn(`Elasticsearch unavailable, falling back to database search: ${esError.message}`);
      }

      // Fallback: PostgreSQL-based search (less powerful but always available)
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));
      const skip = (page - 1) * limit;

      const where: any = { userId };
      if (options.status) where.status = options.status;
      if (options.startDate || options.endDate) {
        where.scheduledAt = {};
        if (options.startDate) where.scheduledAt.gte = new Date(options.startDate);
        if (options.endDate) where.scheduledAt.lte = new Date(options.endDate);
      }
      if (options.q) {
        where.OR = [
          { subject: { contains: options.q, mode: 'insensitive' } },
          { recipient: { contains: options.q, mode: 'insensitive' } },
          { body: { contains: options.q, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.emailJob.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { email: true, displayName: true } } },
        }),
        prisma.emailJob.count({ where }),
      ]);

      res.json({
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      console.error(`EmailController search error:`, error);
      res.status(500).json({ error: 'Failed to search emails' });
    }
  }

  async deleteEmail(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // 1. Delete from PostgreSQL
      const deleted = await emailJobRepo.deleteByIdAndUserId(id, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Email not found or not owned by user' });
        return;
      }

      // 2. Delete from Elasticsearch
      await elasticsearchService.deleteEmail(id);

      // 3. Remove from BullMQ queue (if it's still waiting/delayed)
      try {
        const bullJob = await emailQueue.getJob(`email-job-${id}`);
        if (bullJob) {
          await bullJob.remove();
        }
      } catch (err: any) {
        console.error(`Failed to remove job from BullMQ: ${err.message}`);
      }

      res.json({ success: true, message: 'Email deleted successfully' });
    } catch (error: any) {
      console.error(`EmailController delete error:`, error);
      res.status(500).json({ error: 'Failed to delete email' });
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const stats = await prisma.emailJob.groupBy({
        by: ['status'],
        _count: true,
        where: { userId }
      });

      const result = {
        scheduled: 0,
        sent: 0,
        processing: 0,
        failed: 0,
        delayed: 0
      };

      stats.forEach(stat => {
        const status = stat.status.toLowerCase();
        if (status in result) {
          (result as any)[status] = stat._count;
        } else {
           (result as any)[status] = stat._count;
        }
      });
      
      const scheduledCount = (result.scheduled || 0) + (result.delayed || 0);

      res.json({
        scheduled: scheduledCount,
        sent: result.sent || 0,
      });
    } catch (error: any) {
      console.error(`EmailController getStats error:`, error);
      res.status(500).json({ error: 'Failed to fetch email stats' });
    }
  }

  async getEmail(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Tenant isolation enforced by findByIdAndUserId
      const email = await emailJobRepo.findByIdWithContext(id);
      
      if (!email || email.userId !== userId) {
        res.status(404).json({ error: 'Email not found or unauthorized' });
        return;
      }

      // Safe representation of the email (exclude internal fields if necessary)
      res.json({
        id: email.id,
        recipient: email.recipient,
        sender: email.sender,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt
      });
    } catch (error: any) {
      console.error(`EmailController getEmail error:`, error);
      res.status(500).json({ error: 'Failed to fetch email details' });
    }
  }
}
