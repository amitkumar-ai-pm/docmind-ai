import https from 'https';
import OpenAI from 'openai';

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  timeout: 120_000,
});

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  timeout: 120_000,
  maxRetries: 0,
  httpAgent: httpsAgent,
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEndpoint(): { hostname: string; path: string } {
  const base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const url = new URL(base);
  const basePath = url.pathname.replace(/\/$/, '');
  return {
    hostname: url.hostname,
    path: `${basePath}/chat/completions`,
  };
}

/** Raw HTTPS fallback when the OpenAI SDK fetch layer fails (e.g. "Premature close"). */
export function chatCompletionsDirect(
  messages: ChatMessage[],
  maxTokens = 1000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
    });

    const { hostname, path } = getEndpoint();

    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method: 'POST',
        agent: httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 120_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');
            const parsed = JSON.parse(raw) as {
              error?: { message?: string };
              choices?: { message?: { content?: string } }[];
            };

            if (parsed.error?.message) {
              reject(new Error(parsed.error.message));
              return;
            }

            const content = parsed.choices?.[0]?.message?.content;
            resolve(content ?? 'Sorry, I could not generate a response.');
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(body);
    req.end();
  });
}

function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Premature close') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}

export async function chatCompletions(
  messages: ChatMessage[],
  maxTokens = 1000
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: maxTokens,
      });
      return response.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';
    } catch (error) {
      lastError = error;
      console.warn(`OpenAI SDK attempt ${attempt + 1} failed:`, error);
      if (attempt < 1) await sleep(1500);
    }
  }

  if (isNetworkError(lastError)) {
    console.warn('Falling back to direct HTTPS for chat completions');
    try {
      return await chatCompletionsDirect(messages, maxTokens);
    } catch (directError) {
      throw new Error(
        'Could not reach OpenAI. Check your API key, internet connection, or corporate proxy settings.'
      );
    }
  }

  throw lastError;
}
