import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { billUpload } from '../middleware/upload.js';
import { extractTextFromBuffer } from '../services/ocr.js';
import { parseBillOCR } from '../services/gemini.js';
const router = Router();
function normalizeProductName(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error('Supabase not configured on API server');
    return createClient(url, key);
}
// POST /ai/bill-scan — upload image, run OCR + AI, return extracted items
router.post('/bill-scan', billUpload.single('image'), async (req, res) => {
    const file = req.file;
    const shopId = req.body.shop_id;
    const userId = req.body.user_id;
    if (!file)
        return res.status(400).json({ error: 'No image file provided' });
    if (!shopId)
        return res.status(400).json({ error: 'shop_id is required' });
    if (!userId)
        return res.status(400).json({ error: 'user_id is required' });
    let scanId = null;
    try {
        const supabase = getSupabase();
        // Upload to Supabase Storage
        const fileName = `${shopId}/${Date.now()}-${file.originalname}`;
        const { error: uploadError } = await supabase.storage
            .from('bills')
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
        if (uploadError) {
            return res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` });
        }
        // Create bill_scan record
        const { data: scanRow, error: scanErr } = await supabase
            .from('bill_scans')
            .insert({
            shop_id: shopId,
            user_id: userId,
            storage_path: fileName,
            processing_status: 'pending',
        })
            .select('id')
            .single();
        if (scanErr || !scanRow) {
            return res.status(500).json({ error: 'Failed to create scan record' });
        }
        scanId = scanRow.id;
        // OCR extraction with 30s timeout
        let ocrText = '';
        try {
            const ocrPromise = extractTextFromBuffer(file.buffer, file.mimetype);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), 30000));
            ocrText = await Promise.race([ocrPromise, timeoutPromise]);
        }
        catch (err) {
            await supabase.from('bill_scans').update({ processing_status: 'failed' }).eq('id', scanId);
            return res.status(408).json({ error: 'OCR extraction timed out. Please try again.' });
        }
        // AI extraction with 20s timeout
        let items = [];
        try {
            const aiPromise = parseBillOCR(ocrText);
            const aiTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 20000));
            items = await Promise.race([aiPromise, aiTimeout]);
        }
        catch {
            await supabase.from('bill_scans').update({ processing_status: 'failed' }).eq('id', scanId);
            return res.status(408).json({ error: 'AI extraction timed out. Please retry.' });
        }
        // Match products
        const { data: products } = await supabase
            .from('products')
            .select('id, name, sku, cost_price, quantity')
            .eq('shop_id', shopId);
        const matchedItems = items.map((item) => {
            const normalizedItemName = normalizeProductName(item.name);
            const match = (products ?? []).find((p) => p.name.toLowerCase().includes(item.name.toLowerCase()) ||
                item.name.toLowerCase().includes(p.name.toLowerCase()) ||
                normalizeProductName(p.name).includes(normalizedItemName) ||
                normalizedItemName.includes(normalizeProductName(p.name)));
            return {
                ...item,
                matched_product_id: match?.id ?? null,
                matched_product_name: match?.name ?? null,
                is_new: !match,
            };
        });
        // Update scan record
        await supabase
            .from('bill_scans')
            .update({ processing_status: 'completed', extracted_items: matchedItems })
            .eq('id', scanId);
        return res.json({ ok: true, scan_id: scanId, items: matchedItems });
    }
    catch (err) {
        if (scanId) {
            try {
                getSupabase().from('bill_scans').update({ processing_status: 'failed' }).eq('id', scanId);
            }
            catch { }
        }
        return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
});
// POST /ai/bill-scan/confirm — apply extracted items to inventory
router.post('/bill-scan/confirm', async (req, res) => {
    const schema = z.object({
        scan_id: z.string().uuid(),
        shop_id: z.string().uuid(),
        user_id: z.string().uuid(),
        items: z.array(z.object({
            matched_product_id: z.string().uuid().nullable(),
            name: z.string(),
            quantity: z.number().int().min(1),
            cost_price: z.number().nonnegative(),
            sku: z.string().optional(),
            category: z.string().optional(),
        })),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { scan_id, shop_id, user_id, items } = parsed.data;
    try {
        const supabase = getSupabase();
        for (const item of items) {
            if (item.matched_product_id) {
                // Update existing product
                const { data: prod } = await supabase
                    .from('products')
                    .select('quantity')
                    .eq('id', item.matched_product_id)
                    .single();
                const newQty = (prod?.quantity ?? 0) + item.quantity;
                await supabase
                    .from('products')
                    .update({ quantity: newQty, cost_price: item.cost_price })
                    .eq('id', item.matched_product_id);
                await supabase.from('inventory_logs').insert({
                    shop_id,
                    product_id: item.matched_product_id,
                    user_id,
                    action: 'increase',
                    delta: item.quantity,
                    note: `Bill scan ${scan_id.slice(0, 8).toUpperCase()}`,
                });
            }
            else {
                // Create new product
                const ts = Date.now().toString().slice(-6);
                const prefix = item.name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
                const sku = item.sku ?? `${prefix}-${ts}`;
                const { data: newProd } = await supabase
                    .from('products')
                    .insert({
                    shop_id,
                    name: item.name,
                    sku,
                    category: item.category ?? 'Other',
                    cost_price: item.cost_price,
                    selling_price: item.cost_price * 1.2,
                    quantity: item.quantity,
                    reorder_threshold: 10,
                })
                    .select('id')
                    .single();
                if (newProd) {
                    await supabase.from('inventory_logs').insert({
                        shop_id,
                        product_id: newProd.id,
                        user_id,
                        action: 'increase',
                        delta: item.quantity,
                        note: `Bill scan ${scan_id.slice(0, 8).toUpperCase()} — new product`,
                    });
                }
            }
        }
        await supabase
            .from('bill_scans')
            .update({ processing_status: 'completed' })
            .eq('id', scan_id);
        return res.json({ ok: true });
    }
    catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
});
export default router;
