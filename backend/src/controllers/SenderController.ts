import { Request, Response } from 'express';
import { SenderService } from '../services/SenderService';
import { createSenderSchema } from '../validators/senderValidator';
import { ZodError } from 'zod';

const senderService = new SenderService();

export class SenderController {
  
  async getSenders(req: Request, res: Response) {
    try {
      const senders = await senderService.getSenders(req.user!.id);
      res.json(senders);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  async createSender(req: Request, res: Response) {
    try {
      const data = createSenderSchema.parse(req.body);
      const newSender = await senderService.createSender(req.user!.id, data);
      res.status(201).json(newSender);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (error as any).errors });
      }
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  async activateSender(req: Request, res: Response) {
    try {
      const senderId = req.params.id as string;
      const sender = await senderService.activateSender(req.user!.id, senderId);
      res.json(sender);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  async deactivateSender(req: Request, res: Response) {
    try {
      const senderId = req.params.id as string;
      const sender = await senderService.deactivateSender(req.user!.id, senderId);
      res.json(sender);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}
