import { Router } from 'express';
import { queryLeads } from '../controllers/queryLeads';
import { getLead, createLead, updateLead, deleteLead } from '../controllers/leads';

const router = Router();

router.post('/query', queryLeads);
router.get('/:id', getLead);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

export default router;
