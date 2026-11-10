export interface MastiBaseAdsConfig {
  enabled: boolean;
  bannerFrequency: number;
  interstitialFrequency: number;
}

const API_BASE = 'https://masti-basen.lovable.app';
const API_KEY = 'mb_live_rajkali_8789_7b31a6fe89d24643';

const apiHeaders = (extra: Record<string, string> = {}) => ({
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
  ...extra,
});

export const normalizeMastiAvatarUrl = (url: any): string => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/dicebear|bottts|robohash|avatar\.iran\.liara\.run/i.test(trimmed)) {
    return '';
  }
  return trimmed;
};

export const normalizeMastiMediaUrl = (url: any): string => {
  if (!url) return '';
  return String(url).trim();
};

export const normalizeMastiBaseActionResponse = (res: any) => {
  return res || { success: true };
};

// ── Live MastiBase Cloud API Integration ──

export const getMastiBaseFeed = async (page = 1, limit = 20) => {
  try {
    let res: Response | null = null;
    try {
      res = await fetch(`${API_BASE}/api/videos/feed?page=${page}&limit=${limit}`, {
        headers: apiHeaders(),
      });
    } catch {
      // Fallback to local server proxy
      res = await fetch(`/api/videos/feed?page=${page}&limit=${limit}`).catch(() => null);
    }

    if (!res || !res.ok) {
      try {
        res = await fetch(`/api/videos/feed?page=${page}&limit=${limit}`).catch(() => null);
      } catch {}
    }

    const data = res && res.ok ? await res.json() : null;
    const rawList = data?.data || data?.videos || data?.items || (Array.isArray(data) ? data : []);
    if (Array.isArray(rawList) && rawList.length > 0) {
      const mappedVideos = rawList.map((item: any) => {
        const videoUrl = item.videoUrl || item.url || item.mediaUrl || '';
        const thumbnailUrl = item.thumbnailUrl || item.thumbnail || videoUrl;
        const profile = item.profile || {};
        const social = item.social || {};
        const music = item.music || {};

        return {
          ...item,
          id: String(item.id || 'v_' + Math.random().toString(36).substring(2, 9)),
          url: videoUrl,
          videoUrl: videoUrl,
          thumbnailUrl: thumbnailUrl,
          title: item.title || item.caption || 'Masti Video',
          desc: item.caption || item.description || item.title || '',
          likes: Number(social.likes ?? item.likesCount ?? item.likes ?? 0),
          comments: Number(social.comments ?? item.commentsCount ?? item.comments ?? 0),
          shares: Number(social.shares ?? item.sharesCount ?? item.shares ?? 0),
          saves: Number(social.saves ?? item.savesCount ?? item.saves ?? 0),
          views: Number(social.views ?? item.viewsCount ?? item.views ?? 0),
          isLiked: Boolean(social.isLiked || item.isLiked),
          isSaved: Boolean(social.isSaved || item.isSaved),
          isBookmarked: Boolean(social.isBookmarked || item.isBookmarked),
          isFollowing: Boolean(social.isFollowing || item.isFollowing),
          isFollowingCreator: Boolean(social.isFollowingCreator || item.isFollowingCreator),
          user: profile.username || profile.name || 'creator',
          userId: profile.id || profile.firebaseUid || item.userId || 'creator',
          name: profile.name || 'Masti Creator',
          profileImage: profile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          isVerified: Boolean(profile.isVerified),
          musicCover: profile.avatarUrl || '',
          profile: {
            ...profile,
            avatarUrl: profile.avatarUrl || '',
            name: profile.name || 'Masti Creator',
            username: profile.username || profile.name || 'creator',
            isVerified: Boolean(profile.isVerified),
          },
          social: {
            ...social,
            likes: Number(social.likes ?? item.likesCount ?? item.likes ?? 0),
            comments: Number(social.comments ?? item.commentsCount ?? item.comments ?? 0),
            shares: Number(social.shares ?? item.sharesCount ?? item.shares ?? 0),
            saves: Number(social.saves ?? item.savesCount ?? item.saves ?? 0),
            isLiked: Boolean(social.isLiked || item.isLiked),
            isBookmarked: Boolean(social.isBookmarked || item.isBookmarked),
            isFollowingCreator: Boolean(social.isFollowingCreator || item.isFollowingCreator),
          },
          song: {
            id: music.id || 'song_' + item.id,
            title: music.title || 'Original Audio',
            artist: music.artist || profile.name || 'Masti Creator',
            cover: profile.avatarUrl || '',
          },
          qualities: item.qualities || [],
          qualityUrls: item.qualityUrls || { auto: videoUrl },
          createdAt: item.createdAt || new Date().toISOString(),
        };
      });

      try {
        localStorage.setItem('@masti_media_videos_v3', JSON.stringify(mappedVideos));
      } catch {}

      const result: any = mappedVideos;
      result.videos = mappedVideos;
      result.page = page;
      result.hasMore = mappedVideos.length >= limit;
      return result;
    }
  } catch (err) {
    console.warn('[MastiBase API] Could not fetch live feed, using cache:', err);
  }

  try {
    const saved = localStorage.getItem('@masti_media_videos_v3');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const result: any = parsed;
        result.videos = parsed;
        result.page = page;
        result.hasMore = false;
        return result;
      }
    }
  } catch {}

  const fallback: any = [];
  fallback.videos = fallback;
  fallback.page = page;
  fallback.hasMore = false;
  return fallback;
};

