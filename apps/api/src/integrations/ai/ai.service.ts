import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AppConfig } from '../../config/configuration';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import type { AiProvider, ChatMessage, ChatOptions, ChatResult } from './ai.types';

/**
 * Facade over the configured chat LLM plus OpenAI embeddings.
 * Clients are created lazily so the API boots without keys; calling a method
 * without the required key throws a clear 503 instead of crashing at startup.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private _provider?: AiProvider;
  private _openai?: OpenAI;

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['ai'] {
    return this.config.get<AppConfig['ai']>('ai')!;
  }

  private openaiClient(): OpenAI {
    if (!this._openai) {
      const apiKey = this.cfg.openaiApiKey;
      if (!apiKey) {
        throw new ServiceUnavailableException('OPENAI_API_KEY is not configured');
      }
      this._openai = new OpenAI({ apiKey });
    }
    return this._openai;
  }

  private provider(): AiProvider {
    if (this._provider) return this._provider;
    if (this.cfg.provider === 'openai') {
      this._provider = new OpenAiProvider(this.openaiClient(), this.cfg.chatModelOpenai);
    } else {
      const apiKey = this.cfg.anthropicApiKey;
      if (!apiKey) {
        throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured');
      }
      this._provider = new AnthropicProvider(new Anthropic({ apiKey }), this.cfg.chatModelAnthropic);
    }
    return this._provider;
  }

  /** Run a chat completion against the configured provider. */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    return this.provider().chat(messages, options);
  }

  /** Embed one or more texts (always via OpenAI text-embedding-3-large). */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await this.openaiClient().embeddings.create({
      model: this.cfg.embeddingModel,
      input: texts,
      dimensions: this.cfg.embeddingDimensions,
    });
    return res.data.map((d) => d.embedding);
  }

  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    return vec;
  }

  get embeddingDimensions(): number {
    return this.cfg.embeddingDimensions;
  }
}
