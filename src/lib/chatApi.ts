export interface PeerActivity {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  isOnline: boolean;
  lastActive: string;
}

export interface RemoteChatMessage {
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
  sent?: boolean;
  isMine?: boolean;
}

export interface DirectChatConversation {
  id: string;
  conversationId: string;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  lastMessage: string;
  lastMessageAt?: string;
  time?: string;
  isOnline?: boolean;
  unreadCount?: number;
  userId?: string;
  mastiBaseUserId?: string;
}

const normalizeHandle = (id: string | undefined): string => {
  return String(id ?? '').trim().replace(/^@+/, '').toLowerCase();
};

export const chatConversationId = (id1: string, id2: string): string => {
  const norm1 = normalizeHandle(id1);
  const norm2 = normalizeHandle(id2);
  return [norm1, norm2].sort().join('__');
};

export const getFriendActivity = async (_userIds?: string[]): Promise<PeerActivity[]> => {
  return [];
};

export const markFriendActivityRead = async (_id: any): Promise<{ success: boolean }> => {
  return { success: true };
};

export const getDirectChatConversations = async (
  _ownerIds: string[],
  myId: string
): Promise<DirectChatConversation[]> => {
  const normMyId = normalizeHandle(myId);
  if (!normMyId || normMyId === 'guest') return [];

  try {
    const res = await fetch(`/api/chat/conversations?userId=${encodeURIComponent(normMyId)}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.conversations)) {
        // Cache to local storage
        try {
          localStorage.setItem(`@masti_conversations_${normMyId}`, JSON.stringify(data.conversations));
        } catch {}
        return data.conversations.map((c: any) => ({
          ...c,
          id: c.peerId || c.id,
          userId: c.peerId,
          mastiBaseUserId: c.peerId,
        }));
      }
    }
  } catch (err) {
    console.warn('[ChatAPI] getDirectChatConversations network error:', err);
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem(`@masti_conversations_${normMyId}`);
    if (raw) return JSON.parse(raw);
  } catch {}

  return [];
};

export const getDirectChatMessages = async (
  _ownerIds: string[],
  conversationId: string,
  myId: string,
  _user1?: string,
  _user2?: string
): Promise<RemoteChatMessage[]> => {
  if (!conversationId) return [];
  const normMyId = normalizeHandle(myId);

  try {
    const res = await fetch(
      `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&myId=${encodeURIComponent(normMyId)}`,
      { headers: { 'Cache-Control': 'no-cache' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        try {
          localStorage.setItem(`@masti_chat_msgs_${conversationId}`, JSON.stringify(data.messages));
        } catch {}
        return data.messages;
      }
    }
  } catch (err) {
    console.warn('[ChatAPI] getDirectChatMessages network error:', err);
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem(`@masti_chat_msgs_${conversationId}`);
    if (raw) {
      const list: RemoteChatMessage[] = JSON.parse(raw);
      return list.map(m => ({
        ...m,
        isMine: normMyId ? normalizeHandle(m.senderId) === normMyId : false,
      }));
    }
  } catch {}

  return [];
};

export const sendDirectChatMessage = async (params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;
  text: string;
  clientId?: string;
}): Promise<RemoteChatMessage> => {
  const normSender = normalizeHandle(params.senderId);
  const normRecipient = normalizeHandle(params.recipientId);

  const fallbackMsg: RemoteChatMessage = {
    id: `msg_${Date.now()}`,
    clientId: params.clientId || `client_${Date.now()}`,
    conversationId: params.conversationId,
    senderId: normSender,
    senderName: params.senderName || normSender,
    senderAvatar: params.senderAvatar,
    recipientId: normRecipient,
    recipientName: params.recipientName,
    recipientAvatar: params.recipientAvatar,
    text: params.text,
    createdAt: new Date().toISOString(),
    sent: true,
    isMine: true,
  };

  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: params.conversationId,
        senderId: normSender,
        senderName: params.senderName,
        senderAvatar: params.senderAvatar,
        recipientId: normRecipient,
        recipientName: params.recipientName,
        recipientAvatar: params.recipientAvatar,
        text: params.text,
        clientId: params.clientId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.message) {
        // Cache to local storage
        try {
          const raw = localStorage.getItem(`@masti_chat_msgs_${params.conversationId}`);
          const list: RemoteChatMessage[] = raw ? JSON.parse(raw) : [];
          list.push(data.message);
          localStorage.setItem(`@masti_chat_msgs_${params.conversationId}`, JSON.stringify(list));
        } catch {}
        return data.message;
      }
    }
  } catch (err) {
    console.warn('[ChatAPI] sendDirectChatMessage network error:', err);
  }

  // Offline cache
  try {
    const raw = localStorage.getItem(`@masti_chat_msgs_${params.conversationId}`);
    const list: RemoteChatMessage[] = raw ? JSON.parse(raw) : [];
    list.push(fallbackMsg);
    localStorage.setItem(`@masti_chat_msgs_${params.conversationId}`, JSON.stringify(list));
  } catch {}

  return fallbackMsg;
};

export const subscribeToChatStream = (
  userId: string,
  onMessage: (msg: any) => void
): (() => void) => {
  const normId = normalizeHandle(userId);
  if (!normId || typeof window === 'undefined' || !window.EventSource) {
    return () => {};
  }

  try {
    const es = new EventSource(`/api/chat/stream?userId=${encodeURIComponent(normId)}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === 'new_message') {
          onMessage(data.message);
        }
      } catch {}
    };
    es.onerror = () => {
      // EventSource reconnects automatically
    };
    return () => {
      es.close();
    };
  } catch {
    return () => {};
  }
};

export default {
  chatConversationId,
  getFriendActivity,
  markFriendActivityRead,
  getDirectChatConversations,
  getDirectChatMessages,
  sendDirectChatMessage,
  subscribeToChatStream,
};
