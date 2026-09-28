import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from '../config.js';
import { prompts } from './prompts.js';
import { getHistory, addMessage } from '../database/conversations.js';
const openai = createOpenAI({ apiKey: config.aiKey });
export async function answer({ conversationKey, userId, text, personality }) {
  const history = await getHistory(conversationKey);
  await addMessage(conversationKey, userId, 'user', text);
  const result = await generateText({ model: openai(config.aiModel), system: prompts[personality] || prompts.bot, messages: [...history, { role: 'user', content: text }], maxTokens: 1200, temperature: 0.7 });
  const output = result.text?.trim();
  if (!output) throw new Error('AI returned an empty response');
  await addMessage(conversationKey, userId, 'assistant', output);
  return output;
}
