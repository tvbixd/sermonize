/** Shared transcription/outline error types (provider-agnostic). */

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfter: number) {
    super(`Rate limit reached. Try again in ${Math.ceil(retryAfter / 1000)} seconds.`);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfter;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('No internet connection. Check your network and try again.');
    this.name = 'NetworkError';
  }
}
