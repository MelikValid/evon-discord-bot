import { makeOpenRouterRequest } from './openrouter.js';
import { prompts } from './prompts.js';
import { getHistory, addMessage } from '../database/conversations.js';

export async function answer({ conversationKey, userId, text, personality }) {
  try {
    const history = await getHistory(conversationKey);
    await addMessage(conversationKey, userId, 'user', text);

    const systemPrompt = prompts[personality] || prompts.bot;
    const response = await makeOpenRouterRequest(history.concat([{ role: 'user', content: text }]), systemPrompt);

    if (!response) {
      throw new Error('AI returned empty response');
    }

    await addMessage(conversationKey, userId, 'assistant', response);
    return response;
  } catch (error) {
    console.error('AI generation error:', error);
    throw error;
  }
}
