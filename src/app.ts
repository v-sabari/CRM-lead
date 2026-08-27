import express from 'express';
import cors from 'cors';
import leadsRouter from './routes/leads';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/leads', authMiddleware, leadsRouter);

app.get('/', (_req, res) => {
  res.json({
    service: 'CRM Lead Filter Query API',
    version: '1.0.0',
    health: '/health',
    query: 'POST /api/v1/leads/query',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use(errorHandler);

export default app;
