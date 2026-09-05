import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { EmailController } from '../controllers/EmailController';

const router = Router();
const emailController = new EmailController();

router.use(requireAuth);

router.get('/stats', emailController.getStats.bind(emailController));
router.get('/search', emailController.searchEmails.bind(emailController));
router.delete('/bulk', emailController.bulkDeleteEmails.bind(emailController));
router.get('/:id', emailController.getEmail.bind(emailController));
router.delete('/:id', emailController.deleteEmail.bind(emailController));

export default router;
