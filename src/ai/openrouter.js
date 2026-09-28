import 'dotenv/config';
import { config } from '../config.js';

const required = ['OPENROUTER_API_KEY', 'AI_MODEL'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

async function makeOpenRouterRequest(messages, systemPrompt) {
  const requestBody = {
    model: config.aiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 1200,
    top_p: 0.9
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterKey}`,
          'HTTP-Referer': 'https://github.com/MelikValid/evon-discord-bot',
          'X-Title': 'Evon Discord Bot'
        },
        body: JSON.stringify(requestBody),
        timeout: 30000
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;

        // Handle rate limits
        if (statusCode === 429) {
          const retryAfter = response.headers.get('retry-after') || (5 * Math.pow(2, attempt));
          const waitMs = parseInt(retryAfter) * 1000 || retryAfter;
          console.warn(`OpenRouter rate limit. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, Math.min(waitMs, 30000)));
          continue;
        }

        // Handle auth errors
        if (statusCode === 401) {
          throw new Error('OpenRouter authentication failed. Check OPENROUTER_API_KEY.');
        }

        // Handle 5xx errors with retry
        if (statusCode >= 500 && attempt < MAX_RETRIES - 1) {
          console.warn(`OpenRouter server error (${statusCode}). Retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, RETRY_DELAY * Math.pow(2, attempt)));
          continue;
        }

        throw new Error(`OpenRouter API error ${statusCode}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('OpenRouter returned empty choices');
      }

      const content = data.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('OpenRouter returned empty message content');
      }

      return content;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      // Retry on timeout or network errors
      if (!isLastAttempt && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
        console.warn(`Network error. Retrying (attempt ${attempt + 1}/${MAX_RETRIES}):`, error.message);
        await new Promise(r => setTimeout(r, RETRY_DELAY * Math.pow(2, attempt)));
        continue;
      }

      if (isLastAttempt) {
        throw error;
      }
    }
  }

  throw new Error('OpenRouter request failed after all retries');
}

export { makeOpenRouterRequest };
