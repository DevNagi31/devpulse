// Minimal Groq client. Groq exposes the OpenAI chat-completions shape so
// we can talk to it with plain fetch — no SDK dependency needed.

export interface GroqOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** When set, model must return JSON conforming to this schema (when supported). */
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class GroqClient {
  constructor(private opts: GroqOptions) {}

  async chat(req: ChatRequest): Promise<string> {
    const url = `${this.opts.baseUrl ?? 'https://api.groq.com/openai/v1'}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.opts.model ?? 'llama-3.3-70b-versatile',
      messages: req.messages,
      temperature: req.temperature ?? 0.1,
      max_tokens: req.maxTokens ?? 1024,
    };
    if (req.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.opts.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq error ${res.status}: ${text}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq returned no content');
    return content;
  }
}
