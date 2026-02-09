import { config } from '../config';
import { logger } from '../utils/logger';

class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://api.avalai.ir/v1';

  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    this.apiKey = config.GEMINI_API_KEY;
  }

  async generateReply(chatHistory: string, adDescription: string): Promise<string> {
    logger.info('Generating reply with Gemini 3 Pro (AvalAI)...');

    const prompt = `
    You are a polite and direct Iranian buyer on Divar (an online marketplace).
    Your ONLY goal is to find out the price of the item in the ad.
    You do NOT want to buy it immediately, just get the price.
    Do NOT waste time with small talk. Be concise.

    Ad Description:
    """${adDescription}"""

    Current Chat History:
    """${chatHistory}"""

    Instructions:
    1. Analyze the chat history.
    2. If the seller has already stated the price (e.g., "500 toman", "توافقی نیست", etc.), output exactly: "PRICE_FOUND: [The Price]".
    3. If the price is NOT in the chat history, generate a short, natural Persian message to ask for the price.
       - Example: "سلام، قیمت چنده؟" or "سلام، قیمت [Item Name] چنده؟"
       - IMPORTANT: Try to include the item name (from Ad Description) in your question to be more specific.
         - E.g. instead of "قیمت چنده؟", say "قیمت این بخاری چنده؟" (if it's a heater).
       - Do NOT be overly formal. Use conversational Persian.
       - Do NOT introduce yourself or say "I am interested". Just ask.
    4. If the chat is empty, start with a greeting and ask for the price.
    5. CRITICAL: If the LAST message in the chat history is a question YOU asked (e.g. "قیمت چنده؟"), and the seller has NOT answered yet, output exactly: "WAIT". Do NOT send another message.
    
    Output ONLY the reply, "PRICE_FOUND", or "WAIT". Do not add explanations.
    `;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gemini-3-pro-preview',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`AvalAI API Error: ${response.status} - ${errorText}`);
        return '';
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content?.trim() || '';
      
      logger.info(`Gemini response: ${text}`);
      return text;
    } catch (error) {
      logger.error('Error generating reply from AvalAI:', error);
      return '';
    }
  }
}

export const geminiService = new GeminiService();
