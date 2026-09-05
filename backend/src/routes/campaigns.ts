import { Router } from 'express';
import { CampaignController } from '../controllers/CampaignController';

const router = Router();
const campaignController = new CampaignController();

router.post('/', campaignController.createCampaign.bind(campaignController));

export default router;
