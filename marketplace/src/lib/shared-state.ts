// FILE: marketplace/src/lib/shared-state.ts
// PURPOSE: Shared marketplace room state, backed by a live WebSocket to the Node backend.
// Writes apply locally first (instant UI) and are sent to the server, which normalizes
// them and echoes the authoritative value back to every client including this one.

import { logger } from './logger';

export type SharedCollections = 'deals' | 'campaigns' | 'messages' | 'applications' | 'notifications' | 'events';

export interface SharedState {
  deals: Record<string, any>;
  campaigns: Record<string, any>;
  messages: Record<string, any[]>;
  applications: Record<string, any>;
  notifications: Record<string, any>;
  events?: Record<string, any>;
}

export const EMPTY_SHARED_STATE: SharedState = {
  deals: {},
  campaigns: {},
  messages: {},
  applications: {},
  notifications: {},
  events: {},
};

type Mutation =
  | { op: 'set'; collection: SharedCollections; key: string; value: unknown }
  | { op: 'merge'; collection: SharedCollections; key: string; value: Record<string, unknown> }
  | { op: 'append'; collection: SharedCollections; key: string; value: unknown }
  | { op: 'delete'; collection: SharedCollections; key: string };

const MAX_MESSAGES_PER_DEAL = 500;

export class SharedStateManager {
  private static instance: SharedStateManager;
  private state: SharedState = { ...EMPTY_SHARED_STATE };
  private listeners: Set<(state: SharedState) => void> = new Set();

  private constructor() {}

  static getInstance(): SharedStateManager {
    if (!SharedStateManager.instance) {
      SharedStateManager.instance = new SharedStateManager();
    }
    return SharedStateManager.instance;
  }

  getState(): SharedState {
    return this.state;
  }

  setState(newState: Partial<SharedState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  replaceState(next: Partial<SharedState>): void {
    this.state = { ...EMPTY_SHARED_STATE, ...next };
    this.notifyListeners();
  }

  updateCollection<K extends SharedCollections>(collection: K, key: string, value: any): void {
    this.state = {
      ...this.state,
      [collection]: { ...(this.state[collection] as Record<string, any>), [key]: value },
    };
    this.notifyListeners();
  }

  removeKey(collection: SharedCollections, key: string): void {
    const bucket = { ...(this.state[collection] as Record<string, any>) };
    delete bucket[key];
    this.state = { ...this.state, [collection]: bucket };
    this.notifyListeners();
  }

  subscribe(listener: (state: SharedState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        logger.error('Error notifying state listener', error);
      }
    });
  }

  clear(): void {
    this.state = { ...EMPTY_SHARED_STATE };
    this.notifyListeners();
  }
}

export const sharedStateManager = SharedStateManager.getInstance();

// ---- Realtime connection status -----------------------------------------

const realtimeStatusListeners = new Set<() => void>();
let realtimeConnected = false;

export function subscribeRealtimeStatus(listener: () => void): () => void {
  realtimeStatusListeners.add(listener);
  return () => {
    realtimeStatusListeners.delete(listener);
  };
}

export function isRealtimeConnected(): boolean {
  return realtimeConnected;
}

export function setRealtimeConnected(connected: boolean): void {
  if (realtimeConnected === connected) return;
  realtimeConnected = connected;
  realtimeStatusListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      logger.error('Error notifying realtime status listener', error);
    }
  });
}

// ---- WebSocket transport -------------------------------------------------

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const PING_INTERVAL_MS = 25000;

let socket: WebSocket | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let onlineCount = 0;

// Mutations issued while the socket is down. Replayed on reconnect so an action
// taken during a blip still reaches everyone else instead of silently vanishing.
const outbox: Mutation[] = [];
const MAX_OUTBOX = 200;

function applyLocal(m: Mutation): void {
  const bucket = (sharedStateManager.getState()[m.collection] || {}) as Record<string, any>;

  switch (m.op) {
    case 'set':
      sharedStateManager.updateCollection(m.collection, m.key, m.value);
      return;
    case 'merge': {
      const current = bucket[m.key] && typeof bucket[m.key] === 'object' ? bucket[m.key] : {};
      sharedStateManager.updateCollection(m.collection, m.key, { ...current, ...m.value });
      return;
    }
    case 'append': {
      const arr: any[] = Array.isArray(bucket[m.key]) ? bucket[m.key] : [];
      const v = m.value as any;
      // Same idempotency rule the server uses, so the echo doesn't duplicate.
      if (v && typeof v === 'object' && v.id != null && arr.some((x) => x && x.id === v.id)) return;
      const next = [...arr, m.value];
      sharedStateManager.updateCollection(
        m.collection,
        m.key,
        next.length > MAX_MESSAGES_PER_DEAL ? next.slice(-MAX_MESSAGES_PER_DEAL) : next
      );
      return;
    }
    case 'delete':
      sharedStateManager.removeKey(m.collection, m.key);
      return;
  }
}