export const getMastiBaseComments = async (videoId: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/social/comments/${encodeURIComponent(videoId)}`, {
      headers: apiHeaders(),
    });
    const data = await res.json();
    if (data && data.success && Array.isArray(data.comments)) {
      return data.comments;
    }
  } catch (err) {
    console.warn('[MastiBase API] Could not fetch comments:', err);
  }

  try {
    const raw = localStorage.getItem(`@masti_comments_${videoId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

export const getUserSocialCache = (userId: string) => {
  try {
    const raw = localStorage.getItem(`@masti_social_${userId}`);
    return raw ? JSON.parse(raw) : { liked: {}, saved: {}, following: {}, shares: {} };
  } catch {
    return { liked: {}, saved: {}, following: {}, shares: {} };
  }
};

export const saveUserSocialCache = (userId: string, data: any) => {
  try {
    localStorage.setItem(`@masti_social_${userId}`, JSON.stringify(data));
  } catch {}
};

export const commentOnMastiBaseVideo = async (videoIdOrPayload: any, commentArg?: string, userArg?: any) => {
  const isObj = typeof videoIdOrPayload === 'object' && videoIdOrPayload !== null;
  const mediaId = String(isObj ? (videoIdOrPayload.mediaId || videoIdOrPayload.videoId || videoIdOrPayload.id) : videoIdOrPayload).replace(/^db-/, '');
  const comment = isObj ? (videoIdOrPayload.comment || videoIdOrPayload.text || '') : (commentArg || '');
  const userId = isObj ? (videoIdOrPayload.userId || videoIdOrPayload.email) : (userArg?.email || userArg?.userId || userArg?.accountId || 'user@masti.in');
  const userName = isObj ? (videoIdOrPayload.userName || videoIdOrPayload.name || 'Masti User') : (userArg?.name || userArg?.username || 'Masti User');

  const newComment = {
    id: 'c_' + Date.now(),
    videoId: mediaId,
    userId,
    userName,
    userAvatar: userArg?.profileImage || '',
    text: comment,
    comment,
    likes: 0,
    createdAt: 'Just now',
    time: 'now',
  };

  try {
    const existing = JSON.parse(localStorage.getItem(`@masti_comments_${mediaId}`) || '[]');
    existing.push(newComment);
    localStorage.setItem(`@masti_comments_${mediaId}`, JSON.stringify(existing));
  } catch {}

  try {
    const res = await fetch(`${API_BASE}/api/v1/social/comment`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ mediaId, userId, userName, comment }),
    });
    const data = await res.json();
    if (data && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('[MastiBase API] Comment sync failed:', err);
  }

  return { success: true, comment: newComment };
};

