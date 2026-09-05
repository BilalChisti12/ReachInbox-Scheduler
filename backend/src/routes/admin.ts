import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';

const router = Router();
const adminController = new AdminController();

// POST /api/admin/search/reindex
router.post('/search/reindex', adminController.reindexEmails.bind(adminController));

export default router;