function send(m: Mutation): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'mutate', ...m }));
    return;
  }
  if (outbox.length < MAX_OUTBOX) outbox.push(m);
}

function flushOutbox(): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  while (outbox.length) {
    const m = outbox.shift()!;
    socket.send(JSON.stringify({ type: 'mutate', ...m }));
  }
}

function teardown(): void {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try { socket.close(); } catch { /* already closed */ }
    socket = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    connect();
  }, reconnectDelay);
}

function connect(): void {
  if (typeof window === 'undefined' || !WS_URL) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  teardown();

  let url = WS_URL;
  if (!/^wss?:\/\//.test(url)) {
    url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${url}`;
  }

  try {
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      reconnectDelay = RECONNECT_BASE_MS;
      setRealtimeConnected(true);
      ws.send(JSON.stringify({ type: 'sync' }));
      flushOutbox();
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'sync':
          if (msg.state && typeof msg.state === 'object') sharedStateManager.replaceState(msg.state);
          return;
        case 'mutate':
          applyLocal(msg as Mutation);
          return;
        case 'presence':
          onlineCount = typeof msg.online === 'number' ? msg.online : 0;
          return;
        default:
          return;
      }
    };

    ws.onclose = () => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      setRealtimeConnected(false);
      socket = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      try { ws.close(); } catch { /* onclose will handle reconnect */ }
    };
  } catch (err) {
    logger.warn('[realtime] connect failed', { error: err instanceof Error ? err.message : String(err) });
    setRealtimeConnected(false);
    scheduleReconnect();
  }
}

/** Idempotent — safe to call from every mounting component. */
export function startRealtime(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  if (!WS_URL) {
    logger.warn('[realtime] NEXT_PUBLIC_WS_URL not set, running offline');
    return;
  }

  connect();

  // A backgrounded tab gets its socket reaped; reconnect the moment it returns.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !realtimeConnected) {
      reconnectDelay = RECONNECT_BASE_MS;
      connect();
    }
  });
  window.addEventListener('online', () => {
    reconnectDelay = RECONNECT_BASE_MS;
    connect();
  });
}

export function getOnlineCount(): number {
  return onlineCount;
}

// ---- Public mutation API (unchanged signatures) --------------------------

export async function loadSharedState(): Promise<SharedState> {
  try {
    startRealtime();
    return sharedStateManager.getState();
  } catch (e) {
    logger.warn('[realtime] loadSharedState threw', { error: e instanceof Error ? e.message : String(e) });
    return EMPTY_SHARED_STATE;
  }
}

export async function upsertSharedKey(path: SharedCollections, key: string, value: unknown): Promise<boolean> {
  try {
    const m: Mutation = { op: 'set', collection: path, key, value };
    applyLocal(m);
    send(m);
    return true;
  } catch {
    return false;
  }
}

export async function mergeSharedDeal(dealKey: string, updates: Record<string, unknown>): Promise<boolean> {
  try {
    const m: Mutation = { op: 'merge', collection: 'deals', key: dealKey, value: updates };
    applyLocal(m);
    send(m);
    return true;
  } catch {
    return false;
  }
}

export async function appendSharedMessage(dealKey: string, message: unknown): Promise<boolean> {
  try {
    // An id is what makes the append idempotent across retry and echo.
    const withId =
      message && typeof message === 'object' && (message as any).id == null
        ? { ...(message as Record<string, unknown>), id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
        : message;
    const m: Mutation = { op: 'append', collection: 'messages', key: dealKey, value: withId };
    applyLocal(m);
    send(m);
    return true;
  } catch {
    return false;
  }
}

export async function setSharedMessages(dealKey: string, messages: unknown[]): Promise<boolean> {
  try {
    const m: Mutation = { op: 'set', collection: 'messages', key: dealKey, value: messages };
    applyLocal(m);
    send(m);
    return true;
  } catch {
    return false;
  }
}

export async function deleteSharedKey(path: SharedCollections, key: string): Promise<boolean> {
  try {
    const m: Mutation = { op: 'delete', collection: path, key };
    applyLocal(m);
    send(m);
    return true;
  } catch {
    return false;
  }
}

export function subscribeSharedState(onChange: (state: SharedState) => void): () => void {
  startRealtime();
  return sharedStateManager.subscribe(onChange);
}