export const likeMastiBaseVideo = async (videoIdOrPayload: any, likeArg?: boolean, user?: any) => {
  const isObj = typeof videoIdOrPayload === 'object' && videoIdOrPayload !== null;
  const mediaId = String(isObj ? (videoIdOrPayload.mediaId || videoIdOrPayload.videoId || videoIdOrPayload.id) : videoIdOrPayload).replace(/^db-/, '');
  const userId = isObj ? (videoIdOrPayload.userId || videoIdOrPayload.email) : (user?.email || user?.userId || 'user@masti.in');
  const userName = isObj ? (videoIdOrPayload.userName || videoIdOrPayload.name) : (user?.name || 'Masti User');
  const isLike = isObj ? (typeof videoIdOrPayload.like === 'boolean' ? videoIdOrPayload.like : true) : (typeof likeArg === 'boolean' ? likeArg : true);

  if (userId) {
    const cache = getUserSocialCache(userId);
    cache.liked = cache.liked || {};
    cache.liked[mediaId] = isLike;
    saveUserSocialCache(userId, cache);
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/social/like`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ mediaId, userId, userName, like: isLike }),
    });
    const data = await res.json();
    if (data && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('[MastiBase API] Like sync failed:', err);
  }
  return { success: true, mediaId, videoId: mediaId, isLiked: isLike };
};

export const bookmarkMastiBaseVideo = async (videoIdOrPayload: any, bookmarkArg?: boolean, user?: any) => {
  const isObj = typeof videoIdOrPayload === 'object' && videoIdOrPayload !== null;
  const mediaId = String(isObj ? (videoIdOrPayload.mediaId || videoIdOrPayload.videoId || videoIdOrPayload.id) : videoIdOrPayload).replace(/^db-/, '');
  const userId = isObj ? (videoIdOrPayload.userId || videoIdOrPayload.email) : (user?.email || user?.userId || 'user@masti.in');
  const isBookmark = isObj ? (typeof videoIdOrPayload.bookmark === 'boolean' ? videoIdOrPayload.bookmark : true) : (typeof bookmarkArg === 'boolean' ? bookmarkArg : true);

  if (userId) {
    const cache = getUserSocialCache(userId);
    cache.saved = cache.saved || {};
    cache.saved[mediaId] = isBookmark;
    saveUserSocialCache(userId, cache);
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/social/bookmark`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ mediaId, userId, isBookmark }),
    });
    const data = await res.json();
    if (data && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('[MastiBase API] Bookmark sync failed:', err);
  }
  return { success: true, mediaId, videoId: mediaId, isBookmarked: isBookmark };
};

export const shareMastiBaseVideo = async (videoIdOrPayload: any, platformArg = 'direct', user?: any) => {
  const isObj = typeof videoIdOrPayload === 'object' && videoIdOrPayload !== null;
  const mediaId = String(isObj ? (videoIdOrPayload.mediaId || videoIdOrPayload.videoId || videoIdOrPayload.id) : videoIdOrPayload).replace(/^db-/, '');
  const userId = isObj ? (videoIdOrPayload.userId || videoIdOrPayload.email) : (user?.email || user?.userId || 'user@masti.in');
  const platform = isObj ? (videoIdOrPayload.platform || 'direct') : platformArg;

  if (userId) {
    const cache = getUserSocialCache(userId);
    cache.shares = cache.shares || {};
    cache.shares[mediaId] = (cache.shares[mediaId] || 0) + 1;
    saveUserSocialCache(userId, cache);
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/social/share`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ mediaId, userId, platform }),
    });
    const data = await res.json();
    if (data && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('[MastiBase API] Share sync failed:', err);
  }
  return { success: true, mediaId, videoId: mediaId };
};

export const deleteMastiBaseVideo = async (videoId: string) => {
  return { success: true, videoId };
};

export const getMastiBaseBookmarks = async (email: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/social/bookmarks/${encodeURIComponent(email)}`, {
      headers: apiHeaders(),
    });
    const data = await res.json();
    if (data && data.success && Array.isArray(data.bookmarks)) {
      return data.bookmarks;
    }
  } catch (err) {
    console.warn('[MastiBase API] Could not fetch bookmarks:', err);
  }
  return [];
};

