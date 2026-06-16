import { Router } from 'express';
import { z } from 'zod';
import { parseVoiceCommand } from '../services/gemini.js';
const router = Router();
// POST /ai/voice-command — parse transcript and return intent
router.post('/voice-command', async (req, res) => {
    const schema = z.object({
        transcript: z.string().min(1),
        shop_id: z.string().uuid().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    try {
        const intent = await parseVoiceCommand(parsed.data.transcript);
        return res.json({ ok: true, transcript: parsed.data.transcript, intent });
    }
    catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
});
export default router;
