import { Request, Response } from 'express';
import { CampaignService } from '../services/CampaignService';
import { createCampaignSchema } from '../validators/campaignValidator';
import { ZodError } from 'zod';

const campaignService = new CampaignService();

export class CampaignController {
  
  async createCampaign(req: Request, res: Response) {
    try {
      // 1. Zod Validation
      const data = createCampaignSchema.parse(req.body);
      
      // 2. Pass to service
      const result = await campaignService.scheduleCampaign(req.user!.id, data);
      
      res.status(201).json({
        success: true,
        message: 'Campaign scheduled successfully',
        data: result
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (error as any).errors });
      }
      if (error.message.includes('Sender not found') || error.message.includes('Sender is currently deactivated')) {
         return res.status(400).json({ error: error.message });
      }
      console.error('Campaign creation failed:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}
