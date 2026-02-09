interface ServerState {
  lastRequest: number;
  queue: Array<() => void>;
}

const servers = new Map<string, ServerState>();
let activeRequests = 0;
const MAX_CONCURRENT = 5;
const MIN_INTERVAL_MS = 1000;

function getServerState(server: string): ServerState {
  let state = servers.get(server);
  if (!state) {
    state = { lastRequest: 0, queue: [] };
    servers.set(server, state);
  }
  return state;
}

export async function withRateLimit<T>(
  server: string,
  fn: () => Promise<T>
): Promise<T> {
  // Wait for concurrent slot
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const state = getServerState(server);
  const now = Date.now();
  const elapsed = now - state.lastRequest;

  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }

  activeRequests++;
  state.lastRequest = Date.now();

  try {
    return await fn();
  } finally {
    activeRequests--;
  }
}