export const getMastiBaseAdsConfig = async (): Promise<MastiBaseAdsConfig> => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/admob`, {
      headers: apiHeaders(),
    });
    const data = await res.json();
    if (data) {
      return {
        enabled: Boolean(data.isAdMobEnabled),
        bannerFrequency: data.reelsAdFrequency || 4,
        interstitialFrequency: data.reelsAdFrequency || 4,
      };
    }
  } catch (err) {
    console.warn('[MastiBase API] Could not fetch AdMob config:', err);
  }
  return {
    enabled: true,
    bannerFrequency: 4,
    interstitialFrequency: 4,
  };
};

export const getMastiBaseMonetization = async (email: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/social/monetization/${encodeURIComponent(email)}`, {
      headers: apiHeaders(),
    });
    const data = await res.json();
    if (data) {
      return {
        coins: Math.round((data.walletBalance || 0) * 10),
        diamonds: Math.round((data.walletBalance || 0) / 2),
        estimatedEarningsInr: data.walletBalance || 0,
        eligibleForPayout: data.isEnabled ?? true,
        minPayoutAmount: 500,
        totalEarnings: data.totalEarnings || 0,
        rpm: data.rpm || 15,
        totalViews: data.totalViews || 0,
      };
    }
  } catch (err) {
    console.warn('[MastiBase API] Could not load monetization:', err);
  }
  return {
    coins: 0,
    diamonds: 0,
    estimatedEarningsInr: 0,
    eligibleForPayout: false,
    minPayoutAmount: 500,
    totalEarnings: 0,
  };
};

export const requestMastiBasePayout = async (accountIdOrPayload: any, amount?: number, details?: any) => {
  const isObj = typeof accountIdOrPayload === 'object' && accountIdOrPayload !== null;
  const accountId = isObj ? (accountIdOrPayload.userId || accountIdOrPayload.email) : accountIdOrPayload;
  const payoutAmount = isObj ? (accountIdOrPayload.amount ?? 0) : (amount ?? 0);
  const payoutDetails = isObj ? accountIdOrPayload : details;
  const method = payoutDetails?.accountNumber ? 'bank' : 'upi';
  const accountInfo = method === 'bank' ? JSON.stringify(payoutDetails) : (payoutDetails?.upiId || payoutDetails?.accountNumber || 'user@ybl');

  try {
    const res = await fetch(`${API_BASE}/api/v1/social/monetization/payout`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ userId: accountId, amount: payoutAmount, method, accountInfo, ...(isObj ? accountIdOrPayload : {}) }),
    });
    const data = await res.json();
    if (data && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('[MastiBase API] Payout request failed:', err);
  }

  return {
    success: true,
    amount,
    accountId,
    requestedAt: new Date().toISOString(),
    processAfter: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    status: 'pending',
  };
};

const DEFAULT_INBOX_NOTIFICATIONS: any[] = [];

export const getMastiBaseNotifications = async (ownerId?: string) => {
  const cleanId = String(ownerId || '').trim().toLowerCase().replace(/^@+/, '');
  const list: any[] = [];
  const seenIds = new Set<string>();

  try {
    if (cleanId) {
      const userKey = `@masti_notifs_${cleanId}`;
      const rawUser = localStorage.getItem(userKey);
      if (rawUser) {
        const userNotifs = JSON.parse(rawUser);
        userNotifs.forEach((n: any) => {
          if (!seenIds.has(n.id)) {
            seenIds.add(n.id);
            list.push(n);
          }
        });
      }
    }

    const rawAll = localStorage.getItem('@masti_global_notifications');
    if (rawAll) {
      const allNotifs = JSON.parse(rawAll);
      allNotifs.forEach((n: any) => {
        const rec = String(n.recipientId || n.userId || n.videoOwnerId || '').toLowerCase().replace(/^@+/, '');
        if (!cleanId || rec === cleanId || rec === 'all' || !n.recipientId) {
          if (!seenIds.has(n.id)) {
            seenIds.add(n.id);
            list.push(n);
          }
        }
      });
    }
  } catch {}

  DEFAULT_INBOX_NOTIFICATIONS.forEach((n) => {
    if (!seenIds.has(n.id)) {
      seenIds.add(n.id);
      list.push(n);
    }
  });

  return list;
};

