import { Router } from 'express';
import { SenderController } from '../controllers/SenderController';

const router = Router();
const senderController = new SenderController();

router.get('/', senderController.getSenders.bind(senderController));
router.post('/', senderController.createSender.bind(senderController));
router.patch('/:id/activate', senderController.activateSender.bind(senderController));
router.patch('/:id/deactivate', senderController.deactivateSender.bind(senderController));

export default router;
