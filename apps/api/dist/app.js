import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import billRouter from './routes/bill.js';
import voiceRouter from './routes/voice.js';
import productAIRouter from './routes/product-ai.js';
import chatRouter from './routes/chat.js';
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(morgan('dev'));
app.get('/', (_req, res) => {
    res.json({
        ok: true,
        service: 'smartstock-api',
        deployment: process.env.VERCEL ? 'vercel' : 'server',
    });
});
app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'smartstock-api', timestamp: new Date().toISOString() });
});
app.use('/ai', billRouter);
app.use('/ai', voiceRouter);
app.use('/ai', productAIRouter);
app.use('/ai', chatRouter);
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.use((err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
});
export default app;
