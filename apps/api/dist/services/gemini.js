import { GoogleGenerativeAI } from '@google/generative-ai';
const apiKey = process.env.GEMINI_API_KEY ?? '';
const genAI = new GoogleGenerativeAI(apiKey);
function getModel() {
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}
async function generateJSON(prompt) {
    if (!apiKey)
        return null;
    try {
        const model = getModel();
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        // Strip markdown code fences if present
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(cleaned);
    }
    catch {
        return null;
    }
}
export async function parseBillOCR(ocrText) {
    const prompt = `You are a bill parser for an Indian grocery/retail store.
Given this OCR text from a supplier invoice, extract all product line items.
Return a JSON array only, no explanation: [{name: string, quantity: number, cost_price: number}]
Quantity must be an integer >= 1. Cost price must be a number >= 0.
If a field is unclear, make a reasonable guess.
OCR text:
${ocrText}`;
    const result = await generateJSON(prompt);
    return Array.isArray(result) ? result : [];
}
export async function parseVoiceCommand(transcript) {
    const prompt = `You are an inventory assistant for an Indian shop.
Parse this voice command. It may be in English, Hindi, or Hinglish (mixed).
Return JSON only, no explanation: {action: "add"|"remove"|"create"|"unknown", product_name: string, quantity: number, cost_price?: number, selling_price?: number}
Quantity must be an integer >= 1.
Examples:
- "Add 50 Maggi packets" -> {action:"add", product_name:"Maggi", quantity:50}
- "Remove 10 Lux soaps" -> {action:"remove", product_name:"Lux Soap", quantity:10}
- "Create new product Dairy Milk quantity 20 cost 40 selling 50" -> {action:"create", product_name:"Dairy Milk", quantity:20, cost_price:40, selling_price:50}
- "50 Maggi add karo" -> {action:"add", product_name:"Maggi", quantity:50}
Voice command: ${transcript}`;
    const result = await generateJSON(prompt);
    return result ?? { action: 'unknown', product_name: '', quantity: 0 };
}
export async function generateProductMetadata(productName, shopType) {
    const prompt = `You are a product catalog assistant for an Indian ${shopType} store.
Given product name "${productName}", generate product metadata.
Return JSON only, no explanation:
{
  "sku": "3 uppercase letters + hyphen + 3 digits (e.g. MAG-001)",
  "category": "one of: Beverages, Dairy, Snacks, Grains & Pulses, Spices, Personal Care, Medicines, Electronics, Clothing, Stationery, Other",
  "brand": "brand name or empty string if unknown",
  "tags": ["up to 5 relevant tags"],
  "reorder_threshold": integer between 5 and 50,
  "search_keywords": ["up to 10 search keywords"]
}`;
    return generateJSON(prompt);
}
export async function businessChat(userMessage, history, contextSnapshot) {
    if (!apiKey)
        return 'AI assistant is not configured. Please add GEMINI_API_KEY to the API server.';
    const contextStr = JSON.stringify(contextSnapshot, null, 2);
    const historyStr = history
        .slice(-10)
        .map((m) => `${m.role === 'user' ? 'Owner' : 'Assistant'}: ${m.message}`)
        .join('\n');
    const prompt = `You are an AI business assistant for SmartStock AI, helping an Indian shop owner understand their inventory, sales, and business performance.

Shop data (current snapshot):
${contextStr}

Recent conversation:
${historyStr}

Owner's question: ${userMessage}

Answer in 2-4 sentences. Be direct, practical, and use ₹ for currency. If the data doesn't contain enough information to answer, say so clearly. Do not make up numbers.`;
    try {
        const model = getModel();
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }
    catch (err) {
        return `Sorry, I couldn't process that request. Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
}
