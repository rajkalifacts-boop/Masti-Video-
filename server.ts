import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ── Persistent Data Storage ──────────────────────────────────────────────
const DATA_DIR = path.resolve('data');
const CHAT_FILE = path.join(DATA_DIR, 'chats.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface ChatMessage {
  id: string;
  clientId?: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;
  text: string;
  createdAt: string;
  read: boolean;
  isMine?: boolean;
}

interface ConversationItem {
  id: string;
  conversationId: string;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  lastMessage: string;
  lastMessageAt: string;
  participants: string[];
  unreadCount?: number;
}

interface ChatStore {
  messages: Record<string, ChatMessage[]>;
  conversations: Record<string, {
    conversationId: string;
    participants: string[];
    participantDetails: Record<string, { name: string; avatar: string }>;
    lastMessage: string;
    lastMessageAt: string;
    lastSenderId: string;
  }>;
}

const loadChatStore = (): ChatStore => {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      const raw = fs.readFileSync(CHAT_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Server] Could not read chat store:', err);
  }
  return { messages: {}, conversations: {} };
};

const saveChatStore = (store: ChatStore) => {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Could not save chat store:', err);
  }
};

let store = loadChatStore();

// ── SSE Active Listeners Map ─────────────────────────────────────────────
const sseListeners = new Map<string, Set<Response>>();

const normalizeId = (id: string | undefined): string => {
  return String(id ?? '').trim().replace(/^@+/, '').toLowerCase();
};

const notifySseClients = (userId: string, data: any) => {
  const norm = normalizeId(userId);
  const clients = sseListeners.get(norm);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  });
};

// ── Chat API Routes ──────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// GET /api/chat/messages?conversationId=...&myId=...
app.get('/api/chat/messages', (req: Request, res: Response) => {
  const convId = String(req.query.conversationId || '').trim();
  const myId = normalizeId(String(req.query.myId || ''));

  if (!convId) {
    res.json({ success: true, messages: [] });
    return;
  }

  const list = store.messages[convId] || [];
  const mapped = list.map(m => ({
    ...m,
    isMine: myId ? normalizeId(m.senderId) === myId : false,
  }));

  res.json({ success: true, messages: mapped });
});

// POST /api/chat/send
app.post('/api/chat/send', (req: Request, res: Response) => {
  const {
    conversationId,
    senderId,
    senderName,
    senderAvatar,
    recipientId,
    recipientName,
    recipientAvatar,
    text,
    clientId,
  } = req.body;

  if (!conversationId || !senderId || !text) {
    res.status(400).json({ success: false, error: 'conversationId, senderId and text are required.' });
    return;
  }

  const normSender = normalizeId(senderId);
  const normRecipient = normalizeId(recipientId);
  const nowIso = new Date().toISOString();

  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    clientId: clientId || `client_${Date.now()}`,
    conversationId,
    senderId: normSender,
    senderName: senderName || normSender,
    senderAvatar: senderAvatar || '',
    recipientId: normRecipient,
    recipientName: recipientName || normRecipient,
    recipientAvatar: recipientAvatar || '',
    text: String(text).trim(),
    createdAt: nowIso,
    read: false,
  };

  if (!store.messages[conversationId]) {
    store.messages[conversationId] = [];
  }
  store.messages[conversationId].push(newMsg);

  // Update conversation record
  const participants = Array.from(new Set([normSender, normRecipient].filter(Boolean)));
  store.conversations[conversationId] = {
    conversationId,
    participants,
    participantDetails: {
      ...(store.conversations[conversationId]?.participantDetails || {}),
      [normSender]: { name: senderName || normSender, avatar: senderAvatar || '' },
      ...(normRecipient ? { [normRecipient]: { name: recipientName || normRecipient, avatar: recipientAvatar || '' } } : {}),
    },
    lastMessage: newMsg.text,
    lastMessageAt: nowIso,
    lastSenderId: normSender,
  };

  saveChatStore(store);

  // Real-time Push to both sender and recipient SSE streams
  notifySseClients(normSender, { type: 'new_message', message: newMsg });
  if (normRecipient && normRecipient !== normSender) {
    notifySseClients(normRecipient, { type: 'new_message', message: newMsg });
  }

  res.json({ success: true, message: newMsg });
});

// GET /api/chat/conversations?userId=...
app.get('/api/chat/conversations', (req: Request, res: Response) => {
  const userId = normalizeId(String(req.query.userId || ''));
  if (!userId) {
    res.json({ success: true, conversations: [] });
    return;
  }

  const results: ConversationItem[] = [];

  Object.values(store.conversations).forEach(conv => {
    if (conv.participants.includes(userId)) {
      const peerId = conv.participants.find(p => p !== userId) || userId;
      const peerDetails = conv.participantDetails?.[peerId] || { name: peerId, avatar: '' };
      results.push({
        id: peerId,
        conversationId: conv.conversationId,
        peerId,
        peerName: peerDetails.name || peerId,
        peerAvatar: peerDetails.avatar || '',
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        participants: conv.participants,
      });
    }
  });

  results.sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  res.json({ success: true, conversations: results });
});

// GET /api/chat/stream?userId=... (Server-Sent Events)
app.get('/api/chat/stream', (req: Request, res: Response) => {
  const userId = normalizeId(String(req.query.userId || ''));
  if (!userId) {
    res.status(400).send('userId is required');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  if (!sseListeners.has(userId)) {
    sseListeners.set(userId, new Set());
  }
  sseListeners.get(userId)!.add(res);

  // Keep alive ping
  const interval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(interval);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(interval);
    sseListeners.get(userId)?.delete(res);
    if (sseListeners.get(userId)?.size === 0) {
      sseListeners.delete(userId);
    }
  });
});

// ── Health & Feed Proxy Endpoints ─────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  return res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/videos/feed', async (req: Request, res: Response) => {
  try {
    const page = req.query.page || '1';
    const limit = req.query.limit || '20';
    const upstream = await fetch(
      `https://masti-basen.lovable.app/api/videos/feed?page=${page}&limit=${limit}`,
      {
        headers: {
          'x-api-key': 'mb_live_rajkali_8789_7b31a6fe89d24643',
          'Content-Type': 'application/json',
        },
      }
    );
    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, data: [] });
    }
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Server Proxy] Feed error:', err);
    return res.status(200).json({ success: true, count: 0, data: [] });
  }
});

app.get('/manifest.json', (_req: Request, res: Response) => {
  const manifestPath = path.resolve('public/manifest.json');
  if (fs.existsSync(manifestPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(manifestPath);
  } else {
    res.status(404).json({ error: 'Manifest not found' });
  }
});

// ── Vite Dev Middleware & Prod Static Handling ───────────────────────────
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve('dist'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Masti] Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
