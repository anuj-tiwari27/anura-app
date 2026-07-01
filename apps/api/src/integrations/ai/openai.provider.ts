import OpenAI from 'openai';
import type { AiProvider, ChatMessage, ChatOptions, ChatResult } from './ai.types';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  constructor(
    private readonly client: OpenAI,
    private readonly defaultModel: string,
  ) {}

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const full: ChatMessage[] = options?.system
      ? [{ role: 'system', content: options.system }, ...messages]
      : messages;

    const res = await this.client.chat.completions.create({
      model: options?.model ?? this.defaultModel,
      messages: full.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
    });

    return {
      content: res.choices[0]?.message?.content ?? '',
      model: res.model,
      usage: {
        inputTokens: res.usage?.prompt_tokens,
        outputTokens: res.usage?.completion_tokens,
      },
    };
  }
}
