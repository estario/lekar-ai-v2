import { createOpenAI } from '@ai-sdk/openai';
import { streamText, type ModelMessage } from 'ai';
import { createLovableAiGatewayRunIdFetch } from './run-id.ts';

/** maxOutputTokens: optional hard cap (Responses `max_output_tokens`, includes reasoning tokens). Omitted = unchanged clinical default. */
export function streamClinicalText(apiKey: string, messages: ModelMessage[], options: { maxOutputTokens?: number } = {}) {
 const run = createLovableAiGatewayRunIdFetch();
 const provider = createOpenAI({
  baseURL: 'https://ai.gateway.lovable.dev/v1', apiKey,
  headers: {'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk'},
  fetch: run.fetch,
 });
 return streamText({
  model: provider.responses('openai/gpt-6-luna'),
  instructions: messages.filter(message => message.role === 'system').map(message => message.content).join('\n'),
  messages: messages.filter(message => message.role !== 'system'), maxRetries: 0,
  ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
  providerOptions: {openai: {store: false, forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', include: ['reasoning.encrypted_content']}},
 });
}

