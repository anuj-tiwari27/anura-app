export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
}

export interface ChatResult {
  content: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** A pluggable chat LLM (OpenAI or Anthropic). */
export interface AiProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
}
