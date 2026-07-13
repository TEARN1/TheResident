// Security Labs demo: simulated fetch interceptor showing token expiry
// mid-session, request queueing, and silent retries.
// NOT wired into the real Supabase client — supabase-js manages real
// sessions and refresh itself (see src/utils/supabase.ts).

interface QueuedRequest {
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
  input: RequestInfo | URL;
  init?: RequestInit;
}

class ResilientFetchManager {
  private isRefreshing = false;
  private queue: QueuedRequest[] = [];
  private currentToken: string | null = null;
  private simulateExpiry = false; // Flag to trigger simulated JWT expiry for testing

  setSimulateExpiry(val: boolean) {
    this.simulateExpiry = val;
  }

  setToken(token: string | null) {
    this.currentToken = token;
  }

  getToken() {
    return this.currentToken;
  }

  // Custom fetch function to pass to Supabase or use globally
  public customFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    // 1. Clone init options to inject Authorization headers
    const options = { ...init };
    const headers = new Headers(options.headers || {});

    if (this.currentToken) {
      headers.set('Authorization', `Bearer ${this.currentToken}`);
    }
    options.headers = headers;

    // 2. Simulate token expiry mid-session if flagged (injecting 401 for test cases)
    if (this.simulateExpiry && !this.isRefreshing) {
      console.warn('[ResilientFetch] Simulating mid-session JWT expiry (returning 401)');
      this.simulateExpiry = false; // reset so we don't loop
      return new Response(
        JSON.stringify({ error: 'invalid_grant', message: 'JWT expired' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const response = await fetch(input, options);

      // 3. Handle 401 Unauthorized token expiry
      if (response.status === 401) {
        console.log('[ResilientFetch] Intercepted 401 Unauthorized. Queueing request...');
        return new Promise<Response>((resolve, reject) => {
          this.queue.push({ resolve, reject, input, init });
          this.performSilentRefresh();
        });
      }

      return response;
    } catch (err) {
      // Network drop / connection issues
      throw err;
    }
  };

  private async performSilentRefresh() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    console.log('[ResilientFetch] Starting silent JWT session refresh...');

    try {
      // Simulate silent refresh endpoint call with latency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockNewToken = 'refreshed-jwt-' + Math.random().toString(36).substring(2, 10);
      this.setToken(mockNewToken);
      console.log('[ResilientFetch] Silent JWT refresh completed. Flushing queue...');

      // Flush queue
      const queued = [...this.queue];
      this.queue = [];

      for (const req of queued) {
        // Re-run the fetch call with the updated token
        const newOptions = { ...req.init };
        const headers = new Headers(newOptions.headers || {});
        headers.set('Authorization', `Bearer ${this.currentToken}`);
        newOptions.headers = headers;

        fetch(req.input, newOptions)
          .then(res => req.resolve(res))
          .catch(err => req.reject(err));
      }
    } catch (err) {
      console.error('[ResilientFetch] Silent refresh failed:', err);
      const queued = [...this.queue];
      this.queue = [];
      queued.forEach(req => req.reject(err));
    } finally {
      this.isRefreshing = false;
    }
  }
}

export const resilientFetchManager = new ResilientFetchManager();