export const markMastiBaseNotificationRead = async (id: string, ownerId?: string) => {
  try {
    const rawAll = localStorage.getItem('@masti_global_notifications');
    if (rawAll) {
      const allNotifs = JSON.parse(rawAll);
      allNotifs.forEach((n: any) => {
        if (n.id === id) n.read = true;
      });
      localStorage.setItem('@masti_global_notifications', JSON.stringify(allNotifs));
    }
    if (ownerId) {
      const cleanKey = `@masti_notifs_${String(ownerId).toLowerCase().replace(/^@+/, '')}`;
      const rawUser = localStorage.getItem(cleanKey);
      if (rawUser) {
        const userNotifs = JSON.parse(rawUser);
        userNotifs.forEach((n: any) => {
          if (n.id === id) n.read = true;
        });
        localStorage.setItem(cleanKey, JSON.stringify(userNotifs));
      }
    }
  } catch {}
  return { success: true };
};

export const createMastiBaseNotification = async (targetIdOrPayload: any, notificationArg?: any) => {
  const isObj = typeof targetIdOrPayload === 'object' && targetIdOrPayload !== null;
  const payload = isObj ? targetIdOrPayload : (notificationArg || {});
  const targetId = String(isObj ? (payload.userId || payload.targetId || payload.recipientId) : targetIdOrPayload).trim();

  const notifId = payload.id || 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const fromUserId = payload.fromUserId || payload.userId || '@user';
  const fromUserName = payload.fromUserName || payload.userName || fromUserId;
  const fromProfilePic = payload.fromProfilePic || payload.profilePic || payload.avatar || '';

  const newNotif = {
    id: notifId,
    type: payload.type || 'activity',
    title: payload.title || '',
    message: payload.message || '',
    fromUserId,
    fromUserName,
    fromProfilePic,
    avatar: fromProfilePic,
    profilePic: fromProfilePic,
    videoId: payload.videoId || '',
    videoOwnerId: targetId,
    recipientId: targetId,
    comment: payload.comment || '',
    read: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const rawAll = localStorage.getItem('@masti_global_notifications');
    const allNotifs: any[] = rawAll ? JSON.parse(rawAll) : [];
    const isDuplicate = allNotifs.some((n: any) =>
      n.type === payload.type &&
      n.videoId === payload.videoId &&
      n.fromUserId === fromUserId &&
      (payload.type !== 'comment' || n.comment === payload.comment)
    );
    if (!isDuplicate) {
      allNotifs.unshift(newNotif);
      localStorage.setItem('@masti_global_notifications', JSON.stringify(allNotifs.slice(0, 100)));

      if (targetId) {
        const cleanKey = `@masti_notifs_${targetId.toLowerCase().replace(/^@+/, '')}`;
        const rawUser = localStorage.getItem(cleanKey);
        const userNotifs: any[] = rawUser ? JSON.parse(rawUser) : [];
        const isUserDuplicate = userNotifs.some((n: any) =>
          n.type === payload.type &&
          n.videoId === payload.videoId &&
          n.fromUserId === fromUserId &&
          (payload.type !== 'comment' || n.comment === payload.comment)
        );
        if (!isUserDuplicate) {
          userNotifs.unshift(newNotif);
          localStorage.setItem(cleanKey, JSON.stringify(userNotifs.slice(0, 50)));
        }
      }
    }
  } catch {}

  return { success: true, notification: newNotif };
};

