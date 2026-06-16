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
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(morgan('dev'));
app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'smartstock-api', timestamp: new Date().toISOString() });
});
// AI routes
app.use('/ai', billRouter);
app.use('/ai', voiceRouter);
app.use('/ai', productAIRouter);
app.use('/ai', chatRouter);
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${port}`);
});
