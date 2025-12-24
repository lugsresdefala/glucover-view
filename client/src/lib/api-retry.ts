interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown, attempt: number) => {
    if (attempt >= 3) return false;

    if (error instanceof Response) {
      const status = error.status;
      return status >= 500 || status === 408 || status === 429;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }

    return false;
  },
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < opts.maxRetries - 1 && opts.shouldRetry(error, attempt)) {
        const waitTime = opts.delayMs * Math.pow(opts.backoffMultiplier, attempt);
        await delay(waitTime);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, init);

    if (!response.ok) {
      throw response;
    }

    return response;
  }, options);
}