export const followMastiBaseCreator = async (followerIdOrPayload: any, followingIdArg?: string) => {
  const isObj = typeof followerIdOrPayload === 'object' && followerIdOrPayload !== null;
  const followerId = isObj ? (followerIdOrPayload.followerId || followerIdOrPayload.userId) : followerIdOrPayload;
  const followingId = isObj ? (followerIdOrPayload.followingId || followerIdOrPayload.creatorId || followerIdOrPayload.targetId) : followingIdArg;

  const action = isObj ? (followerIdOrPayload.action || (followerIdOrPayload.isFollowing === false ? 'unfollow' : 'follow')) : 'follow';

  if (followerId) {
    const cache = getUserSocialCache(followerId);
    cache.following = cache.following || {};
    if (action === 'unfollow') {
      delete cache.following[followingId];
    } else {
      cache.following[followingId] = true;
    }
    saveUserSocialCache(followerId, cache);
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/social/follow`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ followerId, followingId, action }),
    });
    const data = await res.json();
    if (data && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('[MastiBase API] Follow sync failed:', err);
  }
  return {
    success: true,
    isFollowing: action !== 'unfollow',
    followersCount: undefined,
    followerId,
    followingId,
  };
};

export const getMastiBaseProfile = async (email: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/social/user/${encodeURIComponent(email)}/synced-profile`, {
      headers: apiHeaders(),
    });
    const data = await res.json();
    if (data) {
      const cleanAvatar = normalizeMastiAvatarUrl(data.avatarUrl || data.profileImage || '');
      return {
        id: data.email || email,
        userId: data.email || email,
        username: data.username || email.split('@')[0],
        name: data.name || 'Masti Creator',
        bio: data.bio || 'Short video creator on Masti 🇮🇳',
        followersCount: data.followersCount || 0,
        followingCount: data.followingCount || 0,
        likesCount: data.totalLikes || 0,
        isVerified: Boolean(data.isVerified),
        avatarUrl: cleanAvatar,
        avatar: cleanAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        socialLinks: data.socialLinks || {},
      };
    }
  } catch (err) {
    console.warn('[MastiBase API] Could not fetch synced profile:', err);
  }

  return {
    id: email,
    userId: email,
    username: email.split('@')[0],
    name: 'Masti Creator',
    bio: 'Short video creator on Masti 🇮🇳',
    followersCount: 0,
    followingCount: 0,
    likesCount: 0,
    isVerified: false,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  };
};

export const lookupMastiBaseUser = async (identifier: string) => {
  return getMastiBaseProfile(identifier);
};

export const syncMastiBaseUser = async (profileData: {
  email: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  firebaseUid?: string;
  phoneNumber?: string;
  username?: string;
}) => {
  try {
    if (profileData.firebaseUid) {
      const res = await fetch(`${API_BASE}/api/auth/firebase-login`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (data) return { success: true, profile: data };
    } else {
      const res = await fetch(`${API_BASE}/api/auth/email-sync`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (data) return { success: true, profile: data };
    }
  } catch (err) {
    console.warn('[MastiBase API] Auth sync failed:', err);
  }
  return { success: true, profile: profileData };
};

export const searchMastiBase = async (q: string, type = 'all') => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/search?query=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`, {
      headers: apiHeaders(),
    });
    const data = await res.json();
    if (data && data.success) {
      return {
        users: data.users || [],
        videos: data.videos || [],
        hashtags: data.hashtags || [],
      };
    }
  } catch (err) {
    console.warn('[MastiBase API] Search failed:', err);
  }
  return { users: [], videos: [], hashtags: [] };
};

export default {
  normalizeMastiAvatarUrl,
  normalizeMastiMediaUrl,
  normalizeMastiBaseActionResponse,
  getMastiBaseFeed,
  getMastiBaseComments,
  commentOnMastiBaseVideo,
  likeMastiBaseVideo,
  bookmarkMastiBaseVideo,
  shareMastiBaseVideo,
  deleteMastiBaseVideo,
  getMastiBaseBookmarks,
  getMastiBaseAdsConfig,
  getMastiBaseMonetization,
  requestMastiBasePayout,
  getMastiBaseNotifications,
  markMastiBaseNotificationRead,
  createMastiBaseNotification,
  followMastiBaseCreator,
  getMastiBaseProfile,
  lookupMastiBaseUser,
  syncMastiBaseUser,
  searchMastiBase,
};
