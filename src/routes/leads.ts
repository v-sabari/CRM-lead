import { Router } from 'express';
import { queryLeads } from '../controllers/queryLeads';

const router = Router();

router.post('/query', queryLeads);

export default router;
