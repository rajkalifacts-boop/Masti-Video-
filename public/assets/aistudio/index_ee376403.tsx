// The supplied app is a large, JavaScript-first Expo screen. Keep its original
// runtime behavior and let Expo/Babel perform the production validation.
// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Animated,
  
  
TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  Image,
  ScrollView,
  FlatList,
  Linking,
  Modal,
  Platform,
  Share,
  RefreshControl,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  PanResponder,
  Switch,
  Easing,
  StatusBar,
  BackHandler,
  ToastAndroid,
  PermissionsAndroid,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/i18n';

import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio, LegacyAudioSound, Video } from '../components/ExpoMediaCompat';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from '../lib/mediaLibraryCompat';
import * as Location from 'expo-location';
import { Ionicons, Feather, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import Svg, { Circle, Rect as SvgRect, Defs, LinearGradient as SvgLinearGradient, Stop as SvgStop } from 'react-native-svg';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import LoginBottomSheet from '../components/LoginBottomSheet';
import { useSuccessToast } from '../components/SuccessToastProvider';
import { appAuth, completeGoogleRedirectSignIn, isGoogleRedirectPending, onAuthStateChanged } from '../lib/auth';
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, where, doc, updateDoc, setDoc, arrayUnion, writeBatch, getDocs, getDoc, runTransaction, deleteDoc } from '../lib/localStore';
import { getMastiAudios, uploadEditedVideoToMastiBash, uploadProfileImageToMastiBash, uploadThumbnailToMastiBash, uploadVideoToMastiBash } from '../lib/mastiBash';
import {
  commentOnMastiBaseVideo,
  deleteMastiBaseVideo,
  getMastiBaseFeed,
  getMastiBaseComments,
  getMastiBaseBookmarks,
  getMastiBaseAdsConfig,
  type MastiBaseAdsConfig,
  getMastiBaseMonetization,
  getMastiBaseNotifications,
  likeMastiBaseVideo,
  bookmarkMastiBaseVideo,
  shareMastiBaseVideo,
  normalizeMastiBaseActionResponse,
  followMastiBaseCreator,
  markMastiBaseNotificationRead,
  normalizeMastiAvatarUrl,
  normalizeMastiMediaUrl,
  requestMastiBasePayout,
  createMastiBaseNotification,
  getMastiBaseProfile,
  lookupMastiBaseUser,
  searchMastiBase,
  syncMastiBaseUser,
} from '../lib/mastiBase';
import {
  getMastiBashQualityStreamUrl,
  getMastiVideoQualityStorageKey,
  isMastiVideoQuality,
  MASTI_VIDEO_QUALITY_OPTIONS,
  MASTI_VIDEO_DEFAULT_QUALITY,
  resolveMastiVideoQuality,
  type MastiVideoQuality,
} from '../lib/videoDelivery';
import { FeedBannerAd, useFeedInterstitial } from '../components/FeedAds';
import {
  getFriendActivity,
  markFriendActivityRead,
  chatConversationId,
  getDirectChatConversations,
  getDirectChatMessages,
  sendDirectChatMessage,
  type PeerActivity,
  type RemoteChatMessage,
} from '../lib/chatApi';
import { createCall, getIncomingCalls, updateCall } from '../lib/callApi';
import WebRTCCallView from '../components/WebRTCCallView';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadOrCreateUserProfile } from '../lib/auth';
import { KeyboardAvoidingView as ControllerKeyboardAvoidingView } from 'react-native-keyboard-controller';

const mastiBaseCount = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : undefined;
};

const useGetChatConversationMessages = (conversationId, options) => {
  return useQuery({
    queryKey: options?.query?.queryKey || ['getChatConversationMessages', conversationId],
    queryFn: async () => ({
      messages: await getDirectChatMessages(
        options?.ownerIds || [],
        conversationId,
        options?.myMessagingId || '',
        options?.chatUser1 || '',
        options?.chatUser2 || '',
      ),
    }),
    enabled: Boolean(options?.query?.enabled && conversationId),
    refetchInterval: options?.query?.refetchInterval,
    refetchOnReconnect: true,
  });
};

const useListChatConversations = (options) => {
  return useQuery({
    queryKey: options?.query?.queryKey || ['listChatConversations'],
    queryFn: async () => ({
      conversations: await getDirectChatConversations(
        options?.ownerIds || [],
        options?.myMessagingId || '',
      ),
    }),
    enabled: Boolean(options?.query?.enabled),
    refetchInterval: options?.query?.refetchInterval,
    refetchOnReconnect: true,
  });
};

const useSendChatConversationMessage = () => {
  return useMutation({
    mutationFn: sendDirectChatMessage,
  });
};

// ── Reanimated v3 + Gesture Handler (Music Trim Screen) ──────────
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  withTiming,
  withRepeat,
  cancelAnimation,
  runOnJS,
  Easing as REasing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, NativeViewGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { height, width } = Dimensions.get('window');
const HEADER_WIDTH = 220;
const TAB_WIDTH = HEADER_WIDTH / 2;
const LINE_WIDTH = 30;
const LINE_CENTER_OFFSET = (TAB_WIDTH - LINE_WIDTH) / 2;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const ReanimatedScrollView = Reanimated.createAnimatedComponent(ScrollView);

const VerifiedBadge = ({ size = 18 }: { size?: number }) => (
  <Ionicons
    name="checkmark-circle"
    size={size}
    color="#2EA7FF"
    style={{ marginLeft: 5 }}
  />
);

// Account data is persisted with the account ID, never in one shared
// device-wide snapshot. This keeps multiple Gmail accounts isolated.
const PROFILE_STORAGE_PREFIX = '@masti_profile_';
const PROFILE_CORE_STORAGE_PREFIX = '@masti_profile_core_';
const PUBLIC_PROFILE_AVATAR_CACHE_KEY = '@masti_public_profile_avatars_v1';
const WITHDRAWAL_REQUEST_STORAGE_PREFIX = '@masti_withdrawal_request_';
const INBOX_NOTIFICATIONS_STORAGE_PREFIX = '@masti_inbox_notifications_';
// ✅ Cache key for Cloudinary/backend videos — persists feed across app restarts
const MASTI_MEDIA_CACHE_KEY = '@masti_media_videos_v3';
const MASTI_AUDIO_CACHE_KEY = '@masti_bash_audio_v1';
const VIDEO_THUMBNAIL_OVERRIDES_PREFIX = '@masti_video_thumbnail_overrides_';
const VIDEO_COVER_POSITIONS_PREFIX = '@masti_video_cover_positions_';
const PROFILE_CORE_TEXT_FIELDS = [
  'name',
  'username',
  'userId',
  'mastiBaseUserId',
  'bio',
  'youtube',
  'instagram',
  'facebook',
  'website',
  'whatsapp',
];
const PROFILE_CORE_BOOLEAN_FIELDS = ['isVerified', 'profileImageSyncPending'];

const profileCoreStorageKey = (accountId: string) =>
  `${PROFILE_CORE_STORAGE_PREFIX}${accountId}`;

const publicProfileAvatarIdentity = (value: unknown) =>
  String(value ?? '').trim().replace(/^@+/, '').toLowerCase();

const readPublicProfileAvatarCache = async (): Promise<Record<string, string>> => {
  try {
    const raw = await AsyncStorage.getItem(PUBLIC_PROFILE_AVATAR_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([identity, value]) => [
          publicProfileAvatarIdentity(identity),
          normalizeMastiAvatarUrl(value),
        ])
        .filter(([identity, avatar]) =>
          Boolean(identity && avatar && /^https?:\/\//i.test(String(avatar))),
        ),
    );
  } catch {
    return {};
  }
};

const rememberPublicProfileAvatar = async (
  avatarValue: unknown,
  identities: unknown[],
): Promise<Record<string, string> | null> => {
  const avatar = normalizeMastiAvatarUrl(avatarValue);
  if (!avatar || !/^https?:\/\//i.test(avatar)) return null;

  const identityKeys = Array.from(
    new Set(identities.map(publicProfileAvatarIdentity).filter(Boolean)),
  );
  if (identityKeys.length === 0) return null;

  const current = await readPublicProfileAvatarCache();
  const next = { ...current };
  identityKeys.forEach((identity) => {
    next[identity] = avatar;
  });

  const bounded = Object.fromEntries(Object.entries(next).slice(-600));
  try {
    await AsyncStorage.setItem(
      PUBLIC_PROFILE_AVATAR_CACHE_KEY,
      JSON.stringify(bounded),
    );
    return bounded;
  } catch (error) {
    console.warn('[Profile] Public avatar cache could not be saved:', error);
    return null;
  }
};

const findCachedPublicProfileAvatar = (
  cache: Record<string, string>,
  ...identities: unknown[]
) => {
  for (const identity of identities) {
    const key = publicProfileAvatarIdentity(identity);
    const avatar = key ? normalizeMastiAvatarUrl(cache[key]) : '';
    if (avatar && /^https?:\/\//i.test(avatar)) return avatar;
  }
  return '';
};

const buildProfileCoreRecord = (accountId: string, values: Record<string, any>) => {
  const record: Record<string, any> = { accountId };
  for (const field of PROFILE_CORE_TEXT_FIELDS) {
    if (typeof values[field] === 'string') record[field] = values[field];
  }
  for (const field of PROFILE_CORE_BOOLEAN_FIELDS) {
    if (typeof values[field] === 'boolean') record[field] = values[field];
  }
  if (
    typeof values.profileImage === 'string' &&
    values.profileImage.length <= 8192 &&
    !/^data:image\//i.test(values.profileImage)
  ) {
    record.profileImage = values.profileImage;
  }
  return record;
};

const readProfileCoreRecord = async (accountId: string) => {
  try {
    const raw = await AsyncStorage.getItem(profileCoreStorageKey(accountId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      (parsed.accountId && parsed.accountId !== accountId)
    ) {
      return {};
    }
    return parsed;
  } catch (error) {
    console.warn('[Profile] Could not read compact profile backup:', error);
    return {};
  }
};

const mergeProfileCoreRecord = (
  snapshot: Record<string, any>,
  core: Record<string, any>,
) => {
  const merged = { ...snapshot };
  for (const field of [...PROFILE_CORE_TEXT_FIELDS, ...PROFILE_CORE_BOOLEAN_FIELDS, 'profileImage']) {
    if (Object.prototype.hasOwnProperty.call(core, field)) merged[field] = core[field];
  }
  return merged;
};

const saveProfileCoreRecord = async (
  accountId: string,
  values: Record<string, any>,
) => {
  const existing = await readProfileCoreRecord(accountId);
  const merged = { ...existing };
  for (const [field, value] of Object.entries(values)) {
    if (value !== undefined) merged[field] = value;
  }
  if (
    typeof values.profileImage === 'string' &&
    /^data:image\//i.test(values.profileImage) &&
    typeof existing.profileImage === 'string'
  ) {
    merged.profileImage = existing.profileImage;
  }
  const compact = buildProfileCoreRecord(accountId, merged);
  await AsyncStorage.setItem(profileCoreStorageKey(accountId), JSON.stringify(compact));
};

const formatWithdrawalWait = (processAfter: string, now: number) => {
  const remainingMs = Math.max(0, new Date(processAfter).getTime() - now);
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1_000);
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

const persistProfileImageLocally = async (sourceUri: string, accountId: string) => {
  if (Platform.OS === 'web') {
    if (sourceUri.startsWith('data:image/')) return sourceUri;
    const response = await fetch(sourceUri);
    if (!response.ok) throw new Error('Selected photo could not be read.');
    const blob = await response.blob();
    if (!blob.size) throw new Error('Selected photo is empty.');
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Selected photo could not be saved on this device.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(blob);
    });
  }

  const dataUri = sourceUri.match(/^data:(image\/[^;,]+);base64,(.+)$/i);
  const extensionFromMime = dataUri?.[1].split('/')[1]?.replace(/[^a-z0-9]/gi, '');
  const extensionFromUri = sourceUri.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1];
  const extension = (extensionFromMime || extensionFromUri || 'jpg').toLowerCase();
  const safeAccountId = accountId.replace(/[^a-zA-Z0-9_-]/g, '');
  const savedFile = new FileSystem.File(
    FileSystem.Paths.document,
    `masti-profile-${safeAccountId}.${extension}`,
  );

  if (dataUri?.[2]) {
    if (savedFile.exists) savedFile.delete();
    savedFile.create({ intermediates: true });
    savedFile.write(dataUri[2], { encoding: FileSystem.EncodingType.Base64 });
  } else {
    await new FileSystem.File(sourceUri).copy(savedFile, { overwrite: true });
  }
  return savedFile.uri;
};

const persistProfileImageDraft = async (
  accountId: string,
  imageUri: string,
  previousImage: string,
) => {
  await saveProfileCoreRecord(accountId, { profileImage: imageUri });
  const storageKey = `${PROFILE_STORAGE_PREFIX}${accountId}`;
  let snapshot: Record<string, any> = {};
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(storageKey);
  } catch (error) {
    console.warn('[Profile] Could not read the full profile snapshot for photo draft:', error);
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        snapshot = parsed;
      }
    } catch {}
  }
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify({
      ...snapshot,
      accountId,
      profileImage: imageUri,
      profileImageUploadUri: imageUri,
      profileImageBeforeUpload: previousImage,
    }));
  } catch (error) {
    console.warn('[Profile] Could not save the full profile photo draft:', error);
  }
};

const getUnreadNotificationCounts = (
  notifications: any[],
  currentAccountIds: Array<string | null | undefined> = [],
) => {
  const currentIds = currentAccountIds
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase());
  const counts = { total: 0, likes: 0, friends: 0, comments: 0 };

  notifications.forEach(notification => {
    if (notification?.read) return;
    const type = String(notification?.type ?? notification?.notificationType ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const senderIds = [notification?.fromUserId, notification?.fromUserName]
      .filter(Boolean)
      .map(value => String(value).trim().toLowerCase());
    const ownSupportChatCopy =
      type === 'support_chat_message' &&
      senderIds.some(senderId => currentIds.includes(senderId));
    if (ownSupportChatCopy) return;

    counts.total += 1;
    if (type.includes('like')) counts.likes += 1;
    else if (type.includes('comment')) counts.comments += 1;
    else if (
      type.includes('friend') ||
      type.includes('follow') ||
      type.includes('follower')
    ) {
      counts.friends += 1;
    }
  });

  return counts;
};

const mergeInboxNotifications = (incoming: any[], existing: any[]) => {
  const merged = new Map<string, any>();
  existing.forEach(notification => {
    if (notification?.id !== undefined && notification?.id !== null) {
      merged.set(String(notification.id), notification);
    }
  });
  incoming.forEach(notification => {
    if (notification?.id === undefined || notification?.id === null) return;
    const id = String(notification.id);
    const previous = merged.get(id);
    merged.set(id, {
      ...previous,
      ...notification,
      // Preserve a local read action if the remote service is temporarily stale.
      read: Boolean(previous?.read || notification?.read),
    });
  });
  return Array.from(merged.values()).sort((a, b) => {
    const aTime = Date.parse(String(a.createdAt ?? '')) || 0;
    const bTime = Date.parse(String(b.createdAt ?? '')) || 0;
    return bTime - aTime;
  });
};

const canonicalVideoKey = (video: any) => {
  const url = normalizeMastiMediaUrl(
    video?.url ||
    video?.videoUrl ||
    video?.fileUrl ||
    video?.mediaUrl ||
    '',
  );
  if (url) return `url:${url}`;
  const id = String(video?.id ?? '').trim().replace(/^db-/, '');
  return id ? `id:${id}` : null;
};

const dedupeVideoItems = (items: any[]) => {
  const seen = new Set<string>();
  return items.filter((video) => {
    const key = canonicalVideoKey(video);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const SHARE_OPTIONS = [
  { id: '1', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { id: '2', name: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  { id: '3', name: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { id: '4', name: 'Copy Link', icon: 'link', color: '#fff' },
];

const FILTERS_LIST = ['Normal', 'Vintage', 'B&W', 'Warm', 'Cool', 'Vibrant'];

const SONGS_LIST: any[] = [];

const TEXT_COLORS   = ['#FFFFFF','#000000','#FE2C55','#FFD700','#00C6FF','#A78BFA','#34D399','#FB923C'];
const VOICE_EFFECTS = ['None','Chipmunk','Deep','Echo','Robot','Reverb'];
const STICKER_EMOJIS = ['🔥','❤️','😂','👑','💯','✨','🎉','🥳','😍','🤩','💪','🙌','🎵','🌟','👏','💕','😎','🤣','🥰','💥','🎯','🏆','🦋','🌈','💫','🍀','⚡','🎸','🌸','😜','💃','🕺','👻','🤯','🔮','🎪'];
const EFFECTS_LIST = ['None', 'Sparkle', 'Blur', 'Glow', 'Zoom', 'Shake'];

const cleanDisplayName = (value: any, fallback = 'New User') => {
  const cleaned = String(value ?? '').trim().replace(/^@+/, '');
  return cleaned || fallback;
};

const formatProfileHandle = (value: any, fallback = '@newuser') => {
  const cleaned = String(value ?? '').trim().replace(/^@+/, '');
  return cleaned ? `@${cleaned}` : fallback;
};

const isPlaceholderProfileHandle = (value: any) => {
  const handle = formatProfileHandle(value, '').toLowerCase();
  return handle === '@user' || handle === '@newuser';
};

const defaultProfileHandle = (accountId?: string | null) =>
  accountId ? `@user_${accountId.slice(0, 8)}` : '@newuser';

const chooseProfileHandle = (...values: any[]) => {
  const candidates = values
    .map((value) => formatProfileHandle(value, ''))
    .filter(Boolean);
  const nonPlaceholder = candidates.filter((value) => value.toLowerCase() !== '@user');
  return (nonPlaceholder.length > 0 ? nonPlaceholder : candidates)[0] || '@newuser';
};

const profileHandleForDisplay = (value: any) => {
  const handle = formatProfileHandle(value, '');
  return handle && !isPlaceholderProfileHandle(handle) ? handle : '@newuser';
};

const LoadingIndicator = ({ visible = true, style }: { visible?: boolean; style?: any }) => {
  const leftDot = useRef(new Animated.Value(0)).current;
  const rightDot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      leftDot.stopAnimation();
      rightDot.stopAnimation();
      leftDot.setValue(0);
      rightDot.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(leftDot, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(leftDot, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(leftDot, { toValue: -1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(leftDot, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rightDot, { toValue: -1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(rightDot, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(rightDot, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(rightDot, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [leftDot, rightDot, visible]);

  if (!visible) return null;

  return (
    <View style={[styles.loadingIndicator, style]} pointerEvents="none">
      <Animated.View
        style={[
          styles.loadingDot,
          styles.loadingDotPink,
          {
            transform: [
              { translateX: leftDot.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) },
              { scale: leftDot.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 1.15, 1] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.loadingDot,
          styles.loadingDotCyan,
          {
            transform: [
              { translateX: rightDot.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) },
              { scale: rightDot.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 1.15, 1] }) },
            ],
          },
        ]}
      />
    </View>
  );
};

const FeedLoadingPlaceholder = () => {
  const pulse = useRef(new Animated.Value(0.32)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.88,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.32,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.feedBlankLoading}>
      <Animated.View style={[styles.feedLoadingPulseLayer, { opacity: pulse }]}>
        <View style={[styles.rightActions, { bottom: 100 + insets.bottom, right: 10 }]}>
          <View style={[styles.profileCircle, styles.feedLoadingProfileCircle]}>
            <View style={styles.feedLoadingAvatar} />
          </View>
          <View style={styles.actionItem}>
            <Ionicons name="heart" size={35} color="#777" />
            <Text style={styles.feedLoadingActionText}>0</Text>
          </View>
          <View style={styles.actionItem}>
            <Ionicons name="chatbubble-ellipses" size={30} color="#777" />
            <Text style={styles.feedLoadingActionText}>0</Text>
          </View>
          <View style={styles.actionItem}>
            <Ionicons name="bookmark" size={30} color="#777" />
            <Text style={styles.feedLoadingActionText}>0</Text>
          </View>
          <View style={styles.actionItem}>
            <Ionicons name="paper-plane" size={30} color="#777" />
            <Text style={styles.feedLoadingActionText}>0</Text>
          </View>
          <View style={styles.musicDiscContainer}>
            <View style={styles.feedLoadingMusicDisc}>
              <Ionicons name="musical-notes" size={16} color="#777" />
              <View style={styles.feedLoadingMusicHole} pointerEvents="none" />
            </View>
          </View>
        </View>

        <View style={[styles.feedLoadingCaption, { bottom: 100 + insets.bottom }]}>
          <View style={[styles.feedLoadingLine, styles.feedLoadingLineShort]} />
          <View style={[styles.feedLoadingLine, styles.feedLoadingLineLong]} />
          <View style={styles.feedLoadingMetaRow}>
            <View style={styles.feedLoadingSmallDot} />
            <View style={[styles.feedLoadingLine, styles.feedLoadingLineMedium]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const FEED_LOADING_MIN_MS = 5000;

const normalizedIdentity = (value: any) =>
  String(value ?? '').trim().replace(/^@+/, '').toLowerCase();

const getVideoOwnerIdentities = (creator: any): string[] => {
  if (typeof creator === 'string' || typeof creator === 'number') {
    const identity = normalizedIdentity(creator);
    return identity ? [identity] : [];
  }

  const profile = creator?.profile ?? {};
  return [
    creator?.user,
    creator?.userId,
    creator?.username,
    creator?.userName,
    creator?.backendUserId,
    creator?.mastiBaseUserId,
    creator?.accountId,
    creator?.email,
    creator?.userEmail,
    creator?.authUid,
    creator?.uid,
    profile.userId,
    profile.username,
    profile.userName,
    profile.id,
    profile.mastiBaseUserId,
    profile.email,
    profile.authUid,
    profile.uid,
  ]
    .map(normalizedIdentity)
    .filter(Boolean);
};

const isRenderableThumbnail = (uri: any) => {
  if (typeof uri !== 'string' || !uri.trim()) return false;
  const path = uri.trim().split('?')[0].toLowerCase();
  return !/\.(mp4|mov|m4v|webm|avi|mkv)(?:$|\/)/.test(path);
};

const normalizedMediaIdentity = (value: any) =>
  String(value ?? '').trim().replace(/^db-/, '').toLowerCase();

const getVideoPlaybackSource = (uri: any) => {
  const value = typeof uri === 'string' ? uri.trim() : '';
  if (!value) return null;
  const path = value.split(/[?#]/)[0];
  return /\.(mp4|mov|m4v|webm|avi|mkv|m3u8)(?:$|\/)/i.test(path)
    ? { uri: value }
    : { uri: value, overrideFileExtension: 'mp4' as const };
};

const ProfileVideoThumbnail = ({ item, coverPosition = 0 }: { item: any; coverPosition?: number }) => {
  const thumbnailUri = isRenderableThumbnail(item?.thumbnail) ? item.thumbnail : '';
  const videoRef = React.useRef<any>(null);
  const coverPositionMs = Math.max(0, Number(coverPosition) || 0) * 1000;
  const seekToCover = React.useCallback(() => {
    const ref = videoRef.current;
    if (!ref) return;
    try {
      const seek = ref.setPositionAsync?.(coverPositionMs);
      if (seek && typeof seek.then === 'function') {
        seek.then(() => ref.pauseAsync?.()).catch(() => {});
      } else {
        ref.pauseAsync?.();
      }
    } catch (_) {}
  }, [coverPositionMs]);

  if (thumbnailUri) {
    return <Image source={{ uri: thumbnailUri }} style={{ flex: 1, backgroundColor: '#111' }} resizeMode="cover" />;
  }
  if (item?.url) {
    return (
      <Video
        ref={videoRef}
        source={getVideoPlaybackSource(item.url) || undefined}
        style={{ flex: 1, backgroundColor: '#111' }}
        resizeMode="cover"
        shouldPlay={false}
        isLooping={false}
        isMuted
        onLoad={seekToCover}
        onReadyForDisplay={seekToCover}
        useNativeControls={false}
      />
    );
  }
  return <View style={{ flex: 1, backgroundColor: '#111' }} />;
};

// expo-av can reject when a video is unmounted while a playback command is
// still in flight (notably when navigating from feed to a profile). These
// commands are best-effort and must not surface as unhandled native errors.
const safeMediaCall = (ref: any, method: string, ...args: any[]) => {
  try {
    const result = ref?.[method]?.(...args);
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch (_) {}
};

type ChatListItem = {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string;
  isOnline?: boolean;
  lastMsg?: string;
  time?: string;
  authUid?: string;
  uid?: string;
  accountId?: string;
  conversationId?: string;
  backendUserId?: string;
  mastiBaseUserId?: string;
  messagingId?: string;
  email?: string;
  firebaseUid?: string;
  userId?: string;
  user?: string;
};
type ChatMessage = {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  clientId?: string;
};
const chatIdentity = (user: any) => {
  const email = [
    user?.email,
    user?.userEmail,
      user?.peerAuthId,
    user?.profile?.email,
    user?.accountId,
    user?.profile?.accountId,
  ]
    .map(value => String(value ?? '').trim())
    .find(value => value.includes('@'));
  if (email) return email.toLowerCase();

  const firebaseUid = [
    user?.authUid,
    user?.uid,
    user?.firebaseUid,
    user?.firebaseUserId,
    user?.accountId,
    user?.profile?.authUid,
    user?.profile?.uid,
    user?.profile?.firebaseUid,
    user?.profile?.firebaseUserId,
    user?.profile?.accountId,
  ]
    .map(value => String(value ?? '').trim())
    .find(Boolean);
  return firebaseUid || '';
};

const messagingIdentity = (user: any) => {
  const stableAccountId = [
    user?.messagingId,
    user?.mastiBaseUserId,
    user?.backendUserId,
    user?.profile?.mastiBaseUserId,
    user?.profile?.backendUserId,
    user?.profile?.id,
  ]
    .map(value => String(value ?? '').trim())
    .find(Boolean);
  return stableAccountId || chatIdentity(user);
};

const chatParticipantFromProfile = (user: any): ChatListItem => {
  const profile = user?.profile ?? {};
  const email = [
    user?.email,
    user?.userEmail,
    profile?.email,
    user?.accountId,
    profile?.accountId,
  ]
    .map(value => String(value ?? '').trim())
    .find(value => value.includes('@'));
  const firebaseUid =
    user?.authUid ||
    user?.uid ||
    user?.firebaseUid ||
    user?.firebaseUserId ||
    profile?.authUid ||
    profile?.uid ||
    profile?.firebaseUid ||
    profile?.firebaseUserId;
  const mastiBaseUserId =
    user?.mastiBaseUserId ||
    user?.backendUserId ||
    profile?.mastiBaseUserId ||
    profile?.id;
  const identity = messagingIdentity({ email, authUid: firebaseUid, mastiBaseUserId });
  const displayName =
    user?.name ||
    profile?.name ||
    user?.displayName ||
    user?.userName ||
    user?.userId ||
    user?.user ||
    'Masti User';
  return {
    id: identity || String(user?.id || user?.userId || user?.user || 'unknown'),
    name: String(displayName),
    emoji: '💬',
    avatar:
      user?.avatar ||
      user?.profileImage ||
      profile?.avatarUrl ||
      profile?.profileImage ||
      '',
    isOnline: user?.isOnline === true,
    lastMsg: '',
    time: '',
    authUid: firebaseUid ? String(firebaseUid) : undefined,
    uid: user?.uid || profile?.uid,
    firebaseUid: user?.firebaseUid || profile?.firebaseUid,
    accountId: user?.accountId || profile?.accountId,
    backendUserId:
      user?.backendUserId || user?.mastiBaseUserId || profile?.mastiBaseUserId || profile?.id,
    mastiBaseUserId:
      user?.mastiBaseUserId || user?.backendUserId || profile?.mastiBaseUserId || profile?.id,
    email,
    userId: user?.userId || profile?.userId || profile?.username || user?.user,
    user: user?.user || user?.userId || profile?.userId || profile?.username,
  };
};

const chatTime = (createdAt: string | undefined) => {
  const date = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const chatDisplayId = (value?: unknown) => {
  const id = String(value ?? '').trim();
  if (!id) return '';
  return id.startsWith('@') ? id : `@${id.replace(/^@+/, '')}`;
};

const formatVideoUploadDate = (value: unknown) => {
  if (value == null || value === '') return 'Upload date unavailable';

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value);
  } else if (typeof value === 'object') {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    try {
      if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else {
        const seconds = Number(timestamp.seconds ?? timestamp._seconds);
        date = new Date(Number.isFinite(seconds) ? seconds * 1000 : Number.NaN);
      }
    } catch {
      return 'Upload date unavailable';
    }
  } else {
    const text = String(value).trim();
    const numericValue = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    date = Number.isFinite(numericValue)
      ? new Date(Math.abs(numericValue) < 1_000_000_000_000 ? numericValue * 1000 : numericValue)
      : new Date(text);
  }

  if (Number.isNaN(date.getTime())) return 'Upload date unavailable';
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getMastiVideoAppLink = (videoId: string | number) =>
  `masti-video:///?video=${encodeURIComponent(String(videoId))}`;

const getSharedMastiVideoId = (message: unknown): string | null => {
  const value = typeof message === 'string' ? message : '';
  const match =
    value.match(/masti-video:\/\/\/?\?video=([^&\s]+)/i) ||
    value.match(/masti\.app\/video\/([^/?&\s]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const mapRemoteChatMessage = (message: RemoteChatMessage, myId: string): ChatMessage => ({
  id: message.id,
  clientId: message.clientId,
  text: message.text,
  sent: message.isMine ?? message.senderId === myId,
  time: chatTime(message.createdAt),
  senderId: message.senderId,
  senderName: message.senderName,
  senderAvatar: message.senderAvatar,
});

const BottomNav = ({ activeScreen, handleHomePress, setShowFriends, setShowInbox, setIsProfile, setSelectedUser, openCameraWithPermissions, requireAuth, notifUnreadCount = 0, notifUnreadCounts = { likes: 0, friends: 0, comments: 0 }, socialUnreadPillVisible = true, profileImage = '' }) => {
  const insets = useSafeAreaInsets();
  const socialUnreadSegments = [
    { label: 'Like', icon: 'heart' as const, count: notifUnreadCounts.likes },
    { label: 'Follow', icon: 'person' as const, count: notifUnreadCounts.friends },
    { label: 'Comment', icon: 'chatbubble' as const, count: notifUnreadCounts.comments },
  ].filter(segment => segment.count > 0);
  const socialUnreadTotal = socialUnreadSegments.reduce((total, segment) => total + segment.count, 0);
  const socialUnreadPillWidth = Math.min(
    160,
    Math.max(82, socialUnreadSegments.length * 38 + (socialUnreadSegments.length - 1) * 8 + 20),
  );
  const summaryPulse = useRef(new Animated.Value(1)).current;
  const previousSocialUnreadTotal = useRef(0);
  const [socialUnreadPillMounted, setSocialUnreadPillMounted] = useState(false);
  const socialUnreadPillMountedRef = useRef(false);
  const socialUnreadPillOpacity = useRef(new Animated.Value(0)).current;
  const socialUnreadPillScale = useRef(new Animated.Value(0.76)).current;
  const socialUnreadPillOffset = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (socialUnreadTotal > previousSocialUnreadTotal.current) {
      summaryPulse.setValue(0.82);
      Animated.spring(summaryPulse, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }).start();
    }
    previousSocialUnreadTotal.current = socialUnreadTotal;
  }, [socialUnreadTotal, summaryPulse]);

  useEffect(() => {
    let entryFrame: number | null = null;

    if (socialUnreadPillVisible && socialUnreadSegments.length > 0) {
      socialUnreadPillMountedRef.current = true;
      setSocialUnreadPillMounted(true);
      socialUnreadPillOpacity.stopAnimation();
      socialUnreadPillScale.stopAnimation();
      socialUnreadPillOffset.stopAnimation();
      socialUnreadPillOpacity.setValue(0);
      socialUnreadPillScale.setValue(0.76);
      socialUnreadPillOffset.setValue(10);
      entryFrame = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(socialUnreadPillOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(socialUnreadPillScale, {
            toValue: 1,
            friction: 5,
            tension: 190,
            useNativeDriver: true,
          }),
          Animated.spring(socialUnreadPillOffset, {
            toValue: 0,
            friction: 7,
            tension: 170,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (socialUnreadPillMountedRef.current) {
      Animated.parallel([
        Animated.timing(socialUnreadPillOpacity, {
          toValue: 0,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.timing(socialUnreadPillScale, {
          toValue: 0.82,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.timing(socialUnreadPillOffset, {
          toValue: 8,
          duration: 170,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          socialUnreadPillMountedRef.current = false;
          setSocialUnreadPillMounted(false);
        }
      });
    }

    return () => {
      if (entryFrame !== null) cancelAnimationFrame(entryFrame);
      socialUnreadPillOpacity.stopAnimation();
      socialUnreadPillScale.stopAnimation();
      socialUnreadPillOffset.stopAnimation();
    };
  }, [
    socialUnreadPillVisible,
    socialUnreadSegments.length,
    socialUnreadPillOpacity,
    socialUnreadPillScale,
    socialUnreadPillOffset,
  ]);

  return (
  <View style={[styles.bottomNav, { height: 90 + insets.bottom, paddingBottom: 10 + insets.bottom }]}>
    <TouchableOpacity style={styles.navItem} onPress={handleHomePress}>
      <Ionicons name="home" size={28} color={activeScreen === 'home'? 'white' : '#666'} />
      <Text style={[styles.navLabel, { color: activeScreen === 'home'? 'white' : '#666' }]}>Home</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.navItem} onPress={() => { setShowFriends(true); setIsProfile(false); setShowInbox(false); }}>
      <Ionicons name="people" size={28} color={activeScreen === 'friends'? 'white' : '#666'} />
      <Text style={[styles.navLabel, { color: activeScreen === 'friends'? 'white' : '#666' }]}>Friends</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.addButtonContainer} onPress={openCameraWithPermissions}>
      <View style={styles.addButtonWrapper}>
        <View style={[styles.addButton, { backgroundColor: '#25F4EE', position: 'absolute', left: 0 }]} />
        <View style={[styles.addButton, { backgroundColor: '#FE2C55', position: 'absolute', right: 0 }]} />
        <View style={[styles.addButton, { backgroundColor: 'white', width: 56, justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="add" size={34} color="black" />
        </View>
      </View>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.navItem, { position: 'relative' }]} onPress={() => requireAuth(() => { setShowInbox(true); setIsProfile(false); setShowFriends(false); })}>
      {socialUnreadPillMounted && (
        <Animated.View
          pointerEvents="none"
          style={[{
            position: 'absolute',
            bottom: 58,
            left: '50%',
            marginLeft: -socialUnreadPillWidth / 2,
            width: socialUnreadPillWidth,
            minHeight: 36,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 22,
            backgroundColor: '#FE2C55',
            zIndex: 10,
            elevation: 8,
            shadowColor: '#FE2C55',
            shadowOpacity: 0.32,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            opacity: socialUnreadPillOpacity,
            transform: [
              { translateY: socialUnreadPillOffset },
              { scale: socialUnreadPillScale },
              { scale: summaryPulse },
            ],
          }]}
        >
          {socialUnreadSegments.map(segment => (
            <View
              key={segment.label}
              accessible
              accessibilityLabel={`${segment.label}: ${segment.count}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name={segment.icon} size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '800' }}>
                {segment.count > 99 ? '99+' : segment.count}
              </Text>
            </View>
          ))}
          <View style={{ position: 'absolute', bottom: -6, left: '50%', marginLeft: -6, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FE2C55' }} />
        </Animated.View>
      )}
      <View style={{ position: 'relative' }}>
        <Ionicons name="chatbubble-ellipses" size={28} color={activeScreen === 'inbox'? 'white' : '#666'} />
        {notifUnreadCount > 0 && socialUnreadSegments.length === 0 && (
          <View style={{ position: 'absolute', top: -4, right: -6, backgroundColor: '#FE2C55', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#000' }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{notifUnreadCount > 99 ? '99+' : notifUnreadCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.navLabel, { color: activeScreen === 'inbox'? 'white' : '#666' }]}>Inbox</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.navItem} onPress={() => requireAuth(() => { setSelectedUser(null); setIsProfile(true); setShowFriends(false); setShowInbox(false); })}>
      {/* Profile tab: sirf user ka khud select kiya hua DP dikhao */}
      {profileImage ? (
        <View style={{
          width: 30, height: 30, borderRadius: 15,
          borderWidth: activeScreen === 'profile' ? 2 : 1.5,
          borderColor: activeScreen === 'profile' ? 'white' : '#666',
          overflow: 'hidden',
        }}>
          <Image source={{ uri: profileImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
      ) : (
        <View style={{
          width: 30, height: 30, borderRadius: 15,
          borderWidth: activeScreen === 'profile' ? 2 : 1.5,
          borderColor: activeScreen === 'profile' ? 'white' : '#666',
          backgroundColor: '#000',
        }} />
      )}
      <Text style={[styles.navLabel, { color: activeScreen === 'profile'? 'white' : '#666' }]}>Profile</Text>
    </TouchableOpacity>
  </View>
  );
};

// ─── Draggable + Pinch-zoomable overlay (sticker / text) ────────────────────
const DraggableOverlay = ({
  id, x, y, size, onUpdate, onDelete, children,
}: {
  id: string; x: number; y: number; size: number;
  onUpdate: (id: string, u: { x?: number; y?: number; size?: number }) => void;
  onDelete: (id: string) => void;
  children: React.ReactNode;
}) => {
  const latestProps = React.useRef({ x, y, size });
  latestProps.current = { x, y, size };

  const basePos    = React.useRef({ x, y });
  const baseSize   = React.useRef(size);
  const pinchDist0 = React.useRef(0);
  const prevTouches = React.useRef(0);
  const tapStart   = React.useRef(0);
  const didMove    = React.useRef(false);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture:  () => false,

      onPanResponderGrant: (evt) => {
        basePos.current  = { x: latestProps.current.x, y: latestProps.current.y };
        baseSize.current = latestProps.current.size;
        prevTouches.current = evt.nativeEvent.touches.length;
        didMove.current  = false;
        tapStart.current = Date.now();

        if (evt.nativeEvent.touches.length === 2) {
          const t  = evt.nativeEvent.touches;
          const dx = t[1].pageX - t[0].pageX;
          const dy = t[1].pageY - t[0].pageY;
          pinchDist0.current = Math.sqrt(dx * dx + dy * dy) || 1;
        }
      },

      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // — init pinch when second finger first arrives —
          if (prevTouches.current !== 2) {
            const dx0 = touches[1].pageX - touches[0].pageX;
            const dy0 = touches[1].pageY - touches[0].pageY;
            pinchDist0.current = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
            baseSize.current   = latestProps.current.size;
          }
          prevTouches.current = 2;

          const dx   = touches[1].pageX - touches[0].pageX;
          const dy   = touches[1].pageY - touches[0].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const scale = dist / pinchDist0.current;
          const newSize = Math.max(16, Math.min(144, baseSize.current * scale));
          onUpdate(id, { size: newSize });
        } else {
          prevTouches.current = 1;
          didMove.current = true;
          onUpdate(id, {
            x: basePos.current.x + gs.dx,
            y: basePos.current.y + gs.dy,
          });
        }
      },

      onPanResponderRelease: (evt, gs) => {
        basePos.current = {
          x: basePos.current.x + gs.dx,
          y: basePos.current.y + gs.dy,
        };
        prevTouches.current = 0;
      },

      onPanResponderTerminate: () => { prevTouches.current = 0; },
    })
  ).current;

  return (
    <View
      style={{ position: 'absolute', top: y, left: x, zIndex: 50 }}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
//  Music Trimmer Screen  (Instagram Reels style)
// ─────────────────────────────────────────────────────────────
const MusicTrimmerScreen: React.FC<{
  visible: boolean;
  song: any;
  onDone: (song: any, startSec: number, endSec: number) => void;
  onBack: () => void;
}> = ({ visible, song, onDone, onBack }) => {
  const { width: SW } = Dimensions.get('window');

  // ── Layout constants ──────────────────────────────────────
  const WAVEFORM_H     = 90;
  const BAR_W          = 3;
  const BAR_GAP        = 2;
  const BAR_STEP       = BAR_W + BAR_GAP;
  const HANDLE_W       = 20;
  const PIXELS_PER_SEC = 5;
  const MIN_SEL_PX     = PIXELS_PER_SEC * 3;   // min 3-sec selection
  const SIDE_PAD       = SW / 2;               // padding so song edges can reach center

  // ── Song duration ─────────────────────────────────────────
  const totalSec = useMemo(() => {
    if (!song?.duration || song.duration === '—') return 30;
    const p = song.duration.split(':');
    return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : 30;
  }, [song?.duration]);

  const WAVEFORM_CONTENT_W = Math.max(SW, totalSec * PIXELS_PER_SEC);
  const SCROLL_CONTENT_W   = SIDE_PAD + WAVEFORM_CONTENT_W + SIDE_PAD;
  const NUM_BARS           = Math.floor(WAVEFORM_CONTENT_W / BAR_STEP);
  const initSelW           = Math.min(SW, 30 * PIXELS_PER_SEC);

  // ── Pseudo-random waveform bars ───────────────────────────
  const bars = useMemo(() => {
    const base = song?.id ?? 'x';
    let seed = base.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    return Array.from({ length: NUM_BARS }, (_: any, i: number) => {
      const wave = Math.abs(Math.sin(i * 0.18)) * 0.5 + 0.1;
      return Math.max(0.06, Math.min(1, wave + rand() * 0.4));
    });
  }, [song?.id, NUM_BARS]);

  // ── Initial centered positions ────────────────────────────
  // Trim box centered around playhead (SW/2); scroll offset so bar[0] = t=0 at trimLeft
  const initTrimLeft  = SW / 2 - initSelW / 2;
  const initTrimRight = SW / 2 + initSelW / 2;
  const initScrollX   = initSelW / 2;

  // ── Reanimated shared values ──────────────────────────────
  const scrollSV    = useSharedValue(initScrollX);
  const trimLeftSV  = useSharedValue(initTrimLeft);
  const trimRightSV = useSharedValue(initTrimRight);

  // ── JS-thread mirrors (for PanResponder + Done handler) ───
  const scrollXJS   = useRef(initScrollX);
  const trimLeftJS  = useRef(initTrimLeft);
  const trimRightJS = useRef(initTrimRight);

  // ── Duration label ────────────────────────────────────────
  const [durationLabel, setDurationLabel] = useState(() => {
    const s = Math.round(initSelW / PIXELS_PER_SEC);
    return `0:${s.toString().padStart(2, '0')}`;
  });

  // ── ScrollView ref ────────────────────────────────────────
  const scrollRef = useRef<any>(null);

  // ── Reset when screen opens ───────────────────────────────
  useEffect(() => {
    if (!visible || !song) return;
    const iW  = Math.min(SW, 30 * PIXELS_PER_SEC);
    const iTL = SW / 2 - iW / 2;
    const iTR = SW / 2 + iW / 2;
    const iSX = iW / 2;
    trimLeftSV.value    = iTL;
    trimRightSV.value   = iTR;
    scrollSV.value      = iSX;
    trimLeftJS.current  = iTL;
    trimRightJS.current = iTR;
    scrollXJS.current   = iSX;
    const s = Math.round(iW / PIXELS_PER_SEC);
    setDurationLabel(`0:${s.toString().padStart(2, '0')}`);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ x: iSX, animated: false }), 80);
    return () => clearTimeout(t);
  }, [visible, song?.id]);

  // ── Audio playback ────────────────────────────────────────
  const trimSoundRef = useRef<LegacyAudioSound | null>(null);

  useEffect(() => {
    let mounted = true;

    const stopAndUnload = async () => {
      if (trimSoundRef.current) {
        try { await trimSoundRef.current.stopAsync(); } catch (_) {}
        try { await trimSoundRef.current.unloadAsync(); } catch (_) {}
        trimSoundRef.current = null;
      }
    };

    const playAudio = async () => {
      await stopAndUnload();
      if (!visible || !song?.audioUrl) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync(
          { uri: song.audioUrl },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        if (mounted) { trimSoundRef.current = sound; }
        else { try { await sound.unloadAsync(); } catch (_) {} }
      } catch (_) {}
    };

    playAudio();
    return () => { mounted = false; stopAndUnload(); };
  }, [visible, song?.id]);

  // ── Animated styles ───────────────────────────────────────

  // White clip-container: positioned exactly over the trim selection
  const overlayContainerStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: trimLeftSV.value,
    width: trimRightSV.value - trimLeftSV.value,
    height: WAVEFORM_H,
    overflow: 'hidden' as const,
  }));

  // Inner SVG translation: aligns white bars with scrolled gray bars
  // translateX = -(scrollX + trimLeft) so bar[i] at SIDE_PAD+i*BAR_STEP
  // maps to screen position SIDE_PAD+i*BAR_STEP - scrollX (same as gray layer)
  const overlayInnerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(scrollSV.value + trimLeftSV.value) }],
  }));

  // Trim frame: white border around the selection window
  const trimFrameStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: trimLeftSV.value,
    width: trimRightSV.value - trimLeftSV.value,
    height: WAVEFORM_H,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 4,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
  }));

  // ── Scrubber dot animated styles (UI-thread, no JS cost) ─
  const leftDotStyle = useAnimatedStyle(() => {
    const absPos = Math.max(0, scrollSV.value - SIDE_PAD + trimLeftSV.value);
    const x = (absPos / WAVEFORM_CONTENT_W) * SW;
    return { left: Math.max(0, Math.min(SW - 10, x - 5)) };
  });
  const rightDotStyle = useAnimatedStyle(() => {
    const absPos = Math.max(0, scrollSV.value - SIDE_PAD + trimRightSV.value);
    const x = (absPos / WAVEFORM_CONTENT_W) * SW;
    return { left: Math.max(0, Math.min(SW - 10, x - 5)) };
  });
  const centerDotStyle = useAnimatedStyle(() => {
    const absPos = Math.max(0, scrollSV.value - SIDE_PAD + (trimLeftSV.value + trimRightSV.value) / 2);
    const x = (absPos / WAVEFORM_CONTENT_W) * SW;
    return { left: Math.max(0, Math.min(SW - 10, x - 5)) };
  });
  const selBarStyle = useAnimatedStyle(() => {
    const l = Math.max(0, (Math.max(0, scrollSV.value - SIDE_PAD + trimLeftSV.value) / WAVEFORM_CONTENT_W) * SW);
    const r = Math.max(0, (Math.max(0, scrollSV.value - SIDE_PAD + trimRightSV.value) / WAVEFORM_CONTENT_W) * SW);
    return { left: l, width: Math.max(0, r - l) };
  });

  // ── Animated scroll handler ───────────────────────────────
  const seekTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateScrollJS = useCallback((x: number) => {
    scrollXJS.current = x;
    // Debounce: seek audio to trim-start position 150 ms after scroll settles
    if (seekTimeout.current) clearTimeout(seekTimeout.current);
    seekTimeout.current = setTimeout(() => {
      const absLeft = x - SIDE_PAD + trimLeftJS.current;
      const ms = Math.max(0, (absLeft / PIXELS_PER_SEC) * 1000);
      if (trimSoundRef.current) {
        trimSoundRef.current.setPositionAsync(ms).catch(() => {});
      }
    }, 150);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollSV.value = event.contentOffset.x;
      runOnJS(updateScrollJS)(event.contentOffset.x);
    },
  });

  // ── PanResponder: left handle ─────────────────────────────
  const leftHandleStart = useRef(0);
  const leftPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { leftHandleStart.current = trimLeftJS.current; },
    onPanResponderMove: (_, g) => {
      const v = Math.max(0, Math.min(trimRightJS.current - MIN_SEL_PX, leftHandleStart.current + g.dx));
      trimLeftSV.value   = v;
      trimLeftJS.current = v;
      const s = Math.round((trimRightJS.current - v) / PIXELS_PER_SEC);
      setDurationLabel(`0:${s.toString().padStart(2, '0')}`);
    },
  })).current;

  // ── PanResponder: right handle ────────────────────────────
  const rightHandleStart = useRef(0);
  const rightPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { rightHandleStart.current = trimRightJS.current; },
    onPanResponderMove: (_, g) => {
      const v = Math.max(trimLeftJS.current + MIN_SEL_PX, Math.min(SW, rightHandleStart.current + g.dx));
      trimRightSV.value   = v;
      trimRightJS.current = v;
      const s = Math.round((v - trimLeftJS.current) / PIXELS_PER_SEC);
      setDurationLabel(`0:${s.toString().padStart(2, '0')}`);
    },
  })).current;

  // ── PanResponder: center — scrolls the waveform ───────────
  const centerScrollStart = useRef(0);
  const centerPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
    onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx) > 3,
    onPanResponderGrant: () => { centerScrollStart.current = scrollXJS.current; },
    onPanResponderMove: (_, g) => {
      const newX = Math.max(0, Math.min(SCROLL_CONTENT_W - SW, centerScrollStart.current - g.dx));
      scrollRef.current?.scrollTo({ x: newX, animated: false });
    },
  })).current;

  // ── Done ──────────────────────────────────────────────────
  const handleDone = useCallback(() => {
    const absLeft = scrollXJS.current - SIDE_PAD + trimLeftJS.current;
    const ss = Math.max(0, absLeft / PIXELS_PER_SEC);
    const es = ss + (trimRightJS.current - trimLeftJS.current) / PIXELS_PER_SEC;
    onDone(song, ss, Math.min(es, totalSec));
  }, [song, totalSec, onDone]);

  if (!song) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={onBack}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* ── Header: Back left, Done right ─────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 40 : 54, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ width: 60, alignItems: 'flex-start' }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 60 }} />
          <TouchableOpacity onPress={handleDone} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ width: 60, alignItems: 'flex-end' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* ── Song title + artist ────────────────────────────── */}
        <View style={{ alignItems: 'center', marginTop: 8, paddingHorizontal: 32 }}>
          <Text style={{ color: '#4FC3F7', fontSize: 20, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{song.title}</Text>
          <Text style={{ color: '#888', fontSize: 14, marginTop: 4 }} numberOfLines={1}>{song.artist}</Text>
        </View>

        {/* spacer above art — equal = art centered */}
        <View style={{ flex: 1 }} />

        {/* ── Large album art center ─────────────────────────── */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={{ uri: song.cover || 'https://i.pravatar.cc/300?img=5' }}
            style={{ width: SW * 0.74, height: SW * 0.74, borderRadius: 10, backgroundColor: '#1A1A1A' }}
            resizeMode="cover"
          />
        </View>

        {/* spacer below art — smaller = waveform closer to bottom */}
        <View style={{ flex: 1 }} />

        {/* ── Waveform trim section ──────────────────────────── */}
        <View style={{ paddingBottom: Platform.OS === 'ios' ? 52 : 36 }}>
          <Text style={{ color: '#fff', fontSize: 13, textAlign: 'center', opacity: 0.85, marginBottom: 6 }}>
            Choose the part you want for your reel.
          </Text>
          <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
            {durationLabel}
          </Text>

          {/* ── Mini timeline scrubber ────────────────────────── */}
          <View style={{ height: 20, marginHorizontal: 0, marginBottom: 8, position: 'relative', justifyContent: 'center' }}>
            {/* Track line */}
            <View style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#333', borderRadius: 1 }} />
            {/* Selected segment highlight */}
            <Reanimated.View style={[{ position: 'absolute', height: 2, backgroundColor: '#FF2D78', borderRadius: 1 }, selBarStyle]} />
            {/* Center dot only (playhead) */}
            <Reanimated.View style={[{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', top: 5 }, centerDotStyle]} />
          </View>

          {/* Waveform container — full screen width, no horizontal padding */}
          <View style={{ height: WAVEFORM_H + 14, position: 'relative' }}>

            {/* ── Layer 1: gray scrollable waveform ─────────── */}
            <ReanimatedScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={scrollHandler}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: WAVEFORM_H }}
              contentContainerStyle={{ height: WAVEFORM_H }}
            >
              <Svg width={SCROLL_CONTENT_W} height={WAVEFORM_H}>
                {bars.map((amp: number, i: number) => {
                  const x = SIDE_PAD + i * BAR_STEP;
                  const barH = Math.max(4, amp * WAVEFORM_H);
                  return (
                    <SvgRect key={i} x={x} y={WAVEFORM_H - barH} width={BAR_W} height={barH} fill="#444" rx={1.5} />
                  );
                })}
              </Svg>
            </ReanimatedScrollView>

            {/* ── Layer 2: gradient bars clipped to trim selection ─ */}
            <Reanimated.View style={overlayContainerStyle} pointerEvents="none">
              <Reanimated.View style={overlayInnerStyle}>
                <Svg width={SCROLL_CONTENT_W} height={WAVEFORM_H}>
                  <Defs>
                    <SvgLinearGradient id="trimGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={SCROLL_CONTENT_W} y2="0">
                      <SvgStop offset="0"   stopColor="#FFA500" stopOpacity="1" />
                      <SvgStop offset="0.4" stopColor="#FF2D78" stopOpacity="1" />
                      <SvgStop offset="0.7" stopColor="#CC44FF" stopOpacity="1" />
                      <SvgStop offset="1"   stopColor="#8844EE" stopOpacity="1" />
                    </SvgLinearGradient>
                  </Defs>
                  {bars.map((amp: number, i: number) => {
                    const x = SIDE_PAD + i * BAR_STEP;
                    const barH = Math.max(4, amp * WAVEFORM_H);
                    return (
                      <SvgRect key={i} x={x} y={WAVEFORM_H - barH} width={BAR_W} height={barH} fill="url(#trimGrad)" rx={1.5} />
                    );
                  })}
                </Svg>
              </Reanimated.View>
            </Reanimated.View>

            {/* ── Trim frame: white border + drag handles ─────── */}
            <Reanimated.View style={trimFrameStyle} pointerEvents="box-none">
              {/* Left handle */}
              <View
                {...leftPan.panHandlers}
                hitSlop={{ top: 16, bottom: 16, left: 10, right: 6 }}
                style={{ width: HANDLE_W, height: '100%', backgroundColor: '#fff', borderTopLeftRadius: 4, borderBottomLeftRadius: 4, justifyContent: 'center', alignItems: 'center' }}
              >
                <View style={{ width: 3, height: 22, backgroundColor: '#000', borderRadius: 2, opacity: 0.6 }} />
              </View>

              {/* Center — drag to scroll waveform */}
              <View {...centerPan.panHandlers} style={{ flex: 1, height: '100%' }} />

              {/* Right handle */}
              <View
                {...rightPan.panHandlers}
                hitSlop={{ top: 16, bottom: 16, left: 6, right: 10 }}
                style={{ width: HANDLE_W, height: '100%', backgroundColor: '#fff', borderTopRightRadius: 4, borderBottomRightRadius: 4, justifyContent: 'center', alignItems: 'center' }}
              >
                <View style={{ width: 3, height: 22, backgroundColor: '#000', borderRadius: 2, opacity: 0.6 }} />
              </View>
            </Reanimated.View>

            {/* ── Fixed playhead at horizontal center of screen ── */}
            <View
              style={{ position: 'absolute', left: SW / 2 - 1, top: -5, width: 2, height: WAVEFORM_H + 10, backgroundColor: '#fff', borderRadius: 1, opacity: 0.85 }}
              pointerEvents="none"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function App() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const routeParams = useLocalSearchParams();
  const routeVideoParam = Array.isArray(routeParams.video)
    ? routeParams.video[0]
    : routeParams.video;
  const deepLinkVideoId = typeof routeVideoParam === 'string' ? routeVideoParam : '';
  const insets = useSafeAreaInsets();
  const { showSuccessToast } = useSuccessToast();
  const [showSplash, setShowSplash] = useState(true);
  const [isProfile, setIsProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<'All' | 'Like' | 'Comments' | 'Share' | 'Save' | 'Follow'>('All');
  const [inboxFilterLoading, setInboxFilterLoading] = useState(false);
  const inboxFilterLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Inbox is server-owned activity. Do not seed it with sample/local entries:
  // only notifications addressed to the signed-in account belong here.
  const [inboxActivities, setInboxActivities] = useState<any[]>([]);
  const [showLikedByModal, setShowLikedByModal] = useState(false);
  const [likedByList, setLikedByList] = useState<{userId: string; profilePic: string}[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [syncedNotifs, setSyncedNotifs] = useState<any[]>([]);
  const syncedNotifsRef = useRef<any[]>([]);
  const [socialUnreadPillVisible, setSocialUnreadPillVisible] = useState(false);
  const socialUnreadPillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appOpenedAtMsRef = useRef(Date.now());
  const hasShownSocialPillSinceOpenRef = useRef(false);
  const previousUnreadSocialIdsRef = useRef<{ accountId: string; ids: Set<string> }>({
    accountId: '',
    ids: new Set<string>(),
  });
  const inboxRowAnimationsRef = useRef<Record<string, Animated.Value>>({});
  const [, setInboxRowAnimationVersion] = useState(0);
  const [notificationsLoadedForUid, setNotificationsLoadedForUid] = useState<string | null>(null);
  const notificationActorCacheRef = useRef<Record<string, any>>({});
  const [showChatScreen, setShowChatScreen] = useState(false);
  const [chatUser, setChatUser] = useState<ChatListItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [friendActivity, setFriendActivity] = useState<Record<string, PeerActivity>>({});
  const [chatInput, setChatInput] = useState('');
  const [userId, setUserId] = useState("@newuser");
  const [mastiBaseUserId, setMastiBaseUserId] = useState<string | null>(null);
  const unreadNotificationCounts = useMemo(
    () => getUnreadNotificationCounts(syncedNotifs, [
      appAuth.currentUser?.uid,
      appAuth.currentUser?.email,
      mastiBaseUserId,
      userId,
    ]),
    [syncedNotifs, userId, mastiBaseUserId, appAuth.currentUser?.uid, appAuth.currentUser?.email],
  );
  useEffect(() => {
    const accountId = appAuth.currentUser?.uid || '';
    const unreadSocialIds = new Set(
      syncedNotifs
        .filter(notification => {
          if (notification?.read || notification?.id === undefined || notification?.id === null) {
            return false;
          }
          const type = String(notification?.type ?? notification?.notificationType ?? '')
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_');
          return type.includes('like') || type.includes('comment') ||
            type.includes('follow') || type.includes('follower') || type.includes('friend');
        })
        .map(notification => String(notification.id)),
    );
    const previous = previousUnreadSocialIdsRef.current;
    const hasNewUnreadSocialActivity = accountId !== previous.accountId
      ? unreadSocialIds.size > 0
      : Array.from(unreadSocialIds).some(id => !previous.ids.has(id));
    previousUnreadSocialIdsRef.current = { accountId, ids: unreadSocialIds };

    if (unreadSocialIds.size === 0) {
      if (socialUnreadPillTimerRef.current) {
        clearTimeout(socialUnreadPillTimerRef.current);
        socialUnreadPillTimerRef.current = null;
      }
      setSocialUnreadPillVisible(false);
      return;
    }

    if (hasNewUnreadSocialActivity) {
      if (socialUnreadPillTimerRef.current) {
        clearTimeout(socialUnreadPillTimerRef.current);
      }
      const firstDisplayDelay = hasShownSocialPillSinceOpenRef.current
        ? 0
        : Math.max(0, 2000 - (Date.now() - appOpenedAtMsRef.current));
      socialUnreadPillTimerRef.current = setTimeout(() => {
        hasShownSocialPillSinceOpenRef.current = true;
        setSocialUnreadPillVisible(true);
        socialUnreadPillTimerRef.current = setTimeout(() => {
          setSocialUnreadPillVisible(false);
          socialUnreadPillTimerRef.current = null;
        }, 6000);
      }, firstDisplayDelay);
    }
  }, [syncedNotifs, appAuth.currentUser?.uid]);
  useEffect(() => () => {
    if (socialUnreadPillTimerRef.current) {
      clearTimeout(socialUnreadPillTimerRef.current);
    }
  }, []);
  const [isVerified, setIsVerified] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [isChatBlocked, setIsChatBlocked] = useState(false);
  const [isChatBlockedByOther, setIsChatBlockedByOther] = useState(false);
  const [showProfileOptionsMenu, setShowProfileOptionsMenu] = useState(false);
  const [isProfileBlocked, setIsProfileBlocked] = useState(false);
  const [blockedProfileIds, setBlockedProfileIds] = useState<Record<string, boolean>>({});
  const [showAudioCall, setShowAudioCall] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeaker, setCallSpeaker] = useState(true);
  const [callCameraEnabled, setCallCameraEnabled] = useState(true);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callIsCaller, setCallIsCaller] = useState(false);
  const [callCameraFacing, setCallCameraFacing] = useState<'user' | 'environment'>('user');
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ── Call signaling refs ──────────────────────────────────────────────────
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCallKind, setIncomingCallKind] = useState<'audio' | 'video'>('audio');
  const [incomingCallUser, setIncomingCallUser] = useState<ChatListItem | null>(null);
  const [incomingCallId, setIncomingCallId] = useState<string | null>(null);
  const ringSoundRef = useRef<any>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callDocIdRef = useRef<string | null>(null);
  const callDocUnsubRef = useRef<(() => void) | null>(null);
  const incomingCallUnsubRef = useRef<(() => void) | null>(null);

  // Block status is stored by account IDs, not by the currently visible
  // inbox list. This keeps the setting valid for existing and future users.
  const currentAccountId = useCallback(
    () => appAuth.currentUser?.uid || userId || 'guest',
    [userId],
  );
  const chatPeerId = useCallback(
    () => {
      const peer = chatUser as any;
      return chatIdentity(peer) || 'unknown';
    },
    [chatUser],
  );
  const blockDocId = useCallback(
    (blockerId: string, blockedId: string) =>
      `${encodeURIComponent(blockerId)}__${encodeURIComponent(blockedId)}`,
    [],
  );
  const refreshChatBlockStatus = useCallback(async (user?: ChatListItem) => {
    const me = currentAccountId();
    const selectedPeer = user as any;
    const peer = selectedPeer
      ? (chatIdentity(selectedPeer) || 'unknown')
      : chatPeerId();
    if (!peer || peer === 'unknown' || me === 'guest') {
      setIsChatBlocked(false);
      setIsChatBlockedByOther(false);
      return;
    }
    try {
      const [mine, theirs] = await Promise.all([
        getDoc(doc(db, 'userBlocks', blockDocId(me, peer))),
        getDoc(doc(db, 'userBlocks', blockDocId(peer, me))),
      ]);
      setIsChatBlocked(mine.exists());
      setIsChatBlockedByOther(theirs.exists());
    } catch (_) {
      setIsChatBlocked(false);
      setIsChatBlockedByOther(false);
    }
  }, [blockDocId, chatPeerId, currentAccountId]);
  const isUserBlocked = useCallback(async (peerId: string, me = currentAccountId()) => {
    if (!peerId || peerId === 'unknown' || me === 'guest') return false;
    try {
      const [mine, theirs] = await Promise.all([
        getDoc(doc(db, 'userBlocks', blockDocId(me, peerId))),
        getDoc(doc(db, 'userBlocks', blockDocId(peerId, me))),
      ]);
      return mine.exists() || theirs.exists();
    } catch (_) {
      return false;
    }
  }, [blockDocId, currentAccountId]);

  // Settings can unblock an account while this screen stays mounted in the
  // navigation stack. Re-read the local block collection whenever Home gets
  // focus so the feed immediately restores videos that were just unblocked.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const syncBlockedProfileIds = async () => {
        const me = appAuth.currentUser?.uid;
        if (!me) {
          setBlockedProfileIds({});
          return;
        }
        try {
          const snapshot = await getDocs(
            query(
              collection(db, 'userBlocks'),
              where('blockerId', '==', me),
            ),
          );
          const nextBlocked: Record<string, boolean> = {};
          snapshot.docs.forEach((item) => {
            const blockedId = String(item.data()?.blockedId || '').trim();
            if (blockedId) nextBlocked[blockedId] = true;
          });
          if (!cancelled) setBlockedProfileIds(nextBlocked);
        } catch (_) {
          // Keep the current in-memory state if the local store is temporarily unavailable.
        }
      };

      void syncBlockedProfileIds();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const profileTargetId = useCallback((profile: any) => {
    const value =
      profile?.backendUserId ??
      profile?.accountId ??
      profile?.userId ??
      profile?.user;
    return String(value ?? '').trim();
  }, []);

  const refreshProfileBlockStatus = useCallback(async (profile: any) => {
    const me = currentAccountId();
    const peer = profileTargetId(profile);
    if (me === 'guest' || !peer || peer === 'unknown') {
      setIsProfileBlocked(false);
      return;
    }
    try {
      const blocked = await getDoc(doc(db, 'userBlocks', blockDocId(me, peer)));
      setIsProfileBlocked(blocked.exists());
      setBlockedProfileIds((previous) => ({ ...previous, [peer]: blocked.exists() }));
    } catch (_) {
      setIsProfileBlocked(false);
    }
  }, [blockDocId, currentAccountId, profileTargetId]);

  const toggleProfileBlock = useCallback(async (profile: any) => {
    const me = currentAccountId();
    const peer = profileTargetId(profile);
    if (me === 'guest' || !peer || peer === 'unknown') {
      Alert.alert('Login required', 'Block karne ke liye pehle login karein.');
      return;
    }

    try {
      const ref = doc(db, 'userBlocks', blockDocId(me, peer));
      if (isProfileBlocked) {
        await deleteDoc(ref);
        setIsProfileBlocked(false);
        setBlockedProfileIds((previous) => ({ ...previous, [peer]: false }));
        showSuccessToast(`${profile?.name || 'User'} ko unblock kar diya gaya.`);
      } else {
        await setDoc(ref, {
          blockerId: me,
          blockedId: peer,
          blockedName: profile?.name || '',
          blockedHandle: profile?.userId || profile?.user || '',
          blockedUsername: profile?.username || '',
          blockedAvatar: profile?.profileImage || profile?.avatarUrl || '',
          createdAt: serverTimestamp(),
        });
        setIsProfileBlocked(true);
        setBlockedProfileIds((previous) => ({ ...previous, [peer]: true }));
        setVideos((previous) => previous.filter((video) => {
          const identities = [
            video?.backendUserId,
            video?.accountId,
            video?.userId,
            video?.user,
          ].filter(Boolean).map((value) => String(value));
          return !identities.includes(peer);
        }));
        setShowProfileOptionsMenu(false);
        setSelectedUser(null);
        setIsProfile(false);
        showSuccessToast(`${profile?.name || 'User'} ko block kar diya gaya.`);
      }
    } catch (_) {
      Alert.alert('Error', 'Block setting save nahi ho saki. Dobara try karein.');
    }
  }, [blockDocId, currentAccountId, isProfileBlocked, profileTargetId, showSuccessToast]);

  const submitProfileReport = useCallback(async (profile: any, reason: string) => {
    const me = currentAccountId();
    const peer = profileTargetId(profile);
    if (me === 'guest' || !peer || peer === 'unknown') {
      Alert.alert('Login required', 'Report karne ke liye pehle login karein.');
      return;
    }

    try {
      await addDoc(collection(db, 'userReports'), {
        reporterId: me,
        reportedUserId: peer,
        reportedHandle: profile?.userId || profile?.user || '',
        reportedName: profile?.name || 'User',
        reason,
        createdAt: serverTimestamp(),
      });
      showSuccessToast('Aapki report receive ho gayi hai. Shukriya.');
    } catch (_) {
      Alert.alert('Error', 'Report submit nahi ho saki. Dobara try karein.');
    }
  }, [currentAccountId, profileTargetId, showSuccessToast]);

  const reportProfile = useCallback((profile: any) => {
    setShowProfileOptionsMenu(false);
    setTimeout(() => {
      Alert.alert(
        'Report profile',
        'Is profile ko report karne ka reason choose karein.',
        [
          { text: 'Spam', onPress: () => { void submitProfileReport(profile, 'Spam'); } },
          { text: 'Inappropriate content', onPress: () => { void submitProfileReport(profile, 'Inappropriate content'); } },
          { text: 'Harassment', onPress: () => { void submitProfileReport(profile, 'Harassment'); } },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }, 250);
  }, [submitProfileReport]);

  const shareProfile = useCallback(async (profile: any) => {
    setShowProfileOptionsMenu(false);
    const handle = formatProfileHandle(profile?.userId || profile?.user);
    const profileName = cleanDisplayName(profile?.name || 'Masti Video User');
    try {
      await Share.share({
        message: `${profileName}\n${handle}\nMasti Video par profile dekhein.`,
      });
    } catch (error) {
      console.log('[Profile] Share failed:', error);
    }
  }, []);

  const toggleChatBlock = useCallback(async () => {
    const me = currentAccountId();
    const peer = chatPeerId();
    if (me === 'guest' || peer === 'unknown') {
      Alert.alert('Login required', 'Block or unblock ke liye pehle login karein.');
      setShowChatMenu(false);
      return;
    }
    const ref = doc(db, 'userBlocks', blockDocId(me, peer));
    try {
      if (isChatBlocked) {
        await deleteDoc(ref);
        setIsChatBlocked(false);
        showSuccessToast(`${chatUser?.name || 'User'} ko unblock kar diya gaya.`);
      } else {
        await setDoc(ref, {
          blockerId: me,
          blockedId: peer,
          blockedName: chatUser?.name || '',
          blockedHandle: (chatUser as any)?.userId || (chatUser as any)?.user || '',
          blockedUsername: (chatUser as any)?.username || '',
          blockedAvatar: (chatUser as any)?.profileImage || (chatUser as any)?.avatar || '',
          createdAt: serverTimestamp(),
        });
        setIsChatBlocked(true);
        showSuccessToast(`${chatUser?.name || 'User'} ko block kar diya gaya.`);
      }
    } catch (_) {
      Alert.alert('Error', 'Block setting save nahi ho saki. Dobara try karein.');
    } finally {
      setShowChatMenu(false);
    }
  }, [blockDocId, chatPeerId, chatUser, currentAccountId, isChatBlocked, showSuccessToast]);
  const [showCamera,setShowCamera] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterModalTempFilter, setFilterModalTempFilter] = useState('No effect');
  const [effectsCategory, setEffectsCategory] = useState<'aesthetics'|'special'>('aesthetics');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraHasPermission = cameraPermission?.granted ?? false;
  const micHasPermission = micPermission?.granted ?? false;
  const cameraRef = useRef<CameraView>(null);
  const permissionFlowRunningRef = useRef(false);
  
  const startY = useRef(0);
const startZoom = useRef(0);

// ✅ Instagram-Reels-style record button state
const isRecordingRef = useRef(false);
const pressStartTimeRef = useRef(0);
const wasRecordingBeforePressRef = useRef(false);
const didDragRef = useRef(false);
const LONG_PRESS_THRESHOLD = 300; // ms — below this on release = "tap"
  
  const [followingUsers, setFollowingUsers] = useState<string[]>([]);
  // MastiBash feed state is authoritative for creators the backend has
  // returned. Keep those answers from being overwritten by the device mirror.
  const remoteFollowingStateRef = useRef(
    new Map<string, { handle: string; isFollowing: boolean }>(),
  );
  const [followingUserAliases, setFollowingUserAliases] = useState<string[]>([]);
  // Real followers list — local store se live aata hai
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(false);
  // When a profile-grid video is opened, keep the player scoped to that
  // profile instead of continuing through the global For You feed.
  const [profilePlaybackUserId, setProfilePlaybackUserId] = useState<string | null>(null);
  const [profilePlaybackVideoIds, setProfilePlaybackVideoIds] = useState<string[]>([]);
  const [pendingScrollVideoId, setPendingScrollVideoId] = useState(null); // ✅ id of just-uploaded video waiting to be scrolled into view
  const handledDeepLinkVideoIdRef = useRef<string | null>(null);
  const [likedVideos, setLikedVideos] = useState<Record<string, boolean>>({});
  const [expandedVideoDetailsId, setExpandedVideoDetailsId] = useState<string | null>(null);
  const [savedVideos, setSavedVideos] = useState<Record<string, boolean>>({});
  const [pinnedVideos, setPinnedVideos] = useState<Record<string, boolean>>({});
  const [deletedVideoIds, setDeletedVideoIds] = useState<Record<string, boolean>>({});
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const savedSongsLoadedRef = useRef(false);
  const [videoThumbnailOverrides, setVideoThumbnailOverrides] = useState<Record<string, string>>({});
  const [videoCoverPositions, setVideoCoverPositions] = useState<Record<string, number>>({});

  // ── Persist likedVideos & savedVideos & drafts — per-user keys (Instagram style) ──
  // Load onAuthStateChanged mein hota hai (per-user); yahan sirf save effects hain.
  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!uid) return;
    AsyncStorage.setItem(`@masti_liked_videos_${uid}`, JSON.stringify(likedVideos)).catch(() => {});
  }, [likedVideos]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!uid) return;
    AsyncStorage.setItem(`@masti_saved_videos_${uid}`, JSON.stringify(savedVideos)).catch(() => {});
  }, [savedVideos]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!uid) return;
    AsyncStorage.setItem(`@masti_pinned_videos_${uid}`, JSON.stringify(pinnedVideos)).catch(() => {});
  }, [pinnedVideos]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!uid) return;
    AsyncStorage.setItem(`@masti_deleted_video_ids_${uid}`, JSON.stringify(deletedVideoIds)).catch(() => {});
  }, [deletedVideoIds]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!uid) return;
    AsyncStorage.setItem(`@masti_drafts_${uid}`, JSON.stringify(drafts)).catch(() => {});
  }, [drafts]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!uid) return;
    AsyncStorage.setItem(
      `${VIDEO_THUMBNAIL_OVERRIDES_PREFIX}${uid}`,
      JSON.stringify(videoThumbnailOverrides),
    ).catch(() => {});
  }, [videoThumbnailOverrides]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!uid) return;
    AsyncStorage.setItem(
      `${VIDEO_COVER_POSITIONS_PREFIX}${uid}`,
      JSON.stringify(videoCoverPositions),
    ).catch(() => {});
  }, [videoCoverPositions]);

  const [editProfile, setEditProfile] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  // Delete/Pin are profile-management actions, never feed actions.
  const [shareOpenedFromProfile, setShareOpenedFromProfile] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [videoComments, setVideoComments] = useState<Record<string, any[]>>({});
  const [commentText, setCommentText] = useState('');
  const [liveLikeCounts, setLiveLikeCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentVideoItem, setCurrentVideoItem] = useState<any>(null);
  const interactionStorageLoadedRef = useRef(false);
  const viewedVideoIdsRef = useRef<Record<string, boolean>>({});

  // Interaction data is kept in a live local document per video. The
  // sanitized id prevents a video id from accidentally creating nested paths.
  const interactionDocId = useCallback(
    (videoId: any) => `video_${String(videoId ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    [],
  );
  const interactionAccountId = useCallback(
    () => appAuth.currentUser?.uid || 'guest',
    [],
  );

  // The local interaction document is a fallback for comments and view counts.
  // MastiBash owns like, save, share, and follow state and counts.
  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!interactionStorageLoadedRef.current || !uid) return;
    AsyncStorage.setItem(`@masti_video_comments_${uid}`, JSON.stringify(videoComments)).catch(() => {});
  }, [videoComments]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!interactionStorageLoadedRef.current || !uid) return;
    AsyncStorage.setItem(`@masti_video_share_counts_${uid}`, JSON.stringify(shareCounts)).catch(() => {});
  }, [shareCounts]);

  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (!interactionStorageLoadedRef.current || !uid) return;
    AsyncStorage.setItem(`@masti_video_save_counts_${uid}`, JSON.stringify(saveCounts)).catch(() => {});
  }, [saveCounts]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'videoInteractions'),
      (snapshot) => {
        snapshot.docs.forEach((interactionSnapshot) => {
          const data = interactionSnapshot.data() as any;
          const videoId = data.videoId || interactionSnapshot.id.replace(/^video_/, '');
          if (Array.isArray(data.comments)) {
            setVideoComments(prev => ({ ...prev, [videoId]: data.comments }));
          }
          if (typeof data.viewCount === 'number') {
            setViewCounts(prev => ({ ...prev, [videoId]: data.viewCount }));
          }
        });
      },
      (error) => console.warn('[Interactions] Live sync unavailable:', error),
    );
    return () => unsubscribe();
  }, []);

  const appendVideoCommentLive = useCallback(async (videoId: any, comment: any) => {
    const interactionRef = doc(db, 'videoInteractions', interactionDocId(videoId));
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(interactionRef);
      const data = snapshot.exists() ? snapshot.data() as any : {};
      const comments = Array.isArray(data.comments)
        ? data.comments
        : (videoComments[videoId] || []);
      transaction.set(interactionRef, {
        videoId: String(videoId),
        comments: [...comments, comment],
        shareCount: typeof data.shareCount === 'number' ? data.shareCount : (shareCounts[videoId] || 0),
        saveCount: typeof data.saveCount === 'number' ? data.saveCount : (saveCounts[videoId] || 0),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }, [interactionDocId, saveCounts, shareCounts, videoComments]);

  const incrementShareLive = useCallback(async (videoId: any, authoritativeCount?: number) => {
    const interactionRef = doc(db, 'videoInteractions', interactionDocId(videoId));
    let nextCount = (shareCounts[videoId] || 0) + 1;
    const remoteCount = mastiBaseCount(authoritativeCount);
    if (remoteCount !== undefined) {
      nextCount = remoteCount;
      setShareCounts(prev => ({ ...prev, [videoId]: nextCount }));
    }
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(interactionRef);
      const data = snapshot.exists() ? snapshot.data() as any : {};
      nextCount = remoteCount ?? (
        (typeof data.shareCount === 'number' ? data.shareCount : (shareCounts[videoId] || 0)) + 1
      );
      transaction.set(interactionRef, {
        videoId: String(videoId),
        shareCount: nextCount,
        saveCount: typeof data.saveCount === 'number' ? data.saveCount : (saveCounts[videoId] || 0),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    setShareCounts(prev => ({ ...prev, [videoId]: nextCount }));
  }, [interactionDocId, saveCounts, shareCounts]);

  const toggleSaveLive = useCallback(async (
    videoId: any,
    desiredSaved: boolean,
    authoritativeCount?: number,
  ) => {
    const interactionRef = doc(db, 'videoInteractions', interactionDocId(videoId));
    const accountId = interactionAccountId();
    let nextSaved = desiredSaved;
    let nextCount = mastiBaseCount(authoritativeCount) ??
      Math.max(0, (saveCounts[videoId] || 0) + (nextSaved ? 1 : -1));
    setSavedVideos(prev => ({ ...prev, [videoId]: nextSaved }));
    setSaveCounts(prev => ({ ...prev, [videoId]: nextCount }));
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(interactionRef);
      const data = snapshot.exists() ? snapshot.data() as any : {};
      const savedBy = Array.isArray(data.savedBy) ? data.savedBy : [];
      const wasSaved = savedBy.includes(accountId);
      nextSaved = desiredSaved;
      nextCount = mastiBaseCount(authoritativeCount) ?? Math.max(
        0,
        (typeof data.saveCount === 'number' ? data.saveCount : (saveCounts[videoId] || 0)) +
          (nextSaved === wasSaved ? 0 : nextSaved ? 1 : -1),
      );
      const nextSavedBy = nextSaved
        ? Array.from(new Set([...savedBy, accountId]))
        : savedBy.filter((id: string) => id !== accountId);
      transaction.set(interactionRef, {
        videoId: String(videoId),
        savedBy: nextSavedBy,
        saveCount: nextCount,
        shareCount: typeof data.shareCount === 'number' ? data.shareCount : (shareCounts[videoId] || 0),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    setSavedVideos(prev => ({ ...prev, [videoId]: nextSaved }));
    setSaveCounts(prev => ({ ...prev, [videoId]: nextCount }));
  }, [interactionAccountId, interactionDocId, saveCounts, shareCounts]);

  const setLikeLive = useCallback(async (
    videoId: any,
    desiredLiked: boolean,
    fallbackCount = 0,
    authoritativeCount?: number,
  ) => {
    const interactionRef = doc(db, 'videoInteractions', interactionDocId(videoId));
    const accountId = interactionAccountId();
    let nextLiked = desiredLiked;
    let nextCount = mastiBaseCount(authoritativeCount) ?? Math.max(0, Number(fallbackCount) || 0);
    setLikedVideos(prev => ({ ...prev, [videoId]: nextLiked }));
    setLiveLikeCounts(prev => ({ ...prev, [videoId]: nextCount }));
    setVideos(prev => prev.map(video =>
      video.id === videoId ? { ...video, likes: nextCount } : video,
    ));

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(interactionRef);
      const data = snapshot.exists() ? snapshot.data() as any : {};
      const hasLikedBy = Array.isArray(data.likedBy);
      const likedBy = hasLikedBy ? data.likedBy : [];
      const wasLiked = hasLikedBy ? likedBy.includes(accountId) : !desiredLiked;
      nextLiked = desiredLiked;
      nextCount = mastiBaseCount(authoritativeCount) ?? Math.max(0, (
        typeof data.likeCount === 'number' ? data.likeCount : fallbackCount
      ) + (nextLiked === wasLiked ? 0 : nextLiked ? 1 : -1));
      const nextLikedBy = nextLiked
        ? Array.from(new Set([...likedBy, accountId]))
        : likedBy.filter((id: string) => id !== accountId);

      transaction.set(interactionRef, {
        videoId: String(videoId),
        likedBy: nextLikedBy,
        likeCount: nextCount,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    setLikedVideos(prev => ({ ...prev, [videoId]: nextLiked }));
    setLiveLikeCounts(prev => ({ ...prev, [videoId]: nextCount }));
    setVideos(prev => prev.map(video =>
      video.id === videoId ? { ...video, likes: nextCount } : video,
    ));
    return { liked: nextLiked, count: nextCount };
  }, [interactionAccountId, interactionDocId]);

  const incrementViewLive = useCallback(async (videoId: any, fallbackCount = 0) => {
    const normalizedVideoId = String(videoId ?? '');
    if (!normalizedVideoId || viewedVideoIdsRef.current[normalizedVideoId]) return;
    viewedVideoIdsRef.current[normalizedVideoId] = true;

    const interactionRef = doc(db, 'videoInteractions', interactionDocId(videoId));
    let nextCount = Math.max(0, Number(fallbackCount) || 0) + 1;
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(interactionRef);
        const data = snapshot.exists() ? snapshot.data() as any : {};
        nextCount = Math.max(
          0,
          (typeof data.viewCount === 'number'
            ? data.viewCount
            : Math.max(0, Number(fallbackCount) || 0)) + 1,
        );
        transaction.set(interactionRef, {
          videoId: normalizedVideoId,
          viewCount: nextCount,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      setViewCounts(prev => ({ ...prev, [normalizedVideoId]: nextCount }));
    } catch (error) {
      delete viewedVideoIdsRef.current[normalizedVideoId];
      console.warn('[Interactions] View count could not sync live:', error);
    }
  }, [interactionDocId]);
  const [profileImage, setProfileImage] = useState("");
  const [profileImageUploadUri, setProfileImageUploadUri] = useState<string | null>(null);
  const [profileImageSyncPending, setProfileImageSyncPending] = useState(false);
  const [publicProfileAvatarCache, setPublicProfileAvatarCache] = useState<Record<string, string>>({});
  const profileImageBeforeUploadRef = useRef<string | null>(null);
  const profilePhotoSyncRetryRef = useRef<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showWithdrawalRequest, setShowWithdrawalRequest] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalBankName, setWithdrawalBankName] = useState('');
  const [withdrawalAccountHolder, setWithdrawalAccountHolder] = useState('');
  const [withdrawalAccountNumber, setWithdrawalAccountNumber] = useState('');
  const [withdrawalConfirmAccountNumber, setWithdrawalConfirmAccountNumber] = useState('');
  const [withdrawalIfscCode, setWithdrawalIfscCode] = useState('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [withdrawalNow, setWithdrawalNow] = useState(Date.now());
  const [withdrawalRequestSummary, setWithdrawalRequestSummary] = useState<{
    amount: number;
    requestedAt: string;
    processAfter: string;
    status: 'pending';
  } | null>(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    let active = true;
    void readPublicProfileAvatarCache().then((cache) => {
      if (active) setPublicProfileAvatarCache(cache);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isProfile || !selectedUser) {
      setShowProfileOptionsMenu(false);
      setIsProfileBlocked(false);
      return;
    }
    void refreshProfileBlockStatus(selectedUser);
  }, [isProfile, refreshProfileBlockStatus, selectedUser]);
  const [name, setName] = useState("New User");
  const [bio, setBio] = useState("");
  const [youtube, setYoutube] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  // Search results are loaded from the live MastiBase search endpoint.
  const directorySearchUsers: any[] = [];
  const [searchLoading, setSearchLoading] = useState(false);
  const [remoteSearchUsers, setRemoteSearchUsers] = useState<any[]>([]);
  const [remoteSearchVideos, setRemoteSearchVideos] = useState<any[]>([]);
  const [remoteSearchHashtags, setRemoteSearchHashtags] = useState<unknown[]>([]);
  const searchLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareSearchLoading, setShareSearchLoading] = useState(false);
  const shareSearchLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const tagSearchLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [musicModalLoading, setMusicModalLoading] = useState(false);
  const musicModalLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [followersModalLoading, setFollowersModalLoading] = useState(false);
  const followersModalLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const friendsLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const chatLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerSearchLoading = useCallback((setLoading, timerRef, duration = 650) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      setLoading(false);
      timerRef.current = null;
    }, duration);
  }, []);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const hydratedProfileUidRef = useRef<string | null>(null);
  // Every auth event gets its own version. An older profile read must not
  // hydrate the UI after the user has switched to another Gmail account.
  const authHydrationVersionRef = useRef(0);
  const videoQualityAuthVersionRef = useRef(0);
  // Login persistence: splash aur auth dono complete hone ke baad decide karo
  const splashDoneRef = useRef(false);
  const authInitRef = useRef(false);
  const [videos, setVideos] = useState<any[]>([]);
  const dmUsers = useMemo(() => {
    const me = messagingIdentity({
      email: appAuth.currentUser?.email,
      authUid: appAuth.currentUser?.uid,
      mastiBaseUserId,
    });
    const uniqueUsers = new Map<string, ChatListItem>();
    videos.forEach(video => {
      const participant = chatParticipantFromProfile(video);
      const identity = messagingIdentity(participant);
      if (!identity || identity === me || uniqueUsers.has(identity)) return;
      uniqueUsers.set(identity, participant);
    });
    return Array.from(uniqueUsers.values());
  }, [videos, appAuth.currentUser?.email, appAuth.currentUser?.uid, mastiBaseUserId]);
  const [feedLoadError, setFeedLoadError] = useState<string | null>(null);
  const [feedErrorBannerReady, setFeedErrorBannerReady] = useState(false);
  const [feedVideoStates, setFeedVideoStates] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});
  const [feedVideoRetryKeys, setFeedVideoRetryKeys] = useState<Record<string, number>>({});
  const [feedVideoProgressiveFallbacks, setFeedVideoProgressiveFallbacks] = useState<Record<string, boolean>>({});
  const [mastiVideoQuality, setMastiVideoQuality] = useState<MastiVideoQuality>(
    MASTI_VIDEO_DEFAULT_QUALITY,
  );
  const [showVideoQualityPicker, setShowVideoQualityPicker] = useState(false);
  const [layoutPreviewIndex, setLayoutPreviewIndex] = useState<number | null>(null);
  const pendingQualitySeekRef = useRef<{ videoId: string; positionMillis: number } | null>(null);
  const [feedConnectivity, setFeedConnectivity] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isFeedInitialLoading, setIsFeedInitialLoading] = useState(true);
  const feedConnectivityRef = useRef<'checking' | 'online' | 'offline'>('checking');
  const feedConnectivityProbeRef = useRef(false);
  const feedVideoStartedRef = useRef<Record<string, boolean>>({});
  const feedVideoEverReadyRef = useRef<Record<string, boolean>>({});
  const feedVideoLoadStartedAtRef = useRef<Record<string, number>>({});
  const feedVideoReadyTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const feedInitialLoadingRef = useRef(true);
  const offlineGraceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setFeedErrorBannerReady(false);
    if (!feedLoadError) return;

    const timer = setTimeout(
      () => setFeedErrorBannerReady(true),
      FEED_LOADING_MIN_MS,
    );
    return () => clearTimeout(timer);
  }, [feedLoadError]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const accountId = appAuth.currentUser?.uid;
      const authVersion = videoQualityAuthVersionRef.current;
      if (!accountId) {
        setMastiVideoQuality(MASTI_VIDEO_DEFAULT_QUALITY);
      } else {
        AsyncStorage.getItem(getMastiVideoQualityStorageKey(accountId))
          .then((savedQuality) => {
            if (
              !cancelled &&
              authVersion === videoQualityAuthVersionRef.current &&
              appAuth.currentUser?.uid === accountId
            ) {
              setMastiVideoQuality(
                isMastiVideoQuality(savedQuality)
                  ? savedQuality
                  : MASTI_VIDEO_DEFAULT_QUALITY,
              );
            }
          })
          .catch(() => {});
      }
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // MastiBase owns per-user verification. Refresh the signed-in creator's
  // status while Home is focused so admin changes appear without a relogin.
  useFocusEffect(
    useCallback(() => {
      const accountId = appAuth.currentUser?.uid;
      const email = appAuth.currentUser?.email?.trim().toLowerCase();
      const backendUserId = String(mastiBaseUserId ?? '').trim().toLowerCase();
      if (!accountId || !email) return undefined;

      let cancelled = false;
      const refreshVerificationStatus = async () => {
        try {
          const profile = await getMastiBaseProfile(email);
          if (cancelled || appAuth.currentUser?.uid !== accountId) return;

          const verified = profile.isVerified === true;
          setIsVerified(verified);
          const followersCount = mastiBaseCount(profile.followersCount);
          const followingCount = mastiBaseCount(profile.followingCount);
          if (followersCount !== undefined) setOwnFollowers(followersCount);
          if (followingCount !== undefined) setOwnFollowingCount(followingCount);
          setVideos((previous) =>
            previous.map((video) => {
              const videoBackendUserId = String(video.backendUserId ?? '')
                .trim()
                .toLowerCase();
              const belongsToAccount =
                video.accountId === accountId ||
                String(video.accountId ?? '').trim().toLowerCase() === email ||
                String(video.email ?? '').trim().toLowerCase() === email ||
                (!!backendUserId && videoBackendUserId === backendUserId);
              return belongsToAccount ? { ...video, isVerified: verified } : video;
            }),
          );
        } catch (error) {
          if (!cancelled) {
            console.warn('[Profile] MastiBase verification refresh failed:', error);
          }
        }
      };

      void refreshVerificationStatus();
      const refreshTimer = setInterval(() => {
        void refreshVerificationStatus();
      }, 30000);

      return () => {
        cancelled = true;
        clearInterval(refreshTimer);
      };
    }, [
      appAuth.currentUser?.email,
      appAuth.currentUser?.uid,
      mastiBaseUserId,
    ]),
  );

  // ─── Backend persistence (MastiBase direct feed) ─────────────────────────
  // The feed client connects directly to the configured MastiBase URL.
  const queryClient = useQueryClient();
  const currentAuthUid = appAuth.currentUser?.uid || '';
  const currentAuthEmail = appAuth.currentUser?.email?.trim().toLowerCase() || '';
  useEffect(() => {
    let cancelled = false;
    setWithdrawalRequestSummary(null);
    setWithdrawalNow(Date.now());
    setShowWithdrawalRequest(false);
    setWithdrawalAmount('');
    setWithdrawalBankName('');
    setWithdrawalAccountHolder('');
    setWithdrawalAccountNumber('');
    setWithdrawalConfirmAccountNumber('');
    setWithdrawalIfscCode('');

    if (!currentAuthUid) return () => { cancelled = true; };

    void AsyncStorage.getItem(
      `${WITHDRAWAL_REQUEST_STORAGE_PREFIX}${currentAuthUid}`,
    ).then((raw) => {
      if (!raw || cancelled) return;
      try {
        const saved = JSON.parse(raw);
        if (
          typeof saved?.amount === 'number' &&
          Number.isFinite(saved.amount) &&
          typeof saved?.requestedAt === 'string' &&
          Number.isFinite(Date.parse(saved.requestedAt)) &&
          typeof saved?.processAfter === 'string' &&
          Number.isFinite(Date.parse(saved.processAfter)) &&
          saved?.status === 'pending'
        ) {
          setWithdrawalRequestSummary({
            amount: saved.amount,
            requestedAt: saved.requestedAt,
            processAfter: saved.processAfter,
            status: 'pending',
          });
        }
      } catch {
        // Ignore an invalid local status snapshot; no bank details are stored here.
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [currentAuthUid]);

  useEffect(() => {
    if (!withdrawalRequestSummary) return;
    const processAfterMs = Date.parse(withdrawalRequestSummary.processAfter);
    const interval = setInterval(() => {
      const now = Date.now();
      setWithdrawalNow(now);
      if (now >= processAfterMs) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [withdrawalRequestSummary]);

  const currentMessagingId = messagingIdentity({
    authUid: currentAuthUid,
    email: appAuth.currentUser?.email,
    mastiBaseUserId,
    userId,
  });
  const currentChatAuthId = chatIdentity({
    authUid: currentAuthUid,
    email: appAuth.currentUser?.email,
  });
  const currentChatOwnerIds = Array.from(new Set(
    [
      currentMessagingId,
      mastiBaseUserId,
      appAuth.currentUser?.email?.trim().toLowerCase(),
      currentAuthUid,
      String(userId ?? '').trim().replace(/^@+/, ''),
      userId,
    ]
      .map(value => String(value ?? '').trim())
      .filter(Boolean),
  ));
  const chatPeerMessagingId = messagingIdentity(chatUser);
  const chatPeerAuthId = chatIdentity(chatUser) || chatPeerMessagingId;
  const activeChatConversationId = chatUser
    ? chatUser.conversationId ||
      (currentMessagingId && chatPeerMessagingId
        ? chatConversationId(currentMessagingId, chatPeerMessagingId)
        : '')
    : '';
  const chatMessagesQuery = useGetChatConversationMessages(activeChatConversationId, {
    query: {
      queryKey: ['getChatConversationMessages', currentAuthUid, activeChatConversationId],
      enabled: Boolean(isLoggedIn && showChatScreen && activeChatConversationId),
      refetchInterval: showChatScreen ? 4_000 : false,
      refetchOnReconnect: true,
    },
    ownerIds: currentChatOwnerIds,
    myMessagingId: currentMessagingId,
    chatUser1: currentChatAuthId || currentMessagingId,
    chatUser2: chatPeerAuthId,
    request: { headers: { 'Cache-Control': 'no-cache' } },
  });
  const chatConversationsQuery = useListChatConversations({
    query: {
      queryKey: ['listChatConversations', currentAuthUid],
      enabled: Boolean(isLoggedIn && (showInbox || showFriends) && currentAuthUid),
      refetchInterval: showInbox || showFriends ? 10_000 : false,
      refetchOnReconnect: true,
    },
    ownerIds: currentChatOwnerIds,
    myMessagingId: currentMessagingId,
    request: { headers: { 'Cache-Control': 'no-cache' } },
  });
  const sendChatMessageMutation = useSendChatConversationMessage();
  const friendUsers = useMemo(() => {
    const usersById = new Map<string, ChatListItem>();
    const conversations = chatConversationsQuery.data?.conversations ?? [];

    conversations.forEach(conversation => {
      const existing = dmUsers.find(
        peer => messagingIdentity(peer) === conversation.peerId,
      );
      usersById.set(conversation.peerId, {
        ...(existing ?? {}),
        id: conversation.peerId,
        name:
          existing?.name && existing.name !== 'Masti User'
            ? existing.name
            : conversation.peerName || conversation.peerId,
        avatar: existing?.avatar || conversation.peerAvatar || '',
        conversationId: conversation.conversationId,
        mastiBaseUserId: conversation.peerId,
        messagingId: conversation.peerId,
        authUid: existing?.authUid || conversation.peerAuthId || undefined,
        userId: existing?.userId || existing?.user || conversation.peerId,
        user: existing?.user || existing?.userId || conversation.peerId,
        lastMsg: conversation.lastMessage,
        time: chatTime(conversation.lastMessageAt),
      });
    });

    dmUsers.forEach(peer => {
      const identity = messagingIdentity(peer) || peer.id;
      if (identity && !usersById.has(identity)) {
        usersById.set(identity, peer);
      }
    });

    return Array.from(usersById.values());
  }, [chatConversationsQuery.data?.conversations, dmUsers]);

  useEffect(() => {
    if (!showChatScreen) return;

    if (chatMessagesQuery.isLoading) {
      setChatLoading(true);
      return;
    }

    setChatLoading(false);
    const remoteMessages = chatMessagesQuery.data?.messages;
    if (!remoteMessages) return;

    const mappedMessages = remoteMessages.map(message =>
      mapRemoteChatMessage(message, currentMessagingId),
    );
    setChatMessages(previous => {
      const pendingMessages = previous.filter(message =>
        message.id.startsWith('local_') &&
        !mappedMessages.some(remote => remote.clientId === message.id),
      );
      return [...mappedMessages, ...pendingMessages];
    });
  }, [
    activeChatConversationId,
    chatMessagesQuery.data,
    chatMessagesQuery.isLoading,
    currentMessagingId,
    showChatScreen,
  ]);
  const [backendVideos, setBackendVideos] = useState<any[]>([]);
  const [adsConfig, setAdsConfig] = useState<MastiBaseAdsConfig | null>(null);
  const remoteTheme = adsConfig?.theme;
  const themePrimaryColor =
    /^#[0-9a-f]{6}$/i.test(remoteTheme?.primaryColor || '')
      ? remoteTheme.primaryColor
      : '#FE2C55';
  const themeSecondaryColor =
    /^#[0-9a-f]{6}$/i.test(remoteTheme?.secondaryColor || '')
      ? remoteTheme.secondaryColor
      : '#8A5CF6';
  const themeBorderRadius = Number.isFinite(remoteTheme?.borderRadius)
    ? Math.max(0, Math.min(32, Number(remoteTheme?.borderRadius)))
    : 12;
  const themeFontFamily =
    remoteTheme?.fontFamily === 'classic'
      ? 'serif'
      : remoteTheme?.fontFamily === 'gothic'
        ? 'sans-serif-condensed'
        : remoteTheme?.fontFamily === 'bold'
          ? 'sans-serif'
          : undefined;
  const remoteFeedLayout = ['grid', 'list', 'reels'].includes(
    String(remoteTheme?.layoutType || '').toLowerCase(),
  )
    ? String(remoteTheme?.layoutType).toLowerCase()
    : 'reels';
  const isDarkTheme = remoteTheme?.isDarkMode !== false;
  const lastInterstitialIndexRef = useRef(-1);

  const loadFeedAdsConfig = useCallback(async () => {
    try {
      const config = await getMastiBaseAdsConfig();
      setAdsConfig(config);
    } catch (error) {
      console.warn('[Ads] MastiBase config unavailable:', error);
      setAdsConfig(null);
    }
  }, []);

  useEffect(() => {
    void loadFeedAdsConfig();
    const refreshTimer = setInterval(loadFeedAdsConfig, 30000);
    return () => clearInterval(refreshTimer);
  }, [loadFeedAdsConfig]);

  const { showInterstitial } = useFeedInterstitial(adsConfig);

  const refetchBackendVideos = useCallback(async (): Promise<{ isError: boolean; error?: any }> => {
    try {
      const fetchedVideos = await getMastiBaseFeed();
      setFeedLoadError(null);
      const currentEmail = appAuth.currentUser?.email?.trim().toLowerCase();
      let remoteBookmarks = null;
      if (currentEmail) {
        try {
          remoteBookmarks = await getMastiBaseBookmarks(currentEmail);
        } catch (error) {
          console.warn('[Bookmarks] MastiBase saved list unavailable:', error);
        }
      }
      const remoteBookmarkIds = new Set(
        (remoteBookmarks || []).map((video) => String(video.id)),
      );
      fetchedVideos.forEach((video) => {
        const rawHandle = String(
          video.profile?.username ??
            video.profile?.userName ??
            video.profile?.userId ??
            video.userId ??
            video.user ??
            video.username ??
            '',
        ).trim();
        if (!rawHandle || typeof video.social?.isFollowingCreator !== 'boolean') return;
        const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
        const key = normalizedIdentity(handle);
        if (!key) return;
        remoteFollowingStateRef.current.set(key, {
          handle,
          isFollowing: video.social.isFollowingCreator,
        });
      });
      feedConnectivityRef.current = 'online';
      setFeedConnectivity('online');
      setBackendVideos(fetchedVideos);
      setLiveLikeCounts((previous) => {
        const next = { ...previous };
        fetchedVideos.forEach((video) => {
          const count = Number(video.social?.likes);
          if (Number.isFinite(count)) next[String(video.id)] = Math.max(0, count);
        });
        return next;
      });
      setShareCounts((previous) => {
        const next = { ...previous };
        fetchedVideos.forEach((video) => {
          const count = mastiBaseCount(video.social?.shares);
          if (count !== undefined) next[String(video.id)] = count;
        });
        return next;
      });
      setLikedVideos((previous) => {
        const next = { ...previous };
        fetchedVideos.forEach((video) => {
          if (typeof video.social?.isLiked === 'boolean') {
            next[String(video.id)] = video.social.isLiked;
          }
        });
        return next;
      });
      setFollowingUsers((previous) => {
        const next = new Map<string, string>();
        previous.forEach((handle) => {
          const key = normalizedIdentity(handle);
          if (key) next.set(key, handle);
        });
        remoteFollowingStateRef.current.forEach((status, key) => {
          if (status.isFollowing) next.set(key, status.handle);
          else next.delete(key);
        });
        return Array.from(next.values());
      });
      setSavedVideos((previous) => {
        const next = { ...previous };
        fetchedVideos.forEach((video) => {
          if (remoteBookmarks) {
            next[String(video.id)] = remoteBookmarkIds.has(String(video.id));
          } else if (typeof video.social?.isBookmarked === 'boolean') {
            next[String(video.id)] = video.social.isBookmarked;
          }
        });
        (remoteBookmarks || []).forEach((video) => {
          next[String(video.id)] = true;
        });
        return next;
      });
      setSaveCounts((previous) => {
        const next = { ...previous };
        fetchedVideos.forEach((video) => {
          const count = mastiBaseCount(video.social?.saves);
          if (count !== undefined) next[String(video.id)] = count;
        });
        (remoteBookmarks || []).forEach((video) => {
          const count = mastiBaseCount(video.social?.saves);
          if (count !== undefined) next[String(video.id)] = count;
        });
        return next;
      });
      if (fetchedVideos.length === 0 && feedInitialLoadingRef.current) {
        feedInitialLoadingRef.current = false;
        setIsFeedInitialLoading(false);
      }
      return { isError: false };
    } catch (error) {
      feedConnectivityRef.current = 'offline';
      setFeedConnectivity('offline');
      setFeedLoadError('Videos could not be loaded');
      if (feedInitialLoadingRef.current) {
        feedInitialLoadingRef.current = false;
        setIsFeedInitialLoading(false);
      }
      return { isError: true, error };
    }
  }, []);

  const finishInitialFeedLoading = useCallback(() => {
    if (!feedInitialLoadingRef.current) return;
    feedInitialLoadingRef.current = false;
    setIsFeedInitialLoading(false);
  }, []);

  const clearOfflineVideoGraceTimer = useCallback((videoId: string) => {
    const timer = offlineGraceTimersRef.current[videoId];
    if (timer) {
      clearTimeout(timer);
      delete offlineGraceTimersRef.current[videoId];
    }
  }, []);

  const scheduleOfflineVideoError = useCallback((videoId: string) => {
    if (offlineGraceTimersRef.current[videoId]) return;
    offlineGraceTimersRef.current[videoId] = setTimeout(() => {
      delete offlineGraceTimersRef.current[videoId];
      setFeedVideoStates((prev) => ({ ...prev, [videoId]: 'error' }));
    // Keep the original black startup loader visible long enough for the
    // first feed surface to mount before handing off to the video screen.
    }, 3500);
  }, []);

  const scheduleFeedVideoReady = useCallback((videoId: string) => {
    if (feedVideoEverReadyRef.current[videoId]) return;
    if (feedVideoReadyTimersRef.current[videoId]) return;

    const startedAt = feedVideoLoadStartedAtRef.current[videoId] || Date.now();
    // Keep the guarded minimum only for the first feed load. When a screen
    // such as Inbox or Profile unmounts and remounts Home, a previously-ready
    // video must not wait another five seconds before it can play.
    const minimumLoadingMs = feedInitialLoadingRef.current ? FEED_LOADING_MIN_MS : 0;
    const remainingMs = Math.max(0, minimumLoadingMs - (Date.now() - startedAt));
    feedVideoReadyTimersRef.current[videoId] = setTimeout(() => {
      delete feedVideoReadyTimersRef.current[videoId];
      feedVideoEverReadyRef.current[videoId] = true;
      finishInitialFeedLoading();
      setFeedVideoStates((prev) => (
        prev[videoId] === 'ready' ? prev : { ...prev, [videoId]: 'ready' }
      ));
    }, remainingMs);
  }, [finishInitialFeedLoading]);

  useEffect(() => {
    return () => {
      Object.values(feedVideoReadyTimersRef.current).forEach((timer) => clearTimeout(timer));
      feedVideoReadyTimersRef.current = {};
    };
  }, []);

  // A small connectivity probe makes the app react to mobile data/Wi-Fi
  // changes even when a video component is still holding a buffered frame.
  const probeFeedConnectivity = useCallback(async () => {
    if (feedConnectivityProbeRef.current) return;
    feedConnectivityProbeRef.current = true;
    try {
      await getMastiBaseFeed();
      feedConnectivityRef.current = 'online';
      setFeedConnectivity('online');
    } catch {
      feedConnectivityRef.current = 'offline';
      setFeedConnectivity('offline');
    } finally {
      feedConnectivityProbeRef.current = false;
    }
  }, []);

  // ✅ On mount: remove the old feed cache and load only the live remote feed
  useEffect(() => {
    AsyncStorage.removeItem(MASTI_MEDIA_CACHE_KEY).catch(() => {});
    void refetchBackendVideos();

    // Auto-poll every 30 seconds so the live feed stays current.
    const pollInterval = setInterval(() => {
      refetchBackendVideos();
    }, 30000);
    // Connectivity checks should not compete with video playback on mobile
    // data. The feed itself is refreshed separately every 30 seconds.
    const connectivityInterval = setInterval(() => {
      probeFeedConnectivity();
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(connectivityInterval);
      Object.values(offlineGraceTimersRef.current).forEach(clearTimeout);
      offlineGraceTimersRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapBackendVideo = useCallback((v: any) => {
    const backendVideoId = String(v.id ?? v.mediaId ?? v.videoId ?? '');
    const persistedThumbnailOverride =
      videoThumbnailOverrides[backendVideoId] ||
      videoThumbnailOverrides[`db-${backendVideoId}`] ||
      '';
    const persistedCoverPosition =
      videoCoverPositions[backendVideoId] ??
      videoCoverPositions[`db-${backendVideoId}`] ??
      0;
    const backendThumbnail =
      v.thumbnailUrl || v.thumbnail_url || v.thumbnail || v.posterUrl || null;
    const backendOwnerId =
      v.profile?.mastiBaseUserId ||
      v.profile?.id ||
      v.backendUserId ||
      v.accountId ||
      null;
    const embeddedProfileImage = [
      v.profile?.avatarUrl,
      v.profile?.avatar,
      v.profile?.profileImage,
      v.profile?.profilePhoto,
      v.profile?.profilePic,
      v.profile?.profilePicture,
      v.profile?.profilePictureUrl,
      v.profile?.photoUrl,
      v.profile?.photoURL,
      v.profileImage,
      v.avatarUrl,
      v.profilePic,
      v.profilePicture,
    ]
      .map(normalizeMastiAvatarUrl)
      .find(Boolean) || '';
    const persistedProfileImage =
      embeddedProfileImage ||
      findCachedPublicProfileAvatar(
        publicProfileAvatarCache,
        backendOwnerId,
        v.profile?.id,
        v.profile?.mastiBaseUserId,
        v.profile?.username,
        v.profile?.userId,
        v.backendUserId,
        v.userId,
        v.username,
        v.accountId,
      );
    const ownerIdentityCandidates = [
      backendOwnerId,
      v.profile?.userId,
      v.profile?.username,
      v.userId,
      v.accountId,
    ]
      .filter(Boolean)
      .map((value) => String(value));
    if (ownerIdentityCandidates.some((identity) => blockedProfileIds[identity])) {
      return null;
    }
    const profileName = String(v.profile?.name ?? '').trim();
    const profileNameHandle = profileName.startsWith('@') ? profileName : '';
    const creatorHandleCandidates = [
      profileNameHandle,
      v.profile?.username,
      v.profile?.userName,
      v.userName,
      v.username,
      v.userId,
      v.profile?.userId,
      v.profile?.id,
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
    const currentStableIdentities = [
      currentAuthUid,
      currentAuthEmail,
      mastiBaseUserId,
    ].map(normalizedIdentity).filter(Boolean);
    const videoStableIdentities = [
      v.firebaseUid,
      v.authUid,
      v.uid,
      v.accountId,
      v.email,
      v.userEmail,
      v.ownerId,
      v.ownerEmail,
      v.backendUserId,
      v.profile?.firebaseUid,
      v.profile?.authUid,
      v.profile?.uid,
      v.profile?.accountId,
      v.profile?.email,
      v.profile?.mastiBaseUserId,
      v.profile?.id,
    ].map(normalizedIdentity).filter(Boolean);
    const hasStableVideoIdentity = videoStableIdentities.length > 0;
    const sharesCurrentStableIdentity = currentStableIdentities.some((identity) =>
      videoStableIdentities.includes(identity),
    );
    const sameHandle =
      !!userId &&
      creatorHandleCandidates.some(
        (candidate) => normalizedIdentity(candidate) === normalizedIdentity(userId),
      );
    const isCurrentAccountVideo =
      sharesCurrentStableIdentity ||
      (!hasStableVideoIdentity && sameHandle);
    const creatorName = cleanDisplayName(
      isCurrentAccountVideo
        ? name || v.profile?.name || v.userName || v.userId
        : v.profile?.name || v.userName || v.userId,
      'Masti Creator',
    );
    const creatorId = isCurrentAccountVideo
      ? currentAuthEmail || currentAuthUid || v.profile?.userId || v.userId || creatorName
      : v.profile?.email || v.profile?.userId || v.userId || creatorName;
    const isBackendIdentity = (value: string) =>
      /^(usr_|med_|masti-)/i.test(value.replace(/^@+/, ''));
    const rawCreatorHandle =
      creatorHandleCandidates.find(
        (value) =>
          !isBackendIdentity(value) && !isPlaceholderProfileHandle(value),
      ) ||
      creatorHandleCandidates.find((value) => !isBackendIdentity(value)) ||
      creatorHandleCandidates[0] ||
      creatorName;
    const backendCreatorHandle = formatProfileHandle(rawCreatorHandle);
    const creatorHandle = isCurrentAccountVideo && userId
      ? formatProfileHandle(userId)
      : backendCreatorHandle;
    const creatorSocialLinks = isCurrentAccountVideo
      ? {
          ...(v.profile?.socialLinks || {}),
          instagram,
          youtube,
          facebook,
        }
      : v.profile?.socialLinks || {};
    const persistedSong = v.song || {
      id: `original-${v.id}`,
      title: 'Original Audio',
      artist: creatorName,
      duration: '00:30',
      cover: persistedProfileImage,
      userId: creatorId,
      isOriginal: true,
    };

    const backendVideoUrl =
      v.videoUrl ||
      v.cloudinaryUrl ||
      v.fileUrl ||
      v.mediaUrl ||
      v.url ||
      v.secure_url ||
      '';
    const explicitSponsoredFlag = [
      v.isSponsored,
      v.sponsored,
      v.isSponsoredContent,
      v.sponsor,
    ].some((value) =>
      value === true ||
      value === 1 ||
      ['true', '1', 'sponsored'].includes(String(value ?? '').trim().toLowerCase()),
    );

    return ({
    id: String(v.id),
    accountId: isCurrentAccountVideo
      ? currentAuthUid || currentAuthEmail || v.accountId || null
      : v.profile?.email || v.accountId || null,
    email:
      (isCurrentAccountVideo ? currentAuthEmail : '') ||
      v.profile?.email ||
      v.userEmail ||
      v.email ||
      (typeof v.accountId === 'string' && v.accountId.includes('@')
        ? v.accountId
        : undefined),
    authUid:
      v.profile?.authUid ||
      v.authUid ||
      v.firebaseUid ||
      v.uid ||
      (isCurrentAccountVideo ? currentAuthUid : undefined) ||
      undefined,
    uid:
      v.profile?.uid ||
      v.uid ||
      v.authUid ||
      v.firebaseUid ||
      (isCurrentAccountVideo ? currentAuthUid : undefined) ||
      undefined,
    backendUserId: isCurrentAccountVideo
      ? mastiBaseUserId || backendOwnerId
      : backendOwnerId,
    user: creatorHandle,
    name: creatorName,
    userId: creatorHandle,
    bio: isCurrentAccountVideo ? bio : v.profile?.bio || '',
    profileImage: isCurrentAccountVideo && profileImage
      ? profileImage
      : persistedProfileImage,
    isVerified: isCurrentAccountVideo
      ? isVerified
      :
      v.profile?.isVerified === true ||
      v.profile?.isVerified === 1 ||
      v.profile?.isVerified === 'true' ||
      v.profile?.isVerified === '1' ||
      v.isVerified === true ||
      v.isVerified === 1 ||
      v.isVerified === 'true' ||
      v.isVerified === '1',
    isLiked: v.social?.isLiked === true,
    isFollowingCreator: v.social?.isFollowingCreator === true,
    followers: v.profile?.followersCount || 0,
    following: v.profile?.followingCount || 0,
    likes: Number(v.social?.likes ?? v.likes ?? 0),
    comments: Number(v.social?.comments ?? v.commentsCount ?? v.commentCount ?? 0),
    shares: Number(v.social?.shares ?? v.shares ?? 0),
    saves: Number(v.social?.saves ?? v.saves ?? v.savesCount ?? 0),
    isBookmarked: v.social?.isBookmarked === true,
    title: v.title || v.caption || v.description || '',
    desc: v.caption || v.description || '',
    createdAt:
      v.createdAt ??
      v.created_at ??
      v.uploadedAt ??
      v.uploaded_at ??
      v.publishedAt ??
      v.published_at ??
      v.timestamp ??
      v.createdAtUtc ??
      v.created_at_utc,
    url: normalizeMastiMediaUrl(backendVideoUrl),
    adaptiveStreamUrl: getMastiBashQualityStreamUrl(v, 'auto') || undefined,
    qualities: v.qualities,
    qualityUrls: v.qualityUrls,
    renditions: v.renditions,
    streams: v.streams,
    variants: v.variants,
    sources: v.sources,
    hlsUrl: v.hlsUrl,
    hls_url: v.hls_url,
    streamUrl: v.streamUrl,
    stream_url: v.stream_url,
     localAsset: v.localAsset,
    thumbnail:
      persistedThumbnailOverride ||
      (isRenderableThumbnail(backendThumbnail) ? backendThumbnail : null),
    coverFramePosition: persistedCoverPosition,
    musicCover: persistedSong.cover || persistedProfileImage,
    song: persistedSong,
    youtube: creatorSocialLinks.youtube || '',
    instagram: creatorSocialLinks.instagram || '',
    facebook: creatorSocialLinks.facebook || '',
    website: creatorSocialLinks.website || '',
    whatsapp: creatorSocialLinks.whatsapp || '',
    telegram: creatorSocialLinks.telegram || '',
    socialLinks: creatorSocialLinks,
    privacy: v.privacy || 'public',
    isUserUpload: true,
      // A remote URL only means that the media is playable. Do not label
      // every MastiBase video as Sponsored; use an explicit ad flag only.
      isSponsored:
        explicitSponsoredFlag ||
        v.adType === 'sponsored' ||
        String(v.label ?? v.badge ?? '').trim().toLowerCase() === 'sponsored',
    });
  }, [
    blockedProfileIds,
    bio,
    currentAuthEmail,
    currentAuthUid,
    facebook,
    instagram,
    isVerified,
    mastiBaseUserId,
    name,
    profileImage,
    publicProfileAvatarCache,
    userId,
    videoCoverPositions,
    videoThumbnailOverrides,
    youtube,
  ]);

  // Sync backend-posted videos into the feed every time the list query
  // resolves — on first load (persists posts across app restarts), after a
  // successful new post (via the invalidate below), and on manual refresh.
  // Re-running (rather than "merge once") is what lets a freshly-posted
  // video that already appears optimistically get reconciled with its real
  // backend id without ever duplicating it in the feed.
  useEffect(() => {
    if (!backendVideos) return;
    console.log('[Feed] Backend videos loaded:', backendVideos.length);
    setFeedLoadError(null);

    const mapped = dedupeVideoItems(backendVideos
      .slice()
      .map(mapBackendVideo)
      .filter((video) => video && !deletedVideoIds[video.id]));
    const mappedIds = new Set(
      mapped.map((m) => String(m.id).replace(/^db-/, '')),
    );
    const currentUid = appAuth.currentUser?.uid;

    setVideos((prev) => {
      const optimisticByKey = new Map(
        prev
          .map((video) => [canonicalVideoKey(video), video] as const)
          .filter(([key]) => Boolean(key)),
      );
      const mappedWithLocalPreviews = mapped.map((video) => {
        const optimistic = optimisticByKey.get(canonicalVideoKey(video));
        if (!optimistic?.localAsset) return video;
        return {
          ...video,
          // Keep the just-recorded local file as the first-session playback
          // source while the remote feed record is being reconciled.
          localAsset: optimistic.localAsset,
          thumbnail: video.thumbnail || optimistic.thumbnail || null,
        };
      });
      // Drop both the temporary db-<id> entry and any stale copy with the
      // backend <id>. The upload is already represented by the fresh backend
      // record, so keeping both caused duplicate profile thumbnails.
      // Keep the current account's locally-hydrated videos even when the API
      // is unavailable or has not returned the newly posted item yet.
      // Keep only local account-owned items in addition to the current remote
      // response. This prevents deleted/old MastiBase videos from surviving
      // after the live feed returns a different list or an empty list.
      const rest = prev.filter((v) =>
        !v?.isUserUpload &&
        !mappedIds.has(String(v.id).replace(/^db-/, '')) &&
        (!String(v.id).startsWith('db-') || v.accountId === currentUid),
      );
      return dedupeVideoItems([...mappedWithLocalPreviews, ...rest]);
    });
  }, [backendVideos, deletedVideoIds, mapBackendVideo]);

  const [recordTime, setRecordTime] = useState('15s');
  const recordTimeRef = useRef('15s');
  const [cameraTab, setCameraTab] = useState('Camera');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState('off');
  const [speed, setSpeed] = useState('1x');
  const [isRecording, setIsRecording] = useState(false);

// keep a ref in sync with isRecording so the PanResponder always reads the latest value
useEffect(() => {
  isRecordingRef.current = isRecording;
}, [isRecording]);

// ✅ Recording Timer
const [recordSeconds, setRecordSeconds] = useState(0);

// ✅ Circular Progress Animation
const progress = useRef(new Animated.Value(0)).current;

// ✅ Timer Ref
const timerRef = useRef(null);

// ✅ Circle Settings
const radius = 35;
const strokeWidth = 5;
const circumference = 2 * Math.PI * radius;

// ✅ Animated Circle
const strokeDashoffset = progress.interpolate({
  inputRange: [0, 1],
  outputRange: [circumference, 0],
});

const rotateAnim = useRef(new Animated.Value(0)).current;

const [selectedFilter, setSelectedFilter] = useState('Normal');
const [selectedEffect, setSelectedEffect] = useState('None');
const [profileTabIndex, setProfileTabIndex] = useState(0);
  const [isProfileTabLoading, setIsProfileTabLoading] = useState(false);
  const profileTabLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (profileTabLoadingTimerRef.current) {
      clearTimeout(profileTabLoadingTimerRef.current);
      profileTabLoadingTimerRef.current = null;
    }
    if (!isProfile) {
      setIsProfileTabLoading(false);
      return;
    }

    setIsProfileTabLoading(true);
    profileTabLoadingTimerRef.current = setTimeout(() => {
      setIsProfileTabLoading(false);
      profileTabLoadingTimerRef.current = null;
    }, 4000);

    return () => {
      if (profileTabLoadingTimerRef.current) {
        clearTimeout(profileTabLoadingTimerRef.current);
        profileTabLoadingTimerRef.current = null;
      }
    };
  }, [isProfile, profileTabIndex]);
  
  const [recordedVideoUri, setRecordedVideoUri] = useState(null);
  const [videoDeleted, setVideoDeleted] = useState(false);
  
  const [ownFollowers, setOwnFollowers] = useState(0);
  const [ownFollowingCount, setOwnFollowingCount] = useState<number | null>(null);
  const [selectedProfileCounts, setSelectedProfileCounts] = useState<{
    userId: string;
    followers: number;
    following: number;
  } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0.4)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const tabFlatListRef = useRef(null);
  const feedFlatListRef = useRef(null);
  const profileTabsFlatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(width)).current;
  const profileScrollX = useRef(new Animated.Value(0)).current;
  const changeTab = useCallback((isFollowing: boolean, animated = true) => {
    const index = isFollowing ? 0 : 1;
    setActiveTab(isFollowing);
    if (!animated) scrollX.setValue(index * width);
    tabFlatListRef.current?.scrollToOffset({
      offset: index * width,
      animated,
    });
  }, [scrollX]);
  const musicSoundRef = useRef<LegacyAudioSound | null>(null);
  const recordingMusicSoundRef = useRef<LegacyAudioSound | null>(null);
  const soundDetailAudioRef = useRef<LegacyAudioSound | null>(null);


  const likeScale = useRef(new Animated.Value(1)).current;
  const bigHeartScale = useRef(new Animated.Value(0)).current;
  const bigHeartOpacity = useRef(new Animated.Value(0)).current;
  const bigHeartAnimationIdRef = useRef(0);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  // Ref keeps the latest value so effects that must NOT re-run on every
  // pause change can still read the current value without a stale closure.
  const isManuallyPausedRef = useRef(false);
  
  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentVideoIndex(viewableItems[0].index);
      setCurrentVideoItem(viewableItems[0].item);
      setFeedPlaybackProgress(0);
      setIsManuallyPaused(false); // Reset pause when scrolling to new video
      setExpandedVideoDetailsId(null);
    }
  });
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 100 });
  
  const [activityFeed] = useState<any[]>([]);
  
  // ─── NEW: Recording flow state ───────────────────────────────────────────
  const [recordingFlowStep, setRecordingFlowStep] = useState(null); // null | 'review' | 'editor' | 'upload'

  const [uploadTitle, setUploadTitle] = useState('');
  const [privacySetting, setPrivacySetting] = useState('public');
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [allowShares, setAllowShares] = useState(true);
  const [hideLikeCount, setHideLikeCount] = useState(false);
  const [hideCommentCount, setHideCommentCount] = useState(false);
  const [hideShareCount, setHideShareCount] = useState(false);
  const [schedulePost, setSchedulePost] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  // ── Tag people & Add link modals ────────────────────────────────────────────
  const [showTagPeopleModal, setShowTagPeopleModal] = useState(false);
  const [tagSearchText, setTagSearchText] = useState('');
  const [taggedPeople, setTaggedPeople] = useState<string[]>([]);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [savedLinks, setSavedLinks] = useState<{title: string; url: string}[]>([]);
  // Auto-share toggles
  const [shareToMessages, setShareToMessages] = useState(false);
  const [shareToInstagram, setShareToInstagram] = useState(false);
  const [shareToSnapchat, setShareToSnapchat] = useState(false);
  const [editorActiveTool, setEditorActiveTool] = useState(null);
  const [textOverlays, setTextOverlays] = useState<Array<{
    id: string;
    text: string;
    color: string;
    size: number;
    x: number;
    y: number;
    startProgress?: number;
    endProgress?: number;
  }>>([]);
  const [stickerOverlays, setStickerOverlays] = useState<Array<{
    id: string;
    emoji: string;
    size: number;
    x: number;
    y: number;
  }>>([]);
  const [editorTextInput, setEditorTextInput] = useState('');
  const [editorTextColor, setEditorTextColor] = useState('#FFFFFF');
  const [editorTextSize, setEditorTextSize] = useState(24);
  const [showTextInput, setShowTextInput] = useState(false);
  const [editorVolume, setEditorVolume] = useState(80);
  const [editorVoiceEffect, setEditorVoiceEffect] = useState('None');
  const [originalSoundVol, setOriginalSoundVol] = useState(80); // 0-100
  const [musicVol, setMusicVol] = useState(0);                  // 0-100
  const [showMixAudio, setShowMixAudio] = useState(false);
  const [mixPanelPlaying, setMixPanelPlaying] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalPlaying, setEditModalPlaying] = useState(true);
  const [editModalPosition, setEditModalPosition] = useState(0);
  const [showVideoTimeline, setShowVideoTimeline] = useState(true); // Always show video timeline layer
  const [isVideoLayerSelected, setIsVideoLayerSelected] = useState(false); // yellow highlight when video layer is selected
  const [isAudioLayerSelected, setIsAudioLayerSelected] = useState(false); // yellow highlight when audio layer is selected
  const [isTextLayerSelected, setIsTextLayerSelected] = useState(false);   // yellow highlight when text layer is selected
  // ── Per-segment selection (index of the clicked segment, null = none) ──
  const [selectedVideoSegmentIndex, setSelectedVideoSegmentIndex] = useState<number | null>(null);
  const [selectedAudioSegmentIndex, setSelectedAudioSegmentIndex] = useState<number | null>(null);
  const [selectedTextSegmentIndex, setSelectedTextSegmentIndex] = useState<number | null>(null);
  // ── Deleted segment starts (progress 0-1 of segment's start bound) ──
  const [deletedSegmentStarts, setDeletedSegmentStarts] = useState<number[]>([]);
  // ── Split/cut points for each layer (progress 0-1) ──────────────
  const [videoCuts, setVideoCuts] = useState<number[]>([]);
  const [audioCuts, setAudioCuts] = useState<number[]>([]);
  const [textCuts, setTextCuts] = useState<number[]>([]);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textModalInput, setTextModalInput] = useState('');
  const [textModalColor, setTextModalColor] = useState('#fff');
  const [textModalAlign, setTextModalAlign] = useState<'left'|'center'|'right'>('center');
  const [textModalFont, setTextModalFont] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [feedPlaybackProgress, setFeedPlaybackProgress] = useState(0);
  const [feedPositionMs, setFeedPositionMs] = useState(0);
  const [feedDurationMs, setFeedDurationMs] = useState(0);
  const soundDetailVideoRefsArray = useRef<any[]>([]);
  const [showDotsMenu, setShowDotsMenu] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1);
  const [audioTrimStart, setAudioTrimStart] = useState(0);
  const [audioTrimEnd, setAudioTrimEnd] = useState(1);
  const [textTrimStart, setTextTrimStart] = useState(0);
  const [textTrimEnd, setTextTrimEnd] = useState(1);
  const [filmFrames, setFilmFrames] = useState<string[]>([]);
  const editorVideoRef = useRef(null);
  const editModalVideoRef = useRef(null);
  const timelineScrollRef = useRef<ScrollView>(null); // Instagram Reels: timeline scroll ref
  const timelineScrollXRef = useRef(0); // tracks current scroll offset
  const isTimelineDraggingRef = useRef(false); // true while user is scrolling timeline
  const videoSeekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // debounce video seek on scroll
  const videoRefs = useRef({}); // ✅ id -> feed <Video> ref, so we can force-play the item that should be current

  // ── Pinch-to-zoom for edit modal video preview ──────────────────
  const videoScale = useSharedValue(1);
  const pinchSavedScale = useSharedValue(1);
  const videoAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: videoScale.value }] }));
  // Sirf Pinch — Tap gesture hata diya taaki neeche ke buttons (undo/redo) block na hon
  const videoPinchGesture = Gesture.Pinch()
    .onUpdate((e: any) => {
      videoScale.value = Math.max(0.5, Math.min(3, pinchSavedScale.value * e.scale));
    })
    .onEnd(() => { pinchSavedScale.value = videoScale.value; });

  // ── Pinch-to-zoom for timeline (all 3 layers scale together) ─────
  const [timelineZoom, setTimelineZoom] = useState(0.7);
  const timelineZoomSV = useSharedValue(1);
  const timelineBaseSV = useSharedValue(1);
  // Ref so pinch gesture runs simultaneously with the timeline ScrollView on native
  const nativeScrollGestureRef = useRef(null);
  const timelinePinchGesture = Gesture.Pinch()
    .simultaneousWithExternalGesture(nativeScrollGestureRef)
    .onUpdate((e: any) => {
      timelineZoomSV.value = Math.max(0.4, Math.min(5, timelineBaseSV.value * e.scale));
    })
    .onEnd(() => {
      timelineBaseSV.value = timelineZoomSV.value;
      runOnJS(setTimelineZoom)(timelineZoomSV.value);
    });
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const videoDurationMsRef = useRef(0);
  const editModalPositionRef = useRef(0);
  const editModalPlayingRef = useRef(true);
  const lastEditModalUiUpdateRef = useRef(0);
  const lastTimelineSyncRef = useRef(0);
  const editorSeekTargetRef = useRef<number | null>(null);
  const editorSeekInFlightRef = useRef(false);
  const editorSeekResumeRef = useRef(false);
  const timelineWasPlayingRef = useRef(false);
  // Unlike the throttled UI value, this ref is updated on every native
  // playback callback. Split must use the actual playhead, not the last
  // rendered timestamp.
  const editModalSourceProgressRef = useRef(0);
  const visibleVideoSegments = useMemo(() => {
    const validCuts = Array.from(new Set(
      videoCuts
        .filter((p) => p > 0.005 && p < 0.995)
        .map((p) => Number(p.toFixed(4))),
    )).sort((a, b) => a - b);
    const allBounds = [0, ...validCuts, 1];
    return allBounds
      .slice(0, -1)
      .map((start, oi) => ({ start, end: allBounds[oi + 1], oi }))
      .filter((segment) => !deletedSegmentStarts.some((start) => Math.abs(start - segment.start) < 0.0005));
  }, [videoCuts, deletedSegmentStarts]);
  const visibleVideoSegmentsRef = useRef(visibleVideoSegments);
  useEffect(() => {
    visibleVideoSegmentsRef.current = visibleVideoSegments;
  }, [visibleVideoSegments]);
  const editedVideoSegments = useMemo(() => {
    const startLimit = Math.max(0, Math.min(1, trimStart));
    const endLimit = Math.max(startLimit, Math.min(1, trimEnd));
    return visibleVideoSegments
      .map((segment) => ({
        start: Math.max(startLimit, segment.start),
        end: Math.min(endLimit, segment.end),
      }))
      .filter((segment) => segment.end - segment.start > 0.005);
  }, [trimEnd, trimStart, visibleVideoSegments]);
  const editedVideoSegmentsRef = useRef(editedVideoSegments);
  useEffect(() => {
    editedVideoSegmentsRef.current = editedVideoSegments;
  }, [editedVideoSegments]);
  const resetVideoEditState = useCallback(() => {
    setVideoCuts([]);
    setDeletedSegmentStarts([]);
    setSelectedVideoSegmentIndex(null);
    setIsVideoLayerSelected(false);
    setTrimStart(0);
    setTrimEnd(1);
    trimStartRef.current = 0;
    trimEndRef.current = 1;
    trimPreviewPositionRef.current = 0;
    editModalSourceProgressRef.current = 0;
    editModalPositionRef.current = 0;
    setEditModalPosition(0);
    videoDurationMsRef.current = 0;
    setVideoDurationMs(0);
    setFilmFrames([]);
  }, []);
  useEffect(() => {
    editModalPositionRef.current = editModalPosition;
  }, [editModalPosition]);
  useEffect(() => {
    editModalPlayingRef.current = editModalPlaying;
  }, [editModalPlaying]);
  const queueEditorSeek = useCallback((targetMs: number, resumePlayback = false) => {
    const duration = videoDurationMsRef.current || videoDurationMs;
    if (duration <= 0) return;
    editorSeekTargetRef.current = Math.max(0, Math.min(duration - 40, targetMs));
    editorSeekResumeRef.current = editorSeekResumeRef.current || resumePlayback;
    if (editorSeekInFlightRef.current) return;
    editorSeekInFlightRef.current = true;
    const flushSeek = async () => {
      try {
        while (editorSeekTargetRef.current !== null) {
          const target = editorSeekTargetRef.current;
          const resume = editorSeekResumeRef.current;
          editorSeekTargetRef.current = null;
          editorSeekResumeRef.current = false;
          await editModalVideoRef.current?.setPositionAsync(target);
          if (resume && editModalPlayingRef.current) {
            await editModalVideoRef.current?.playAsync();
          }
        }
      } catch (_) {
        // The modal/player can close while a seek is in flight.
      } finally {
        editorSeekInFlightRef.current = false;
      }
    };
    flushSeek();
  }, [videoDurationMs]);
  const timelineProgressToVideoProgress = useCallback((timelineProgress: number, totalW: number) => {
    const segments = visibleVideoSegmentsRef.current;
    if (segments.length === 0 || totalW <= 0) return Math.max(0, Math.min(1, timelineProgress));

    const gapProgress = (Math.max(0, segments.length - 1) * 5) / totalW;
    const contentProgress = Math.max(0.0001, 1 - gapProgress);
    const progress = Math.max(0, Math.min(1, timelineProgress));
    let cursor = 0;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const segmentVisualWidth = (segment.end - segment.start) * contentProgress;
      if (progress <= cursor + segmentVisualWidth || index === segments.length - 1) {
        const withinSegment = segmentVisualWidth > 0
          ? Math.max(0, Math.min(1, (progress - cursor) / segmentVisualWidth))
          : 0;
        return segment.start + withinSegment * (segment.end - segment.start);
      }
      cursor += segmentVisualWidth;
      if (index < segments.length - 1 && progress <= cursor + gapProgress) {
        return segments[index + 1].start;
      }
      cursor += gapProgress;
    }
    return segments[segments.length - 1].end;
  }, []);
  const seekEditorToVideoSegment = useCallback((segmentIndex: number, resumePlayback = true) => {
    const duration = videoDurationMsRef.current || videoDurationMs;
    const segment = visibleVideoSegmentsRef.current.find(({ oi }) => oi === segmentIndex);
    if (!segment || duration <= 0) return;
    const startMs = segment.start * duration;
    trimPreviewPositionRef.current = segment.start;
    editModalPositionRef.current = startMs / 1000;
    setEditModalPosition(startMs / 1000);
    timelineScrollRef.current?.scrollTo({
      x: segment.start * (totalWRef.current || 1),
      animated: true,
    });
    queueEditorSeek(startMs, resumePlayback);
  }, [queueEditorSeek, videoDurationMs]);
  const seekEditorFromTimeline = useCallback((x: number, totalW: number, resumePlayback = false) => {
    const duration = videoDurationMsRef.current || videoDurationMs;
    if (duration <= 0 || totalW <= 0) return;
    const sourceProgress = timelineProgressToVideoProgress(x / totalW, totalW);
    editModalSourceProgressRef.current = sourceProgress;
    trimPreviewPositionRef.current = sourceProgress;
    queueEditorSeek(sourceProgress * duration, resumePlayback);
  }, [queueEditorSeek, timelineProgressToVideoProgress, videoDurationMs]);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [focusPoint, setFocusPoint] = useState(null);
  const [isLongPressMode, setIsLongPressMode] = useState(false);
  const [showZoomLabel, setShowZoomLabel] = useState(false);
  const [showCoverSelection, setShowCoverSelection] = useState(false);
  const [coverFramePosition, setCoverFramePosition] = useState(0);
  const [selectedCoverUri, setSelectedCoverUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingVideoId, setProcessingVideoId] = useState(null);
  const [allowHighQuality, setAllowHighQuality] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [brandedContent, setBrandedContent] = useState(false);
  const [saveToDeviceEnabled, setSaveToDeviceEnabled] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showMusicTrimmer, setShowMusicTrimmer] = useState(false);
  const [trimmerSong, setTrimmerSong] = useState<any>(null);
  const [showSoundDetail, setShowSoundDetail] = useState(false);
  const [soundDetailTab, setSoundDetailTab] = useState<'Videos'|'Users'>('Videos');
  const [isSoundDetailAudioPlaying, setIsSoundDetailAudioPlaying] = useState(false);
  const [playingGridVideoId, setPlayingGridVideoId] = useState<string | null>(null);
  const [soundFullScreenVideo, setSoundFullScreenVideo] = useState<any>(null);
  const [soundDetailPlaybackProgress, setSoundDetailPlaybackProgress] = useState(0);
  const [previewingSongId, setPreviewingSongId] = useState(null);
  const [itunesResults, setItunesResults] = useState<any[]>([]);
  const [itunesSearching, setItunesSearching] = useState(false);
  const [showBeautyPanel, setShowBeautyPanel] = useState(false);
  const [beautySmooth, setBeautySmooth] = useState(50);
  const [beautyBright, setBeautyBright] = useState(30);
  const [beautySlim, setBeautySlim] = useState(20);
  const [beautyEye, setBeautyEye] = useState(20);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [customSongs, setCustomSongs] = useState<any[]>([]);
  const [mastiAudioSongs, setMastiAudioSongs] = useState<any[]>([]);
  const [musicTab, setMusicTab] = useState('forYou');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerCountdown, setTimerCountdown] = useState(0);
  const countdownRef = useRef(null);
  const [activeDescTab, setActiveDescTab] = useState('Hashtags');
  const [showVideoPickerModal, setShowVideoPickerModal] = useState(false);

  const stopRecordingMusic = useCallback(async () => {
    const sound = recordingMusicSoundRef.current;
    recordingMusicSoundRef.current = null;
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch (_) {}
    try {
      await sound.unloadAsync();
    } catch (_) {}
  }, []);

  const prepareRecordingMusic = useCallback(async (song: any) => {
    if (!song?.audioUrl) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      let sound = recordingMusicSoundRef.current;
      if (!sound) {
        const created = await Audio.Sound.createAsync(
          { uri: song.audioUrl },
          {
            shouldPlay: false,
            isLooping: false,
            // A selected song should be audible immediately even though the
            // mixer volume starts at zero before its state effect runs.
            volume: musicVol > 0 ? musicVol / 100 : 0.7,
          },
        );
        sound = created.sound;
        recordingMusicSoundRef.current = sound;
      }

      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      const trimStartSeconds = Number(song.trimStart);
      const trimEndSeconds = Number(song.trimEnd);
      const startMs = Number.isFinite(trimStartSeconds)
        ? Math.max(0, trimStartSeconds * 1000)
        : 0;
      await sound.setPositionAsync(Math.min(startMs, status.durationMillis));

      sound.setOnPlaybackStatusUpdate((playbackStatus: any) => {
        if (!playbackStatus?.isLoaded) return;
        // MusicTrimmer stores trim bounds in seconds. Do not apply an end
        // bound when the song has never been trimmed.
        if (
          Number.isFinite(trimEndSeconds) &&
          trimEndSeconds > (Number.isFinite(trimStartSeconds) ? trimStartSeconds : 0) &&
          playbackStatus.positionMillis >= trimEndSeconds * 1000
        ) {
          sound?.pauseAsync().catch(() => {});
        }
      });
      await sound.playAsync();
    } catch (error) {
      console.warn('[Recording] Selected music could not start:', error);
      await stopRecordingMusic();
    }
  }, [musicVol, stopRecordingMusic]);

  // Preload the selected song while the camera is open so the first frame and
  // the music can begin together instead of waiting for a network download
  // after the record button has already been pressed.
  useEffect(() => {
    if (!showCamera || recordedVideoUri || !selectedSong?.audioUrl) return;
    let disposed = false;

    const preload = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
        });
        const created = await Audio.Sound.createAsync(
          { uri: selectedSong.audioUrl },
          {
            shouldPlay: false,
            isLooping: false,
            volume: 0.7,
          },
        );
        if (disposed || isRecordingRef.current || recordingMusicSoundRef.current) {
          await created.sound.unloadAsync();
          return;
        }
        await created.sound.setPositionAsync(
          Math.max(0, Number(selectedSong.trimStart || 0) * 1000),
        );
        recordingMusicSoundRef.current = created.sound;
      } catch (error) {
        if (!disposed) {
          console.warn('[Recording] Selected music preload failed:', error);
        }
      }
    };

    void preload();
    return () => {
      disposed = true;
      void stopRecordingMusic();
    };
  }, [
    recordedVideoUri,
    selectedSong?.audioUrl,
    selectedSong?.id,
    selectedSong?.trimStart,
    showCamera,
    stopRecordingMusic,
  ]);

  // Saved songs load onAuthStateChanged mein hota hai (per-user); yahan sirf save effect hai.
  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    if (savedSongsLoadedRef.current && uid) {
      AsyncStorage.setItem(`@masti_saved_songs_${uid}`, JSON.stringify(customSongs)).catch(() => {});
    }
  }, [customSongs]);

  // Masti Bash audio is shared across all users and remains available after
  // app restarts through a local cache while the remote list refreshes.
  useEffect(() => {
    let cancelled = false;
    const loadMastiAudio = async () => {
      try {
        const cached = await AsyncStorage.getItem(MASTI_AUDIO_CACHE_KEY);
        if (!cancelled && cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setMastiAudioSongs(parsed);
        }
      } catch (_) {
        // A stale or missing cache should never block the remote refresh.
      }

      try {
        const media = await getMastiAudios();
        const songs = media
          .filter((item) => item.fileUrl)
          .map((item) => ({
            id: `masti-audio-${item.id}`,
            title: item.originalName?.replace(/\.[^/.]+$/, '') || 'Masti Bash Audio',
            artist: item.artist || 'MastiBase',
            duration: item.duration
              ? `${Math.floor(item.duration / 60)}:${String(Math.floor(item.duration % 60)).padStart(2, '0')}`
              : '—',
            cover: item.posterUrl || item.thumbnailUrl || '',
            genre: item.genre || 'MastiBase',
            audioUrl: item.fileUrl,
            isMastiBashAudio: true,
          }));
        if (!cancelled) {
          setMastiAudioSongs(songs);
          AsyncStorage.setItem(MASTI_AUDIO_CACHE_KEY, JSON.stringify(songs)).catch(() => {});
        }
      } catch (error) {
        console.warn('[Sounds] Could not load Masti Bash audio:', error);
      }
    };

    loadMastiAudio();
    const refreshInterval = setInterval(loadMastiAudio, 30000);
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, []);

  // Upload processing animation refs
  const uploadPulseAnim = useRef(new Animated.Value(1)).current;
  const uploadGlowAnim  = useRef(new Animated.Value(0)).current;
  const uploadDotsAnim  = useRef(new Animated.Value(0)).current;

  // Refs for camera gestures
  const cameraZoomRef = useRef(0);
  const pinchInitialDistanceRef = useRef(0);
  const zoomLabelTimerRef = useRef(null);
  const pinchInitialZoomRef = useRef(0);
  const lastCameraTapRef = useRef(0);
  const focusTimerRef = useRef(null);
  const cameraFlipAnim = useRef(new Animated.Value(0)).current;
  const cameraFlipInProgressRef = useRef(false);
  const cameraPinchMovedRef = useRef(false);
  const cameraPinchEndRef = useRef(0);
  const cameraPinchActiveRef = useRef(false);
  const cameraSingleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Android double-back-to-exit refs (Home screen only) ──────────────────
  const backPressCountRef = useRef(0);
  const backPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const recordButtonResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,

    onPanResponderGrant: (evt) => {
      startY.current = evt.nativeEvent.pageY;
      startZoom.current = cameraZoomRef.current;

      pressStartTimeRef.current = Date.now();
      didDragRef.current = false;

      // Record whether we were already recording before this touch
      wasRecordingBeforePressRef.current = isRecordingRef.current;

      // First tap or hold -> Start recording
      if (!isRecordingRef.current) {
        startRecording();
      }
    },

    onPanResponderMove: (evt) => {
      const moveY = startY.current - evt.nativeEvent.pageY;

      if (Math.abs(moveY) > 5) {
        didDragRef.current = true;
      }

      // Instagram-style vertical zoom (1x–10x mapped to 0–1 native range)
      // Each pixel of drag = ~0.003 zoom units; smooth and responsive
      let zoom = startZoom.current + moveY * 0.008;
      zoom = Math.max(0, Math.min(1, zoom));

      cameraZoomRef.current = zoom;
      setCameraZoom(zoom);

      // Show zoom label while dragging
      if (zoomLabelTimerRef.current) clearTimeout(zoomLabelTimerRef.current);
      setShowZoomLabel(true);
      zoomLabelTimerRef.current = setTimeout(() => setShowZoomLabel(false), 1500);
    },

    onPanResponderRelease: () => {
      const wasDrag = didDragRef.current;

      if (!wasRecordingBeforePressRef.current && wasDrag) {
        // Press+hold+drag (zoom gesture, started recording this touch) → Instagram style: stop on release
        stopRecording();
      } else if (wasRecordingBeforePressRef.current && !wasDrag) {
        // Clean tap while already recording → tap-to-toggle stop
        stopRecording();
      }
      // Was already recording + drag → just zoomed, keep recording
      // First clean tap → keep recording (tap-to-toggle start)
    },

    onPanResponderTerminate: () => {
      // System took over gesture — reset zoom label but keep recording
      if (zoomLabelTimerRef.current) clearTimeout(zoomLabelTimerRef.current);
      setShowZoomLabel(false);
    },
  })
).current;

 // ─────────────────────────────────────────────────────────────────────────

const filteredVideos = useMemo(() => {
  const followedIdentities = new Set(
    [...followingUsers, ...followingUserAliases]
      .map(normalizedIdentity)
      .filter(Boolean),
  );
  const creatorIsFollowed = (creator: any) =>
    creator?.isFollowingCreator === true ||
    creator?.isFollowing === true ||
    getVideoOwnerIdentities(creator).some((identity) =>
      followedIdentities.has(identity),
    );
  const visibleVideos = videos.filter(v => {
    const isOwnVideo =
      normalizedIdentity(v.user || v.userId) === normalizedIdentity(userId);
    if (v.privacy === 'private') return isOwnVideo;
    if (v.privacy === 'friends') return isOwnVideo || creatorIsFollowed(v);
    return true;
  });
  if (activeTab) return visibleVideos.filter(creatorIsFollowed);
  return visibleVideos;
}, [activeTab, followingUserAliases, followingUsers, videos, userId]);

const playbackVideos = useMemo(() => {
  if (!profilePlaybackUserId && profilePlaybackVideoIds.length === 0) return filteredVideos;

  const videosById = new Map(videos.map(video => [video.id, video]));
  return profilePlaybackVideoIds
    .map(videoId => videosById.get(videoId))
    .filter(Boolean);
}, [filteredVideos, profilePlaybackUserId, profilePlaybackVideoIds, videos]);

useEffect(() => {
  if (!deepLinkVideoId || handledDeepLinkVideoIdRef.current === deepLinkVideoId) return;
  handledDeepLinkVideoIdRef.current = deepLinkVideoId;

  setShowChatScreen(false);
  setShowInbox(false);
  setIsProfile(false);
  setShowFriends(false);
  setShowSearch(false);
  setActiveTab(false);
  setProfilePlaybackUserId(null);
  setProfilePlaybackVideoIds([]);
  setPendingScrollVideoId(deepLinkVideoId);

  if (!videos.some(video => String(video.id) === deepLinkVideoId)) {
    void refetchBackendVideos();
  }
}, [deepLinkVideoId, refetchBackendVideos, videos]);

// Profile playback is its own feed context. It must never fall back to the
// global For You/Following list while a profile video is open.
const isProfilePlayback = profilePlaybackVideoIds.length > 0;

  const interstitialFrequency = Math.max(
    1,
    Math.floor(adsConfig?.interstitialFrequency ?? 4),
  );

  useEffect(() => {
    if (
      !adsConfig?.globalAdsEnabled ||
      (!adsConfig.testAdsEnabled && !adsConfig.interstitialAdUnitId.trim()) ||
      isProfilePlayback ||
      currentVideoIndex <= 0 ||
      currentVideoIndex % interstitialFrequency !== 0 ||
      lastInterstitialIndexRef.current === currentVideoIndex
    ) {
      return;
    }

    lastInterstitialIndexRef.current = currentVideoIndex;
    showInterstitial();
  }, [
    adsConfig,
    currentVideoIndex,
    interstitialFrequency,
    isProfilePlayback,
    showInterstitial,
  ]);

// Keep a short native-video buffer visible after connectivity drops. Once
// that buffer is exhausted, the active remote video switches to the same
// black offline state used by TikTok-like feeds.
useEffect(() => {
  const currentItem = playbackVideos[currentVideoIndex];
  if (!currentItem) return;
  const videoId = String(currentItem.id);

  if (feedConnectivity === 'offline') {
    if (
      !currentItem.localAsset &&
      feedVideoStartedRef.current[videoId] &&
      feedVideoStates[videoId] === 'ready'
    ) {
      scheduleOfflineVideoError(videoId);
    }
    return;
  }

  if (feedConnectivity === 'online') {
    clearOfflineVideoGraceTimer(videoId);
    if (!currentItem.localAsset && feedVideoStates[videoId] === 'error') {
      feedVideoEverReadyRef.current[videoId] = false;
      setFeedVideoStates((prev) => ({ ...prev, [videoId]: 'loading' }));
      setFeedVideoRetryKeys((prev) => ({ ...prev, [videoId]: (prev[videoId] || 0) + 1 }));
    }
  }
}, [
  clearOfflineVideoGraceTimer,
  currentVideoIndex,
  feedConnectivity,
  feedVideoStates,
  playbackVideos,
  scheduleOfflineVideoError,
]);

// Count a video once when it becomes the active item in this app session.
// The shared transaction makes that count visible live to other viewers.
useEffect(() => {
  const currentItem = playbackVideos[currentVideoIndex];
  if (!currentItem || showCamera || recordedVideoUri || isUploading) return;
  void incrementViewLive(
    currentItem.id,
    viewCounts[currentItem.id] ??
      currentItem.views ??
      currentItem.viewCount ??
      0,
  );
}, [
  currentVideoIndex,
  incrementViewLive,
  isUploading,
  playbackVideos,
  recordedVideoUri,
  showCamera,
  viewCounts,
]);

// ✅ Once a just-uploaded video actually appears in the (recomputed) feed list,
//    scroll straight to it so it's visible and starts playing automatically.
useEffect(() => {
  if (!pendingScrollVideoId) return;
  const idx = playbackVideos.findIndex(v => v.id === pendingScrollVideoId);
  if (idx === -1) return; // not in this list yet (e.g. tab hasn't switched) — wait for next recompute
  // The tab list can contain only one item during upload reconciliation.
  // Scrolling to a hard-coded index causes an out-of-range native exception.
  tabFlatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  requestAnimationFrame(() => {
    // Smooth forward scroll — the new video is right after the one being watched,
    // so it slides into view naturally instead of jumping to the top of the feed.
    // scrollToOffset avoids a native out-of-range exception while FlatList is
    // still reconciling its data after the optimistic upload insert.
    feedFlatListRef.current?.scrollToOffset({ offset: idx * height, animated: true });
    setCurrentVideoIndex(idx);
    setCurrentVideoItem(playbackVideos[idx]);
  });
  setPendingScrollVideoId(null);
}, [height, pendingScrollVideoId, playbackVideos]);

// ✅ Whenever the "current" video changes (swipe, tab switch, or a just-uploaded
//    video sliding into view), explicitly play it and pause every other loaded
//    video — don't rely solely on the `shouldPlay` prop reacting on its own.
//    isManuallyPaused check added: local updates to filteredVideos must NOT
//    override a user's intentional tap-to-pause.
useEffect(() => {
  if (showCamera || recordedVideoUri || isUploading) return;
  const currentItem = playbackVideos[currentVideoIndex];
  if (!currentItem) return;
  Object.entries(videoRefs.current).forEach(([id, ref]) => {
    if (!ref) return;
    const currentVideoIsReady = feedVideoStates[id] === 'ready';
    if (id === currentItem.id && currentVideoIsReady && !showSoundDetail) {
      // Only auto-play if user has NOT manually paused
      if (!isManuallyPaused) {
        ref.playAsync?.();
      }
    } else {
      ref.pauseAsync?.();
    }
  });
}, [currentVideoIndex, playbackVideos, showCamera, recordedVideoUri, isUploading, showSoundDetail, isManuallyPaused, feedVideoStates]);

// ── Camera open → immediately pause all videos + music ──────────────────
useEffect(() => {
  if (showCamera) {
    Object.values(videoRefs.current).forEach((ref: any) => {
      ref?.pauseAsync?.();
    });
    musicSoundRef.current?.pauseAsync?.().catch(() => {});
  }
}, [showCamera]);

useEffect(() => {
  Animated.loop(
    Animated.timing(spin, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: true,
    })
  ).start();
}, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
    ])).start();
    setTimeout(() => {
      setShowSplash(false);
      splashDoneRef.current = true;
      // Keep the public MastiBase feed visible to signed-out visitors.
      // Protected actions open the login sheet through requireAuth.
    }, 1800);
  }, []);

  const requestAndroidPermission = useCallback(async (
    permission: string,
    minimumAndroidVersion = 1,
    permissionLabel = 'required permission',
  ) => {
    const androidVersion = typeof Platform.Version === 'number'
      ? Platform.Version
      : Number(Platform.Version);
    if (Platform.OS !== 'android' || androidVersion < minimumAndroidVersion) return true;

    try {
      const alreadyGranted = await PermissionsAndroid.check(permission as never);
      if (alreadyGranted) return true;

      const result = await PermissionsAndroid.request(permission as never);
      if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

      const blockedForever = result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
      Alert.alert(
        `${permissionLabel} required`,
        blockedForever
          ? `${permissionLabel} ko Settings se Allow karein, tabhi camera open hoga.`
          : `${permissionLabel} Allow karein, tabhi camera open hoga.`,
        blockedForever
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
            ]
          : [{ text: 'OK' }],
      );
      return false;
    } catch (error) {
      console.warn(`Permission request failed for ${permission}:`, error);
      Alert.alert(
        'Permission required',
        `${permissionLabel} ka access nahi mil saka. Camera open nahi hoga.`,
      );
      return false;
    }
  }, []);

  const openCameraWithPermissions = useCallback(async () => {
    if (adsConfig?.isUploadAllowed === false) {
      Alert.alert('Uploads unavailable', 'Video uploads are temporarily disabled.');
      return;
    }
    if (
      remoteTheme?.cameraEngine &&
      remoteTheme.cameraEngine.toLowerCase() !== 'expo'
    ) {
      Alert.alert(
        'Camera unavailable',
        'This Expo Go build supports the Expo camera engine. Ask the admin to select Expo or install a native build with the Vision Camera module.',
      );
      return;
    }
    if (permissionFlowRunningRef.current) return;
    permissionFlowRunningRef.current = true;

    try {
      if (!cameraHasPermission) {
        const cameraResult = await requestCameraPermission();
        if (!cameraResult.granted) {
          Alert.alert(
            'Camera permission required',
            'Camera permission allow karein, tabhi video record ho payegi.',
          );
          return;
        }
      }

      if (!micHasPermission) {
        const micResult = await requestMicPermission();
        if (!micResult.granted) {
          Alert.alert(
            'Microphone permission required',
            'Microphone permission Allow karein, tabhi camera open hoga.',
          );
          return;
        }
      }

      let mediaPermission: { status: string } = { status: 'denied' };
      try {
        mediaPermission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      } catch (_) {
        // Expo Go on Android no longer supports MediaLibrary — treat as denied but don't crash
        mediaPermission = { status: 'denied' };
      }
      if (mediaPermission.status !== 'granted') {
        // Don't block camera in Expo Go where MediaLibrary is unavailable
        // Just continue — save-to-gallery will silently skip if not granted
      }

      if (Platform.OS === 'android') {
        const locationPermission = await Location.requestForegroundPermissionsAsync();
        if (!locationPermission.granted) {
          Alert.alert(
            'Location permission required',
            'Location permission Allow karein, tabhi camera open hoga.',
          );
          return;
        }

        const androidVersion = typeof Platform.Version === 'number'
          ? Platform.Version
          : Number(Platform.Version);
        const androidPermissions = [
          ...(androidVersion < 33
            ? [{ name: 'android.permission.READ_EXTERNAL_STORAGE', label: 'Storage permission', minVersion: 23 }]
            : []),
          ...(androidVersion < 29
            ? [{ name: 'android.permission.WRITE_EXTERNAL_STORAGE', label: 'Storage permission', minVersion: 23 }]
            : []),
          { name: 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED', label: 'Selected photos and videos permission', minVersion: 34 },
          { name: 'android.permission.ACCESS_MEDIA_LOCATION', label: 'Media location permission', minVersion: 29 },
          { name: 'android.permission.READ_MEDIA_IMAGES', label: 'Photos permission', minVersion: 33 },
          { name: 'android.permission.READ_MEDIA_VIDEO', label: 'Videos permission', minVersion: 33 },
          { name: 'android.permission.READ_MEDIA_AUDIO', label: 'Audio permission', minVersion: 33 },
          { name: 'android.permission.READ_CONTACTS', label: 'Contacts permission', minVersion: 23 },
          { name: 'android.permission.POST_NOTIFICATIONS', label: 'Notifications permission', minVersion: 33 },
          { name: 'android.permission.READ_PHONE_STATE', label: 'Phone permission', minVersion: 23 },
          { name: 'android.permission.READ_CALENDAR', label: 'Calendar permission', minVersion: 23 },
          { name: 'android.permission.WRITE_CALENDAR', label: 'Calendar permission', minVersion: 23 },
          { name: 'android.permission.ACCESS_FINE_LOCATION', label: 'Location permission', minVersion: 23 },
          { name: 'android.permission.BLUETOOTH_SCAN', label: 'Nearby devices permission', minVersion: 31 },
          { name: 'android.permission.BLUETOOTH_CONNECT', label: 'Nearby devices permission', minVersion: 31 },
        ];

        for (const permission of androidPermissions) {
          const granted = await requestAndroidPermission(
            permission.name,
            permission.minVersion,
            permission.label,
          );
          if (!granted) return;
        }
      }

      setShowCamera(true);
    } finally {
      permissionFlowRunningRef.current = false;
    }
  }, [
    cameraHasPermission,
    micHasPermission,
    adsConfig,
    remoteTheme?.cameraEngine,
    requestCameraPermission,
    requestMicPermission,
    requestAndroidPermission,
  ]);

  // A closed camera flow must always allow the next Plus tap to start fresh.
  useEffect(() => {
    if (!showCamera) {
      permissionFlowRunningRef.current = false;
    }
  }, [showCamera]);

  const requireAuth = useCallback((action: () => void) => {
    // isLoggedIn state ke saath actual current user bhi check karo
    // Isse login ke turant baad bhi action sahi se chalega (state update hone se pehle bhi)
    if (isLoggedIn || !!appAuth.currentUser) {
      action();
    } else {
      pendingActionRef.current = action;
      setShowLoginSheet(true);
    }
  }, [isLoggedIn]);

  // Auth state listener — sets isLoggedIn whenever the user changes
  useEffect(() => {
    const hadPendingGoogleRedirect = isGoogleRedirectPending();
    const unsub = onAuthStateChanged(appAuth, async (user) => {
      const hydrationVersion = ++authHydrationVersionRef.current;
      const qualityAuthVersion = ++videoQualityAuthVersionRef.current;
      profilePhotoSyncRetryRef.current = null;
      remoteFollowingStateRef.current.clear();
      // Stop all account-scoped writes while the next account is loading.
      hydratedProfileUidRef.current = null;
      setProfileImageUploadUri(null);
      profileImageBeforeUploadRef.current = null;
      setProfileImage('');
      setProfileImageSyncPending(false);
      authInitRef.current = true;
      // Local inbox entries are account-scoped. Clear them before hydrating a
      // different account so a previous account's activity cannot
      // flash in the next account's Inbox.
      setInboxActivities([]);
      setSyncedNotifs([]);
      syncedNotifsRef.current = [];
      setNotificationsLoadedForUid(null);
      setNotifUnreadCount(0);
      // Public feed browsing does not require sign-in. Protected actions
      // continue to open the login sheet through requireAuth.

      // A signed-out auth event must never fall back to the last UID on this
      // device. The account ID is the only account identity.
      if (!user?.uid) {
        hydratedProfileUidRef.current = null;
        setIsLoggedIn(false);
        setMastiVideoQuality(MASTI_VIDEO_DEFAULT_QUALITY);
        setUserId('@newuser');
        setMastiBaseUserId(null);
        setName('New User');
        setBio('');
        setProfileImage('');
        setProfileImageUploadUri(null);
        setProfileImageSyncPending(false);
        profileImageBeforeUploadRef.current = null;
        setYoutube('');
        setInstagram('');
        setFacebook('');
        setVideos([]);
        setFollowingUsers([]);
        setFollowersList([]);
        setOwnFollowers(0);
        setOwnFollowingCount(null);
        setLikedVideos({});
        setSavedVideos({});
        setPinnedVideos({});
        setDeletedVideoIds({});
        setDrafts([]);
        setCustomSongs([]);
        setVideoComments({});
        setShareCounts({});
        setSaveCounts({});
        setVideoThumbnailOverrides({});
        setVideoCoverPositions({});
        return;
      }

      const accountId = user.uid;
      setMastiVideoQuality(MASTI_VIDEO_DEFAULT_QUALITY);
      const qualityStorageKey = getMastiVideoQualityStorageKey(accountId);
      void AsyncStorage.getItem(qualityStorageKey)
        .then(async (savedQuality) => {
          if (
            qualityAuthVersion !== videoQualityAuthVersionRef.current ||
            appAuth.currentUser?.uid !== accountId
          ) {
            return;
          }
          if (isMastiVideoQuality(savedQuality)) {
            setMastiVideoQuality(savedQuality);
            return;
          }
          setMastiVideoQuality(MASTI_VIDEO_DEFAULT_QUALITY);
          await AsyncStorage.setItem(
            qualityStorageKey,
            MASTI_VIDEO_DEFAULT_QUALITY,
          );
        })
        .catch((error) => {
          console.warn("[VideoQuality] Could not load the account preference:", error);
        });
      const storageKey = `${PROFILE_STORAGE_PREFIX}${accountId}`;
      let savedThumbnailOverrides: Record<string, string> = {};
      let profileLoaded = false;
      try {
        // The full per-UID snapshot keeps local app state; the compact profile
        // record is merged separately so profile fields survive a large or
        // quota-limited snapshot.
        let saved: any = {};
        let raw: string | null = null;
        try {
          raw = await AsyncStorage.getItem(storageKey);
        } catch (error) {
          console.warn('[Profile] Full snapshot is unavailable; restoring compact profile backup:', error);
        }
        if (raw) {
          try { saved = JSON.parse(raw) ?? {}; } catch (_) {}
        }
        saved = mergeProfileCoreRecord(
          saved,
          await readProfileCoreRecord(accountId),
        );
         const thumbnailOverridesRaw = await AsyncStorage.getItem(
           `${VIDEO_THUMBNAIL_OVERRIDES_PREFIX}${accountId}`,
         );
         if (thumbnailOverridesRaw) {
           try {
             const parsed = JSON.parse(thumbnailOverridesRaw);
             if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
               savedThumbnailOverrides = Object.fromEntries(
                 Object.entries(parsed).filter(
                   ([key, value]) => typeof key === 'string' && typeof value === 'string' && value,
                 ),
               );
             }
           } catch (_) {}
         }
          let savedCoverPositions: Record<string, number> = {};
          const coverPositionsRaw = await AsyncStorage.getItem(
            `${VIDEO_COVER_POSITIONS_PREFIX}${accountId}`,
          );
          if (coverPositionsRaw) {
            try {
              const parsed = JSON.parse(coverPositionsRaw);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                savedCoverPositions = Object.fromEntries(
                  Object.entries(parsed).filter(
                    ([key, value]) => typeof key === 'string' && typeof value === 'number' && Number.isFinite(value),
                  ),
                );
              }
            } catch (_) {}
          }

        const { profile, usernameReassigned } = await loadOrCreateUserProfile(accountId, saved);
        const fs = profile as any;
        const value = (key: string, fallback: any) => {
          const serverValue = fs[key];
          if (serverValue === undefined || serverValue === null) return fallback;

          // A profile document may have been created before the first full
          // save completed. In that case the store contains empty defaults,
          // while the UID-scoped device snapshot already has the user's data.
          // Do not let those empty defaults erase the saved profile on login.
          if (Array.isArray(serverValue)) {
            return serverValue.length > 0 ||
              !Array.isArray(fallback) ||
              fallback.length === 0
              ? serverValue
              : fallback;
          }
          if (
            typeof serverValue === 'object' &&
            typeof fallback === 'object' &&
            serverValue !== null &&
            fallback !== null &&
            !Array.isArray(serverValue) &&
            !Array.isArray(fallback)
          ) {
            return Object.keys(serverValue).length > 0 ||
              Object.keys(fallback).length === 0
              ? serverValue
              : fallback;
          }
          const defaultUsername = `@user_${accountId.slice(0, 8)}`;
          if (
            (key === 'userId' || key === 'username') &&
            serverValue === defaultUsername &&
            typeof fallback === 'string' &&
            fallback.trim().length > 0 &&
            fallback !== defaultUsername
          ) {
            return fallback;
          }
          if (
            serverValue === '' &&
            typeof fallback === 'string' &&
            fallback.trim().length > 0
          ) {
            return fallback;
          }
          return serverValue;
        };
        const defaultHandle = defaultProfileHandle(accountId);
        const persistedHandleCandidates = [
          value('userId', undefined),
          value('username', undefined),
          saved.userId,
          saved.username,
        ]
          .map((candidate) => formatProfileHandle(candidate))
          .filter(
            (candidate) =>
              candidate !== defaultHandle &&
              !isPlaceholderProfileHandle(candidate),
          );
        const persistedUserId = usernameReassigned
          ? formatProfileHandle(profile.userId || defaultHandle)
          : persistedHandleCandidates[0] ||
            formatProfileHandle(profile.userId || defaultHandle);
        const persistedName = cleanDisplayName(value('name', saved.name ?? 'New User'));
        const persistedMastiBaseUserId = value('mastiBaseUserId', saved.mastiBaseUserId || null);
        // Logout/account switching can happen while the profile is loading.
        // Never apply the previous account's data after the account has changed.
        if (
          authHydrationVersionRef.current !== hydrationVersion ||
          appAuth.currentUser?.uid !== accountId
        ) return;

        setName(persistedName);
        setUserId(formatProfileHandle(persistedUserId));
        if (usernameReassigned) {
          Alert.alert(
            'Username already in use',
            `Your old username was claimed by another account. We gave you ${formatProfileHandle(persistedUserId)} instead.`,
          );
        }
        setMastiBaseUserId(persistedMastiBaseUserId);
        setIsVerified(value('isVerified', false) === true);
        setBio(value('bio', saved.bio ?? ''));
        const savedProfileImage = value('profileImage', saved.profileImage ?? '');
        let savedPendingProfileImage =
          typeof saved.profileImageUploadUri === 'string'
            ? saved.profileImageUploadUri
            : '';
        if (
          !savedPendingProfileImage &&
          savedProfileImage &&
          !/^https?:\/\//i.test(savedProfileImage)
        ) {
          savedPendingProfileImage = savedProfileImage;
        }
        if (savedPendingProfileImage && Platform.OS !== 'web' && savedPendingProfileImage.startsWith('data:')) {
          try {
            savedPendingProfileImage = await persistProfileImageLocally(
              savedPendingProfileImage,
              accountId,
            );
          } catch (error) {
            console.warn('[Profile] Could not restore the pending profile photo:', error);
          }
        }
        setProfileImageUploadUri(savedPendingProfileImage || null);
        profileImageBeforeUploadRef.current =
          savedPendingProfileImage
            ? (typeof saved.profileImageBeforeUpload === 'string'
                ? saved.profileImageBeforeUpload
                : '')
            : null;
        setProfileImage(
          savedPendingProfileImage
            ? savedPendingProfileImage
            : savedProfileImage,
        );
        const profileAvatarForPublicCache =
          savedPendingProfileImage || savedProfileImage;
        void rememberPublicProfileAvatar(profileAvatarForPublicCache, [
          persistedUserId,
          profile.userId,
          profile.username,
          persistedMastiBaseUserId,
          profile.mastiBaseUserId,
          profile.id,
        ]).then((cache) => {
          if (cache) setPublicProfileAvatarCache(cache);
        });
        setProfileImageSyncPending(profile.profileImageSyncPending === true);
        setYoutube(value('youtube', saved.youtube ?? ''));
        setInstagram(value('instagram', saved.instagram ?? ''));
        setFacebook(value('facebook', saved.facebook ?? ''));
        setFollowingUsers(value('following', saved.followingUsers ?? []));
        setOwnFollowers(
          typeof value('followersCount', undefined) === 'number'
            ? value('followersCount', 0)
            : (Array.isArray(value('followers', undefined)) ? value('followers', []).length : (saved.ownFollowers ?? 0)),
        );
        setLikedVideos(value('likedVideos', saved.likedVideos ?? {}));
        setSavedVideos(value('savedVideos', value('savedPosts', saved.savedVideos ?? {})));
        setPinnedVideos(value('pinnedVideos', saved.pinnedVideos ?? {}));
        setDeletedVideoIds(value('deletedVideoIds', saved.deletedVideoIds ?? {}));
        setVideoThumbnailOverrides(savedThumbnailOverrides);
        setVideoCoverPositions(savedCoverPositions);
        setDrafts(value('drafts', saved.drafts ?? []));
        setCustomSongs(value('customSongs', saved.customSongs ?? []));
        setVideoComments(value('videoComments', saved.videoComments ?? {}));
        setShareCounts(value('shareCounts', saved.shareCounts ?? {}));
        setSaveCounts(value('saveCounts', saved.saveCounts ?? {}));
        setInboxActivities(value('inboxActivities', saved.inboxActivities ?? []));
        if (Array.isArray(value('followers', undefined))) {
          setFollowersList(value('followers', []));
        }
        profileLoaded = true;
      } catch (error) {
        console.warn('[Profile] Could not restore saved profile:', error);
      } finally {
        if (
          authHydrationVersionRef.current !== hydrationVersion ||
          appAuth.currentUser?.uid !== accountId
        ) return;
        // A temporary store/AsyncStorage failure must not mark the profile
        // as hydrated. Otherwise the save effect can write the reset/default
        // React state back over the account's real data.
        if (!profileLoaded) {
          setIsLoggedIn(true);
          return;
        }
        hydratedProfileUidRef.current = accountId;
        // ── IMPORTANT: setIsLoggedIn ko profile load hone ke BAAD call karo ──
        // Pehle call karne se save-effect race condition hota tha jisme empty
        // profileImage saved DP ko overwrite kar deta tha (DP disappear bug)
        setIsLoggedIn(true);
      }
    });
    // Complete the mobile Google account-picker redirect after the auth
    // listener is attached. Closing the sheet here is important because the
    // redirect flow cannot call LoginBottomSheet's popup callback.
    void completeGoogleRedirectSignIn().then((result) => {
      if (result?.success) {
        setShowLoginSheet(false);
        setTimeout(() => {
          if (pendingActionRef.current) {
            pendingActionRef.current();
            pendingActionRef.current = null;
          }
        }, 350);
      } else if (result && !result.success) {
        setShowLoginSheet(true);
        console.warn('[Auth] Google redirect login failed:', result.error);
      } else if (hadPendingGoogleRedirect && !appAuth.currentUser) {
        // Google returned without a credential; show the sheet again only
        // after redirect completion has finished, never during the redirect.
        setShowLoginSheet(true);
      }
    });

    return () => unsub();
  }, []);

  // ── Live follows listeners ──────────────────────────────────────────────
  // 1) Mujhe koun follow karta hai (ownFollowers count + followersList)
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'follows'), where('followeeId', '==', userId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => d.data());
      setOwnFollowers(list.length);
      setFollowersList(list);
    });
    return () => unsub();
  }, [userId]);

  // 2) Main kisko follow karta hun (followingUsers array)
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'follows'), where('followerId', '==', userId));
    const unsub = onSnapshot(q, (snap) => {
      const ids = snap.docs.map(d => d.data().followeeId as string);
      setFollowingUsers((previous) => {
        const merged = new Map<string, string>();
        [...ids, ...previous].forEach((handle) => {
          const key = normalizedIdentity(handle);
          if (key) merged.set(key, handle);
        });
        remoteFollowingStateRef.current.forEach((status, key) => {
          if (status.isFollowing) merged.set(key, status.handle);
          else merged.delete(key);
        });
        return Array.from(merged.values());
      });
    });
    return () => unsub();
  }, [userId]);

  const selectedProfileLookupCandidates = selectedUser
    ? Array.from(new Set([
        selectedUser.profile?.email,
        selectedUser.email,
        selectedUser.profile?.mastiBaseUserId,
        selectedUser.mastiBaseUserId,
        selectedUser.backendUserId,
        selectedUser.profile?.id,
        selectedUser.profile?.firebaseUid,
        selectedUser.profile?.authUid,
        selectedUser.profile?.uid,
        selectedUser.firebaseUid,
        selectedUser.authUid,
        selectedUser.uid,
        selectedUser.profile?.username,
        selectedUser.username,
        selectedUser.userId,
        selectedUser.user,
      ].map((value) => String(value ?? '').trim()).filter(Boolean)))
    : [];
  const selectedProfileLookupKey = selectedProfileLookupCandidates.join('\u001f');

  // Public profile fields belong to MastiBase, not the viewer's local account.
  // Refresh them when another creator's profile opens so account B sees the
  // avatar and details account A saved, even when its feed video is stale.
  useEffect(() => {
    if (!isProfile || !selectedUser || selectedProfileLookupCandidates.length === 0) {
      return;
    }

    let cancelled = false;
    const targetIdentities = new Set(
      selectedProfileLookupCandidates.map(normalizedIdentity).filter(Boolean),
    );

    const hydratePublicProfile = async () => {
      for (const candidate of selectedProfileLookupCandidates) {
        let remoteProfile: any;
        try {
          remoteProfile = await lookupMastiBaseUser(candidate);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/not configured|HTTP (?:401|403|5\d\d)|failed to fetch|network request failed/i.test(message)) {
            console.warn('[Profile] Public profile refresh is unavailable:', error);
            break;
          }
          continue;
        }

        if (!remoteProfile) continue;
        if (cancelled) return;

        const remoteSocialLinks = remoteProfile.socialLinks ?? {};
        const remoteAvatar = normalizeMastiAvatarUrl(
          remoteProfile.avatarUrl ??
            remoteProfile.profileImage ??
            remoteProfile.profilePic ??
            remoteProfile.profilePicture ??
            remoteProfile.photoUrl ??
            remoteProfile.photoURL ??
            remoteProfile.profile?.avatarUrl ??
            remoteProfile.profile?.profileImage,
        );
        const remoteName = String(
          remoteProfile.name ?? remoteProfile.displayName ?? '',
        ).trim();
        const remoteHandle = String(
          remoteProfile.username ?? remoteProfile.userName ?? '',
        ).trim();
        const nextAvatarCache = remoteAvatar
          ? await rememberPublicProfileAvatar(remoteAvatar, [
              ...selectedProfileLookupCandidates,
              remoteProfile.id,
              remoteProfile.mastiBaseUserId,
              remoteProfile.username,
              remoteProfile.userName,
              remoteProfile.firebaseUid,
              remoteProfile.authUid,
              remoteProfile.uid,
            ])
          : null;
        if (cancelled) return;
        if (nextAvatarCache) setPublicProfileAvatarCache(nextAvatarCache);

        setSelectedUser((current: any) => {
          if (!current) return current;
          const currentIdentities = getVideoOwnerIdentities(current);
          if (!currentIdentities.some((identity) => targetIdentities.has(identity))) {
            return current;
          }
          const currentProfile = current.profile ?? {};

          const avatar = remoteAvatar || normalizeMastiAvatarUrl(
            currentProfile.avatarUrl ??
              currentProfile.profileImage ??
              current.profileImage ??
              current.avatarUrl ??
              current.profilePic,
          );
          const socialLinks = {
            ...(currentProfile.socialLinks ?? {}),
            ...(current.socialLinks ?? {}),
            ...remoteSocialLinks,
          };
          const bio = String(
            remoteProfile.bio ?? current.bio ?? currentProfile.bio ?? '',
          ).trim();
          const name = remoteName || current.name || currentProfile.name || '';

          return {
            ...current,
            user: remoteHandle || current.user || current.userId || current.username,
            userId: remoteHandle || current.userId || current.user || current.username,
            username: remoteHandle || current.username || current.userId || current.user,
            email: remoteProfile.email || current.email || currentProfile.email,
            backendUserId:
              remoteProfile.mastiBaseUserId ||
              remoteProfile.id ||
              current.backendUserId ||
              current.mastiBaseUserId,
            mastiBaseUserId:
              remoteProfile.mastiBaseUserId ||
              remoteProfile.id ||
              current.mastiBaseUserId ||
              current.backendUserId,
            name,
            bio,
            profileImage: avatar,
            avatarUrl: avatar,
            followers:
              remoteProfile.followersCount ??
              current.followers ??
              current.followersCount ??
              currentProfile.followersCount,
            followersCount:
              remoteProfile.followersCount ??
              current.followersCount ??
              currentProfile.followersCount,
            following:
              remoteProfile.followingCount ??
              current.following ??
              current.followingCount ??
              currentProfile.followingCount,
            followingCount:
              remoteProfile.followingCount ??
              current.followingCount ??
              currentProfile.followingCount,
            isVerified:
              typeof remoteProfile.isVerified === 'boolean'
                ? remoteProfile.isVerified
                : current.isVerified,
            instagram:
              remoteSocialLinks.instagram ||
              current.instagram ||
              currentProfile.socialLinks?.instagram ||
              '',
            youtube:
              remoteSocialLinks.youtube ||
              current.youtube ||
              currentProfile.socialLinks?.youtube ||
              '',
            facebook:
              remoteSocialLinks.facebook ||
              current.facebook ||
              currentProfile.socialLinks?.facebook ||
              '',
            socialLinks,
            profile: {
              ...currentProfile,
              ...remoteProfile,
              name,
              bio,
              avatarUrl: avatar,
              profileImage: avatar,
              socialLinks,
            },
          };
        });
        return;
      }
    };

    void hydratePublicProfile();
    return () => {
      cancelled = true;
    };
  }, [isProfile, selectedProfileLookupKey]);

  // Keep another user's profile follower/following totals live while the
  // profile is open. The follow documents use the same stable handle as the
  // follow button, so both devices see the same counts.
  useEffect(() => {
    if (!isProfile || !selectedUser) {
      setSelectedProfileCounts(null);
      return;
    }

    const targetUserId = String(
      selectedUser.user || selectedUser.userId || selectedUser.username || '',
    ).trim();
    if (!targetUserId || targetUserId === userId) {
      setSelectedProfileCounts(null);
      return;
    }

    setSelectedProfileCounts({ userId: targetUserId, followers: 0, following: 0 });
    const followersQuery = query(collection(db, 'follows'), where('followeeId', '==', targetUserId));
    const followingQuery = query(collection(db, 'follows'), where('followerId', '==', targetUserId));
    let followers = 0;
    let following = 0;

    const publishCounts = () => {
      setSelectedProfileCounts({ userId: targetUserId, followers, following });
    };
    const unsubscribeFollowers = onSnapshot(followersQuery, (snapshot) => {
      followers = snapshot.docs.length;
      publishCounts();
    }, () => publishCounts());
    const unsubscribeFollowing = onSnapshot(followingQuery, (snapshot) => {
      following = snapshot.docs.length;
      publishCounts();
    }, () => publishCounts());

    return () => {
      unsubscribeFollowers();
      unsubscribeFollowing();
    };
  }, [isProfile, selectedUser, userId]);

  const notificationActorLabel = (notification: any) => {
    const candidates = [
      notification?.fromUserName,
      notification?.username,
      notification?.userName,
      notification?.fromUserId,
    ];
    const label = candidates
      .map(value => String(value ?? '').trim())
      .find(value => value && !/^(new user|masti user|someone)$/i.test(value));
    return label || 'Masti user';
  };

  // Older notifications often contain only the actor ID and no avatar. Read
  // the actor's synced profile once and cache it so Inbox can still show the
  // real handle and DP without making a request on every poll.
  const hydrateNotificationActors = async (notifications: any[]) => {
    const socialTypes = new Set(['like', 'comment', 'share', 'save', 'follow']);
    const isTextMessage = (notification: any) => {
      const type = String(notification?.type ?? '').toLowerCase();
      return !socialTypes.has(type) && Boolean(notification?.title || notification?.message);
    };
    const actorIds = Array.from(new Set(
      notifications
        .filter(notification => !isTextMessage(notification))
        .flatMap(notification => [
          notification?.fromUserId,
          notification?.fromUserName,
        ])
        .map(value => String(value ?? '').trim())
        .filter(value =>
          value &&
          !/^(new user|masti user|someone)$/i.test(value) &&
          !value.startsWith('notification-'),
        ),
    ));

    await Promise.all(actorIds.map(async actorId => {
      const cacheKey = actorId.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(notificationActorCacheRef.current, cacheKey)) {
        return;
      }
      try {
        const profile = await getMastiBaseProfile(actorId);
        notificationActorCacheRef.current[cacheKey] = profile || {};
      } catch {
        // Cache misses as empty profiles to avoid retrying the same bad ID
        // every five seconds while the Inbox is open.
        notificationActorCacheRef.current[cacheKey] = {};
      }
    }));

    return notifications.map(notification => {
      const lookupIds = [
        notification?.fromUserId,
        notification?.fromUserName,
      ]
        .map(value => String(value ?? '').trim().toLowerCase())
        .filter(Boolean);
      const actorProfile = (isTextMessage(notification) ? [] : lookupIds)
        .map(id => notificationActorCacheRef.current[id])
        .find(profile => profile && Object.keys(profile).length > 0);
      if (!actorProfile) {
        return {
          ...notification,
          fromUserName: notificationActorLabel(notification),
        };
      }
      return {
        ...notification,
        fromUserName:
          actorProfile.userName ||
          actorProfile.username ||
          actorProfile.name ||
          notificationActorLabel(notification),
        fromProfilePic:
          actorProfile.avatarUrl ||
          notification.fromProfilePic ||
          '',
      };
    });
  };

  // Restore each account's Inbox snapshot before the remote poll starts. This
  // keeps received activity visible when the app is reopened offline.
  useEffect(() => {
    const accountUid = appAuth.currentUser?.uid;
    let cancelled = false;
    setNotificationsLoadedForUid(null);
    if (!accountUid) {
      setSyncedNotifs([]);
      syncedNotifsRef.current = [];
      setNotifUnreadCount(0);
      return () => {
        cancelled = true;
      };
    }

    const storageKey = `${INBOX_NOTIFICATIONS_STORAGE_PREFIX}${accountUid}`;
    AsyncStorage.getItem(storageKey)
      .then(raw => {
        if (cancelled || appAuth.currentUser?.uid !== accountUid) return;
        let cached: any[] = [];
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) cached = parsed;
        } catch {
          cached = [];
        }
        setSyncedNotifs(cached);
        syncedNotifsRef.current = cached;
        setNotifUnreadCount(
          getUnreadNotificationCounts(cached, [
            accountUid,
            appAuth.currentUser?.email,
            mastiBaseUserId,
            userId,
          ]).total,
        );
        setNotificationsLoadedForUid(accountUid);
      })
      .catch(error => {
        if (cancelled || appAuth.currentUser?.uid !== accountUid) return;
        console.warn('[MastiBase notification] local restore failed:', error);
        setNotificationsLoadedForUid(accountUid);
      });

    return () => {
      cancelled = true;
    };
  }, [appAuth.currentUser?.uid]);

  // Save both new activity and read state under the active account's UID.
  useEffect(() => {
    const accountUid = appAuth.currentUser?.uid;
    if (!accountUid || notificationsLoadedForUid !== accountUid) return;
    AsyncStorage.setItem(
      `${INBOX_NOTIFICATIONS_STORAGE_PREFIX}${accountUid}`,
      JSON.stringify(syncedNotifs),
    ).catch(error => {
      console.warn('[MastiBase notification] local save failed:', error);
    });
    setNotifUnreadCount(
      getUnreadNotificationCounts(syncedNotifs, [
        accountUid,
        appAuth.currentUser?.email,
        mastiBaseUserId,
        userId,
      ]).total,
    );
  }, [syncedNotifs, notificationsLoadedForUid, appAuth.currentUser?.uid, userId, mastiBaseUserId]);

  // ── Live MastiBase notifications listener ─────────────────────────────────
  useEffect(() => {
    const email = appAuth.currentUser?.email?.trim().toLowerCase();
    const authUid = appAuth.currentUser?.uid;
    if (authUid && notificationsLoadedForUid !== authUid) return;
    const unprefixedHandle = String(userId ?? '').trim().replace(/^@+/, '');
    const notificationOwnerIds = Array.from(new Set(
      [mastiBaseUserId, email, unprefixedHandle, authUid, userId]
        .filter(Boolean)
        .map(value => String(value)),
    ));
    if (notificationOwnerIds.length === 0) {
      setSyncedNotifs([]);
      syncedNotifsRef.current = [];
      setNotifUnreadCount(0);
      return;
    }
    let disposed = false;

    const refreshMastiBaseNotifications = async () => {
      const lists = await Promise.all(
        notificationOwnerIds.map(ownerId =>
          getMastiBaseNotifications(ownerId).catch(() => []),
        ),
      );
      if (disposed) return;

      const unique = new Map<string, any>();
      lists.flat().forEach((notification: any) => {
        const key = String(notification.id);
        if (!unique.has(key)) unique.set(key, notification);
      });
      const notifs = Array.from(unique.values())
        .sort((a, b) => {
          const aTime = Date.parse(String(a.createdAt ?? '')) || 0;
          const bTime = Date.parse(String(b.createdAt ?? '')) || 0;
          return bTime - aTime;
        })
        .map(notification => {
          const createdAt = notification.createdAt
            ? new Date(String(notification.createdAt))
            : null;
          return {
            ...notification,
            time: createdAt && !Number.isNaN(createdAt.getTime())
              ? formatNotifTime(createdAt)
              : 'now',
          };
        });
      const hydratedNotifs = await hydrateNotificationActors(notifs);
      if (disposed) return;
      const mergedNotifs = mergeInboxNotifications(
        hydratedNotifs,
        syncedNotifsRef.current,
      );
      syncedNotifsRef.current = mergedNotifs;
      setSyncedNotifs(mergedNotifs);
      setNotifUnreadCount(getUnreadNotificationCounts(mergedNotifs, [
        appAuth.currentUser?.uid,
        appAuth.currentUser?.email,
        mastiBaseUserId,
        userId,
      ]).total);
    };

    refreshMastiBaseNotifications();
    // MastiBase currently exposes notifications over REST, so use a short
    // foreground poll to make activity feel live across two signed-in users.
    const refreshTimer = setInterval(
      refreshMastiBaseNotifications,
      showInbox ? 5000 : 15000,
    );
    return () => {
      disposed = true;
      clearInterval(refreshTimer);
    };
  }, [userId, mastiBaseUserId, showInbox, appAuth.currentUser?.uid, notificationsLoadedForUid]);

  const markVisibleNotificationsRead = async () => {
    const accountUid = appAuth.currentUser?.uid;
    const currentNotifications = syncedNotifsRef.current;
    const unread = currentNotifications.filter(notification => !notification.read && notification.id);
    if (!accountUid || unread.length === 0) return;

    const unreadIds = new Set(unread.map(notification => String(notification.id)));
    const markedRead = currentNotifications.map(notification =>
      unreadIds.has(String(notification.id))
        ? { ...notification, read: true }
        : notification,
    );
    syncedNotifsRef.current = markedRead;
    setSyncedNotifs(markedRead);
    setNotifUnreadCount(getUnreadNotificationCounts(markedRead, [
      accountUid,
      appAuth.currentUser?.email,
      mastiBaseUserId,
      userId,
    ]).total);

    if (notificationsLoadedForUid === accountUid) {
      await AsyncStorage.setItem(
        `${INBOX_NOTIFICATIONS_STORAGE_PREFIX}${accountUid}`,
        JSON.stringify(markedRead),
      ).catch(error => {
        console.warn('[MastiBase notification] local read-state save failed:', error);
      });
    }
    await Promise.all(unread.map(notification =>
      markMastiBaseNotificationRead(String(notification.id)).catch(error => {
        console.warn('[MastiBase notification] mark-read failed:', error);
      }),
    ));
  };

  // Let the Inbox finish entering and show new rows briefly, then mark what
  // the user has seen. Notifications arriving later get their own animation
  // and read-state update; previously viewed entries stay in history.
  useEffect(() => {
    const accountUid = appAuth.currentUser?.uid;
    if (
      !showInbox ||
      !accountUid ||
      notificationsLoadedForUid !== accountUid ||
      !syncedNotifs.some(notification => !notification.read)
    ) {
      return;
    }
    const readTimer = setTimeout(() => {
      void markVisibleNotificationsRead();
    }, 1400);
    return () => clearTimeout(readTimer);
  }, [showInbox, syncedNotifs, notificationsLoadedForUid]);

  // Animate each unread notification once when the Inbox is visible. This
  // also catches unread activity restored after a full app restart.
  useEffect(() => {
    if (!showInbox) return;
    const unread = syncedNotifs
      .filter(notification => !notification.read && notification.id)
      .slice(0, 30);
    let addedAnimation = false;
    unread.forEach((notification, index) => {
      const id = String(notification.id);
      if (inboxRowAnimationsRef.current[id]) return;
      const animation = new Animated.Value(0);
      inboxRowAnimationsRef.current[id] = animation;
      addedAnimation = true;
      Animated.timing(animation, {
        toValue: 1,
        duration: 360,
        delay: index * 35,
        useNativeDriver: true,
      }).start();
    });
    if (addedAnimation) {
      setInboxRowAnimationVersion(version => version + 1);
    }
  }, [showInbox, syncedNotifs]);

  const formatNotifTime = (date: Date): string => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const resolveNotificationTarget = async (targetId: string) => {
    if (!targetId) return null;
    const currentUid = appAuth.currentUser?.uid;
    if (targetId === currentUid || targetId === userId) return null;
    // New video records carry the owner's account ID. Older records may
    // carry only @username, so resolve those to the owner's UID before
    // writing the notification.
    if (!targetId.startsWith('@')) return targetId;
    try {
      for (const field of ['userId', 'username']) {
        const ownerSnapshot = await getDocs(query(collection(db, 'users'), where(field, '==', targetId)));
        if (!ownerSnapshot.empty) return ownerSnapshot.docs[0].id;
      }
    } catch (_) {}
    return targetId;
  };

  const videoOwnerId = (item: any) =>
    item?.accountId || item?.ownerAccountId || item?.creatorAccountId || item?.ownerId || item?.user;

  const isVideoOwnedByCurrentUser = (item: any) => {
    const currentUid = appAuth.currentUser?.uid;
    const currentEmail = appAuth.currentUser?.email?.trim().toLowerCase();
    return !!item && (
      (currentUid && (
        item.accountId === currentUid ||
        item.ownerAccountId === currentUid ||
        item.creatorAccountId === currentUid ||
        item.ownerId === currentUid
      )) ||
      (currentEmail && (
        item.accountId === currentEmail ||
        item.ownerEmail === currentEmail ||
        item.profile?.email === currentEmail
      )) ||
      (mastiBaseUserId && (
        String(item.backendUserId ?? '') === String(mastiBaseUserId) ||
        String(item.profile?.mastiBaseUserId ?? '') === String(mastiBaseUserId)
      )) ||
      item.user === userId ||
      item.userId === userId
    );
  };

  const addLocalOwnerActivity = (item: any, activity: any) => {
    // The actor must not see someone else's activity in their own inbox.
    // Only add local activity when this account owns the video.
    if (isVideoOwnedByCurrentUser(item)) {
      setInboxActivities(prev => [activity, ...prev]);
    }
  };

  const sendNotification = async (targetId: string, payload: Record<string, any>) => {
    const targetUserId = String(targetId ?? '').trim();
    const currentIds = [
      appAuth.currentUser?.uid,
      appAuth.currentUser?.email?.trim().toLowerCase(),
      mastiBaseUserId,
      userId,
    ].filter(Boolean).map(value => String(value));
    if (!targetUserId || currentIds.includes(targetUserId)) return;

    const actorId = appAuth.currentUser?.email?.trim().toLowerCase() || userId || '@you';
    // Inbox should identify the actor by their stable handle, not the
    // editable display name (which may still be "New User").
    const actorName = userId || name || 'Someone';
    const type = String(payload.type || 'activity');
    const title = payload.title || (
      type === 'like' ? `${actorName} liked your video` :
      type === 'comment' ? `${actorName} commented on your video` :
      type === 'share' ? `${actorName} shared your video` :
      type === 'save' ? `${actorName} saved your video` :
      type === 'follow' ? `${actorName} started following you` :
      'New activity'
    );
    const message = payload.message || (
      type === 'comment' && payload.comment
        ? String(payload.comment)
        : `${actorName} interacted with your profile.`
    );

    try {
      await createMastiBaseNotification({
        userId: targetUserId,
        title,
        message,
        type,
        fromUserId: actorId,
        fromUserName: userId || actorName,
        fromProfilePic: profileImage || '',
        videoId: payload.videoId,
        comment: payload.comment,
      });
    } catch (error) {
      console.warn('[MastiBase notification] create failed:', error);
    }
  };

  const addVideoActivityForOwner = (item: any, type: 'like' | 'comment' | 'share' | 'save', extra: Record<string, any> = {}) => {
    const activity = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      userId: userId || '@you',
      profilePic: profileImage || '',
      videoId: item?.id,
      time: 'now',
      ...extra,
    };
    addLocalOwnerActivity(item, activity);
    return activity;
  };

  const notifyVideoOwner = async (item: any, type: 'like' | 'comment' | 'share' | 'save', extra: Record<string, any> = {}) => {
    if (!item?.id) return;
    const ownerNotificationId =
      item?.backendUserId ||
      item?.profile?.mastiBaseUserId ||
      item?.profile?.id ||
      item?.ownerEmail ||
      item?.userEmail ||
      item?.profile?.email ||
      item?.profile?.username ||
      item?.profile?.userName ||
      videoOwnerId(item);
    await sendNotification(ownerNotificationId, {
      type,
      videoId: item.id,
      ...extra,
    });
  };

  // Notification payloads from older MastiBase records may not contain the
  // actor avatar. Resolve it from the current profile/video cache so Inbox
  // still shows the user's DP for every activity type.
  const resolveActivityProfilePic = (activity: any) => {
    const actorIds = [
      activity?.actorId,
      activity?.userId,
      activity?.fromUserId,
      activity?.userName,
    ]
      .filter(Boolean)
      .map(value => String(value).trim().toLowerCase());
    const currentIds = [
      appAuth.currentUser?.uid,
      appAuth.currentUser?.email,
      mastiBaseUserId,
      userId,
    ]
      .filter(Boolean)
      .map(value => String(value).trim().toLowerCase());

    if (activity?.profilePic) return String(activity.profilePic);
    if (actorIds.some(id => currentIds.includes(id))) return profileImage || '';

    const actorVideo = videos.find((video: any) => {
      const videoIds = [
        video?.user,
        video?.userId,
        video?.accountId,
        video?.backendUserId,
        video?.ownerId,
        video?.ownerEmail,
        video?.profile?.id,
        video?.profile?.email,
        video?.profile?.userId,
        video?.profile?.username,
        video?.profile?.userName,
        video?.profile?.mastiBaseUserId,
      ]
        .filter(Boolean)
        .map(value => String(value).trim().toLowerCase());
      return actorIds.some(id => videoIds.includes(id));
    });

    return (
      actorVideo?.profileImage ||
      actorVideo?.userAvatar ||
      actorVideo?.profile?.avatarUrl ||
      actorVideo?.profile?.profileImage ||
      ''
    );
  };

  // Keep the signed-in account's profile and local social state across app
  // restarts. The account ID keeps different accounts isolated on one phone.
  useEffect(() => {
    const uid = hydratedProfileUidRef.current;
    const accountId = appAuth.currentUser?.uid;
    if (!isLoggedIn || !uid || uid !== accountId) return;
    const snapshot = {
      accountId: uid,
      username: userId,
      name,
      userId,
      profileImageSyncPending,
      mastiBaseUserId,
      isVerified,
      bio,
      profileImage,
      profileImageUploadUri,
      profileImageBeforeUpload: profileImageUploadUri
        ? profileImageBeforeUploadRef.current || ''
        : null,
      youtube,
      instagram,
      facebook,
      posts: videos.filter((v: any) =>
        v?.user === userId ||
        v?.userId === userId ||
        v?.accountId === uid ||
        v?.backendUserId === mastiBaseUserId,
      ),
      reels: videos.filter((v: any) =>
        v?.user === userId ||
        v?.userId === userId ||
        v?.accountId === uid ||
        v?.backendUserId === mastiBaseUserId,
      ),
      videos: videos.filter((v: any) =>
        v?.user === userId ||
        v?.userId === userId ||
        v?.accountId === uid ||
        v?.backendUserId === mastiBaseUserId,
      ),
      uploadedContent: videos.filter((v: any) =>
        v?.user === userId ||
        v?.userId === userId ||
        v?.accountId === uid ||
        v?.backendUserId === mastiBaseUserId,
      ),
      likedVideos,
      likes: likedVideos,
      savedVideos,
      savedPosts: savedVideos,
      pinnedVideos,
      deletedVideoIds,
      drafts,
      customSongs,
      videoComments,
      shareCounts,
      saveCounts,
      inboxActivities,
      followers: followersList,
      followersCount: ownFollowers,
      followingUsers,
      ownFollowers,
      following: followingUsers,
    };
    // Local cache (device storage)
    AsyncStorage.setItem(`${PROFILE_STORAGE_PREFIX}${uid}`, JSON.stringify(snapshot))
      .catch(error => console.warn('[Profile] Could not save profile:', error));
    // ── Instagram/TikTok style: local store mein bhi save karo ───────────────
    // Isse koi bhi user ka DP aur data logout ke baad bhi hamesha ke liye save rahega
    setDoc(doc(db, 'users', accountId), {
      ...snapshot,
      accountId,
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }, [
    isLoggedIn,
    name,
    userId,
    bio,
    isVerified,
    profileImage,
    profileImageUploadUri,
    profileImageSyncPending,
    youtube,
    instagram,
    facebook,
    followingUsers,
    ownFollowers,
    followersList,
    likedVideos,
    savedVideos,
    pinnedVideos,
    deletedVideoIds,
    drafts,
    customSongs,
    videoComments,
    shareCounts,
    saveCounts,
    inboxActivities,
    videos,
  ]);

  // ── Music preview playback ──
  // Jab bhi previewingSongId badalta hai, uss song ka audio play/stop karo
  useEffect(() => {
    let mounted = true;
    const loadAndPlay = async () => {
      // Pehle purana sound band karo
      if (musicSoundRef.current) {
        try {
          await musicSoundRef.current.stopAsync();
          await musicSoundRef.current.unloadAsync();
        } catch (_) {}
        musicSoundRef.current = null;
      }
      if (!previewingSongId) return;

      const allSongs = [...(mastiAudioSongs || []), ...(customSongs || []), ...SONGS_LIST, ...itunesResults];
      const song = allSongs.find(s => s.id === previewingSongId);
      if (!song?.audioUrl) return;

      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync(
          { uri: song.audioUrl },
          { shouldPlay: true, isLooping: false, volume: 1.0 }
        );
        if (!mounted) { sound.unloadAsync(); return; }
        musicSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) setPreviewingSongId(null);
        });
      } catch (err) {
        console.log('Music preview error:', err);
      }
    };
    loadAndPlay();
    return () => {
      mounted = false;
      if (musicSoundRef.current) {
        musicSoundRef.current.stopAsync().catch(() => {});
        musicSoundRef.current.unloadAsync().catch(() => {});
        musicSoundRef.current = null;
      }
    };
  }, [previewingSongId, mastiAudioSongs, customSongs, itunesResults]);

  // ── Jab selectedSong set ho, musicVol auto-set karo 70 agar abhi 0 hai ──
  useEffect(() => {
    if (selectedSong && musicVol === 0) {
      setMusicVol(70);
    }
    // Naya song add hone par auto-play shuru karo mixer mein
    if (selectedSong) {
      setMixPanelPlaying(true);
    }
    // Jab mix panel close ho ya song hata do, playing band karo
    if (!selectedSong) {
      setMixPanelPlaying(false);
      setPreviewingSongId(null);
    }
  }, [selectedSong]);

  // ── Mix panel play/pause control ──
  // Sirf tab preview play karo jab mix panel khula ho (showMixAudio=true).
  // Jab user feed pe ho aur panel band ho, song bilkul na baje.
  useEffect(() => {
    if (mixPanelPlaying && selectedSong && showMixAudio) {
      setPreviewingSongId(selectedSong.id);
    } else {
      setPreviewingSongId(null);
    }
  }, [mixPanelPlaying, showMixAudio]);

  // ── Ring sound helpers ───────────────────────────────────────────────────
  const stopRingSound = useCallback(async () => {
    if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
    try {
      if (ringSoundRef.current) {
        await ringSoundRef.current.stopAsync();
        await ringSoundRef.current.unloadAsync();
        ringSoundRef.current = null;
      }
    } catch (_) {}
  }, []);

  const playRingSound = useCallback(async () => {
    await stopRingSound();
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/sfx/preview/mixkit-iphone-classic-ringtone-951.mp3' },
        { isLooping: true, volume: 1.0 }
      );
      ringSoundRef.current = sound;
      await sound.playAsync();
    } catch (_) {}
    const pulse = () => {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (_) {}
      setTimeout(() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {} }, 350);
    };
    pulse();
    ringIntervalRef.current = setInterval(pulse, 2200);
  }, [stopRingSound]);

  // Route the live WebView call audio through the speaker or earpiece on
  // Android. The WebView owns the media tracks, but Expo owns the device
  // output route.
  useEffect(() => {
    if (!showAudioCall && !showVideoCall) return;
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      ...(Platform.OS === 'android'
        ? { shouldRouteThroughEarpiece: !callSpeaker }
        : {}),
    }).catch(() => {});
  }, [callSpeaker, showAudioCall, showVideoCall]);

  // ── Incoming call detection via the shared API ────────────────────────────
  // Firestore/localStore calls were only visible to one app data store. Polling
  // the API keeps the ringing call and WebRTC signaling on the same server for
  // two devices using different accounts.
  useEffect(() => {
    // Both devices use Firebase email when available, otherwise the exact
    // Firebase UID, so the callee can find the caller's ringing record.
    const myId = chatIdentity({
      authUid: appAuth.currentUser?.uid,
      email: appAuth.currentUser?.email,
      mastiBaseUserId,
      userId,
    }) || null;
    if (!myId || myId === 'guest') return;
    let disposed = false;
    const pollIncomingCalls = async () => {
      if (disposed || showAudioCall || showVideoCall || showIncomingCall) return;
      try {
        const calls = await getIncomingCalls(myId);
        const incoming = calls[0];
        if (!incoming || disposed) return;
        const blocked = await isUserBlocked(incoming.callerId, currentAccountId());
        if (blocked) {
          await updateCall(incoming.id, { status: 'blocked' }).catch(() => {});
          return;
        }
        setIncomingCallId(incoming.id);
        setIncomingCallKind(incoming.kind);
        setIncomingCallUser({
          id: incoming.callerId,
          name: incoming.callerName || 'Unknown User',
          emoji: '📞',
          avatar: incoming.callerAvatar || 'https://i.pravatar.cc/300?img=1',
          isOnline: true,
          lastMsg: '',
          time: '',
        });
        setShowIncomingCall(true);
        void playRingSound();
      } catch (_) {
        // The API may be briefly unavailable while the server restarts.
      }
    };
    void pollIncomingCalls();
    // Poll often enough for incoming calls without keeping the network and
    // JS thread busy while the feed is scrolling.
    const timer = setInterval(() => { void pollIncomingCalls(); }, 3000);
    return () => {
      disposed = true;
      clearInterval(timer);
      if (incomingCallUnsubRef.current) {
        incomingCallUnsubRef.current();
        incomingCallUnsubRef.current = null;
      }
    };
  }, [
    currentAccountId,
    isUserBlocked,
    mastiBaseUserId,
    userId,
    showAudioCall,
    showVideoCall,
    showIncomingCall,
    playRingSound,
  ]);

  // ── iTunes live search — user ke type karne par real songs fetch karo ──
  useEffect(() => {
    const q = musicSearchQuery.trim();
    if (q.length < 2) { setItunesResults([]); setItunesSearching(false); return; }
    setItunesSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=30&country=in`
        );
        const data = await res.json();
        const mapped = (data.results || [])
          .filter((r: any) => r.previewUrl)
          .map((r: any) => ({
            id: 'itunes_' + r.trackId,
            title: r.trackName,
            artist: r.artistName,
            duration: r.trackTimeMillis
              ? Math.floor(r.trackTimeMillis / 60000) + ':' + String(Math.floor((r.trackTimeMillis % 60000) / 1000)).padStart(2, '0')
              : '—',
            cover: (r.artworkUrl100 || r.artworkUrl60 || '').replace('100x100', '200x200'),
            genre: r.primaryGenreName || 'Music',
            audioUrl: r.previewUrl,
            isItunes: true,
          }));
        setItunesResults(mapped);
      } catch (e) {
        setItunesResults([]);
      } finally {
        setItunesSearching(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [musicSearchQuery]);

  // Show the same circular loading treatment while Search results settle,
  // including when the query changes.
  useEffect(() => {
    if (searchLoadingTimerRef.current) {
      clearTimeout(searchLoadingTimerRef.current);
      searchLoadingTimerRef.current = null;
    }
    if (!showSearch) {
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchLoadingTimerRef.current = setTimeout(() => {
      setSearchLoading(false);
      searchLoadingTimerRef.current = null;
    }, 650);
    return () => {
      if (searchLoadingTimerRef.current) {
        clearTimeout(searchLoadingTimerRef.current);
        searchLoadingTimerRef.current = null;
      }
    };
  }, [showSearch, searchQuery]);

  // Search creators, videos and hashtags from the live MastiBase index.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!showSearch || query.length < 2) {
      setRemoteSearchUsers([]);
      setRemoteSearchVideos([]);
      setRemoteSearchHashtags([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchMastiBase(query, 'all');
        if (cancelled) return;
        setRemoteSearchUsers(results.users.map((profile) => {
          const resolvedId =
            profile.username ||
            profile.userName ||
            profile.userId ||
            profile.mastiBaseUserId ||
            query;
          return {
            user: resolvedId,
            userId: resolvedId,
            name: profile.name || profile.username || profile.userName || resolvedId,
            profileImage: profile.avatarUrl || profile.profileImage || '',
            videoCount: 0,
            backendUserId: profile.mastiBaseUserId || profile.id,
            email: profile.email,
            profile,
          };
        }));
        setRemoteSearchVideos(results.videos);
        setRemoteSearchHashtags(results.hashtags);
      } catch (_) {
        if (!cancelled) {
          setRemoteSearchUsers([]);
          setRemoteSearchVideos([]);
          setRemoteSearchHashtags([]);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, showSearch]);

  // Sounds has local categories as well as live search results, so show a
  // short circular loading state when the picker opens or its category changes.
  useEffect(() => {
    if (musicModalLoadingTimerRef.current) {
      clearTimeout(musicModalLoadingTimerRef.current);
      musicModalLoadingTimerRef.current = null;
    }
    if (!showMusicModal) {
      setMusicModalLoading(false);
      return;
    }
    setMusicModalLoading(true);
    musicModalLoadingTimerRef.current = setTimeout(() => {
      setMusicModalLoading(false);
      musicModalLoadingTimerRef.current = null;
    }, 650);
    return () => {
      if (musicModalLoadingTimerRef.current) {
        clearTimeout(musicModalLoadingTimerRef.current);
        musicModalLoadingTimerRef.current = null;
      }
    };
  }, [showMusicModal, musicTab]);

  // Followers and Following are both backed by live account data. Keep their
  // list area in a loading state briefly whenever either modal opens.
  useEffect(() => {
    if (followersModalLoadingTimerRef.current) {
      clearTimeout(followersModalLoadingTimerRef.current);
      followersModalLoadingTimerRef.current = null;
    }
    if (!showFollowers && !showFollowing) {
      setFollowersModalLoading(false);
      return;
    }
    setFollowersModalLoading(true);
    followersModalLoadingTimerRef.current = setTimeout(() => {
      setFollowersModalLoading(false);
      followersModalLoadingTimerRef.current = null;
    }, 650);
    return () => {
      if (followersModalLoadingTimerRef.current) {
        clearTimeout(followersModalLoadingTimerRef.current);
        followersModalLoadingTimerRef.current = null;
      }
    };
  }, [showFollowers, showFollowing]);

  // Apply the circular treatment to the other search fields used throughout
  // the app, not just the main Search screen.
  useEffect(() => {
    if (shareSearchLoadingTimerRef.current) {
      clearTimeout(shareSearchLoadingTimerRef.current);
      shareSearchLoadingTimerRef.current = null;
    }
    if (!showShare) {
      setShareSearchLoading(false);
      return;
    }
    setShareSearchLoading(true);
    shareSearchLoadingTimerRef.current = setTimeout(() => {
      setShareSearchLoading(false);
      shareSearchLoadingTimerRef.current = null;
    }, 500);
    return () => {
      if (shareSearchLoadingTimerRef.current) {
        clearTimeout(shareSearchLoadingTimerRef.current);
        shareSearchLoadingTimerRef.current = null;
      }
    };
  }, [showShare, shareSearchQuery]);

  useEffect(() => {
    if (tagSearchLoadingTimerRef.current) {
      clearTimeout(tagSearchLoadingTimerRef.current);
      tagSearchLoadingTimerRef.current = null;
    }
    if (!showTagPeopleModal) {
      setTagSearchLoading(false);
      return;
    }
    setTagSearchLoading(true);
    tagSearchLoadingTimerRef.current = setTimeout(() => {
      setTagSearchLoading(false);
      tagSearchLoadingTimerRef.current = null;
    }, 500);
    return () => {
      if (tagSearchLoadingTimerRef.current) {
        clearTimeout(tagSearchLoadingTimerRef.current);
        tagSearchLoadingTimerRef.current = null;
      }
    };
  }, [showTagPeopleModal, tagSearchText]);

  useEffect(() => {
    if (friendsLoadingTimerRef.current) {
      clearTimeout(friendsLoadingTimerRef.current);
      friendsLoadingTimerRef.current = null;
    }
    if (!showFriends) {
      setFriendsLoading(false);
      return;
    }
    setFriendsLoading(true);
    friendsLoadingTimerRef.current = setTimeout(() => {
      setFriendsLoading(false);
      friendsLoadingTimerRef.current = null;
    }, 650);
    return () => {
      if (friendsLoadingTimerRef.current) {
        clearTimeout(friendsLoadingTimerRef.current);
        friendsLoadingTimerRef.current = null;
      }
    };
  }, [showFriends]);

  useEffect(() => {
    if (!showFriends || friendUsers.length === 0) return;

    const peerIds = friendUsers
      .map(peer => messagingIdentity(peer))
      .filter(Boolean)
      .slice(0, 100);
    let disposed = false;
    let inFlight = false;

    const refreshFriendActivity = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      try {
        const response = await getFriendActivity({ peerIds });
        if (!disposed) {
          setFriendActivity(
            Object.fromEntries(
              response.activities.map((activity) => [activity.peerId, activity]),
            ),
          );
        }
      } catch (error) {
        if (!disposed) {
          console.warn('[Friends] Activity sync unavailable:', error);
        }
      } finally {
        inFlight = false;
      }
    };

    void refreshFriendActivity();
    const timer = setInterval(() => {
      void refreshFriendActivity();
    }, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [friendUsers, showFriends]);

  useEffect(() => {
    if (chatLoadingTimerRef.current) {
      clearTimeout(chatLoadingTimerRef.current);
      chatLoadingTimerRef.current = null;
    }
    if (!showChatScreen) {
      setChatLoading(false);
      return;
    }
    setChatLoading(true);
    chatLoadingTimerRef.current = setTimeout(() => {
      setChatLoading(false);
      chatLoadingTimerRef.current = null;
    }, 650);
    return () => {
      if (chatLoadingTimerRef.current) {
        clearTimeout(chatLoadingTimerRef.current);
        chatLoadingTimerRef.current = null;
      }
    };
  }, [showChatScreen, chatUser?.id]);

  // Keep a visible circular loading state for every Inbox filter, including
  // the first render after opening Inbox.
  useEffect(() => {
    if (inboxFilterLoadingTimerRef.current) {
      clearTimeout(inboxFilterLoadingTimerRef.current);
      inboxFilterLoadingTimerRef.current = null;
    }

    if (!showInbox) {
      setInboxFilterLoading(false);
      return;
    }

    setInboxFilterLoading(true);
    inboxFilterLoadingTimerRef.current = setTimeout(() => {
      setInboxFilterLoading(false);
      inboxFilterLoadingTimerRef.current = null;
    }, 900);

    return () => {
      if (inboxFilterLoadingTimerRef.current) {
        clearTimeout(inboxFilterLoadingTimerRef.current);
        inboxFilterLoadingTimerRef.current = null;
      }
    };
  }, [showInbox, inboxFilter]);

  // ─── Pull-to-Refresh hook for home feed (declared here to avoid TDZ in useEffect below) ──
  const homeRefreshAsync = useCallback(async () => {
    // minimum 900ms so the spinning indicator is visibly seen
    const [refreshResult] = await Promise.all([
      refetchBackendVideos(),
      new Promise(r => setTimeout(r, 900)),
    ]);
    if (refreshResult.isError) {
      console.warn('[Feed] Manual refresh unavailable; keeping local videos:', refreshResult.error);
    } else {
      console.log('[Feed] Manual refresh succeeded');
    }
    const shuffled = [...videos].sort(() => Math.random() - 0.5);
    setVideos(shuffled);
    setCurrentVideoIndex(0);
    setCurrentVideoItem(shuffled[0]);
    feedFlatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [videos, refetchBackendVideos]);
  const homePTR = usePullToRefresh(homeRefreshAsync);

  // Use the same lightweight return path for every screen. Returning Home
  // should resume the current feed, not refresh/shuffle it like a pull-to-
  // refresh; refreshing here makes the feed remount and delays playback.
  const restoreHomeFeed = useCallback(() => {
    setShowCamera(false);
    setRecordingFlowStep(null);
    setRecordedVideoUri(null);
    setShowChatScreen(false);
    setShowFollowers(false);
    setShowFollowing(false);
    setShowInbox(false);
    setShowFriends(false);
    setShowSearch(false);
    setShowSoundDetail(false);
    setIsProfile(false);
    setSelectedUser(null);
    setProfilePlaybackUserId(null);
    setProfilePlaybackVideoIds([]);
    setShareOpenedFromProfile(false);
    setIsManuallyPaused(false);
    isManuallyPausedRef.current = false;

    const nextIndex = playbackVideos.length > 0
      ? Math.min(currentVideoIndex, playbackVideos.length - 1)
      : 0;
    setCurrentVideoIndex(nextIndex);
    setCurrentVideoItem(playbackVideos[nextIndex] || null);

    requestAnimationFrame(() => {
      feedFlatListRef.current?.scrollToOffset({
        offset: nextIndex * height,
        animated: false,
      });
      const item = playbackVideos[nextIndex];
      if (item?.id) {
        safeMediaCall(videoRefs.current[item.id], 'playAsync');
      }
    });
  }, [currentVideoIndex, height, playbackVideos]);

  // ── Android Hardware Back Button Navigation ──────────────────────────────
  // Instagram-style: every screen goes back exactly one level.
  // Home screen: first press refreshes feed + shows toast; second press within
  // 2 s exits the app; after 2 s the timer resets.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = (): boolean => {
      // ── 1. Active call screens – block back to prevent accidental exit ──
      if (showIncomingCall || showAudioCall || showVideoCall) return true;

      // ── 2. Search Music (Music Trimmer) → Add Music (Music Modal) ──────
      if (showMusicTrimmer) {
        setShowMusicTrimmer(false);
        setShowMusicModal(true);
        return true;
      }

      // ── 3. Add Music (Music Modal) → Camera ──────────────────────────
      if (showMusicModal) {
        setShowMusicModal(false);
        setMusicSearchQuery('');
        setPreviewingSongId(null);
        return true;
      }

      // ── 4. Upload → Camera Editor ────────────────────────────────────
      if (showCamera && recordingFlowStep === 'upload') {
        setRecordingFlowStep('editor');
        return true;
      }

      // ── 5. Camera Editor → Camera (live view, discard recording) ─────
      if (showCamera && recordingFlowStep === 'editor') {
        setRecordedVideoUri(null);
        setRecordingFlowStep(null);
        return true;
      }

      // ── 6. Review → Camera (live view, discard recording) ────────────
      if (showCamera && recordingFlowStep === 'review') {
        setRecordedVideoUri(null);
        setRecordingFlowStep(null);
        return true;
      }

      // ── 7. Camera → Home ──────────────────────────────────────────────
      if (showCamera) {
        restoreHomeFeed();
        return true;
      }

      // ── 8. Chat → Inbox ───────────────────────────────────────────────
      if (showChatScreen) {
        setShowChatScreen(false);
        setShowInbox(true);
        return true;
      }

      // ── 9. Followers modal → Profile ─────────────────────────────────
      if (showFollowers) {
        setShowFollowers(false);
        return true;
      }

      // ── 10. Following modal → Profile ────────────────────────────────
      if (showFollowing) {
        setShowFollowing(false);
        return true;
      }

      // ── 11. Inbox → Home ─────────────────────────────────────────────
      if (showInbox) {
        restoreHomeFeed();
        return true;
      }

      // ── 12. Friends → Home ───────────────────────────────────────────
      if (showFriends) {
        restoreHomeFeed();
        return true;
      }

      // ── 13. Search → Home ────────────────────────────────────────────
      if (showSearch) {
        restoreHomeFeed();
        return true;
      }

      // ── 14. Profile → Home ───────────────────────────────────────────
      if (isProfilePlayback && !isProfile) {
        setIsProfile(true);
        setProfilePlaybackUserId(null);
        setProfilePlaybackVideoIds([]);
        setShareOpenedFromProfile(false);
        return true;
      }

      if (isProfile) {
        restoreHomeFeed();
        return true;
      }

      // ── 15. Home screen – double-back-to-exit ────────────────────────
      if (backPressCountRef.current === 0) {
        backPressCountRef.current = 1;
        // Refresh home feed and reload latest videos
        homePTR.onRefresh();
        refetchBackendVideos();
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        backPressTimerRef.current = setTimeout(() => {
          backPressCountRef.current = 0;
        }, 2000);
        return true;
      }

      // Second back press within 2 s → exit
      if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);
      backPressCountRef.current = 0;
      BackHandler.exitApp();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      subscription.remove();
      if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);
    };
  }, [
    showIncomingCall, showAudioCall, showVideoCall,
    showMusicTrimmer, showMusicModal,
    showCamera, recordingFlowStep,
    showChatScreen, showFollowers, showFollowing,
    showInbox, showFriends, showSearch, isProfile, isProfilePlayback,
    homePTR, refetchBackendVideos, restoreHomeFeed,
  ]);
  // ── End Android Back Navigation ─────────────────────────────────────────

  // Explicitly pause sound-detail grid videos when modal closes
  useEffect(() => {
    if (!showSoundDetail) {
      soundDetailVideoRefsArray.current.forEach(ref => {
        ref?.pauseAsync?.();
      });
      // Stop thumbnail audio preview when modal closes
      if (soundDetailAudioRef.current) {
        soundDetailAudioRef.current.stopAsync().catch(() => {});
        soundDetailAudioRef.current.unloadAsync().catch(() => {});
        soundDetailAudioRef.current = null;
      }
      setIsSoundDetailAudioPlaying(false);
      setPlayingGridVideoId(null);
    }
  }, [showSoundDetail]);

  useEffect(() => {
    if (!soundFullScreenVideo) {
      setSoundDetailPlaybackProgress(0);
    }
  }, [soundFullScreenVideo]);

  const handleLoginSuccess = useCallback(() => {
    // The auth listener will update isLoggedIn automatically.
    // We just close the sheet and execute the queued action.
    setShowLoginSheet(false);
    setTimeout(() => {
      if (pendingActionRef.current) {
        pendingActionRef.current();
        pendingActionRef.current = null;
      }
    }, 350);
  }, []);

  const openUserProfile = (user) => {
    const currentEmail = appAuth.currentUser?.email?.trim().toLowerCase();
    // A backend video can retain its old username after the creator edits their
    // handle. Use the stable MastiBase owner ID/email before comparing handles.
    const isOwnProfile = user?.user === userId || user?.userId === userId
      || (user?.backendUserId != null && String(user.backendUserId) === String(mastiBaseUserId))
      || (user?.accountId != null && (
        user.accountId === appAuth.currentUser?.uid ||
        user.accountId === currentEmail
      ))
      || (user?.profile?.email && user.profile.email === currentEmail);
    setProfilePlaybackUserId(null);
    setProfilePlaybackVideoIds([]);
    setSelectedUser(isOwnProfile ? null : user);
    // NOTE: global youtube/instagram/facebook state nahi badhate —
    // har user ka data uske apne video object se aata hai (displayUser)
    setIsProfile(true);
    setProfileTabIndex(0);
    profileScrollX.setValue(0);
    profileTabsFlatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const openProfileVideo = useCallback((item: any, profileVideoList: any[]) => {
    const videoIds = profileVideoList.map(video => video.id);
    const index = videoIds.indexOf(item.id);
    if (index === -1) return;

    setProfilePlaybackUserId(item.user || item.userId || null);
    setProfilePlaybackVideoIds(videoIds);
    setActiveTab(false);
    setCurrentVideoIndex(index);
    setCurrentVideoItem(item);
    setShareOpenedFromProfile(isVideoOwnedByCurrentUser(item));
    setIsManuallyPaused(false);
    tabFlatListRef.current?.scrollToIndex({ index: 1, animated: false });
    setIsProfile(false);
    requestAnimationFrame(() => {
      feedFlatListRef.current?.scrollToIndex({ index, animated: false });
    });
  }, [isVideoOwnedByCurrentUser]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],   // SDK 54 — MediaTypeOptions deprecated
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      try {
        const accountId = appAuth.currentUser?.uid;
        if (!accountId) throw new Error('Sign in again before changing your profile photo.');
        const uri = await persistProfileImageLocally(
          result.assets[0].uri,
          accountId,
        );
        const previousImage = profileImageUploadUri
          ? profileImageBeforeUploadRef.current || ''
          : profileImage || '';
        await persistProfileImageDraft(accountId, uri, previousImage);
        if (!profileImageUploadUri) {
          profileImageBeforeUploadRef.current = previousImage;
        }
        setProfileImageSyncPending(false);
        setProfileImageUploadUri(uri);
        setProfileImage(uri);
      } catch (error: any) {
        Alert.alert(
          'Photo could not be saved',
          error?.message || 'Please choose the photo again and try once more.',
        );
      }
    }
  };

  const clearWithdrawalBankFields = () => {
    setWithdrawalAmount('');
    setWithdrawalBankName('');
    setWithdrawalAccountHolder('');
    setWithdrawalAccountNumber('');
    setWithdrawalConfirmAccountNumber('');
    setWithdrawalIfscCode('');
  };

  const closeWithdrawalRequest = () => {
    if (isSubmittingWithdrawal) return;
    setShowWithdrawalRequest(false);
    clearWithdrawalBankFields();
  };

  const submitWithdrawalRequest = async () => {
    if (isSubmittingWithdrawal) return;
    const email = appAuth.currentUser?.email?.trim().toLowerCase();
    const firebaseUid = appAuth.currentUser?.uid;
    if (!email || !firebaseUid) {
      Alert.alert('Login required', 'Withdrawal request bhejne ke liye pehle login karein.');
      return;
    }

    if (
      withdrawalRequestSummary &&
      Date.parse(withdrawalRequestSummary.processAfter) > Date.now()
    ) {
      Alert.alert(
        'Request already pending',
        `Nayi request se pehle ${formatWithdrawalWait(withdrawalRequestSummary.processAfter, Date.now())} wait karein.`,
      );
      return;
    }

    const amount = Number(withdrawalAmount);
    const bankName = withdrawalBankName.trim();
    const accountHolderName = withdrawalAccountHolder.trim();
    const accountNumber = withdrawalAccountNumber.replace(/\s/g, '');
    const confirmedAccountNumber = withdrawalConfirmAccountNumber.replace(/\s/g, '');
    const ifscCode = withdrawalIfscCode.trim().toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Withdrawal amount ₹0 se zyada hona chahiye.');
      return;
    }
    if (bankName.length < 2 || accountHolderName.length < 2) {
      Alert.alert('Bank details required', 'Bank name aur account holder name dono bharein.');
      return;
    }
    if (!/^\d{9,18}$/.test(accountNumber)) {
      Alert.alert('Invalid account number', 'Account number mein 9 se 18 digits honi chahiye.');
      return;
    }
    if (accountNumber !== confirmedAccountNumber) {
      Alert.alert('Account numbers do not match', 'Dono account number fields dobara check karein.');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      Alert.alert('Invalid IFSC code', '11-character Indian bank IFSC code enter karein.');
      return;
    }

    const requestStartedAt = Date.now();
    const requestedAt = new Date(requestStartedAt).toISOString();
    const processAfter = new Date(requestStartedAt + 72 * 60 * 60 * 1000).toISOString();
    setIsSubmittingWithdrawal(true);
    try {
      await requestMastiBasePayout({
        userId: mastiBaseUserId || firebaseUid,
        email,
        userEmail: email,
        firebaseUid,
        mastiBaseUserId: mastiBaseUserId || undefined,
        name: cleanDisplayName(name),
        userName: formatProfileHandle(userId),
        username: String(userId).replace(/^@+/, ''),
        amount,
        method: 'bank',
        accountInfo: `Bank: ${bankName} | Account holder: ${accountHolderName} | Account: ${accountNumber} | IFSC: ${ifscCode}`,
        bankDetails: {
          bankName,
          accountHolderName,
          accountNumber,
          ifscCode,
        },
        requestedAt,
        processAfter,
        holdUntil: processAfter,
        holdHours: 72,
        status: 'pending',
      });

      const summary = {
        amount,
        requestedAt,
        processAfter,
        status: 'pending' as const,
      };
      setWithdrawalRequestSummary(summary);
      setWithdrawalNow(Date.now());
      try {
        await AsyncStorage.setItem(
          `${WITHDRAWAL_REQUEST_STORAGE_PREFIX}${firebaseUid}`,
          JSON.stringify(summary),
        );
      } catch {
        console.warn('[Payout] Request was accepted, but its local wait timer could not be cached.');
      }
      clearWithdrawalBankFields();
      setShowWithdrawalRequest(false);
      showSuccessToast('Withdrawal request MastiBase par submit ho gayi. Processing mein 72 ghante tak lag sakte hain.');
    } catch {
      Alert.alert(
        'Request failed',
        'MastiBase par withdrawal request submit nahi ho saki. Bank details app mein save nahi kiye gaye; connection check karke dobara try karein.',
      );
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const saveProfileToMastiBase = async () => {
    if (isSavingProfile) return;
    const email = appAuth.currentUser?.email?.trim().toLowerCase();
    const accountId = appAuth.currentUser?.uid;
    if (!email || !accountId) {
      Alert.alert('Login required', 'Profile save karne ke liye pehle login karein.');
      return;
    }

    let deviceProfileSaved = false;
    try {
      setIsSavingProfile(true);
      const retryAvatar = profileImageUploadUri || profileImage;
      if (retryAvatar) {
        profilePhotoSyncRetryRef.current = `${accountId}:${retryAvatar}`;
      }
      const savedName = cleanDisplayName(name);
      const savedHandle = isPlaceholderProfileHandle(userId)
        ? '@newuser'
        : formatProfileHandle(userId);
      const usernameNeedsClaim =
        isPlaceholderProfileHandle(userId) ||
        normalizedIdentity(savedHandle) !== normalizedIdentity(userId);
      if (usernameNeedsClaim) {
        try {
          const existingProfile = await lookupMastiBaseUser(savedHandle);
          if (existingProfile) {
            const ownerEmail = String(existingProfile.email ?? '').trim().toLowerCase();
            const ownerMastiBaseId = String(
              existingProfile.mastiBaseUserId || existingProfile.id || '',
            ).trim();
            const knownOtherAccount = ownerEmail
              ? ownerEmail !== email
              : !!mastiBaseUserId &&
                !!ownerMastiBaseId &&
                ownerMastiBaseId !== String(mastiBaseUserId);
            if (knownOtherAccount) {
              Alert.alert(
                'Username already in use',
                'Another account is using this username. Choose a different one.',
              );
              return;
            }
          }
        } catch (error: any) {
          // The old username-claim route is not part of the live MastiBase
          // API. A lookup is best-effort; firebase-login remains the durable
          // owner-scoped profile write.
          console.warn('[Profile] Username availability lookup failed:', error);
        }
      }

      // Save the editable profile fields to the account-scoped device snapshot
      // before waiting on network services. This makes Save Profile durable
      // even if the app is closed immediately or MastiBase is unavailable.
      const storageKey = `${PROFILE_STORAGE_PREFIX}${accountId}`;
      let localSnapshotRaw: string | null = null;
      try {
        localSnapshotRaw = await AsyncStorage.getItem(storageKey);
      } catch (error) {
        console.warn('[Profile] Full snapshot could not be read before saving:', error);
      }
      let localSnapshot: Record<string, any> = {};
      if (localSnapshotRaw) {
        try {
          const parsed = JSON.parse(localSnapshotRaw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            localSnapshot = parsed;
          }
        } catch {}
      }
      const profileSnapshot = {
        ...localSnapshot,
        accountId,
        name: savedName,
        username: savedHandle,
        userId: savedHandle,
        bio: bio.trim(),
        profileImage: profileImage || localSnapshot.profileImage || '',
        profileImageSyncPending: Boolean(profileImageSyncPending || profileImageUploadUri),
        profileImageUploadUri: profileImageUploadUri || null,
        profileImageBeforeUpload: profileImageUploadUri
          ? profileImageBeforeUploadRef.current || ''
          : null,
        youtube: youtube.trim(),
        instagram: instagram.trim(),
        facebook: facebook.trim(),
      };
      try {
        await saveProfileCoreRecord(accountId, {
          accountId,
          name: savedName,
          username: savedHandle,
          userId: savedHandle,
          bio: bio.trim(),
          profileImage: profileSnapshot.profileImage,
          profileImageSyncPending: profileSnapshot.profileImageSyncPending,
          mastiBaseUserId: mastiBaseUserId || '',
          isVerified,
          youtube: youtube.trim(),
          instagram: instagram.trim(),
          facebook: facebook.trim(),
        });
        deviceProfileSaved = true;
      } catch (error) {
        console.warn('[Profile] Compact profile backup could not be saved:', error);
      }
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(profileSnapshot));
        deviceProfileSaved = true;
      } catch (error) {
        console.warn('[Profile] Full snapshot could not be saved; continuing with profile sync:', error);
      }
      setProfileImageSyncPending(Boolean(profileImageSyncPending || profileImageUploadUri));
      setName(savedName);
      setUserId(savedHandle);

      let existingAvatar = profileImageUploadUri
        ? profileImageBeforeUploadRef.current || ''
        : profileImage || '';
      if (profileImageUploadUri && !/^https?:\/\//i.test(existingAvatar)) {
        try {
          const remoteProfile = await getMastiBaseProfile(email);
          existingAvatar = String(
            remoteProfile.avatarUrl || remoteProfile.profileImage || '',
          ).trim();
        } catch {
          // Preserve the local selection and continue if MastiBase is offline.
        }
      }
      let avatarUrl = /^https?:\/\//i.test(existingAvatar) ? existingAvatar : '';
      let avatarUploadError: unknown = null;
      const uploadIdentity = {
        userName: savedHandle,
        username: savedHandle.replace(/^@+/, ''),
        userId: savedHandle,
        accountId,
        firebaseUid: accountId,
        mastiBaseUserId: mastiBaseUserId || undefined,
        name: savedName,
      };
      if (profileImageUploadUri) {
        try {
          const uploaded = await uploadProfileImageToMastiBash(
            profileImageUploadUri,
            email,
            uploadIdentity,
          );
          avatarUrl = uploaded.secure_url;
          setProfileImage(avatarUrl);
          setProfileImageUploadUri(null);
          profileImageBeforeUploadRef.current = avatarUrl;
          try {
            await saveProfileCoreRecord(accountId, {
              name: savedName,
              username: savedHandle,
              userId: savedHandle,
              bio: bio.trim(),
              profileImage: avatarUrl,
              profileImageSyncPending: true,
              mastiBaseUserId: mastiBaseUserId || '',
              isVerified,
              youtube: youtube.trim(),
              instagram: instagram.trim(),
              facebook: facebook.trim(),
            });
          } catch (error) {
            console.warn('[Profile] Uploaded photo URL could not be saved to the compact backup:', error);
          }
          try {
            await AsyncStorage.setItem(storageKey, JSON.stringify({
              ...localSnapshot,
              accountId,
              name: savedName,
              username: savedHandle,
              userId: savedHandle,
              bio: bio.trim(),
              profileImage: avatarUrl,
              profileImageSyncPending: true,
              profileImageUploadUri: null,
              profileImageBeforeUpload: null,
              youtube: youtube.trim(),
              instagram: instagram.trim(),
              facebook: facebook.trim(),
            }));
          } catch (error) {
            console.warn('[Profile] Uploaded photo URL could not be cached locally:', error);
          }
        } catch (error) {
          avatarUploadError = error;
          // Keep the picked photo and its durable local URI so Save can retry.
        }
      }

      const writeSynced = await syncMastiBaseUser({
        email,
        firebaseUid: accountId,
        phoneNumber: appAuth.currentUser?.phoneNumber || undefined,
        name: savedName,
        userName: savedHandle,
        username: savedHandle.replace(/^@+/, ''),
        userId: savedHandle,
        avatarUrl: avatarUploadError && !avatarUrl ? undefined : avatarUrl,
        bio: bio.trim(),
        socialLinks: {
          instagram: instagram.trim(),
          youtube: youtube.trim(),
          facebook: facebook.trim(),
          website: '',
          whatsapp: '',
        },
      });
      let synced = writeSynced;
      let profileReadBackSucceeded = false;
      let readBackAvatarUrl = '';
      try {
        const readBack = await getMastiBaseProfile(email);
        profileReadBackSucceeded = true;
        readBackAvatarUrl = normalizeMastiAvatarUrl(
          readBack.avatarUrl || readBack.profileImage || '',
        );
        const readBackValues = Object.fromEntries(
          Object.entries(readBack).filter(([, value]) =>
            value !== undefined && value !== null && value !== '',
          ),
        );
        const writeSyncedValues = Object.fromEntries(
          Object.entries(writeSynced).filter(([, value]) =>
            value !== undefined && value !== null && value !== '',
          ),
        );
        // Keep server-owned IDs and flags from the read-back, but don't let a
        // stale profile response undo the name/handle that the user just saved.
        synced = { ...readBackValues, ...writeSyncedValues };
      } catch (error) {
        console.warn('[Profile] MastiBase read-back failed after save:', error);
      }

      // The request payload is the user's latest edit. MastiBase is the shared
      // identity record used by MastiBash; its immediate read-back can lag, so
      // preserve the submitted values locally and let the sync endpoint catch up.
      const syncedName = savedName;
      const syncedHandle = savedHandle;
      const syncedBio = bio.trim();
      const syncedInstagram = instagram.trim();
      const syncedYoutube = youtube.trim();
      const syncedFacebook = facebook.trim();
      const syncedMastiBaseUserId =
        synced.mastiBaseUserId || synced.id || mastiBaseUserId;
      const returnedAvatarUrl = normalizeMastiAvatarUrl(
        readBackAvatarUrl ||
          synced.avatarUrl ||
          synced.profileImage ||
          '',
      );
      const avatarSyncConfirmed = Boolean(
        avatarUrl &&
        /^https?:\/\//i.test(avatarUrl) &&
        profileReadBackSucceeded &&
        readBackAvatarUrl === normalizeMastiAvatarUrl(avatarUrl),
      );
      const nextProfileImageSyncPending = avatarUploadError
        ? true
        : Boolean(normalizeMastiAvatarUrl(avatarUrl) && !avatarSyncConfirmed);
      const appAvatar = avatarUploadError && profileImageUploadUri
        ? profileImage || localSnapshot.profileImage || ''
        : (profileImageSyncPending || profileImageUploadUri) &&
            /^https?:\/\//i.test(avatarUrl)
          ? avatarUrl
          : returnedAvatarUrl ||
            normalizeMastiAvatarUrl(avatarUrl) ||
            normalizeMastiAvatarUrl(profileImage);
      const nextPublicAvatarCache = await rememberPublicProfileAvatar(
        appAvatar,
        [
          savedHandle,
          syncedHandle,
          mastiBaseUserId,
          syncedMastiBaseUserId,
          synced.id,
          synced.mastiBaseUserId,
          writeSynced.id,
          writeSynced.mastiBaseUserId,
        ],
      );
      if (nextPublicAvatarCache) {
        setPublicProfileAvatarCache(nextPublicAvatarCache);
      }
      setName(syncedName);
      setUserId(syncedHandle);
      setBio(syncedBio);
      setProfileImage(appAvatar);
      setProfileImageSyncPending(nextProfileImageSyncPending);
      setInstagram(syncedInstagram);
      setYoutube(syncedYoutube);
      setFacebook(syncedFacebook);
      setMastiBaseUserId(syncedMastiBaseUserId);
      setIsVerified(synced.isVerified === true);
      try {
        await saveProfileCoreRecord(accountId, {
          name: syncedName,
          username: syncedHandle,
          userId: syncedHandle,
          mastiBaseUserId: syncedMastiBaseUserId || '',
          isVerified: synced.isVerified === true,
          bio: syncedBio,
          profileImage: appAvatar,
          profileImageSyncPending: nextProfileImageSyncPending,
          youtube: syncedYoutube,
          instagram: syncedInstagram,
          facebook: syncedFacebook,
        });
      } catch (error) {
        console.warn('[Profile] Final compact profile backup could not be saved:', error);
      }
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify({
          ...localSnapshot,
          accountId,
          name: syncedName,
          username: syncedHandle,
          userId: syncedHandle,
          mastiBaseUserId: syncedMastiBaseUserId || '',
          bio: syncedBio,
          profileImage: appAvatar,
          profileImageSyncPending: nextProfileImageSyncPending,
          profileImageUploadUri: avatarUploadError
            ? profileImageUploadUri
            : null,
          profileImageBeforeUpload: avatarUploadError
            ? profileImageBeforeUploadRef.current || ''
            : null,
          youtube: syncedYoutube,
          instagram: syncedInstagram,
          facebook: syncedFacebook,
        }));
      } catch (error) {
        console.warn('[Profile] Synced profile could not be cached locally:', error);
      }
      setVideos((previous) => previous.map((video) => (
        video.accountId === appAuth.currentUser?.uid ||
        video.accountId === email ||
        video.backendUserId === mastiBaseUserId ||
        normalizedIdentity(video.userId) === normalizedIdentity(userId) ||
        normalizedIdentity(video.user) === normalizedIdentity(userId)
          ? {
              ...video,
              name: syncedName,
              user: syncedHandle,
              userId: syncedHandle,
              backendUserId: synced.mastiBaseUserId || synced.id || video.backendUserId || mastiBaseUserId,
              profileImage: appAvatar,
              bio: syncedBio,
              instagram: syncedInstagram,
              youtube: syncedYoutube,
              facebook: syncedFacebook,
            }
          : video
      )));
      void refetchBackendVideos();
      if (avatarUploadError) {
        console.warn('[Profile] MastiBash profile photo upload failed:', avatarUploadError);
      }
      setEditProfile(false);
    } catch (error: any) {
      if (deviceProfileSaved) {
        console.warn('[Profile] MastiBase sync failed after local save:', error);
        setEditProfile(false);
      } else {
        Alert.alert('Profile save failed', error?.message || 'Profile MastiBase me save nahi ho saka.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    const accountId = appAuth.currentUser?.uid;
    if (
      !isLoggedIn ||
      !accountId ||
      hydratedProfileUidRef.current !== accountId ||
      !profileImageSyncPending ||
      isSavingProfile
    ) {
      return;
    }
    const retryAvatar =
      profileImageUploadUri ||
      (/^https?:\/\//i.test(profileImage) ? profileImage : '');
    if (!retryAvatar) return;
    const retryKey = `${accountId}:${retryAvatar}`;
    if (profilePhotoSyncRetryRef.current === retryKey) return;
    profilePhotoSyncRetryRef.current = retryKey;
    void saveProfileToMastiBase();
  }, [
    isLoggedIn,
    isSavingProfile,
    profileImage,
    profileImageSyncPending,
    profileImageUploadUri,
  ]);

  const pickVideoFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],          // SDK 54 — MediaTypeOptions deprecated
        allowsEditing: false,
        quality: 1,                      // HD quality
        videoMaxDuration: 0,             // 0 = no limit (allows up to 2GB)
        videoExportPreset: ImagePicker.VideoExportPreset?.HighestQuality ?? undefined,
      });
      if (!result.canceled && result.assets?.[0]) {
        resetVideoEditState();
        setRecordedVideoUri(result.assets[0].uri);
        setRecordingFlowStep('review');
        setShowCamera(true);
      }
    } catch (e) {
      console.warn('Gallery pick error:', e);
      Alert.alert('Error', 'Video load nahi ho paya. Dobara try karo.');
    }
  };

  // Editor ke andar se video pick karne ke liye — screen change nahi hogi
  const pickVideoForEditor = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 0,
        videoExportPreset: ImagePicker.VideoExportPreset?.HighestQuality ?? undefined,
      });
      if (!result.canceled && result.assets?.[0]) {
        resetVideoEditState();
        setRecordedVideoUri(result.assets[0].uri);
        setVideoDeleted(false);
        // Review/camera flow pe nahi jaana — editor wahi khula rahega
      }
    } catch (e) {
      console.warn('Gallery pick error:', e);
      Alert.alert('Error', 'Video load nahi ho paya. Dobara try karo.');
    }
  };

  
  const startRecording = async () => {
  if (isRecordingRef.current) return;

  if (!cameraHasPermission) {
    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert('Permission', 'Camera permission chahiye');
      return;
    }
  }
  if (!micHasPermission) {
    const granted = await requestMicPermission();
    if (!granted) {
      Alert.alert('Permission', 'Microphone permission chahiye');
      return;
    }
  }

  const duration =
    recordTimeRef.current === "3m" ? 180
    : recordTimeRef.current === "60s" ? 60
    : 15;

  isRecordingRef.current = true;
  setIsRecording(true);
  setRecordSeconds(0);

  rotateAnim.setValue(0);
  Animated.loop(
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  ).start();

  progress.setValue(0);
  Animated.timing(progress, {
    toValue: 1,
    duration: duration * 1000,
    useNativeDriver: false,
  }).start();

  timerRef.current = setInterval(() => {
    setRecordSeconds(prev => {
      const next = prev + 1;
      if (next >= duration) {
        stopRecording();
        return duration;
      }
      return next;
    });
  }, 1000);

  const resetRecordingState = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    progress.stopAnimation();
    rotateAnim.stopAnimation();
    rotateAnim.setValue(0);
    isRecordingRef.current = false;
    setIsRecording(false);
  };

  if (!cameraRef.current) {
    resetRecordingState();
    Alert.alert('Camera', 'Camera abhi ready nahi hai. Dobara try karo.');
    return;
  }

  try {
    // Start the selected Jio/Masti audio immediately before the camera
    // recording. The camera screen preloads it, so this stays close to the
    // first recorded frame instead of starting after a network delay.
    await prepareRecordingMusic(selectedSong);
    const video = await cameraRef.current.recordAsync({ maxDuration: duration });
    resetRecordingState();
    if (video?.uri) {
      resetVideoEditState();
      setRecordedVideoUri(video.uri);
      setRecordingFlowStep("review");
    }
  } catch (e) {
    console.log('Expo Camera recording error:', e);
    resetRecordingState();
    Alert.alert('Recording error', 'Video record nahi ho paya. Dobara try karo.');
  } finally {
    await stopRecordingMusic();
  }
};

const stopRecording = () => {
  if (cameraRef.current && isRecordingRef.current) {
    try {
      cameraRef.current.stopRecording();
    } catch (e) {
      console.log('stopRecording error:', e);
    }
  }
  isRecordingRef.current = false;
  setIsRecording(false);
  void stopRecordingMusic();
};

  const discardRecordedVideo = () => {
    setRecordedVideoUri(null);
    setRecordingFlowStep(null);
  };

  const saveVideoToDevice = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      if (status !== 'granted') {
        Alert.alert('Permission chahiye', 'Gallery access do video save karne ke liye');
        return;
      }
      if (!recordedVideoUri) {
        Alert.alert('Error', 'Save karne ke liye koi video nahi mili');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(recordedVideoUri);
                  showSuccessToast('Video gallery mein save ho gayi.');
    } catch (e) {
      Alert.alert('Error', 'Video save nahi ho payi. Dobara try karo.');
    }
  };

  // ─── Post video from Upload screen ──────────────────────────────────────
  const uploadIntervalRef = useRef(null);
  const pendingVideoRef   = useRef<any>(null);   // holds the video object while processing
  const uploadInFlightRef = useRef(false);

  useEffect(() => {
    // Release the guard only after the upload flow has fully settled. This
    // keeps rapid taps on Post from creating a second MastiBase record.
    if (!isUploading && !recordedVideoUri) {
      uploadInFlightRef.current = false;
    }
  }, [isUploading, recordedVideoUri]);

  const postVideoToFeed = useCallback(async () => {
    if (!recordedVideoUri || uploadInFlightRef.current) return;
    if (adsConfig?.isUploadAllowed === false) {
      Alert.alert('Uploads unavailable', 'Video uploads are temporarily disabled.');
      return;
    }
    uploadInFlightRef.current = true;

    // Capture all values before state resets
    const capturedUri     = recordedVideoUri;
    const capturedPrivacy = privacySetting;
    const capturedCaption = uploadTitle.trim() || 'New video #masti';
    const capturedCoverFramePosition = coverFramePosition;
    const capturedAccountId = appAuth.currentUser?.uid || null;
    const capturedMastiBaseUserId = mastiBaseUserId;
    const capturedUserId = userId;
    const capturedName = name;
    const capturedSegments = editedVideoSegments.map((segment) => ({
      start: Number(segment.start.toFixed(4)),
      end: Number(segment.end.toFixed(4)),
    }));
    const shouldRenderEditedVideo =
      capturedSegments.length > 1 ||
      capturedSegments[0]?.start > 0.005 ||
      capturedSegments[0]?.end < 0.995;
    const myProfileVideo  = videos.find(v => v.user === userId);
    let localThumbnailUri: string | null = null;

    // Render the exact frame selected in the cover picker. The local image is
    // used immediately, then uploaded so it remains available after refresh.
    try {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(capturedUri, {
        time: Math.max(0, Math.round(capturedCoverFramePosition * 1000)),
        quality: 0.8,
      });
      localThumbnailUri = thumbnail.uri;
    } catch (error) {
      console.warn('[Upload] Could not render selected cover frame:', error);
    }

    const uploadId = Date.now().toString();
    const uploadProfileImage = profileImage || '';
    const uploadSong = selectedSong || {
      id: `original-${uploadId}`,
      title: 'Original Audio',
      artist: name || userId,
      duration: '00:30',
      cover: uploadProfileImage,
      userId,
      isOriginal: true,
    };

    const pendingVideo = {
      id: uploadId,
      createdAt: new Date().toISOString(),
      accountId: appAuth.currentUser?.uid || null,
      user: userId,
      name: name,
      userId: userId,
      backendUserId: capturedMastiBaseUserId || undefined,
      bio: bio,
      profileImage: uploadProfileImage,
      followers: myProfileVideo ? myProfileVideo.followers : ownFollowers,
      following: followingUsers.length,
      likes: 0,
      desc: capturedCaption,
      url: capturedUri, // replaced with the MastiBase secure_url on success
      thumbnail: localThumbnailUri,
      coverFramePosition: capturedCoverFramePosition,
      musicCover: uploadSong.cover || uploadProfileImage,
      song: uploadSong,
      youtube: youtube,
      instagram: instagram,
      facebook: facebook,
      privacy: capturedPrivacy,
    };

    // ── STEP 1: Close upload screen immediately ──────────────────────────
    pendingVideoRef.current = pendingVideo;
    setRecordingFlowStep(null);
    setShowCamera(false);
    setRecordedVideoUri(null);
    setUploadTitle('');
    setPrivacySetting('public');
    setLocationEnabled(false);
    setCoverFramePosition(0);

    // ── STEP 2: Show the MastiBase upload with live progress ──────────────
    setIsUploading(true);
    setUploadProgress(0);

    let mastiResult: Awaited<ReturnType<typeof uploadVideoToMastiBash>> | null = null;
    const uploadEmail = appAuth.currentUser?.email?.trim().toLowerCase();
    if (!uploadEmail) {
      setIsUploading(false);
      setUploadProgress(0);
      Alert.alert('Email required', 'Please sign in with an email account to upload.');
      return;
    }

    const uploadIdentity = {
      userName: capturedUserId,
      username: capturedUserId.replace(/^@+/, ''),
      userId: capturedUserId,
      name: capturedName,
      accountId: capturedAccountId || undefined,
      firebaseUid: capturedAccountId || undefined,
      mastiBaseUserId: capturedMastiBaseUserId || undefined,
    };

    try {
      let uploadedThumbnailUrl: string | undefined;
      if (localThumbnailUri) {
        try {
          const thumbnailResult = await uploadThumbnailToMastiBash(
            localThumbnailUri,
            uploadEmail,
            uploadIdentity,
          );
          uploadedThumbnailUrl = thumbnailResult.secure_url || thumbnailResult.fileUrl;
        } catch (error) {
          // The video is still valid if thumbnail storage is temporarily
          // unavailable; the local cover remains visible until the next refresh.
          console.warn('[Upload] Could not persist selected cover frame:', error);
        }
      }
      // ── STEP 2a: Upload the retained edit. Edited uploads are rendered on
      // the API server with FFmpeg before MastiBase receives the final file.
      console.log(
        `[Upload] Starting ${shouldRenderEditedVideo ? 'edited' : 'original'} Masti Bash upload`,
        capturedUri,
      );
      const uploadMetadata = {
        ...uploadIdentity,
        title: capturedCaption,
        caption: capturedCaption,
        thumbnailUrl: uploadedThumbnailUrl,
        uploadId,
      };
      mastiResult = shouldRenderEditedVideo
        ? await uploadEditedVideoToMastiBash(
            capturedUri,
            uploadEmail,
            capturedSegments,
            (pct) => setUploadProgress(pct),
            uploadMetadata,
          )
        : await uploadVideoToMastiBash(capturedUri, uploadEmail, (pct) => {
            setUploadProgress(pct);
          }, uploadMetadata);
      console.log('[Upload] Masti Bash upload complete:', mastiResult.fileUrl);
    } catch (err: any) {
      // Masti Bash upload failed — nothing was posted, tell the user plainly.
      console.warn('[Upload] Masti Bash upload failed:', err);
      pendingVideoRef.current = null;
      setIsUploading(false);
      setUploadProgress(0);
      Alert.alert(
        'Upload Failed',
         err?.message || 'Video upload failed. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = mastiResult;
    if (!result) {
      setIsUploading(false);
      setUploadProgress(0);
      return;
    }
    // MastiBase upload persists both the file and its feed metadata. There is
    // no second Firebase/legacy metadata write.
    const savedVideo = { id: result.id };
    const durableThumbnailUrl = result.thumbnail_url || uploadedThumbnailUrl || null;

    // Keep the selected cover available even if the feed endpoint does not
    // immediately echo thumbnail_url back. The remote URL survives refresh;
    // the temporary local file is only an optimistic preview.
    if (durableThumbnailUrl) {
      setVideoThumbnailOverrides((prev) => ({
        ...prev,
        [String(savedVideo.id)]: durableThumbnailUrl,
        [`db-${savedVideo.id}`]: durableThumbnailUrl,
      }));
    }
    setVideoCoverPositions((prev) => ({
      ...prev,
      [String(savedVideo.id)]: capturedCoverFramePosition,
      [`db-${savedVideo.id}`]: capturedCoverFramePosition,
    }));

    // ── STEP 3: MastiBase confirmed the upload → add it to the feed ───────
    if (pendingVideoRef.current) {
      // If the user changed accounts while the upload was running, keep the
      // upload attached to the original account and do not show it in the
      // newly signed-in account's feed.
      if (
        !capturedAccountId ||
        appAuth.currentUser?.uid !== capturedAccountId
      ) {
        pendingVideoRef.current = null;
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }

      const videoToAdd = {
        ...pendingVideoRef.current,
        accountId: capturedAccountId,
        id: `db-${savedVideo.id}`,
        url: result.secure_url,
        adaptiveStreamUrl: result.adaptiveStreamUrl,
        qualities: result.qualities,
         renditions: result.renditions,
         streams: result.streams,
         variants: result.variants,
         sources: result.sources,
         hlsUrl: result.hlsUrl,
         hls_url: result.hls_url,
         streamUrl: result.streamUrl,
         stream_url: result.stream_url,
        // Use the local recording immediately after upload success. This
        // avoids a black frame while the remote MP4 is still buffering.
        localAsset: capturedUri,
        thumbnail: durableThumbnailUrl || pendingVideoRef.current.thumbnail || null,
        coverFramePosition: capturedCoverFramePosition,
      };
      pendingVideoRef.current = null;

      // Save the post immediately under the signed-in account. The regular
      // profile snapshot effect remains as a backup, but this write makes an
      // upload survive logout even if the app is closed before that effect
      // gets another render.
      // Insert RIGHT AFTER the currently-watched video so it lands in front
      // of the user instead of forcing a scroll back to the top.
      setVideos(prev => {
        const watchingId  = currentVideoItem?.id;
        const watchingIdx = prev.findIndex(v => v.id === watchingId);
        if (watchingIdx === -1) return dedupeVideoItems([videoToAdd, ...prev]);
        const next = [...prev];
        next.splice(watchingIdx + 1, 0, videoToAdd);
        return dedupeVideoItems(next);
      });

      // Refresh the backend-sourced list in the background so the feed stays
      // consistent (and correct after a restart) without a second round-trip
      // blocking the UI — the video is already visible from the line above.
      console.log('[Feed] Invalidating video list cache after successful post');
      void refetchBackendVideos();
      queryClient.invalidateQueries({ queryKey: ['videos'] });

      // Switch away from "Following" tab so the new post is visible
      if (activeTab) setActiveTab(false);
      setPendingScrollVideoId(videoToAdd.id);
    }

    setTimeout(() => {
      setIsUploading(false);
      setUploadProgress(0);
    }, 600);
  }, [activeTab, adsConfig, bio, currentVideoItem, editedVideoSegments, facebook, followingUsers, instagram, name, ownFollowers, profileImage, queryClient, recordedVideoUri, selectedSong, uploadTitle, userId, youtube]);
  // ─────────────────────────────────────────────────────────────────────────

  const changeProfileTab = (index) => {
    setProfileTabIndex(index);
    profileTabsFlatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const recordMastiBaseShare = async (
    item: any,
    platform: 'whatsapp' | 'facebook' | 'direct' = 'direct',
  ) => {
    const actorId =
      appAuth.currentUser?.email?.trim().toLowerCase() ||
      appAuth.currentUser?.uid;
    const mediaId = String(item?.id ?? '').replace(/^db-/, '');
    if (!actorId || !mediaId) throw new Error('Sign in to sync this share count.');

    const response = normalizeMastiBaseActionResponse(await shareMastiBaseVideo({
      mediaId,
      userId: actorId,
      platform,
    }));
    if (response.success === false) {
      throw new Error(response.error || 'MastiBase could not save this share.');
    }
    try {
      await incrementShareLive(item.id, mastiBaseCount(response.sharesCount));
    } catch (error) {
      console.warn('[Share] MastiBase saved the share; live mirror update failed:', error);
    }
  };

  const handleShare = async (item) => {
    setShowShare(false);
    const videoLink = getMastiVideoAppLink(item.id);
    try {
      const result = await Share.share({
        message: `${item.desc || 'Dekho yeh video Masti Video par!'}\n${videoLink}`,
        url: videoLink,
      });
      if (result.action === Share.sharedAction) {
        try {
          await recordMastiBaseShare(item, 'direct');
          notifyVideoOwner(item, 'share').catch(() => {});
        } catch (error) {
          Alert.alert('Share count not saved', error instanceof Error ? error.message : 'MastiBase share count sync nahi ho saka.');
        }
      }
    } catch (error) { console.log(error); }
  };

  const handlePinSharedVideo = () => {
    const videoId = currentVideoItem?.id;
    if (!videoId || !shareOpenedFromProfile || !isVideoOwnedByCurrentUser(currentVideoItem)) return;
    const nextPinned = !pinnedVideos[videoId];
    setPinnedVideos(prev => ({ ...prev, [videoId]: nextPinned }));
    setVideos(prev => prev.map(video =>
      video.id === videoId ? { ...video, isPinned: nextPinned } : video,
    ));
    showSuccessToast(nextPinned
      ? 'Video pin ho gayi.'
      : 'Video unpin ho gayi.');
  };

  const handleDeleteSharedVideo = () => {
    const videoId = currentVideoItem?.id;
    if (!videoId || !shareOpenedFromProfile || !isVideoOwnedByCurrentUser(currentVideoItem)) return;
    Alert.alert(
      'Delete video?',
      'Yeh video aapke profile aur feed se permanently delete ho jayegi.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const rawVideoId = String(videoId);
            if (deletingVideoId) return;
            const backendMediaId = rawVideoId.replace(/^db-/, '');
            const previousVideos = videos;
            const previousDeletedIds = deletedVideoIds;
            const currentEmail = appAuth.currentUser?.email?.trim().toLowerCase() || null;
            setDeletingVideoId(rawVideoId);

            // Optimistic removal keeps the profile responsive while the
            // permanent backend deletion is in flight.
            setDeletedVideoIds(prev => ({
              ...prev,
              [rawVideoId]: true,
              [backendMediaId]: true,
            }));
            setPinnedVideos(prev => {
              const next = { ...prev };
              delete next[rawVideoId];
              delete next[backendMediaId];
              return next;
            });
            setVideos(prev => prev.filter(video =>
              String(video.id) !== rawVideoId &&
              String(video.id) !== backendMediaId &&
              String(video.id) !== `db-${backendMediaId}`,
            ));

            try {
              await deleteMastiBaseVideo(backendMediaId, {
                userId: mastiBaseUserId,
                userEmail: currentEmail,
              });
              setVideoThumbnailOverrides(prev => {
                const next = { ...prev };
                delete next[rawVideoId];
                delete next[backendMediaId];
                delete next[`db-${backendMediaId}`];
                return next;
              });
              setVideoCoverPositions(prev => {
                const next = { ...prev };
                delete next[rawVideoId];
                delete next[backendMediaId];
                delete next[`db-${backendMediaId}`];
                return next;
              });
              setProfilePlaybackVideoIds(prev => prev.filter(id =>
                String(id) !== rawVideoId &&
                String(id) !== backendMediaId &&
                String(id) !== `db-${backendMediaId}`,
              ));
              setProfilePlaybackUserId(null);
              setCurrentVideoItem(null);
              setIsProfile(true);
              setProfileTabIndex(0);
              profileScrollX.setValue(0);
              void refetchBackendVideos();
              setShowShare(false);
              setShareSearchQuery('');
              showSuccessToast('Video permanently delete ho gayi.');
            } catch (error) {
              // Do not leave the UI claiming a delete succeeded when the
              // server rejected or could not complete the request.
              setVideos(previousVideos);
              setDeletedVideoIds(previousDeletedIds);
              Alert.alert(
                'Delete failed',
                error instanceof Error
                  ? error.message
                  : 'Video delete nahi ho payi. Please try again.',
              );
            } finally {
              setDeletingVideoId(null);
            }
          },
        },
      ],
    );
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const friendsPTR = usePullToRefresh(useCallback(async () => { await new Promise(r => setTimeout(r, 600)); }, []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inboxPTR = usePullToRefresh(useCallback(async () => { await new Promise(r => setTimeout(r, 900)); }, []));
  const startCall = useCallback(async (kind: 'audio' | 'video') => {
    if (isChatBlocked || isChatBlockedByOther) {
      Alert.alert('Call unavailable', 'Is user ke saath call available nahi hai.');
      return;
    }
    const myId = chatIdentity({
      authUid: appAuth.currentUser?.uid,
      email: appAuth.currentUser?.email,
      mastiBaseUserId,
      userId,
    }) || 'guest';
    const otherId = chatPeerId();
    if (!otherId || otherId === 'unknown' || myId === 'guest') {
      Alert.alert('Call unavailable', 'Is user ki account identity available nahi hai.');
      return;
    }

    const newCallId = `${myId}_${otherId}_${Date.now()}`;
    callDocIdRef.current = newCallId;
    setActiveCallId(newCallId);
    setCallIsCaller(true);
    setCallCameraFacing('user');
    setCallCameraEnabled(true);
    setCallDuration(0);
    setCallActive(false);
    setCallMuted(false);
    setCallSpeaker(true);
    if (kind === 'audio') setShowAudioCall(true);
    else setShowVideoCall(true);
    void playRingSound();

    try {
      await createCall({
        id: newCallId,
        callerId: myId,
        callerName: name || userId,
        callerAvatar: profileImage || '',
        calleeId: otherId,
        kind,
      });
    } catch (error) {
      callDocIdRef.current = null;
      setActiveCallId(null);
      setShowAudioCall(false);
      setShowVideoCall(false);
      setCallActive(false);
      void stopRingSound();
      Alert.alert(
        'Call failed',
        error instanceof Error ? error.message : 'Call start nahi ho saki.',
      );
    }
  }, [
    chatPeerId,
    isChatBlocked,
    isChatBlockedByOther,
    mastiBaseUserId,
    name,
    playRingSound,
    profileImage,
    stopRingSound,
    userId,
  ]);

  const markCallConnected = useCallback(() => {
    void stopRingSound();
    setCallActive(true);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, [stopRingSound]);

  const endCall = useCallback(() => {
    void stopRingSound();
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (callDocUnsubRef.current) { callDocUnsubRef.current(); callDocUnsubRef.current = null; }
    const endingCallId = callDocIdRef.current;
    callDocIdRef.current = null;
    if (endingCallId) void updateCall(endingCallId, { status: 'ended' }).catch(() => {});
    setActiveCallId(null);
    setCallIsCaller(false);
    setShowAudioCall(false);
    setShowVideoCall(false);
    setCallActive(false);
    setCallDuration(0);
    setShowIncomingCall(false);
    setIncomingCallId(null);
    setIncomingCallUser(null);
  }, [stopRingSound]);

  // Accept incoming call (callee side)
  const acceptIncomingCall = useCallback(async () => {
    void stopRingSound();
    if (incomingCallId) {
      await updateCall(incomingCallId, { status: 'active' }).catch(() => {});
    }
    if (incomingCallUser?.id) {
      await markFriendActivityRead({
        peerId: incomingCallUser.id,
        scope: 'calls',
      }).catch(() => {});
    }
    callDocIdRef.current = incomingCallId;
    setActiveCallId(incomingCallId);
    setCallIsCaller(false);
    setCallCameraFacing('user');
    setCallCameraEnabled(true);
    if (incomingCallUser) setChatUser(incomingCallUser);
    setShowIncomingCall(false);
    setCallDuration(0);
    setCallActive(false);
    setCallMuted(false);
    setCallSpeaker(true);
    if (incomingCallKind === 'audio') setShowAudioCall(true);
    else setShowVideoCall(true);
  }, [incomingCallId, incomingCallKind, incomingCallUser, stopRingSound]);

  // Decline incoming call (callee side)
  const declineIncomingCall = useCallback(async () => {
    void stopRingSound();
    if (incomingCallId) {
      await updateCall(incomingCallId, { status: 'declined' }).catch(() => {});
    }
    if (incomingCallUser?.id) {
      await markFriendActivityRead({
        peerId: incomingCallUser.id,
        scope: 'calls',
      }).catch(() => {});
    }
    setShowIncomingCall(false);
    setIncomingCallUser(null);
    setIncomingCallId(null);
  }, [incomingCallId, incomingCallUser, stopRingSound]);

  const sendMessageToPeer = useCallback(async (
    peerUser: any,
    text: string,
    requestedClientId?: string,
  ) => {
    const myId = currentMessagingId || 'guest';
    const otherId = messagingIdentity(peerUser);
    if (!otherId || myId === 'guest') throw new Error('Login required for chat.');
    const peerAuthId = chatIdentity(peerUser) || otherId;
    const senderName = name || userId || 'Masti User';
    const recipientName = peerUser?.name || peerUser?.userId || 'Masti User';
    const clientId =
      requestedClientId || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const result = await sendChatMessageMutation.mutateAsync({
      conversationId: peerUser?.conversationId || chatConversationId(myId, otherId),
      clientId,
      senderMessagingId: myId,
      senderNotificationOwnerId: myId,
      senderId: currentChatAuthId || myId,
      senderName,
      senderAvatar: profileImage || '',
      recipientMessagingId: otherId,
      recipientNotificationOwnerId: otherId,
      recipientId: peerAuthId,
      recipientName,
      recipientAvatar: peerUser?.avatar || peerUser?.profileImage || '',
      text,
    });
    void queryClient.invalidateQueries({
      queryKey: ['listChatConversations', currentAuthUid],
    });
    return result;
  }, [
    currentAuthUid,
    currentChatAuthId,
    currentMessagingId,
    name,
    profileImage,
    queryClient,
    sendChatMessageMutation.mutateAsync,
    userId,
  ]);

  const openChat = useCallback((user: ChatListItem) => {
    const myId = currentMessagingId;
    const otherId = messagingIdentity(user);
    if (!myId) {
      Alert.alert('Login required', 'Sign in to start a chat.');
      return;
    }
    if (!otherId) {
      Alert.alert(
        'Chat unavailable',
        'This profile does not have a verified account identity for messaging yet.',
      );
      return;
    }
    if (otherId === myId) {
      Alert.alert('Chat unavailable', 'You cannot start a chat with your own account.');
      return;
    }

    const conversationId = user.conversationId || chatConversationId(myId, otherId);
    setChatUser({ ...user, conversationId });
    setShowChatMenu(false);
    setIsChatBlocked(false);
    setIsChatBlockedByOther(false);
    setChatMessages([]);
    setChatInput('');
    setChatLoading(true);
    setFriendActivity((previous) => ({
      ...previous,
      [otherId]: {
        peerId: otherId,
        unreadMessage: false,
        unreadCall: false,
      },
    }));
    void markFriendActivityRead({ peerId: otherId, scope: 'all' }).catch((error) => {
      console.warn('[Friends] Could not save read receipt:', error);
    });
    setShowChatScreen(true);
    setShowFriends(false);
    setShowInbox(false);
    setIsProfile(false);
    setShowSearch(false);
    void refreshChatBlockStatus(user);
  }, [currentMessagingId, refreshChatBlockStatus]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profilePTR = usePullToRefresh(useCallback(async () => { await new Promise(r => setTimeout(r, 600)); }, []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const searchPTR = usePullToRefresh(useCallback(async () => { await new Promise(r => setTimeout(r, 600)); }, []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const commentsPTR = usePullToRefresh(useCallback(async () => { await new Promise(r => setTimeout(r, 600)); }, []));

  const handleHomePress = () => {
    restoreHomeFeed();
  };
  
  
  const toggleCameraFacing = () => {
    if (cameraFlipInProgressRef.current) return;
    cameraFlipInProgressRef.current = true;

    Animated.timing(cameraFlipAnim, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setFacing(prev => (prev === 'back' ? 'front' : 'back'));
      Animated.timing(cameraFlipAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        cameraFlipInProgressRef.current = false;
      });
    });
  };
  
    
  const toggleFlash = () => {
    setFlash(prev => (prev === 'off' ? 'on' : 'off'));
  };

  const changeSpeed = () => {
    const speeds = ['0.5x', '1x', '2x', '3x'];
    const currentIndex = speeds.indexOf(speed);
    setSpeed(speeds[(currentIndex + 1) % speeds.length]);
  };

  
  const toggleFollow = async (target: any) => {
    const currentUser = appAuth.currentUser;
    if (!currentUser?.uid) {
      requireAuth(() => {
        void toggleFollow(target);
      });
      return;
    }
    if (!userId) return;
    const targetUserName = typeof target === 'string'
      ? target
      : target?.user || target?.userId || target?.username || target?.userName;
    const targetNotificationId = typeof target === 'string'
      ? target
      : target?.backendUserId ||
        target?.mastiBaseUserId ||
        target?.accountId ||
        target?.email ||
        target?.userEmail ||
        targetUserName;
    if (!targetUserName) return;
    const followDocId = `${userId}_${targetUserName}`;
    const followRef = doc(db, 'follows', followDocId);
    const targetKey = normalizedIdentity(targetUserName);
    const isFollowing = followingUsers.some(
      (handle) => normalizedIdentity(handle) === targetKey,
    );
    const targetMatches = (video: any) => [
      video.user,
      video.userId,
      video.backendUserId,
      video.email,
    ].some((value) =>
      value != null &&
      [targetUserName, targetNotificationId].some(
        (targetId) => normalizedIdentity(value) === normalizedIdentity(targetId),
      ),
    );

    // Optimistic UI update for video follower counts
    setVideos(prev => prev.map(v => {
      if (targetMatches(v)) {
        return { ...v, followers: Math.max(0, (v.followers || 0) + (isFollowing ? -1 : 1)) };
      }
      return v;
    }));

    const followerId =
      currentUser.email?.trim().toLowerCase() ||
      currentUser.uid;
    let remoteFollowing = !isFollowing;
    let remoteFollowerCount: number | undefined;
    try {
      const response = normalizeMastiBaseActionResponse(await followMastiBaseCreator({
        followerId,
        followingId: String(targetNotificationId),
      }));
      if (response.success === false) {
        throw new Error(response.error || 'MastiBase could not update this follow.');
      }
      if (typeof response.isFollowing === 'boolean') {
        remoteFollowing = response.isFollowing;
      }
      remoteFollowerCount = mastiBaseCount(response.followersCount);
    } catch (err) {
      // Rollback optimistic update on failure
      setVideos(prev => prev.map(v => {
        if (targetMatches(v)) {
          return { ...v, followers: Math.max(0, (v.followers || 0) + (isFollowing ? 1 : -1)) };
        }
        return v;
      }));
      console.warn('[MastiBase] Follow update failed:', err);
      Alert.alert('Follow failed', err instanceof Error ? err.message : 'Could not update this follow.');
      return;
    }

    const remoteHandle = String(targetUserName).startsWith('@')
      ? String(targetUserName)
      : `@${String(targetUserName)}`;
    remoteFollowingStateRef.current.set(targetKey, {
      handle: remoteHandle,
      isFollowing: remoteFollowing,
    });
    const optimisticFollowing = !isFollowing;
    const followCorrection = (remoteFollowing ? 1 : 0) - (optimisticFollowing ? 1 : 0);
    setVideos(prev => prev.map(v => {
      if (!targetMatches(v)) return v;
      const currentFollowers = Number(v.followers) || 0;
      return {
        ...v,
        followers: remoteFollowerCount ?? Math.max(0, currentFollowers + followCorrection),
        isFollowing: remoteFollowing,
      };
    }));
    setSelectedProfileCounts((previous) => {
      if (!previous || ![targetUserName, targetNotificationId].some(
        (targetId) => normalizedIdentity(previous.userId) === normalizedIdentity(targetId),
      )) return previous;
      return {
        ...previous,
        followers: remoteFollowerCount ?? Math.max(0, previous.followers + followCorrection),
      };
    });
    setFollowingUsers((previous) =>
      remoteFollowing
        ? previous.some((handle) => normalizedIdentity(handle) === targetKey)
          ? previous
          : [...previous, targetUserName]
        : previous.filter((handle) => normalizedIdentity(handle) !== targetKey),
    );
    const followingDelta = (remoteFollowing ? 1 : 0) - (isFollowing ? 1 : 0);
    setOwnFollowingCount((previous) =>
      Math.max(0, (previous ?? followingUsers.length) + followingDelta),
    );
    const currentEmail = appAuth.currentUser?.email?.trim().toLowerCase();
    if (currentEmail) {
      void getMastiBaseProfile(currentEmail).then((profile) => {
        const followingCount = mastiBaseCount(profile.followingCount);
        const followersCount = mastiBaseCount(profile.followersCount);
        if (followingCount !== undefined) setOwnFollowingCount(followingCount);
        if (followersCount !== undefined) setOwnFollowers(followersCount);
      }).catch((error) => {
        console.warn('[Profile] Could not refresh MastiBase follow counts:', error);
      });
    }
    try {
      if (remoteFollowing) {
        await setDoc(followRef, {
          followerId: userId,
          followeeId: targetUserName,
          followerName: name || userId,
          followerPic: profileImage || '',
          followerUserId: userId,
          followeeBackendId: targetNotificationId,
          createdAt: serverTimestamp(),
        });
        if (!isFollowing) void sendNotification(targetNotificationId, { type: 'follow' });
      } else {
        await deleteDoc(followRef);
      }
    } catch (err) {
      console.warn('[Follow] Local activity mirror could not be updated:', err);
    }
  };


  const handleLike = async (item) => {
    const isLiked = likedVideos[item.id] ?? item.isLiked === true;
    const currentLikeCount = liveLikeCounts[item.id] ??
      mastiBaseCount(item.social?.likes ?? item.likes) ?? 0;
    const optimisticLikeCount = Math.max(0, currentLikeCount + (isLiked ? -1 : 1));
    setLikedVideos(prev => ({ ...prev, [item.id]: !isLiked }));
    setLiveLikeCounts(prev => ({ ...prev, [item.id]: optimisticLikeCount }));
    setVideos(prev => prev.map(v =>
      v.id === item.id ? { ...v, likes: optimisticLikeCount } : v,
    ));

    if (!isLiked) {
      Animated.sequence([
        Animated.spring(likeScale, { toValue: 1.4, friction: 3, useNativeDriver: true }),
        Animated.spring(likeScale, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }

    const actorId =
      appAuth.currentUser?.email?.trim().toLowerCase() ||
      appAuth.currentUser?.uid;
    const mediaId = String(item?.id ?? '').replace(/^db-/, '');
    if (!mediaId) return;

    try {
      if (!actorId) throw new Error('Sign in to like videos.');
      const response = normalizeMastiBaseActionResponse(await likeMastiBaseVideo({
        mediaId,
        userId: actorId,
        userName: name || actorId,
      }));
      if (response.success === false) {
        throw new Error(response.error || 'MastiBase could not save this like.');
      }
      const confirmedLiked = typeof response.isLiked === 'boolean'
        ? response.isLiked
        : !isLiked;
      const confirmedCount = mastiBaseCount(response.likesCount);
      try {
        await setLikeLive(item.id, confirmedLiked, currentLikeCount, confirmedCount);
      } catch (error) {
        console.warn('[Like] MastiBase saved the like; live mirror update failed:', error);
      }
      if (confirmedLiked && !isLiked) {
        // The notification belongs to the video's owner, not the person who
        // performed the action. The helper also keeps the owner's local inbox
        // in sync when the owner likes their own video.
        notifyVideoOwner(item, 'like').catch(() => {});
      }
    } catch (error) {
      setLikedVideos(prev => ({ ...prev, [item.id]: isLiked }));
      setLiveLikeCounts(prev => ({ ...prev, [item.id]: currentLikeCount }));
      setVideos(prev => prev.map(v => v.id === item.id
        ? { ...v, likes: currentLikeCount }
        : v));
      Alert.alert('Like failed', error instanceof Error ? error.message : 'Like save nahi ho saka.');
    }
  };

  const openVideoComments = (item: any) => {
    setCurrentVideoItem(item);
    setShowComments(true);
    const mediaId = String(item?.id ?? '').replace(/^db-/, '');
    if (!mediaId) return;

    void getMastiBaseComments(mediaId).then(async (comments) => {
      setVideoComments((previous) => ({ ...previous, [item.id]: comments }));
      try {
        await setDoc(doc(db, 'videoInteractions', interactionDocId(item.id)), {
          videoId: String(item.id),
          comments,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.warn('[Comments] MastiBase loaded comments; live mirror update failed:', error);
      }
    }).catch((error) => {
      console.warn('[Comments] Could not load comments from MastiBase:', error);
    });
  };

  
  const triggerBigHeart = () => {
    const animationId = ++bigHeartAnimationIdRef.current;
    setShowBigHeart(true);
    bigHeartScale.stopAnimation();
    bigHeartOpacity.stopAnimation();
    bigHeartScale.setValue(0.35);
    bigHeartOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(bigHeartScale, {
          toValue: 1.15,
          friction: 4,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(bigHeartOpacity, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(bigHeartScale, {
          toValue: 0.9,
          friction: 5,
          tension: 55,
          useNativeDriver: true,
        }),
        Animated.timing(bigHeartOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished && animationId === bigHeartAnimationIdRef.current) {
        setShowBigHeart(false);
      }
    });
  };

  const handleVideoTap = (item) => {
    setExpandedVideoDetailsId(null);
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — cancel pending single-tap timer and trigger like
      clearTimeout(singleTapTimerRef.current);
      requireAuth(() => {
        if (!likedVideos[item.id]) {
          handleLike(item);
        }
        triggerBigHeart();
      });
    } else {
      // Possible single tap — wait 300ms to see if a second tap follows
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        // Single tap confirmed → toggle pause / play
        const ref = videoRefs.current[item.id];
        setIsManuallyPaused(prev => {
          const nowPaused = !prev;
          if (ref) {
            if (nowPaused) {
              // Stop both video and audio explicitly
              ref.setStatusAsync?.({ shouldPlay: false }).catch?.(() => {});
              ref.pauseAsync?.().catch?.(() => {});
            } else {
              ref.playAsync?.().catch?.(() => {});
            }
          }
          return nowPaused;
        });
      }, 300);
    }
    lastTapRef.current = now;
  };

  const handleSave = async (item) => {
    const isSaved = savedVideos[item.id] || false;
    const previousCount = saveCounts[item.id] ??
      mastiBaseCount(item.social?.saves ?? item.saves) ?? 0;
    const optimisticCount = Math.max(0, previousCount + (isSaved ? -1 : 1));
    const actorId =
      appAuth.currentUser?.email?.trim().toLowerCase() ||
      appAuth.currentUser?.uid;
    const mediaId = String(item?.id ?? '').replace(/^db-/, '');
    if (!actorId || !mediaId) {
      Alert.alert('Sign in required', 'MastiBase par video save karne ke liye sign in karein.');
      return;
    }

    setSaveCounts(prev => ({ ...prev, [item.id]: optimisticCount }));
    setSavedVideos(prev => ({ ...prev, [item.id]: !isSaved }));
    try {
      const response = normalizeMastiBaseActionResponse(await bookmarkMastiBaseVideo({
        mediaId,
        userId: actorId,
      }));
      if (response.success === false) {
        throw new Error(response.error || 'MastiBase could not save this bookmark.');
      }
      const confirmedSaved = typeof response.isBookmarked === 'boolean'
        ? response.isBookmarked
        : !isSaved;
      const confirmedCount = mastiBaseCount(response.savesCount) ?? optimisticCount;
      setSavedVideos(prev => ({ ...prev, [item.id]: confirmedSaved }));
      setSaveCounts(prev => ({ ...prev, [item.id]: confirmedCount }));
      try {
        await toggleSaveLive(item.id, confirmedSaved, confirmedCount);
      } catch (error) {
        console.warn('[Save] MastiBase saved the bookmark; live mirror update failed:', error);
      }
      if (confirmedSaved && !isSaved) {
        notifyVideoOwner(item, 'save').catch(() => {});
      }
    } catch (error) {
      setSavedVideos(prev => ({ ...prev, [item.id]: isSaved }));
      setSaveCounts(prev => ({ ...prev, [item.id]: previousCount }));
      Alert.alert('Save failed', error instanceof Error ? error.message : 'MastiBase par save nahi ho saka.');
    }
  };

  // ─── NEW: Camera gesture handlers ─────────────────────────────────────────
  const handleCameraTap = useCallback((evt) => {
    const now = Date.now();
    const { locationX, locationY } = evt.nativeEvent;
    if (cameraPinchMovedRef.current || now - cameraPinchEndRef.current < 350) {
      cameraPinchMovedRef.current = false;
      return;
    }

    if (now - lastCameraTapRef.current < 300 && lastCameraTapRef.current !== 0) {
      // Double tap → flip camera
      if (cameraSingleTapTimerRef.current) {
        clearTimeout(cameraSingleTapTimerRef.current);
        cameraSingleTapTimerRef.current = null;
      }
      lastCameraTapRef.current = 0;
      toggleCameraFacing();
    } else {
      // Wait briefly so a second tap can switch the camera instead.
      lastCameraTapRef.current = now;
      if (cameraSingleTapTimerRef.current) {
        clearTimeout(cameraSingleTapTimerRef.current);
      }
      cameraSingleTapTimerRef.current = setTimeout(() => {
        // Single tap → show focus reticle
        setFocusPoint({ x: locationX, y: locationY });
        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => setFocusPoint(null), 1500);
        cameraSingleTapTimerRef.current = null;
      }, 300);
    }
  }, []);

  const cameraPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
    onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 2,
    onPanResponderGrant: (evt) => {
      if (evt.nativeEvent.touches.length >= 2) {
        const [t1, t2] = evt.nativeEvent.touches;
        const dx = t2.pageX - t1.pageX;
        const dy = t2.pageY - t1.pageY;
        pinchInitialDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        pinchInitialZoomRef.current = cameraZoomRef.current;
        cameraPinchMovedRef.current = false;
        cameraPinchActiveRef.current = true;
      }
    },
    onPanResponderMove: (evt) => {
      if (evt.nativeEvent.touches.length >= 2) {
        const [t1, t2] = evt.nativeEvent.touches;
        const dx = t2.pageX - t1.pageX;
        const dy = t2.pageY - t1.pageY;
        const currentDist = Math.sqrt(dx * dx + dy * dy);

        // If the first finger started the responder, initialize the pinch
        // when the second finger arrives instead of jumping the zoom.
        if (!cameraPinchActiveRef.current || pinchInitialDistanceRef.current <= 1) {
          pinchInitialDistanceRef.current = currentDist;
          pinchInitialZoomRef.current = cameraZoomRef.current;
          cameraPinchActiveRef.current = true;
          cameraPinchMovedRef.current = false;
          return;
        }

        const scale = currentDist / (pinchInitialDistanceRef.current || 1);
        if (Math.abs(currentDist - pinchInitialDistanceRef.current) > 8) {
          cameraPinchMovedRef.current = true;
        }
        // Pinch in = zoom out, pinch out = zoom in, like Instagram/TikTok.
        const newZoom = Math.max(0, Math.min(1, pinchInitialZoomRef.current + (scale - 1) * 0.5));
        cameraZoomRef.current = newZoom;
        setCameraZoom(newZoom);
        // Show zoom label during pinch
        if (zoomLabelTimerRef.current) clearTimeout(zoomLabelTimerRef.current);
        setShowZoomLabel(true);
        zoomLabelTimerRef.current = setTimeout(() => setShowZoomLabel(false), 1500);
      }
    },
    onPanResponderRelease: () => {
      if (cameraPinchMovedRef.current) {
        cameraPinchEndRef.current = Date.now();
      }
      pinchInitialDistanceRef.current = 0;
      cameraPinchActiveRef.current = false;
    },
    onPanResponderTerminate: () => {
      cameraPinchMovedRef.current = false;
      pinchInitialDistanceRef.current = 0;
      cameraPinchActiveRef.current = false;
    },
  }), []);
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Thumbnail extraction when edit modal opens ──────────────────────────
  useEffect(() => {
    if (!showEditModal || !recordedVideoUri) return;
    if (filmFrames.length > 0) return;
    const NUM = 10;
    const extract = async () => {
      const dur = videoDurationMsRef.current || videoDurationMs;
      if (dur <= 0) { setTimeout(extract, 900); return; }
      const frames: string[] = [];
      for (let i = 0; i < NUM; i++) {
        const t = Math.max(0, Math.floor((i / NUM) * dur));
        try {
          const res = await VideoThumbnails.getThumbnailAsync(recordedVideoUri, { time: t, quality: 0.3 });
          frames.push(res.uri);
        } catch (_) {}
      }
      if (frames.length > 0) setFilmFrames(frames);
    };
    extract();
  }, [showEditModal, recordedVideoUri, videoDurationMs]);
  // ─────────────────────────────────────────────────────────────────────────

  // ─── NEW: Trim timeline PanResponder ─────────────────────────────────────
  const timelineWidth = width - 32;
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(1);
  const trimDragStartRef = useRef(0);
  const trimDragEndRef = useRef(1);
  const trimPreviewPositionRef = useRef(0);
  const trimSeekTargetRef = useRef<number | null>(null);
  const trimSeekInFlightRef = useRef(false);

  // keep trim refs always in sync with state so cross-handle reads are accurate
  useEffect(() => { trimStartRef.current = trimStart; }, [trimStart]);
  useEffect(() => { trimEndRef.current  = trimEnd;   }, [trimEnd]);

  // Keep preview seeks serialized. Expo AV can queue setPositionAsync calls if
  // the finger moves faster than the native player can seek.
  const seekTrimPreview = useCallback((preferredProgress?: number) => {
    const duration = videoDurationMsRef.current || videoDurationMs;
    if (duration <= 0) return;

    const start = trimStartRef.current;
    const end = trimEndRef.current;
    const current = trimPreviewPositionRef.current;
    const progress = Math.max(start, Math.min(end, preferredProgress ?? current));
    trimSeekTargetRef.current = progress * duration;

    if (trimSeekInFlightRef.current) return;
    trimSeekInFlightRef.current = true;

    const flushTrimSeek = async () => {
      while (trimSeekTargetRef.current !== null) {
        const targetMs = trimSeekTargetRef.current;
        trimSeekTargetRef.current = null;
        const videoRefs = [editorVideoRef.current, editModalVideoRef.current].filter(Boolean);
        await Promise.all(videoRefs.map((video: any) => video.setPositionAsync(targetMs).catch(() => {})));
      }
      trimSeekInFlightRef.current = false;
    };

    flushTrimSeek();
  }, [videoDurationMs]);

  useEffect(() => {
    if (editorActiveTool === 'edit') {
      seekTrimPreview(trimStartRef.current);
    }
  }, [editorActiveTool, seekTrimPreview]);

  const leftHandlePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      trimDragStartRef.current = trimStartRef.current;
      trimDragEndRef.current = trimEndRef.current;
    },
    onPanResponderMove: (evt, gs) => {
      const delta = gs.dx / timelineWidth;
      const newStart = Math.max(0, Math.min(trimDragEndRef.current - 0.05, trimDragStartRef.current + delta));
      trimStartRef.current = newStart;
      setTrimStart(newStart);
      seekTrimPreview(newStart);
    },
  }), [seekTrimPreview, timelineWidth]);

  const rightHandlePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      trimDragStartRef.current = trimStartRef.current;
      trimDragEndRef.current = trimEndRef.current;
    },
    onPanResponderMove: (evt, gs) => {
      const delta = gs.dx / timelineWidth;
      const newEnd = Math.max(trimDragStartRef.current + 0.05, Math.min(1, trimDragEndRef.current + delta));
      trimEndRef.current = newEnd;
      setTrimEnd(newEnd);
      seekTrimPreview(Math.max(trimStartRef.current, Math.min(trimPreviewPositionRef.current, newEnd)));
    },
  }), [seekTrimPreview, timelineWidth]);

  // ── Scrollable-timeline trim handles (delta relative to TOTAL_W, not screen width) ──
  const totalWRef = useRef((width - 32) * 1.4); // updated each render by the IIFE
  const videoLeftScrollPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      trimDragStartRef.current = trimStartRef.current;
      trimDragEndRef.current = trimEndRef.current;
    },
    onPanResponderMove: (_evt, gs) => {
      const delta = gs.dx / (totalWRef.current || 1);
      const newStart = Math.max(0, Math.min(trimDragEndRef.current - 0.05, trimDragStartRef.current + delta));
      trimStartRef.current = newStart;
      setTrimStart(newStart);
      seekTrimPreview(newStart);
    },
  }), [seekTrimPreview]);
  const videoRightScrollPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      trimDragStartRef.current = trimStartRef.current;
      trimDragEndRef.current = trimEndRef.current;
    },
    onPanResponderMove: (_evt, gs) => {
      const delta = gs.dx / (totalWRef.current || 1);
      const newEnd = Math.max(trimDragStartRef.current + 0.05, Math.min(1, trimDragEndRef.current + delta));
      trimEndRef.current = newEnd;
      setTrimEnd(newEnd);
      seekTrimPreview(Math.max(trimStartRef.current, Math.min(trimPreviewPositionRef.current, newEnd)));
    },
  }), [seekTrimPreview]);

  // Audio track trim handles
  const audioTrimStartRef = useRef(0);
  const audioTrimEndRef   = useRef(1);
  useEffect(() => { audioTrimStartRef.current = audioTrimStart; }, [audioTrimStart]);
  useEffect(() => { audioTrimEndRef.current   = audioTrimEnd;   }, [audioTrimEnd]);
  const audioLeftPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { audioTrimStartRef.current = audioTrimStart; },
    onPanResponderMove: (_, gs) => {
      const delta = gs.dx / timelineWidth;
      setAudioTrimStart(Math.max(0, Math.min(audioTrimEndRef.current - 0.05, audioTrimStartRef.current + delta)));
    },
  }), [audioTrimStart, timelineWidth]);
  const audioRightPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { audioTrimEndRef.current = audioTrimEnd; },
    onPanResponderMove: (_, gs) => {
      const delta = gs.dx / timelineWidth;
      setAudioTrimEnd(Math.max(audioTrimStartRef.current + 0.05, Math.min(1, audioTrimEndRef.current + delta)));
    },
  }), [audioTrimEnd, timelineWidth]);

  // Text track trim handles
  const textTrimStartRef = useRef(0);
  const textTrimEndRef   = useRef(1);
  useEffect(() => { textTrimStartRef.current = textTrimStart; }, [textTrimStart]);
  useEffect(() => { textTrimEndRef.current   = textTrimEnd;   }, [textTrimEnd]);
  const textLeftPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { textTrimStartRef.current = textTrimStart; },
    onPanResponderMove: (_, gs) => {
      const delta = gs.dx / timelineWidth;
      setTextTrimStart(Math.max(0, Math.min(textTrimEndRef.current - 0.05, textTrimStartRef.current + delta)));
    },
  }), [textTrimStart, timelineWidth]);
  const textRightPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { textTrimEndRef.current = textTrimEnd; },
    onPanResponderMove: (_, gs) => {
      const delta = gs.dx / timelineWidth;
      setTextTrimEnd(Math.max(textTrimStartRef.current + 0.05, Math.min(1, textTrimEndRef.current + delta)));
    },
  }), [textTrimEnd, timelineWidth]);
  // ─────────────────────────────────────────────────────────────────────────

  const CameraModalOverlay = () => {
    if (!showCamera) return null;

    // ─── NEW: Review Screen ───────────────────────────────────────────────
    if (recordedVideoUri && recordingFlowStep === 'review') {
      return (
        <View style={styles.cameraContainer}>
          {/* Cinematic black bars — same as camera screen */}
          <View style={[flowStyles.cinematicBar, { top: 0, height: 62 }]} />
          <View style={[flowStyles.cinematicBar, { bottom: 0, height: 80 }]} />

          {/* Top bar: X | flash | ••• */}
          <View style={flowStyles.rvTopBar}>
            <TouchableOpacity onPress={discardRecordedVideo} style={flowStyles.rvTopBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={flowStyles.rvTopBtn} onPress={toggleFlash}>
              <Ionicons name={flash === 'off' ? 'flash-off' : 'flash'} size={22} color={flash === 'off' ? '#fff' : '#FFD700'} />
            </TouchableOpacity>
            <TouchableOpacity style={flowStyles.rvTopBtn}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

           {/* Full 9:16 video — centered at the same size, with only the
               rounded outer frame added. */}
           <View style={{
             position: 'absolute',
             top: 62,
             left: 0,
             width,
             height: width * (16 / 9) > height ? height : width * (16 / 9),
             backgroundColor: '#000',
             alignItems: 'center',
             justifyContent: 'center',
           }}>
             <View style={{
               width,
               height: width * (16 / 9) > height ? height : width * (16 / 9),
               borderRadius: 20,
               overflow: 'hidden',
               backgroundColor: '#000',
             }}>
               <Video
                 key={recordedVideoUri}
                 source={{ uri: recordedVideoUri }}
                 style={{ width: '100%', height: '100%' }}
                 resizeMode="contain"
                 shouldPlay
                 isLooping
                 useNativeControls={false}
               />
             </View>
          </View>

          {/* Right-side options — camera style overlay */}
          <View style={[styles.cameraRightOptions, { top: 115, width: 68 }]}>
            {([
              { kind: 'ion',   icon: 'musical-note', label: 'Music',   action: () => setShowMusicModal(true) },
              { kind: 'ion',   icon: 'speedometer',  label: speed,     action: changeSpeed },
              { kind: 'ion',   icon: 'sparkles',     label: 'Effects', action: () => setShowEffects(true) },
              { kind: 'ion',   icon: 'color-filter', label: 'Filter',  action: () => setShowFilters(true) },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.cameraOptionItem, { width: 68, alignItems: 'center' }]}
                onPress={opt.action}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={opt.icon as any} size={24} color="#fff" />
                </View>
                <Text
                  style={[styles.cameraOptionText, { textAlign: 'center', width: 68 }]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom bar: Delete | Camera record button (re-record) | Next > */}
          <View style={flowStyles.rvBottomBar}>
            <TouchableOpacity style={flowStyles.rvDeleteBtn} onPress={discardRecordedVideo}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={flowStyles.rvDeleteText}>Delete</Text>
            </TouchableOpacity>

            {/* Camera-style record button → taps discard so user re-records */}
            <TouchableOpacity style={styles.recordBtn} onPress={discardRecordedVideo}>
              <View style={styles.recordBtnInner} />
            </TouchableOpacity>
            <TouchableOpacity
              style={flowStyles.rvNextBtn}
              onPress={() => setRecordingFlowStep('editor')}
            >
              <Text style={flowStyles.rvNextText}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ─── Editor Screen ────────────────────────────────────────────────────
    if ((recordedVideoUri || videoDeleted) && recordingFlowStep === 'editor') {
      return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.cameraContainer}>
          <View style={styles.cameraContainer}>

            {/* 9:16 video — keep the original full-size footprint, but clip it
                into the rounded portrait frame used by the reference editor. */}
            {recordedVideoUri ? (
              <View style={{
                position: 'absolute',
                top: 62,
                left: 0,
                width,
                height: Math.min(height, width * (16 / 9)),
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: '#000',
              }}>
                <Video
                  ref={editorVideoRef}
                  source={{ uri: recordedVideoUri }}
                  style={{ width: '100%', height: '100%', borderRadius: 20 }}
                  resizeMode="contain"
                  shouldPlay
                  isLooping={false}
                  useNativeControls={false}
                  isMuted={showMixAudio || showEditModal}
                  onPlaybackStatusUpdate={(status) => {
                    if (!status.isLoaded) return;
                    if (status.durationMillis && videoDurationMsRef.current === 0) {
                      videoDurationMsRef.current = status.durationMillis;
                      setVideoDurationMs(status.durationMillis);
                    }
                    if (status.durationMillis && status.durationMillis > 0) {
                      setPlaybackProgress((status.positionMillis || 0) / status.durationMillis);
                    }
                     if (status.isPlaying && videoDurationMsRef.current > 0) {
                       const totalDur = videoDurationMsRef.current;
                       const positionMs = status.positionMillis || 0;
                       const segments = editedVideoSegmentsRef.current;
                       const toleranceMs = 45;
                       const currentIndex = segments.findIndex((segment) => (
                         positionMs >= segment.start * totalDur - toleranceMs &&
                         positionMs < segment.end * totalDur
                       ));
                       if (currentIndex < 0) {
                         const nextSegment = segments.find(
                           (segment) => segment.start * totalDur > positionMs + toleranceMs,
                         );
                         editorVideoRef.current?.setPositionAsync(
                           (nextSegment || segments[0]).start * totalDur,
                         ).catch(() => {});
                       } else if (positionMs >= segments[currentIndex].end * totalDur - toleranceMs) {
                         const nextSegment = segments[currentIndex + 1] || segments[0];
                         editorVideoRef.current?.setPositionAsync(nextSegment.start * totalDur).catch(() => {});
                       }
                     }
                    if (!status.isPlaying && status.didJustFinish) {
                       const firstSegment = editedVideoSegmentsRef.current[0];
                       editorVideoRef.current?.setPositionAsync(
                         (firstSegment?.start ?? trimStartRef.current) * videoDurationMsRef.current,
                       );
                      editorVideoRef.current?.playAsync();
                    }
                  }}
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickVideoForEditor}
                activeOpacity={0.8}
                style={{
                  position: 'absolute',
                   top: 62,
                  left: 0,
                  width,
                   height: Math.min(height, width * (16 / 9)),
                  borderRadius: 20,
                  overflow: 'hidden',
                  backgroundColor: '#111',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#888', fontSize: 14 }}>+ Add video</Text>
              </TouchableOpacity>
            )}

            {/* Progress bar — thin white line right at the top edge of the black toolbar, fills L→R with playback */}
            <View style={{ position: 'absolute', top: 62 + width * (16 / 9) - 50, left: 0, width: width, height: 3, backgroundColor: 'rgba(255,255,255,0.18)', zIndex: 110 }}>
              <View style={{ height: 3, width: width * playbackProgress, backgroundColor: '#fff', borderRadius: 1.5 }} />
            </View>

            {/* Text overlays on video — draggable + pinch-zoomable */}
            {textOverlays
              .filter((ov) => playbackProgress >= (ov.startProgress ?? 0) - 0.002 && playbackProgress < (ov.endProgress ?? 1) + 0.002)
              .map((ov) => (
              <DraggableOverlay
                key={ov.id}
                id={ov.id}
                x={ov.x}
                y={ov.y}
                size={ov.size}
                onUpdate={(id, u) => setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...u } : t))}
                onDelete={(id) => setTextOverlays(prev => prev.filter(t => t.id !== id))}
              >
                <Text style={{ color: ov.color, fontSize: ov.size, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }}>{ov.text}</Text>
              </DraggableOverlay>
            ))}

            {/* Sticker overlays on video — draggable + pinch-zoomable */}
            {stickerOverlays.map((s) => (
              <DraggableOverlay
                key={s.id}
                id={s.id}
                x={s.x}
                y={s.y}
                size={s.size}
                onUpdate={(id, u) => setStickerOverlays(prev => prev.map(st => st.id === id ? { ...st, ...u } : st))}
                onDelete={(id) => setStickerOverlays(prev => prev.filter(st => st.id !== id))}
              >
                <Text style={{ fontSize: s.size }}>{s.emoji}</Text>
              </DraggableOverlay>
            ))}

            {/* ── STATUS BAR PATTI (only) ── */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 24), backgroundColor: '#000', zIndex: 101 }} />

            {/* ── TOP BAR — transparent, sits right below patti ── */}
            <View style={[flowStyles.edTopBar, { top: (Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 24)) + 12 }]}>
              <TouchableOpacity onPress={() => setRecordingFlowStep('review')} style={flowStyles.edBackBtn}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>

              {/* Selected song banner */}
              {selectedSong && (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 8 }}>
                  <Ionicons name="musical-note" size={14} color="#FE2C55" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#fff', fontSize: 12, flex: 1 }} numberOfLines={1}>{selectedSong.title}</Text>
                </View>
              )}

              <TouchableOpacity style={flowStyles.edDotsBtn} onPress={() => setShowDotsMenu(v => !v)}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Dots menu */}
            {showDotsMenu && (
              <View style={{ position: 'absolute', top: 56, right: 14, backgroundColor: '#1A1A1A', borderRadius: 12, overflow: 'hidden', zIndex: 200, minWidth: 170 }}>
                {[
                  { icon: 'save-outline',    label: 'Draft Save karo',  action: () => { showSuccessToast('Draft save ho gaya.'); setShowDotsMenu(false); } },
                  { icon: 'share-social-outline', label: 'Share karo', action: () => { setShowDotsMenu(false); handleShare({ desc: uploadTitle, url: recordedVideoUri, id: 'draft' }); } },
                  { icon: 'trash-outline',   label: 'Discard karo',     action: () => { setShowDotsMenu(false); discardRecordedVideo(); } },
                ].map((item, i) => (
                  <TouchableOpacity key={i} onPress={item.action} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: '#333' }}>
                    <Ionicons name={item.icon} size={18} color="#fff" style={{ marginRight: 12 }} />
                    <Text style={{ color: '#fff', fontSize: 14 }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ══ TOOL PANELS (above bottom bar) ══ */}

            {/* ── EDIT / TRIM panel ── */}
            {editorActiveTool === 'edit' && (
              <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 88, left: 0, right: 0, backgroundColor: '#0D0D0D', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, zIndex: 90, borderTopWidth: 1, borderTopColor: '#222' }}>

                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>Trim</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (editorVideoRef.current && videoDurationMsRef.current > 0) {
                        editorVideoRef.current.setPositionAsync(trimStartRef.current * videoDurationMsRef.current);
                      }
                      setEditorActiveTool(null);
                    }}
                    style={{ backgroundColor: '#FFD700', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20 }}
                  >
                    <Text style={{ color: '#000', fontSize: 13, fontWeight: '800' }}>✓ Apply</Text>
                  </TouchableOpacity>
                </View>

                {/* Filmstrip timeline */}
                <View style={{ height: 58, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1A', marginBottom: 12 }}>
                  {/* Film frames */}
                  <View style={{ flex: 1, flexDirection: 'row' }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <View key={i} style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', backgroundColor: i % 2 === 0 ? '#1E1E1E' : '#171717' }}>
                        <View style={{ width: 2, height: 10, backgroundColor: '#2E2E2E', borderRadius: 1 }} />
                      </View>
                    ))}
                  </View>

                  {/* Dimmed — left of selection */}
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${trimStart * 100}%`, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                  {/* Dimmed — right of selection */}
                  <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${(1 - trimEnd) * 100}%`, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                  {/* Selected region top+bottom border */}
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${trimStart * 100}%`, right: `${(1 - trimEnd) * 100}%`, borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#FFD700' }} />

                  {/* Left handle */}
                  <View {...leftHandlePan.panHandlers} style={{ position: 'absolute', top: 0, bottom: 0, left: `${trimStart * 100}%`, width: 24, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>
                    <Text style={{ color: '#000', fontSize: 11, fontWeight: '900', lineHeight: 13 }}>{'|'}{'\n'}{'|'}</Text>
                  </View>
                  {/* Right handle */}
                  <View {...rightHandlePan.panHandlers} style={{ position: 'absolute', top: 0, bottom: 0, right: `${(1 - trimEnd) * 100}%`, width: 24, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>
                    <Text style={{ color: '#000', fontSize: 11, fontWeight: '900', lineHeight: 13 }}>{'|'}{'\n'}{'|'}</Text>
                  </View>
                </View>

                {/* Time row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: '#777', fontSize: 10, marginBottom: 2 }}>Start</Text>
                    <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>
                      {videoDurationMs > 0 ? `${(trimStart * videoDurationMs / 1000).toFixed(1)}s` : `${(trimStart * 60).toFixed(1)}s`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    trimStartRef.current = 0;
                    trimEndRef.current = 1;
                    setTrimStart(0);
                    setTrimEnd(1);
                    seekTrimPreview(0);
                  }} style={{ paddingHorizontal: 16, paddingVertical: 5, backgroundColor: '#222', borderRadius: 20 }}>
                    <Text style={{ color: '#777', fontSize: 12 }}>Reset</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#777', fontSize: 10, marginBottom: 2 }}>End</Text>
                    <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>
                      {videoDurationMs > 0 ? `${(trimEnd * videoDurationMs / 1000).toFixed(1)}s` : `${(trimEnd * 60).toFixed(1)}s`}
                    </Text>
                  </View>
                </View>

              </View>
            )}

            {/* ── EFFECTS / FILTER panel ── */}
            {/* Effects panel removed — now opens full-screen Filter Modal */}

            {/* ── MIX YOUR AUDIO — full-screen Modal (reference image style) ── */}
            <Modal visible={showMixAudio} animationType="slide" transparent={false} onRequestClose={() => setShowMixAudio(false)}>
              <View style={{ flex: 1, backgroundColor: '#000' }}>

                {/* ── Top bar: Cancel (left) · Done (right) — NO title in middle ── */}
                <View style={{ paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <TouchableOpacity onPress={() => setShowMixAudio(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '500' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowMixAudio(false)} hitSlop={{ top: 10, bottom: 10, left: 20, right: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* ── Video preview — smaller, centered, with black bars ── */}
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                  {(() => {
                    const vw = width * 0.52;
                    const vh = vw * (16 / 9);
                    return (
                      <>
                        <Video
                          source={{ uri: recordedVideoUri }}
                          style={{ width: vw, height: vh, borderRadius: 10 }}
                          resizeMode="cover"
                          shouldPlay
                          isLooping
                          useNativeControls={false}
                          isMuted={originalSoundVol === 0}
                          volume={originalSoundVol / 100}
                        />
                        {selectedSong && (
                          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(56,151,240,0.18)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#3897F0', maxWidth: vw }}>
                            <Ionicons name="musical-note" size={12} color="#3897F0" style={{ marginRight: 5 }} />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{selectedSong.title}</Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>

                {/* ── Mix audio panel — compact ── */}
                <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 30 : 16, paddingHorizontal: 16 }}>
                  {/* Handle */}
                  <View style={{ width: 32, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 14 }} />

                  {/* "Mix your audio" title + info */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Mix your audio</Text>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#777', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#777', fontSize: 11, fontWeight: '700' }}>i</Text>
                    </View>
                  </View>

                  {/* Original Sound Slider */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="volume-medium" size={16} color="#fff" />
                    </View>
                    <View style={{ flex: 1, height: 36, justifyContent: 'center' }}
                      onStartShouldSetResponder={() => true}
                      onResponderGrant={(e) => {
                        const tw = width - 32 - 30 - 10 - 52 - 10;
                        setOriginalSoundVol(Math.round(Math.max(0, Math.min(100, (e.nativeEvent.locationX / tw) * 100))));
                      }}
                      onResponderMove={(e) => {
                        const tw = width - 32 - 30 - 10 - 52 - 10;
                        setOriginalSoundVol(Math.round(Math.max(0, Math.min(100, (e.nativeEvent.locationX / tw) * 100))));
                      }}
                    >
                      <View style={{ height: 4, backgroundColor: '#3A3A3C', borderRadius: 2 }}>
                        <View style={{ height: 4, width: `${originalSoundVol}%`, backgroundColor: '#3897F0', borderRadius: 2 }} />
                      </View>
                      <View style={{ position: 'absolute', left: `${Math.min(originalSoundVol, 96)}%`, top: 10, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', elevation: 4 }} />
                    </View>
                    <TouchableOpacity style={{ width: 48, alignItems: 'flex-end' }} onPress={() => setOriginalSoundVol(v => v > 0 ? 0 : 80)}>
                      <Text style={{ color: originalSoundVol === 0 ? '#FE2C55' : '#3897F0', fontSize: 13, fontWeight: '600' }}>
                        {originalSoundVol === 0 ? 'Muted' : 'Mute'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Music Volume Slider (generic — only when NO song selected) */}
                  {!selectedSong && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="musical-note" size={16} color="#fff" />
                      </View>
                      <View style={{ flex: 1, height: 32, justifyContent: 'center' }}
                        onStartShouldSetResponder={() => true}
                        onResponderGrant={(e) => {
                          const tw = width - 32 - 30 - 10 - 52 - 10;
                          setMusicVol(Math.round(Math.max(0, Math.min(100, (e.nativeEvent.locationX / tw) * 100))));
                        }}
                        onResponderMove={(e) => {
                          const tw = width - 32 - 30 - 10 - 52 - 10;
                          setMusicVol(Math.round(Math.max(0, Math.min(100, (e.nativeEvent.locationX / tw) * 100))));
                        }}
                      >
                        <View style={{ height: 4, backgroundColor: '#3A3A3C', borderRadius: 2 }}>
                          <View style={{ height: 4, width: `${musicVol}%`, backgroundColor: '#3897F0', borderRadius: 2 }} />
                        </View>
                        <View style={{ position: 'absolute', left: `${Math.min(musicVol, 96)}%`, top: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', elevation: 4 }} />
                      </View>
                      <TouchableOpacity style={{ width: 48, alignItems: 'flex-end' }} onPress={() => setMusicVol(v => v > 0 ? 0 : 60)}>
                        <Text style={{ color: musicVol === 0 ? '#FE2C55' : '#3897F0', fontSize: 13, fontWeight: '600' }}>
                          {musicVol === 0 ? 'Off' : 'On'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ── Music track row — shows when song IS selected ── */}
                  {selectedSong && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      {/* Song thumbnail with play/pause overlay */}
                      <TouchableOpacity
                        style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                        onPress={() => setMixPanelPlaying(v => !v)}
                        activeOpacity={0.8}
                      >
                        {selectedSong.cover
                          ? <Image source={{ uri: selectedSong.cover }} style={{ width: 30, height: 30 }} />
                          : <Ionicons name="musical-notes" size={14} color="#3897F0" />
                        }
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={mixPanelPlaying ? 'pause' : 'play'} size={13} color="#fff" />
                        </View>
                      </TouchableOpacity>
                      {/* Blue slider for music volume */}
                      <View style={{ flex: 1, height: 32, justifyContent: 'center' }}
                        onStartShouldSetResponder={() => true}
                        onResponderGrant={(e) => {
                          const tw = width - 32 - 30 - 10 - 48 - 10;
                          setMusicVol(Math.round(Math.max(0, Math.min(100, (e.nativeEvent.locationX / tw) * 100))));
                        }}
                        onResponderMove={(e) => {
                          const tw = width - 32 - 30 - 10 - 48 - 10;
                          setMusicVol(Math.round(Math.max(0, Math.min(100, (e.nativeEvent.locationX / tw) * 100))));
                        }}
                      >
                        <View style={{ height: 4, backgroundColor: '#3A3A3C', borderRadius: 2 }}>
                          <View style={{ height: 4, width: `${musicVol}%`, backgroundColor: '#3897F0', borderRadius: 2 }} />
                        </View>
                        <View style={{ position: 'absolute', left: `${Math.min(musicVol, 96)}%`, top: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', elevation: 4 }} />
                      </View>
                      {/* Edit — opens music modal again */}
                      <TouchableOpacity
                        style={{ width: 40, alignItems: 'flex-end' }}
                        onPress={() => { setShowMixAudio(false); setTimeout(() => setShowMusicModal(true), 300); }}
                      >
                        <Text style={{ color: '#3897F0', fontSize: 13, fontWeight: '600' }}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Buttons */}
                  {/* Add music — only when NO song selected */}
                  {!selectedSong && (
                    <TouchableOpacity
                      onPress={() => { setShowMixAudio(false); setTimeout(() => setShowMusicModal(true), 300); }}
                      style={{ backgroundColor: '#3897F0', borderRadius: 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 8 }}
                    >
                      <Ionicons name="musical-notes" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Add music</Text>
                    </TouchableOpacity>
                  )}

                  {/* Add voiceover — always visible */}
                  <TouchableOpacity
                    onPress={() => Alert.alert('Add Voiceover', 'Coming soon!')}
                    style={{ backgroundColor: '#3897F0', borderRadius: 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                  >
                    <Ionicons name="mic" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Add voiceover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* ── EDIT MODAL ── */}
            <Modal visible={showEditModal} animationType="slide" transparent={false} onRequestClose={() => { setShowEditModal(false); setShowVideoTimeline(false); }}>
              <View style={emStyles.root}>

                {/* ── Cancel / Done ── */}
                <View style={emStyles.topBar}>
                  <TouchableOpacity onPress={() => setShowEditModal(false)} hitSlop={{ top:10,bottom:10,left:10,right:20 }}>
                    <Text style={emStyles.topCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowEditModal(false)} hitSlop={{ top:10,bottom:10,left:20,right:10 }}>
                    <Text style={emStyles.topDone}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* ── Video preview ── tap to toggle timeline | pinch to zoom ── */}
                <GestureDetector gesture={videoPinchGesture}>
                  <Reanimated.View style={[emStyles.videoWrap, videoAnimStyle]}>
                    {/* Tap se timeline toggle — GestureDetector se alag rakhne ke liye TouchableOpacity */}
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => setShowVideoTimeline(prev => !prev)}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
                    />
                    {recordedVideoUri ? (
                      <Video
                        ref={editModalVideoRef}
                        source={{ uri: recordedVideoUri }}
                        style={emStyles.video}
                        resizeMode="cover"
                        shouldPlay={editModalPlaying}
                        isLooping={false}
                        useNativeControls={false}
                        isMuted={originalSoundVol === 0}
                        volume={originalSoundVol / 100}
                        onPlaybackStatusUpdate={(status: any) => {
                          if (!status.isLoaded) return;
                          if (status.durationMillis && videoDurationMsRef.current === 0) {
                            videoDurationMsRef.current = status.durationMillis;
                            setVideoDurationMs(status.durationMillis);
                          }
                          const totalDur = videoDurationMsRef.current || videoDurationMs || status.durationMillis || 0;
                          if (status.positionMillis != null && totalDur > 0) {
                            const positionMs = status.positionMillis;
                            const previewProgress = positionMs / totalDur;
                             editModalSourceProgressRef.current = previewProgress;
                            trimPreviewPositionRef.current = previewProgress;
                            const now = Date.now();
                            if (
                              now - lastEditModalUiUpdateRef.current > 100 ||
                              status.didJustFinish
                            ) {
                              lastEditModalUiUpdateRef.current = now;
                              editModalPositionRef.current = positionMs / 1000;
                              setEditModalPosition(positionMs / 1000);
                            }

                             // Play only the retained timeline segments. A
                             // native player still knows about the original
                             // source, so explicitly jump across every
                             // deleted/trimmed range before it can be shown.
                             const segments = editedVideoSegmentsRef.current;
                             if (segments.length > 0) {
                               const toleranceMs = 45;
                               const currentIndex = segments.findIndex((segment) => {
                                 const startMs = segment.start * totalDur;
                                 const endMs = segment.end * totalDur;
                                 return positionMs >= startMs - toleranceMs && positionMs < endMs;
                               });
                               const currentSegment = currentIndex >= 0 ? segments[currentIndex] : null;
                               if (!currentSegment) {
                                 const nextSegment = segments.find(
                                   (segment) => segment.start * totalDur > positionMs + toleranceMs,
                                 );
                                 if (nextSegment) {
                                   queueEditorSeek(
                                     nextSegment.start * totalDur,
                                     status.isPlaying || editModalPlayingRef.current,
                                   );
                                 } else if (
                                   status.didJustFinish ||
                                   positionMs >= segments[segments.length - 1].end * totalDur - toleranceMs
                                 ) {
                                   editModalVideoRef.current?.pauseAsync().catch(() => {});
                                   setEditModalPlaying(false);
                                 }
                               } else if (
                                 positionMs >= currentSegment.end * totalDur - toleranceMs
                               ) {
                                 const nextSegment = segments[currentIndex + 1];
                                 if (nextSegment) {
                                   queueEditorSeek(
                                     nextSegment.start * totalDur,
                                     status.isPlaying || editModalPlayingRef.current,
                                   );
                                 } else {
                                   editModalVideoRef.current?.pauseAsync().catch(() => {});
                                   setEditModalPlaying(false);
                                 }
                               }
                             }

                            if (
                              !isTimelineDraggingRef.current &&
                              showVideoTimeline &&
                              now - lastTimelineSyncRef.current > 120
                            ) {
                              lastTimelineSyncRef.current = now;
                              const _FRAME_W = ((width - 32) / 10) * timelineZoom;
                              const _TOTAL_W = _FRAME_W * 20;
                              const targetX = previewProgress * _TOTAL_W;
                              timelineScrollRef.current?.scrollTo({ x: targetX, animated: false });
                            }
                          }
                        }}
                      />
                    ) : (
                      <View style={[emStyles.video, { backgroundColor: '#000' }]} />
                    )}
                  </Reanimated.View>
                </GestureDetector>

                {/* ── Playback controls: Play/Pause | Time | Undo/Redo ── */}
                <View style={emStyles.controlsRow}>
                  {/* Play / Pause */}
                  <TouchableOpacity
                    hitSlop={{ top:12,bottom:12,left:12,right:12 }}
                    onPress={async () => {
                      try {
                        if (editModalPlaying) { await editModalVideoRef.current?.pauseAsync(); }
                        else                  { await editModalVideoRef.current?.playAsync();  }
                        setEditModalPlaying(p => !p);
                      } catch(_) {}
                    }}
                  >
                    <Ionicons name={editModalPlaying ? 'pause' : 'play'} size={28} color="#fff" />
                  </TouchableOpacity>

                  {/* Time display */}
                  <View style={emStyles.timeRow}>
                    <Text style={emStyles.timeCurrent}>{editModalPosition.toFixed(1)}</Text>
                    <Text style={emStyles.timeSep}>{' / '}</Text>
                    <Text style={emStyles.timeTotal}>{videoDurationMs > 0 ? (videoDurationMs / 1000).toFixed(1) : '0.0'}</Text>
                  </View>

                  {/* Undo / Redo */}
                  <View style={emStyles.undoRedoRow}>
                    <TouchableOpacity hitSlop={{ top:10,bottom:10,left:10,right:6 }}
                      onPress={async () => { try { await editModalVideoRef.current?.setPositionAsync(0); } catch(_) {} }}>
                      <Ionicons name="arrow-undo" size={22} color="#ccc" />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={{ top:10,bottom:10,left:6,right:10 }}
                      onPress={async () => {
                        try {
                          const endMs = trimEndRef.current * (videoDurationMsRef.current || videoDurationMs || 0);
                          await editModalVideoRef.current?.setPositionAsync(Math.max(0, endMs - 200));
                        } catch(_) {}
                      }}>
                      <Ionicons name="arrow-redo" size={22} color="#ccc" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Toolbar: Audio | Edit | Effects | Text | Stickers | Delete ── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={emStyles.toolbarScroll}
                  contentContainerStyle={emStyles.toolbarContent}
                >
                  <TouchableOpacity style={emStyles.toolItem} onPress={() => { setShowEditModal(false); setTimeout(() => setShowMusicModal(true), 300); }}>
                    <View style={emStyles.toolBox}><Ionicons name="musical-note" size={22} color="#fff" /></View>
                    <Text style={emStyles.toolLabel}>Audio</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={emStyles.toolItem}>
                    <View style={emStyles.toolBox}><Ionicons name="cut-outline" size={22} color="#fff" /></View>
                    <Text style={[emStyles.toolLabel, emStyles.toolLabelSelected]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={emStyles.toolItem} onPress={() => { setFilterModalTempFilter(selectedFilter); setShowFilterModal(true); }}>
                    <View style={emStyles.toolBox}><Ionicons name="sparkles" size={22} color="#fff" /></View>
                    <Text style={emStyles.toolLabel}>Effects</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={emStyles.toolItem} onPress={() => { setShowEditModal(false); setTimeout(() => setShowTextModal(true), 300); }}>
                    <View style={emStyles.toolBox}><Text style={emStyles.toolAa}>Aa</Text></View>
                    <Text style={emStyles.toolLabel}>Text</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={emStyles.toolItem} onPress={() => { setShowEditModal(false); setTimeout(() => setShowStickerModal(true), 300); }}>
                    <View style={emStyles.toolBox}><Ionicons name="happy-outline" size={22} color="#fff" /></View>
                    <Text style={emStyles.toolLabel}>Stickers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={emStyles.toolItem} onPress={() => {
                    if (isAudioLayerSelected) {
                      setSelectedSong(null);
                      setMusicVol(0);
                      setIsAudioLayerSelected(false);
                    } else if (isTextLayerSelected) {
                      setTextOverlays([]);
                      setIsTextLayerSelected(false);
                    } else if (selectedVideoSegmentIndex !== null) {
                      // Delete only the selected segment and move the preview
                      // to the next remaining segment instead of replaying the
                      // deleted source range.
                      const targetSeg = visibleVideoSegments.find(({ oi }) => oi === selectedVideoSegmentIndex);
                      if (targetSeg) {
                         const newDeleted = Array.from(new Set([...deletedSegmentStarts, targetSeg.start]));
                        setDeletedSegmentStarts(newDeleted);
                        const remaining = visibleVideoSegments.filter(
                           (segment) => !newDeleted.some((start) => Math.abs(start - segment.start) < 0.0005),
                        );
                        if (remaining.length === 0) {
                          setRecordedVideoUri(null);
                          setVideoDeleted(true);
                          setDeletedSegmentStarts([]);
                          setVideoCuts([]);
                        } else {
                          const nextSegment = remaining.find(({ oi }) => oi > targetSeg.oi) || remaining[0];
                          seekEditorToVideoSegment(nextSegment.oi, editModalPlayingRef.current);
                        }
                      }
                      setSelectedVideoSegmentIndex(null);
                      setIsVideoLayerSelected(false);
                    } else {
                      setRecordedVideoUri(null);
                      setVideoDeleted(true);
                      setIsVideoLayerSelected(false);
                      setSelectedVideoSegmentIndex(null);
                      setDeletedSegmentStarts([]);
                      setVideoCuts([]);
                    }
                  }}>
                    <View style={emStyles.toolBox}><Ionicons name="trash-outline" size={22} color="#fff" /></View>
                    <Text style={emStyles.toolLabel}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={emStyles.toolItem} onPress={() => {
                     const totalMs = videoDurationMsRef.current || videoDurationMs;
                     const progress = totalMs > 0
                       ? Math.max(0, Math.min(1, editModalSourceProgressRef.current))
                       : 0.5;
                    const addCut = (updateCuts: React.Dispatch<React.SetStateAction<number[]>>) => {
                      if (progress <= 0.005 || progress >= 0.995) return;
                      updateCuts((cuts) => cuts.some((cut) => Math.abs(cut - progress) < 0.01)
                        ? cuts
                        : [...cuts, progress].sort((a, b) => a - b));
                    };
                    if (isVideoLayerSelected) {
                      addCut(setVideoCuts);
                    } else if (isAudioLayerSelected) {
                      addCut(setAudioCuts);
                    } else if (isTextLayerSelected) {
                      addCut(setTextCuts);
                    } else {
                      addCut(setVideoCuts);
                    }
                  }}>
                    <View style={emStyles.toolBox}>
                      <Ionicons name="cut-outline" size={24} color="#fff" />
                    </View>
                    <Text style={emStyles.toolLabel}>Split</Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* ── Reset pill between toolbar and tracks ── */}
                <TouchableOpacity
                  onPress={() => {
                    trimStartRef.current = 0;
                    trimEndRef.current = 1;
                    setTrimStart(0);
                    setTrimEnd(1);
                    setAudioTrimStart(0);
                    setAudioTrimEnd(1);
                    setTextTrimStart(0);
                    setTextTrimEnd(1);
                    seekTrimPreview(0);
                  }}
                  style={emStyles.resetPill}
                >
                  <Text style={emStyles.resetPillText}>Rese</Text>
                </TouchableOpacity>

                 {/* ── Track timeline — CapCut / Instagram Reels style ── */}
                 <GestureDetector gesture={timelinePinchGesture}>
                   <View style={{
                     position: 'relative',
                     marginBottom: Platform.OS === 'ios' ? 24 : 14,
                   }}>
                     {/* Fixed white center playhead — spans all 3 tracks */}
                     <View pointerEvents="none" style={{
                       position: 'absolute', top: 0, bottom: 0,
                       left: '50%', marginLeft: 11.5,
                       width: 3, backgroundColor: '#fff',
                       zIndex: 200, borderRadius: 2,
                     }} />

                     {(() => {
                       const FRAME_W = ((width - 32) / 10) * timelineZoom;
                       const TOTAL_W = FRAME_W * 20;
                       totalWRef.current = TOTAL_W; // keep in sync for pan responders
                       const SIDE_PAD = (width - 32) / 2;
                       const TRACK_H = 36;
                       const AUX_H   = 30;
                       const GAP     = 5;
                       return (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                           <NativeViewGestureHandler ref={nativeScrollGestureRef} simultaneousHandlers={[]}>
                           <ScrollView
                           ref={timelineScrollRef}
                           horizontal
                           style={{ flex: 1 }}
                           showsHorizontalScrollIndicator={false}
                           scrollEventThrottle={16}
                           onScrollBeginDrag={() => {
                             isTimelineDraggingRef.current = true;
                             timelineWasPlayingRef.current = editModalPlayingRef.current;
                             if (timelineWasPlayingRef.current) {
                               editModalVideoRef.current?.pauseAsync().catch(() => {});
                             }
                           }}
                           onScrollEndDrag={() => {
                             isTimelineDraggingRef.current = false;
                             if (videoSeekTimeoutRef.current) clearTimeout(videoSeekTimeoutRef.current);
                             videoSeekTimeoutRef.current = setTimeout(() => {
                               if (!isTimelineDraggingRef.current) {
                                 seekEditorFromTimeline(timelineScrollXRef.current, TOTAL_W, timelineWasPlayingRef.current);
                               }
                             }, 120);
                           }}
                           onMomentumScrollEnd={() => {
                             isTimelineDraggingRef.current = false;
                             if (videoSeekTimeoutRef.current) clearTimeout(videoSeekTimeoutRef.current);
                             seekEditorFromTimeline(timelineScrollXRef.current, TOTAL_W, timelineWasPlayingRef.current);
                           }}
                           onScroll={(e) => {
                             const x = e.nativeEvent.contentOffset.x;
                             timelineScrollXRef.current = x;
                             const totalDur = videoDurationMsRef.current || videoDurationMs;
                             if (totalDur > 0) {
                               if (videoSeekTimeoutRef.current) clearTimeout(videoSeekTimeoutRef.current);
                               videoSeekTimeoutRef.current = setTimeout(() => {
                                 if (isTimelineDraggingRef.current) {
                                   seekEditorFromTimeline(x, TOTAL_W);
                                 }
                               }, 80);
                             }
                           }}
                           contentContainerStyle={{ paddingRight: SIDE_PAD }}
                         >
                              <View style={{ flexDirection: 'column' }}>

                             {/* VIDEO TRACK */}
                             <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: GAP }}>
                                {/* Sound icon scrolls with the video layer */}
                                <TouchableOpacity
                                  style={{ width: 26, height: TRACK_H, alignItems: 'center', justifyContent: 'center' }}
                                  onPress={() => setOriginalSoundVol((v: number) => v > 0 ? 0 : 80)}
                                >
                                  <Ionicons
                                    name={originalSoundVol > 0 ? 'volume-medium' : 'volume-mute'}
                                    size={15}
                                    color={originalSoundVol > 0 ? '#aaa' : '#555'}
                                  />
                                </TouchableOpacity>
                                {/* Gap before the layer matches the centered timeline playhead */}
                                <View style={{ width: SIDE_PAD, height: TRACK_H }} />
                               {!recordedVideoUri ? (
                                 <TouchableOpacity activeOpacity={0.7} onPress={pickVideoForEditor}>
                                   <View style={{
                                     width: TOTAL_W, height: TRACK_H, borderRadius: 8,
                                     backgroundColor: '#1C1C1C',
                                     flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
                                   }}>
                                     <Text style={{ color: '#555', fontSize: 16, marginRight: 6, fontWeight: '300' }}>+</Text>
                                     <Text style={{ color: '#555', fontSize: 12, fontWeight: '500' }}>Add video</Text>
                                   </View>
                                 </TouchableOpacity>
                               ) : (
                                 /* ── Segmented video track — har segment alag touchable ── */
                                 (() => {
                                   const validCuts = videoCuts.filter((p: number) => p > 0.005 && p < 0.995).sort((a: number, b: number) => a - b);
                                   const allBounds: number[] = [0, ...validCuts, 1];
                                   const allSegments = allBounds.slice(0, -1).map((start: number, oi: number) => ({ start, end: allBounds[oi + 1], oi }));
                                    const visibleSegments = allSegments.filter((seg: { start: number }) => (
                                      !deletedSegmentStarts.some((start) => Math.abs(start - seg.start) < 0.0005)
                                    ));
                                   const SEG_GAP = 5;
                                   const totalGapPx = Math.max(0, visibleSegments.length - 1) * SEG_GAP;
                                   const usableW = TOTAL_W - totalGapPx;
                                   return (
                                     <View style={{ flexDirection: 'row', height: TRACK_H }}>
                                       {visibleSegments.map((seg: { start: number; end: number; oi: number }, vi: number) => {
                                         const segW = Math.max(8, (seg.end - seg.start) * usableW);
                                         const isFirst = vi === 0;
                                         const isLast = vi === visibleSegments.length - 1;
                                         const isSegSelected = selectedVideoSegmentIndex === seg.oi;
                                         const startFrameIdx = Math.round(seg.start * 20);
                                         const framesNeeded = Math.ceil(segW / FRAME_W) + 1;
                                         return (
                                           <React.Fragment key={seg.oi}>
                                             {vi > 0 && <View style={{ width: SEG_GAP, height: TRACK_H, backgroundColor: '#000' }} />}
                                             <TouchableOpacity
                                               activeOpacity={0.85}
                                               onPress={() => {
                                                 setSelectedVideoSegmentIndex(seg.oi);
                                                  setSelectedAudioSegmentIndex(null);
                                                  setSelectedTextSegmentIndex(null);
                                                 setIsVideoLayerSelected(true);
                                                 setIsAudioLayerSelected(false);
                                                 setIsTextLayerSelected(false);
                                                 seekEditorToVideoSegment(seg.oi, true);
                                               }}
                                               style={{ width: segW, height: TRACK_H, borderRadius: 8, overflow: 'hidden', position: 'relative' }}
                                             >
                                               {/* Film frames for this segment */}
                                               <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, flexDirection: 'row' }}>
                                                 {Array.from({ length: framesNeeded }).map((_, fi) => {
                                                   const fIdx = (startFrameIdx + fi) % Math.max(filmFrames.length, 1);
                                                   return filmFrames.length > 0 && filmFrames[fIdx]
                                                     ? <Image key={fi} source={{ uri: filmFrames[fIdx] }} style={{ width: FRAME_W, height: TRACK_H }} resizeMode="cover" />
                                                     : <View key={fi} style={{ width: FRAME_W, height: TRACK_H, backgroundColor: fi % 2 === 0 ? '#2a2a2a' : '#1f1f1f' }} />;
                                                 })}
                                               </View>
                                               {/* Yellow border — sirf selected segment par */}
                                               {isSegSelected && (
                                                 <View pointerEvents="none" style={{
                                                   position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                   borderRadius: 8, borderWidth: 3, borderColor: '#FFD700', zIndex: 15,
                                                 }} />
                                               )}
                                               {/* Left trim handle on first segment */}
                                               {isFirst && (
                                                 <View {...videoLeftScrollPan.panHandlers} style={{
                                                   position: 'absolute', left: 0, top: 0, bottom: 0,
                                                   width: 18, backgroundColor: '#fff',
                                                   borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
                                                   alignItems: 'center', justifyContent: 'center', zIndex: 30,
                                                 }}>
                                                   <View style={{ width: 3, height: 16, backgroundColor: '#888', borderRadius: 2 }} />
                                                 </View>
                                               )}
                                               {/* Right trim handle on last segment */}
                                               {isLast && (
                                                 <View {...videoRightScrollPan.panHandlers} style={{
                                                   position: 'absolute', right: 0, top: 0, bottom: 0,
                                                   width: 18, backgroundColor: '#fff',
                                                   borderTopRightRadius: 8, borderBottomRightRadius: 8,
                                                   alignItems: 'center', justifyContent: 'center', zIndex: 30,
                                                 }}>
                                                   <View style={{ width: 3, height: 16, backgroundColor: '#888', borderRadius: 2 }} />
                                                 </View>
                                               )}
                                             </TouchableOpacity>
                                           </React.Fragment>
                                         );
                                       })}
                                     </View>
                                   );
                                 })()
                               )}
                               {/* + add clip */}
                               <TouchableOpacity style={{
                                 width: 34, height: TRACK_H,
                                 backgroundColor: '#2a2a2a', borderRadius: 7,
                                 alignItems: 'center', justifyContent: 'center',
                                 marginLeft: 5,
                               }}>
                                 <Text style={{ fontSize: 20, color: '#aaa', fontWeight: '300', lineHeight: 24 }}>+</Text>
                               </TouchableOpacity>
                             </View>

                              {/* AUDIO TRACK — each split segment is independently selectable */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: GAP }}>
                                {/* Sound icon scrolls with the audio layer */}
                                <TouchableOpacity
                                  style={{ width: 26, height: AUX_H, alignItems: 'center', justifyContent: 'center' }}
                                  onPress={() => setMusicVol((v: number) => v > 0 ? 0 : 70)}
                                >
                                  <Ionicons
                                    name={musicVol > 0 ? 'volume-medium' : 'volume-mute'}
                                    size={14}
                                    color={musicVol > 0 ? '#aaa' : '#555'}
                                  />
                                </TouchableOpacity>
                                {/* Keep the audio layer aligned with the video layer */}
                                <View style={{ width: SIDE_PAD, height: AUX_H }} />
                                {selectedSong ? (
                                  (() => {
                                    const validCuts = audioCuts.filter((p: number) => p > 0.005 && p < 0.995).sort((a: number, b: number) => a - b);
                                    const allBounds: number[] = [0, ...validCuts, 1];
                                    const segments = allBounds.slice(0, -1).map((start: number, oi: number) => ({ start, end: allBounds[oi + 1], oi }));
                                    const totalGapPx = Math.max(0, segments.length - 1) * 5;
                                    const usableW = TOTAL_W - totalGapPx;
                                    return (
                                      <View style={{ flexDirection: 'row', height: AUX_H }}>
                                        {segments.map((seg: { start: number; end: number; oi: number }, vi: number) => {
                                          const segW = Math.max(8, (seg.end - seg.start) * usableW);
                                          const isFirst = vi === 0;
                                          const isLast = vi === segments.length - 1;
                                          const isSegSelected = selectedAudioSegmentIndex === seg.oi;
                                          return (
                                            <React.Fragment key={seg.oi}>
                                              {vi > 0 && <View style={{ width: 5, height: AUX_H, backgroundColor: '#000' }} />}
                                              <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => {
                                                  setSelectedAudioSegmentIndex(seg.oi);
                                                  setSelectedVideoSegmentIndex(null);
                                                  setSelectedTextSegmentIndex(null);
                                                  setIsAudioLayerSelected(true);
                                                  setIsVideoLayerSelected(false);
                                                  setIsTextLayerSelected(false);
                                                }}
                                                style={{ width: segW, height: AUX_H, borderRadius: 7, overflow: 'hidden', position: 'relative' }}
                                              >
                                                <View style={{
                                                  width: '100%', height: AUX_H, borderRadius: 7,
                                                  backgroundColor: '#D946A8',
                                                  flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
                                                }}>
                                                  {seg.oi === 0 && (
                                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', flex: 1, paddingHorizontal: 10 }} numberOfLines={1}>
                                                      {`${selectedSong.title || ''}${selectedSong.artist ? ' · ' + selectedSong.artist : ''}`}
                                                    </Text>
                                                  )}
                                                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
                                                    {[4,7,10,5,8,12,6,9,11,5,8].map((h, i) => (
                                                      <View key={i} style={[emStyles.waveBar, { height: h, backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                                                    ))}
                                                  </View>
                                                </View>
                                                {isSegSelected && (
                                                  <View pointerEvents="none" style={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                    borderRadius: 7, borderWidth: 3, borderColor: '#FFD700', zIndex: 15,
                                                  }} />
                                                )}
                                                {isSegSelected && isFirst && (
                                                  <View {...audioLeftPan.panHandlers} style={{
                                                    position: 'absolute', left: 0, top: 0, bottom: 0,
                                                    width: 16, backgroundColor: '#fff',
                                                    borderTopLeftRadius: 7, borderBottomLeftRadius: 7,
                                                    alignItems: 'center', justifyContent: 'center', zIndex: 30,
                                                  }}>
                                                    <View style={{ width: 3, height: 13, backgroundColor: '#888', borderRadius: 2 }} />
                                                  </View>
                                                )}
                                                {isSegSelected && isLast && (
                                                  <View {...audioRightPan.panHandlers} style={{
                                                    position: 'absolute', right: 0, top: 0, bottom: 0,
                                                    width: 16, backgroundColor: '#fff',
                                                    borderTopRightRadius: 7, borderBottomRightRadius: 7,
                                                    alignItems: 'center', justifyContent: 'center', zIndex: 30,
                                                  }}>
                                                    <View style={{ width: 3, height: 13, backgroundColor: '#888', borderRadius: 2 }} />
                                                  </View>
                                                )}
                                              </TouchableOpacity>
                                            </React.Fragment>
                                          );
                                        })}
                                      </View>
                                    );
                                  })()
                                ) : (
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => { setShowEditModal(false); setTimeout(() => setShowMixAudio(true), 300); }}
                                    style={{
                                      width: TOTAL_W, height: 34, borderRadius: 6, backgroundColor: '#1C1C1C',
                                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
                                    }}
                                  >
                                    <Text style={{ color: '#555', fontSize: 16, marginRight: 6, fontWeight: '300' }}>+</Text>
                                    <Text style={{ color: '#555', fontSize: 12, fontWeight: '500' }}>Add audio</Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {/* TEXT TRACK — each split segment is independently selectable */}
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {/* Empty spacer keeps all three timeline layers aligned */}
                                <View style={{ width: 26 + SIDE_PAD, height: AUX_H }} />
                                {textOverlays.length > 0 ? (
                                  (() => {
                                    const validCuts = textCuts.filter((p: number) => p > 0.005 && p < 0.995).sort((a: number, b: number) => a - b);
                                    const allBounds: number[] = [0, ...validCuts, 1];
                                    const segments = allBounds.slice(0, -1).map((start: number, oi: number) => ({ start, end: allBounds[oi + 1], oi }));
                                    const totalGapPx = Math.max(0, segments.length - 1) * 5;
                                    const usableW = TOTAL_W - totalGapPx;
                                    return (
                                      <View style={{ flexDirection: 'row', height: AUX_H }}>
                                        {segments.map((seg: { start: number; end: number; oi: number }, vi: number) => {
                                          const segW = Math.max(8, (seg.end - seg.start) * usableW);
                                          const isFirst = vi === 0;
                                          const isLast = vi === segments.length - 1;
                                          const isSegSelected = selectedTextSegmentIndex === seg.oi;
                                          const segmentText = textOverlays.find((overlay) => {
                                            const overlayStart = overlay.startProgress ?? 0;
                                            return Math.abs(overlayStart - seg.start) < 0.02;
                                          });
                                          return (
                                            <React.Fragment key={seg.oi}>
                                              {vi > 0 && <View style={{ width: 5, height: AUX_H, backgroundColor: '#000' }} />}
                                              <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => {
                                                  setSelectedTextSegmentIndex(seg.oi);
                                                  setSelectedVideoSegmentIndex(null);
                                                  setSelectedAudioSegmentIndex(null);
                                                  setIsTextLayerSelected(true);
                                                  setIsVideoLayerSelected(false);
                                                  setIsAudioLayerSelected(false);
                                                }}
                                                style={{ width: segW, height: AUX_H, borderRadius: 7, overflow: 'hidden', position: 'relative' }}
                                              >
                                                <View style={{
                                                  width: '100%', height: AUX_H, borderRadius: 7,
                                                  backgroundColor: '#7C4FFF',
                                                  flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
                                                }}>
                                                  {segmentText && (
                                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', flex: 1, paddingHorizontal: 10 }} numberOfLines={1}>
                                                      {segmentText.text || 'Text'}
                                                    </Text>
                                                  )}
                                                </View>
                                                {isSegSelected && (
                                                  <View pointerEvents="none" style={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                    borderRadius: 7, borderWidth: 3, borderColor: '#FFD700', zIndex: 15,
                                                  }} />
                                                )}
                                                {isSegSelected && isFirst && (
                                                  <View {...textLeftPan.panHandlers} style={{
                                                    position: 'absolute', left: 0, top: 0, bottom: 0,
                                                    width: 16, backgroundColor: '#fff',
                                                    borderTopLeftRadius: 7, borderBottomLeftRadius: 7,
                                                    alignItems: 'center', justifyContent: 'center', zIndex: 30,
                                                  }}>
                                                    <View style={{ width: 3, height: 13, backgroundColor: '#888', borderRadius: 2 }} />
                                                  </View>
                                                )}
                                                {isSegSelected && isLast && (
                                                  <View {...textRightPan.panHandlers} style={{
                                                    position: 'absolute', right: 0, top: 0, bottom: 0,
                                                    width: 16, backgroundColor: '#fff',
                                                    borderTopRightRadius: 7, borderBottomRightRadius: 7,
                                                    alignItems: 'center', justifyContent: 'center', zIndex: 30,
                                                  }}>
                                                    <View style={{ width: 3, height: 13, backgroundColor: '#888', borderRadius: 2 }} />
                                                  </View>
                                                )}
                                              </TouchableOpacity>
                                            </React.Fragment>
                                          );
                                        })}
                                      </View>
                                    );
                                  })()
                                ) : (
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => { setShowEditModal(false); setTimeout(() => setShowTextModal(true), 300); }}
                                    style={{
                                      width: TOTAL_W, height: 34, borderRadius: 6, backgroundColor: '#1C1C1C',
                                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
                                    }}
                                  >
                                    <Text style={{ color: '#555', fontSize: 16, marginRight: 6, fontWeight: '300' }}>+</Text>
                                    <Text style={{ color: '#555', fontSize: 12, fontWeight: '500' }}>Add text</Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                           </View>
                         </ScrollView>
                           </NativeViewGestureHandler>
                         </View>
                       );
                     })()}
                   </View>
                 </GestureDetector>


              </View>
            </Modal>

            {/* ── TEXT panel ── */}
            {/* ── TEXT MODAL — Instagram full-screen style ── */}
            <Modal visible={showTextModal} animationType="fade" transparent onRequestClose={() => setShowTextModal(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' }}>

                {/* Top toolbar */}
                <View style={{ paddingTop: Platform.OS === 'ios' ? 56 : 38, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                    {/* Alignment */}
                    <TouchableOpacity onPress={() => setTextModalAlign(a => a === 'left' ? 'center' : a === 'center' ? 'right' : 'left')} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                      <Ionicons name={textModalAlign === 'left' ? 'text-outline' : textModalAlign === 'center' ? 'reorder-three-outline' : 'reorder-two-outline'} size={24} color="#fff" />
                    </TouchableOpacity>
                    {/* Color wheel */}
                    <TouchableOpacity hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: textModalColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }} />
                      </View>
                    </TouchableOpacity>
                    {/* Font toggle Aa */}
                    <TouchableOpacity onPress={() => setTextModalFont(f => (f + 1) % 4)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: textModalFont === 0 ? '#fff' : 'transparent', borderWidth: textModalFont !== 0 ? 1.5 : 0, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: textModalFont === 0 ? '#000' : '#fff', fontSize: 15, fontWeight: '700' }}>Aa</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {/* Done */}
                  <TouchableOpacity
                    onPress={() => {
                      if (textModalInput.trim()) {
                        const selectedSegment = selectedVideoSegmentIndex === null
                          ? null
                          : visibleVideoSegments.find(({ oi }) => oi === selectedVideoSegmentIndex);
                        const startProgress = selectedSegment?.start ?? 0;
                        const endProgress = selectedSegment?.end ?? 1;
                        if (selectedSegment) {
                          setTextCuts((cuts) => Array.from(new Set(
                            [...cuts, startProgress, endProgress]
                              .filter((cut) => cut > 0.005 && cut < 0.995)
                              .map((cut) => Number(cut.toFixed(4))),
                          )).sort((a, b) => a - b));
                        }
                        setTextOverlays(prev => [...prev, {
                          id: Date.now().toString(),
                          text: textModalInput.trim(),
                          color: textModalColor,
                          size: 24,
                          x: width / 2 - 80,
                          y: height / 2 - 40,
                          startProgress,
                          endProgress,
                        }]);
                      }
                      setTextModalInput('');
                      setShowTextModal(false);
                    }}
                    style={{ backgroundColor: '#2A2A2A', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* Center: text input overlay */}
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                  <TextInput
                    style={{
                      color: textModalColor,
                      fontSize: 28,
                      fontWeight: '700',
                      textAlign: textModalAlign,
                      minWidth: 120,
                      maxWidth: width - 48,
                      textShadowColor: 'rgba(0,0,0,0.6)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 4,
                      fontFamily: textModalFont === 1 ? 'serif' : textModalFont === 2 ? 'monospace' : undefined,
                      fontStyle: textModalFont === 3 ? 'italic' : 'normal',
                    }}
                    placeholder="Start typing"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    value={textModalInput}
                    onChangeText={setTextModalInput}
                    autoFocus
                    multiline
                    autoCorrect={false}
                    maxLength={80}
                    returnKeyType="done"
                  />
                </View>

                {/* Font style row */}
                <View style={{ paddingBottom: 8 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, alignItems: 'center', paddingVertical: 8 }}>
                    {[
                      { label: 'Aa', font: 0, style: { fontWeight: '700' as const } },
                      { label: 'Aa', font: 1, style: { fontFamily: 'serif', fontWeight: '700' as const } },
                      { label: 'Aa', font: 2, style: { fontFamily: 'monospace' } },
                      { label: 'Aa', font: 3, style: { fontStyle: 'italic' as const, fontWeight: '700' as const } },
                    ].map((f, i) => (
                      <TouchableOpacity key={i} onPress={() => setTextModalFont(f.font)}>
                        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: textModalFont === f.font ? '#fff' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: textModalFont === f.font ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                          <Text style={[{ color: textModalFont === f.font ? '#000' : '#fff', fontSize: 16 }, f.style]}>{f.label}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {/* Color dots */}
                    {TEXT_COLORS.map(col => (
                      <TouchableOpacity key={col} onPress={() => setTextModalColor(col)}>
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: col, borderWidth: textModalColor === col ? 3 : 1.5, borderColor: textModalColor === col ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

              </View>
            </Modal>

            {/* ── STICKER MODAL — Instagram bottom sheet style ── */}
            <Modal visible={showStickerModal} animationType="slide" transparent onRequestClose={() => { setShowStickerModal(false); setEditorActiveTool(null); }}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setShowStickerModal(false); setEditorActiveTool(null); }} />
              <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: height * 0.72 }}>
                {/* Handle */}
                <View style={{ width: 36, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 14 }} />

                {/* Category pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 12 }}>
                  {[
                    { icon: 'location-outline',   label: 'Location' },
                    { icon: 'time-outline',        label: 'Time'     },
                    { icon: 'images-outline',      label: 'GIF'      },
                    { icon: 'musical-notes',       label: 'Music'    },
                    { icon: 'person-circle-outline', label: 'Avatar' },
                  ].map(cat => (
                    <TouchableOpacity key={cat.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2C2C2E', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 }}>
                      <Ionicons name={cat.icon as any} size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: '#2C2C2E', marginHorizontal: 0 }} />

                {/* Sticker grid — scrollable */}
                <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30 }}>
                  {/* Section: Limited time */}
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 }}>Limited time</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                    {['⚽🔥','🎯','💙','🎺','🌟','🎉'].map((emoji, i) => (
                      <TouchableOpacity key={`lt-${i}`}
                        style={{ width: (width - 28 - 40) / 4, height: (width - 28 - 40) / 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2C2C2E', borderRadius: 12 }}
                        onPress={() => { setStickerOverlays(prev => [...prev, { id: Date.now().toString() + i, emoji, size: 44, x: 60 + (i % 3) * 60, y: 140 + Math.floor(i / 3) * 70 }]); setShowStickerModal(false); setEditorActiveTool(null); }}
                      >
                        <Text style={{ fontSize: 36 }}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Section: Popular */}
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 }}>Popular</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {STICKER_EMOJIS.map((emoji, i) => (
                      <TouchableOpacity key={`st-${i}`}
                        style={{ width: (width - 28 - 40) / 4, height: (width - 28 - 40) / 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2C2C2E', borderRadius: 12 }}
                        onPress={() => { setStickerOverlays(prev => [...prev, { id: Date.now().toString() + i, emoji, size: 44, x: 60 + (i % 4) * 55, y: 140 + Math.floor(i / 4) * 70 }]); setShowStickerModal(false); setEditorActiveTool(null); }}
                      >
                        <Text style={{ fontSize: 34 }}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </Modal>

            {/* ── FILTER MODAL — full-screen Picsart style ── */}
            <Modal visible={showFilterModal} animationType="slide" transparent={false} onRequestClose={() => setShowFilterModal(false)}>
              <View style={{ flex: 1, backgroundColor: '#000' }}>

                {/* ── TOP BAR: Cancel | Done ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 12, paddingBottom: 12 }}>
                  <TouchableOpacity onPress={() => setShowFilterModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '500' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setSelectedFilter(filterModalTempFilter); setShowFilterModal(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* ── VIDEO PREVIEW 9:16 ── */}
                 <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 4 }}>
                   <View style={{ width: width * 0.46, height: width * 0.46 * (16 / 9), borderRadius: 14, overflow: 'hidden', backgroundColor: '#111' }}>
                     {recordedVideoUri ? (
                       <Video
                         source={{ uri: recordedVideoUri }}
                         style={{ width: '100%', height: '100%' }}
                         resizeMode={'cover' as any}
                         shouldPlay
                         isLooping
                         isMuted
                       />
                     ) : (
                       <View style={{ flex: 1, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}>
                         <Ionicons name="videocam" size={40} color="#555" />
                       </View>
                     )}
                     {filterModalTempFilter !== 'No effect' && (
                       <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                         backgroundColor:
                           filterModalTempFilter === 'Fine Tone'    ? 'rgba(180,120,60,0.28)'  :
                           filterModalTempFilter === 'Vignette'     ? 'rgba(0,0,0,0.40)'        :
                           filterModalTempFilter === 'Summer'       ? 'rgba(255,160,30,0.25)'   :
                           filterModalTempFilter === 'fairy grunge' ? 'rgba(0,180,160,0.22)'    :
                           filterModalTempFilter === 'Film burn II' ? 'rgba(20,60,200,0.28)'    :
                           filterModalTempFilter === 'Classic'      ? 'rgba(140,90,30,0.30)'    :
                           filterModalTempFilter === 'Starry Night' ? 'rgba(60,0,140,0.35)'     :
                           filterModalTempFilter === 'Dreamy'       ? 'rgba(220,100,255,0.20)'  :
                           filterModalTempFilter === 'Warm'         ? 'rgba(192,97,43,0.28)'    :
                           filterModalTempFilter === 'Cool'         ? 'rgba(43,123,192,0.28)'   :
                           filterModalTempFilter === 'Fade'         ? 'rgba(180,180,180,0.30)'  :
                           filterModalTempFilter === 'Glitch'       ? 'rgba(255,0,80,0.20)'     :
                           filterModalTempFilter === 'Mirror'       ? 'rgba(80,200,255,0.15)'   :
                           filterModalTempFilter === 'Neon'         ? 'rgba(0,255,160,0.18)'    :
                           filterModalTempFilter === 'Retro'        ? 'rgba(200,150,0,0.28)'    :
                           filterModalTempFilter === 'Dark'         ? 'rgba(0,0,0,0.50)'        : 'transparent',
                       }} pointerEvents="none" />
                     )}
                   </View>
                   <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 8, width: width * 0.46, textAlign: 'center' }}>Select an effect</Text>
                 </View>

                 {/* ── BOTTOM SHEET ── */}
                 <View style={{ flex: 1, backgroundColor: '#1a1a1a', borderTopLeftRadius: 18, borderTopRightRadius: 18, marginTop: 6 }}>
                   {/* Drag handle */}
                   <View style={{ alignItems: 'center', paddingTop: 10, marginBottom: 0 }}>
                     <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                   </View>

                   {/* Category tab bar */}
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 4, alignItems: 'center' }}>
                     <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
                       <Ionicons name="search" size={20} color="rgba(255,255,255,0.75)" />
                     </TouchableOpacity>
                     <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
                       <Ionicons name="bookmark-outline" size={20} color="rgba(255,255,255,0.75)" />
                     </TouchableOpacity>
                     <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                       <Ionicons name="sparkles-outline" size={20} color="rgba(255,255,255,0.75)" />
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => setEffectsCategory('aesthetics')} style={{ marginRight: 16 }}>
                       <Text style={{ color: effectsCategory === 'aesthetics' ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>AESTHETICS</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => setEffectsCategory('special')}>
                       <Text style={{ color: effectsCategory === 'special' ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>SPECIAL EFFECTS</Text>
                     </TouchableOpacity>
                   </ScrollView>

                   {/* Effects grid — Picsart card style */}
                   {(() => {
                     const aestheticsEffects = [
                       { name: 'No effect',    top: '#5a5a5a', bot: '#2a2a2a', icon: 'ban-outline',         iconColor: '#ddd',    sz: 32 },
                       { name: 'Fine Tone',    top: '#C8901A', bot: '#5C3A0A', icon: 'person-circle',        iconColor: '#FFE0A0', sz: 36 },
                       { name: 'Vignette',     top: '#666',    bot: '#000',    icon: 'radio-button-off',     iconColor: '#ddd',    sz: 32 },
                       { name: 'Summer',       top: '#E07820', bot: '#6B3A00', icon: 'flower-outline',       iconColor: '#FFE0A0', sz: 32 },
                       { name: 'fairy grunge', top: '#00A080', bot: '#003030', icon: 'leaf-outline',         iconColor: '#AAFFF0', sz: 30 },
                       { name: 'Film burn II', top: '#2050DD', bot: '#000820', icon: 'flame',                iconColor: '#A0C0FF', sz: 34 },
                       { name: 'Classic',      top: '#A06010', bot: '#3A2400', icon: 'image-outline',        iconColor: '#FFD0A0', sz: 30 },
                       { name: 'Starry Night', top: '#6040CC', bot: '#100030', icon: 'star-outline',         iconColor: '#D0C0FF', sz: 30 },
                       { name: 'Dreamy',       top: '#A030CC', bot: '#300040', icon: 'sparkles',             iconColor: '#F0C0FF', sz: 30 },
                       { name: 'Warm',         top: '#DD5020', bot: '#6B2A00', icon: 'sunny-outline',        iconColor: '#FFD0B0', sz: 30 },
                       { name: 'Cool',         top: '#2070CC', bot: '#002050', icon: 'snow-outline',         iconColor: '#C0E0FF', sz: 30 },
                       { name: 'Fade',         top: '#999',    bot: '#444',    icon: 'water-outline',        iconColor: '#eee',    sz: 28 },
                     ];
                     const specialEffects = [
                       { name: 'Glitch',   top: '#CC1040', bot: '#280010', icon: 'pulse',            iconColor: '#FFB0C0', sz: 30 },
                       { name: 'Mirror',   top: '#1070CC', bot: '#002050', icon: 'git-compare',      iconColor: '#A0E0FF', sz: 30 },
                       { name: 'Neon',     top: '#00A050', bot: '#002010', icon: 'bulb-outline',     iconColor: '#A0FFD0', sz: 30 },
                       { name: 'Retro',    top: '#CC8800', bot: '#3A2800', icon: 'tv-outline',       iconColor: '#FFE0A0', sz: 30 },
                       { name: 'Dark',     top: '#333',    bot: '#000',    icon: 'moon',             iconColor: '#999',    sz: 30 },
                       { name: 'Zoom',     top: '#006090', bot: '#001828', icon: 'scan-outline',     iconColor: '#A0D8FF', sz: 30 },
                       { name: 'Shake',    top: '#AA0050', bot: '#300018', icon: 'infinite-outline', iconColor: '#FFB0D0', sz: 30 },
                       { name: 'Blur',     top: '#4050CC', bot: '#10102A', icon: 'eye-off-outline',  iconColor: '#C0C8FF', sz: 30 },
                       { name: 'Sparkle',  top: '#AA7800', bot: '#2A1800', icon: 'star',             iconColor: '#FFE080', sz: 30 },
                     ];
                     const list = effectsCategory === 'aesthetics' ? aestheticsEffects : specialEffects;
                     const gap = 5;
                     const hPad = 10;
                     const cellW = Math.floor((width - hPad * 2 - gap * 2) / 3);
                     const circD = Math.floor(cellW * 0.72);
                     const rows: any[][] = [];
                     for (let i = 0; i < list.length; i += 3) rows.push(list.slice(i, i + 3));
                     return (
                       <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: Platform.OS === 'ios' ? 36 : 20, paddingTop: 4 }}>
                         {rows.map((row: any[], ri: number) => (
                           <View key={ri} style={{ flexDirection: 'row', gap, marginBottom: gap }}>
                             {row.map((ef: any) => {
                               const sel = filterModalTempFilter === ef.name;
                               return (
                                 <TouchableOpacity
                                   key={ef.name}
                                   onPress={() => setFilterModalTempFilter(ef.name)}
                                   activeOpacity={0.78}
                                   style={{
                                     width: cellW,
                                     backgroundColor: '#232323',
                                     borderRadius: 12,
                                     paddingVertical: 12,
                                     paddingHorizontal: 4,
                                     alignItems: 'center',
                                     borderWidth: sel ? 2 : 1,
                                     borderColor: sel ? '#4A90E2' : 'rgba(255,255,255,0.07)',
                                   }}
                                 >
                                   <View style={{
                                     width: circD, height: circD, borderRadius: circD / 2,
                                     overflow: 'hidden',
                                     alignItems: 'center', justifyContent: 'center',
                                     borderWidth: sel ? 2.5 : 1.5,
                                     borderColor: sel ? '#fff' : 'rgba(255,255,255,0.18)',
                                     backgroundColor: ef.bot,
                                   }}>
                                     <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '40%', backgroundColor: ef.top, opacity: 0.85 }} />
                                     <Ionicons name={ef.icon as any} size={ef.sz} color={ef.iconColor} />
                                   </View>
                                   <Text style={{
                                     color: sel ? '#fff' : 'rgba(255,255,255,0.7)',
                                     fontSize: 11, fontWeight: sel ? '700' : '400',
                                     marginTop: 8, textAlign: 'center',
                                     fontStyle: ef.name === 'fairy grunge' ? 'italic' : 'normal',
                                     paddingHorizontal: 2,
                                   }} numberOfLines={1}>{ef.name}</Text>
                                 </TouchableOpacity>
                               );
                             })}
                             {row.length < 3 && Array.from({ length: 3 - row.length }).map((_: any, i: number) => (
                               <View key={'pad'+i} style={{ width: cellW }} />
                             ))}
                           </View>
                         ))}
                       </ScrollView>
                     );
                   })()}
                 </View>

              </View>
            </Modal>
            {/* ── BOTTOM TOOLBAR ── */}
            <View style={flowStyles.edBottomBar}>
              {[
                { id: 'audio',    icon: 'musical-notes',   label: 'Audio'    },
                { id: 'edit',     icon: 'cut-outline',     label: 'Edit'     },
                { id: 'effects',  icon: 'color-filter',    label: 'Effects'  },
                { id: 'text',     icon: 'text',            label: 'Text'     },
                { id: 'stickers', icon: 'happy',           label: 'Stickers' },
              ].map((tool) => (
                <TouchableOpacity
                  key={tool.id}
                  style={flowStyles.edToolItem}
                  onPress={() => {
                    setShowDotsMenu(false);
                    if (tool.id === 'audio') {
                      setShowMusicModal(true);
                    } else if (tool.id === 'edit') {
                      setEditModalPlaying(true);
                      setEditModalPosition(0);
                      setShowEditModal(true);
                    } else if (tool.id === 'effects') {
                      setFilterModalTempFilter(selectedFilter);
                      setShowFilterModal(true);
                    } else if (tool.id === 'text') {
                      setTextModalInput('');
                      setShowTextModal(true);
                    } else if (tool.id === 'stickers') {
                      setShowStickerModal(true);
                    } else {
                      setEditorActiveTool(prev => prev === tool.id ? null : tool.id);
                    }
                  }}
                >
                  <View style={[flowStyles.edToolIconCircle, (tool.id === 'audio' ? showMixAudio : editorActiveTool === tool.id) && { backgroundColor: '#FE2C55' }]}>
                    <Ionicons
                      name={tool.icon as any}
                      size={22}
                      color="#fff"
                    />
                  </View>
                  <Text style={[flowStyles.edToolLabel, (tool.id === 'audio' ? showMixAudio : editorActiveTool === tool.id) && { color: '#FE2C55', fontWeight: '700' }]}>
                    {tool.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}
                onPress={() => setRecordingFlowStep('upload')}
              >
                <View style={flowStyles.edNextCircle}>
                  <Ionicons name="arrow-forward" size={24} color="#fff" />
                </View>
                <Text style={flowStyles.edToolLabel}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      );
    }

    // ─── Upload / Post Screen (TikTok-style) ─────────────────────────────────
    if (recordedVideoUri && recordingFlowStep === 'upload') {
      return (
        <View style={[styles.cameraContainer, { backgroundColor: '#111' }]}>

          {/* ── TOP BAR ── */}
          <View style={[flowStyles.uploadTopBar, { top: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setRecordingFlowStep('editor')} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[flowStyles.editorTitle, { color: '#fff' }]}>Post</Text>
            <TouchableOpacity onPress={() => { setShowCamera(false); setRecordingFlowStep(null); setRecordedVideoUri(null); }} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
            <ScrollView style={{ flex: 1, marginTop: insets.top + 60 }} contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── DESCRIPTION ROW: input left, thumb right ── */}
              <View style={flowStyles.ttDescRow}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 14 }}>
                  <TextInput
                    style={flowStyles.ttDescInput}
                    placeholder="Add a caption, hashtags, tags, etc."
                    placeholderTextColor="#aaa"
                    value={uploadTitle}
                    onChangeText={setUploadTitle}
                    multiline
                    maxLength={4000}
                  />
                  {/* Tabs */}
                  <View style={flowStyles.ttTabRow}>
                    {[
                      { key: '#Hashtags', icon: 'pricetag-outline' },
                      { key: '@Mention',  icon: 'at-outline'       },
                      { key: 'Videos',    icon: 'videocam-outline' },
                    ].map(tab => {
                      const on = activeDescTab === tab.key;
                      return (
                        <TouchableOpacity
                          key={tab.key}
                          onPress={() => {
                            setActiveDescTab(tab.key);
                            if (tab.key === '#Hashtags') {
                              setUploadTitle(prev => prev + '#');
                            } else if (tab.key === '@Mention') {
                              setUploadTitle(prev => prev + '@');
                            } else if (tab.key === 'Videos') {
                              setShowVideoPickerModal(true);
                            }
                          }}
                          style={[flowStyles.ttTab, on && flowStyles.ttTabActive]}
                        >
                          <Ionicons name={tab.icon} size={10} color={on ? '#fff' : '#777'} style={{ marginRight: 2 }} />
                          <Text style={[flowStyles.ttTabText, on && flowStyles.ttTabTextActive]}>{tab.key}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                {/* Thumbnail with Select cover badge */}
                <TouchableOpacity style={flowStyles.ttThumb} onPress={() => setShowCoverSelection(true)} activeOpacity={0.85}>
                  {recordedVideoUri ? <Video source={{ uri: recordedVideoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" shouldPlay={false} positionMillis={coverFramePosition * 1000} useNativeControls={false} /> : <View style={{ width: '100%', height: '100%', backgroundColor: '#222' }} />}
                  <View style={flowStyles.ttSelectCoverBadge}>
                    <Text style={flowStyles.ttSelectCoverText}>Select cover</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* ── LIST ROWS ── */}
              <View style={flowStyles.ttListCard}>

                {/* Tag people */}
                <TouchableOpacity style={flowStyles.ttRow} onPress={() => setShowTagPeopleModal(true)}>
                  <Ionicons name="person-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={flowStyles.ttRowLabel}>Tag people</Text>
                    {taggedPeople.length > 0 && (
                      <Text style={{ color: '#FE2C55', fontSize: 12, marginTop: 2 }}>{taggedPeople.join(', ')}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#bbb" />
                </TouchableOpacity>
                <View style={flowStyles.ttDivider} />

                {/* Add link */}
                <TouchableOpacity style={flowStyles.ttRow} onPress={() => setShowAddLinkModal(true)}>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={flowStyles.ttRowLabel}>Add link</Text>
                    {savedLinks.length > 0 && (
                      <Text style={{ color: '#FE2C55', fontSize: 12, marginTop: 2 }}>{savedLinks[0].title || savedLinks[0].url}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#bbb" />
                </TouchableOpacity>
                <View style={flowStyles.ttDivider} />

                {/* Who can watch this video */}
                <TouchableOpacity
                  style={flowStyles.ttRow}
                  onPress={() => setShowPrivacySheet(true)}
                >
                  <Ionicons name="eye-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <Text style={flowStyles.ttRowLabel}>Who can watch this video</Text>
                  <Text style={flowStyles.ttRowSub}>
                    {privacySetting === 'public' ? 'Everyone' : privacySetting === 'friends' ? 'Friends' : 'Only Me'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#bbb" />
                </TouchableOpacity>
                <View style={flowStyles.ttDivider} />

                {/* Hide like */}
                <View style={flowStyles.ttRow}>
                  <Ionicons name="heart-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <Text style={flowStyles.ttRowLabel}>Hide like</Text>
                  <Switch
                    value={!allowLikes}
                    onValueChange={v => setAllowLikes(!v)}
                    trackColor={{ false: '#3a3a3a', true: '#FE2C55' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#3a3a3a"
                  />
                </View>
                <View style={flowStyles.ttDivider} />

                {/* Hide comment */}
                <View style={flowStyles.ttRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <Text style={flowStyles.ttRowLabel}>Hide comment</Text>
                  <Switch
                    value={!allowComments}
                    onValueChange={v => setAllowComments(!v)}
                    trackColor={{ false: '#3a3a3a', true: '#FE2C55' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#3a3a3a"
                  />
                </View>
                <View style={flowStyles.ttDivider} />

                {/* Hide save */}
                <View style={flowStyles.ttRow}>
                  <Ionicons name="bookmark-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <Text style={flowStyles.ttRowLabel}>Hide save</Text>
                  <Switch
                    value={hideLikeCount}
                    onValueChange={setHideLikeCount}
                    trackColor={{ false: '#3a3a3a', true: '#FE2C55' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#3a3a3a"
                  />
                </View>
                <View style={flowStyles.ttDivider} />

                {/* Hide share */}
                <View style={flowStyles.ttRow}>
                  <Ionicons name="share-social-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <Text style={flowStyles.ttRowLabel}>Hide share</Text>
                  <Switch
                    value={!allowShares}
                    onValueChange={v => setAllowShares(!v)}
                    trackColor={{ false: '#3a3a3a', true: '#FE2C55' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#3a3a3a"
                  />
                </View>
                <View style={flowStyles.ttDivider} />

                {/* More options */}
                <TouchableOpacity style={flowStyles.ttRow} onPress={() => setShowMoreOptions(true)}>
                  <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color="#fff" style={flowStyles.ttRowIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={flowStyles.ttRowLabel}>More options</Text>
                    <Text style={flowStyles.ttRowSubLine}>
                      {allowHighQuality ? '✅ High quality on' : 'Manage upload quality'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#bbb" />
                </TouchableOpacity>
                <View style={flowStyles.ttDivider} />

                {/* Automatically share to */}
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                  <Text style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>Automatically share to:</Text>
                  {[
                    { icon: 'chatbubble-outline' as const, label: 'Messages', color: '#34C759', value: shareToMessages, setter: setShareToMessages },
                    { icon: 'logo-instagram' as const, label: 'Instagram', color: '#E1306C', value: shareToInstagram, setter: setShareToInstagram },
                    { icon: 'logo-snapchat' as const, label: 'Snapchat', color: '#FFFC00', value: shareToSnapchat, setter: setShareToSnapchat },
                  ].map((item, i, arr) => (
                    <View key={item.label}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                        activeOpacity={0.7}
                        onPress={() => item.setter(v => !v)}
                      >
                        <Ionicons name={item.icon} size={22} color={item.color} style={{ marginRight: 14 }} />
                        <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>{item.label}</Text>
                        <Switch
                          value={item.value}
                          onValueChange={item.setter}
                          trackColor={{ false: '#3a3a3a', true: '#FE2C55' }}
                          thumbColor="#fff"
                          ios_backgroundColor="#3a3a3a"
                        />
                      </TouchableOpacity>
                      {i < arr.length - 1 && <View style={{ height: 0.5, backgroundColor: '#2A2A2A' }} />}
                    </View>
                  ))}
                  <View style={{ height: 14 }} />
                </View>

              </View>

            </ScrollView>
          </KeyboardAvoidingView>

          {/* ── BOTTOM BAR (fixed) ── */}
          <View style={[flowStyles.uploadBottomBar, { height: 90 + insets.bottom, paddingBottom: 16 + insets.bottom }]}>
            <TouchableOpacity style={flowStyles.ttDraftsBtn} onPress={() =>
              Alert.alert('Drafts', 'Video draft mein save karein?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Save Draft', onPress: () => {
                  const newDraft = {
                    id: Date.now().toString(),
                    uri: recordedVideoUri,
                    title: uploadTitle || 'Draft',
                    savedAt: new Date().toISOString(),
                  };
                  setDrafts(prev => [newDraft, ...prev]);
                  setRecordingFlowStep(null);
                  setShowCamera(false);
                  setRecordedVideoUri(null);
                  showSuccessToast('Video draft mein save ho gaya.');
                }},
              ])
            }>
              <Ionicons name="albums-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={flowStyles.ttDraftsBtnText}>Drafts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[flowStyles.uploadPostBtn, isUploading && { opacity: 0.55 }]}
              onPress={postVideoToFeed}
              disabled={isUploading}
            >
              <Text style={flowStyles.uploadPostText}>Post</Text>
            </TouchableOpacity>
          </View>

          {/* ── MORE OPTIONS BOTTOM SHEET ── */}
          <Modal visible={showMoreOptions} animationType="slide" transparent onRequestClose={() => setShowMoreOptions(false)}>
            <TouchableOpacity style={flowStyles.ttModalOverlay} activeOpacity={1} onPress={() => setShowMoreOptions(false)}>
              <TouchableOpacity activeOpacity={1} style={flowStyles.ttMoreSheet}>
                <View style={flowStyles.ttSheetHandle} />
                <View style={flowStyles.ttSheetHeader}>
                  <TouchableOpacity onPress={() => setShowMoreOptions(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                  <Text style={flowStyles.ttSheetTitle}>More options</Text>
                  <View style={{ width: 22 }} />
                </View>

                {/* Save to device */}
                <TouchableOpacity
                  style={flowStyles.ttSheetRow}
                  onPress={() => { setShowMoreOptions(false); setTimeout(saveVideoToDevice, 300); }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="download-outline" size={20} color="#ccc" style={{ marginRight: 14 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={flowStyles.ttSheetRowLabel}>Save to device</Text>
                  </View>
                  <Switch
                    value={saveToDeviceEnabled}
                    onValueChange={(v) => { setSaveToDeviceEnabled(v); if (v) { setTimeout(saveVideoToDevice, 300); } }}
                    trackColor={{ false: '#3a3a3a', true: '#4CD964' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#3a3a3a"
                  />
                </TouchableOpacity>
                <View style={{ height: 0.5, backgroundColor: '#2A2A2A', marginLeft: 20 }} />

                {/* Allow high-quality uploads */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={flowStyles.ttSheetRow}
                  onPress={() => setAllowHighQuality(v => !v)}
                >
                  <Ionicons name="diamond-outline" size={20} color="#ccc" style={{ marginRight: 14 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={flowStyles.ttSheetRowLabel}>Allow high-quality uploads</Text>
                    <Text style={flowStyles.ttSheetRowSub}>Higher quality videos may take longer to process.</Text>
                  </View>
                  <Switch
                    value={allowHighQuality}
                    onValueChange={setAllowHighQuality}
                    trackColor={{ false: '#3a3a3a', true: '#4CD964' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#3a3a3a"
                  />
                </TouchableOpacity>
                <View style={{ height: 0.5, backgroundColor: '#2A2A2A', marginLeft: 20 }} />

                {/* Branded content */}
                <TouchableOpacity
                  style={flowStyles.ttSheetRow}
                  onPress={() => setBrandedContent(v => !v)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="megaphone-outline" size={20} color="#ccc" style={{ marginRight: 14 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={flowStyles.ttSheetRowLabel}>Branded content</Text>
                    <Text style={flowStyles.ttSheetRowSub}>Disclose the content created as sponsored content.</Text>
                  </View>
                  <Switch
                    value={brandedContent}
                    onValueChange={setBrandedContent}
                    trackColor={{ false: '#3a3a3a', true: '#4CD964' }}
                    thumbColor="#fff"
                    ios_backgroundColor="#3a3a3a"
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* ── PRIVACY SHEET ── */}
          <Modal visible={showPrivacySheet} animationType="slide" transparent onRequestClose={() => setShowPrivacySheet(false)}>
            <TouchableOpacity style={flowStyles.ttModalOverlay} activeOpacity={1} onPress={() => setShowPrivacySheet(false)}>
              <TouchableOpacity activeOpacity={1} style={flowStyles.ttMoreSheet}>
                <View style={flowStyles.ttSheetHandle} />
                <View style={flowStyles.ttSheetHeader}>
                  <TouchableOpacity onPress={() => setShowPrivacySheet(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                  <Text style={flowStyles.ttSheetTitle}>Who can watch this video</Text>
                  <View style={{ width: 22 }} />
                </View>

                {[
                  { key: 'public',   label: 'Everyone', icon: 'earth-outline' },
                  { key: 'friends',  label: 'Friends',  icon: 'people-outline' },
                  { key: 'private',  label: 'Private',  icon: 'lock-closed-outline' },
                ].map((opt, idx, arr) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[flowStyles.ttSheetRow, { paddingVertical: 18 }]}
                    activeOpacity={0.75}
                    onPress={() => { setPrivacySetting(opt.key); setShowPrivacySheet(false); }}
                  >
                    <Ionicons name={opt.icon} size={22} color="#ccc" style={{ marginRight: 16 }} />
                    <Text style={[flowStyles.ttSheetRowLabel, { fontSize: 16 }]}>{opt.label}</Text>
                    {privacySetting === opt.key && (
                      <Ionicons name="checkmark" size={22} color="#FE2C55" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* ── VIDEO PICKER MODAL ── */}
          <Modal visible={showVideoPickerModal} animationType="slide" transparent onRequestClose={() => setShowVideoPickerModal(false)}>
            <TouchableOpacity style={flowStyles.ttModalOverlay} activeOpacity={1} onPress={() => setShowVideoPickerModal(false)}>
              <TouchableOpacity activeOpacity={1} style={[flowStyles.ttMoreSheet, { maxHeight: '75%' }]}>
                <View style={flowStyles.ttSheetHandle} />
                <View style={flowStyles.ttSheetHeader}>
                  <TouchableOpacity onPress={() => setShowVideoPickerModal(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                  <Text style={flowStyles.ttSheetTitle}>Apne Videos</Text>
                  <View style={{ width: 22 }} />
                </View>
                <FlatList
                  data={videos.filter(v => v.user === userId)}
                  keyExtractor={item => item.id}
                  style={{ width: '100%' }}
                  ListEmptyComponent={
                    <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 24 }}>Koi video nahi mila</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[flowStyles.ttSheetRow, { paddingVertical: 14, alignItems: 'center' }]}
                      activeOpacity={0.75}
                      onPress={() => {
                        const link = getMastiVideoAppLink(item.id);
                        setUploadTitle(prev => prev ? prev + ' ' + link : link);
                        setShowVideoPickerModal(false);
                      }}
                    >
                      <View style={{ width: 56, height: 72, backgroundColor: '#222', borderRadius: 8, marginRight: 14, overflow: 'hidden', flexShrink: 0 }}>
                        {item.profileImage ? (
                          <Image source={{ uri: item.profileImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : null}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 2, alignItems: 'center' }}>
                          <Ionicons name="videocam" size={14} color="#fff" />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[flowStyles.ttSheetRowLabel, { fontSize: 14 }]} numberOfLines={2}>{item.desc || item.name || 'Video'}</Text>
                        <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{getMastiVideoAppLink(item.id)}</Text>
                      </View>
                      <Ionicons name="link-outline" size={18} color="#FE2C55" style={{ marginLeft: 10 }} />
                    </TouchableOpacity>
                  )}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* ── COVER SELECTION MODAL ── */}
          <Modal visible={showCoverSelection} animationType="slide" transparent onRequestClose={() => setShowCoverSelection(false)}>
            <View style={flowStyles.coverModalBg}>
              <View style={flowStyles.coverModalContent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={flowStyles.coverModalTitle}>Select Cover Frame</Text>
                  <TouchableOpacity onPress={() => setShowCoverSelection(false)}>
                    <Ionicons name="close" size={26} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Video
                  source={{ uri: recordedVideoUri }}
                  style={{ width: width * 0.52, height: width * 0.52 * (16 / 9), alignSelf: 'center', borderRadius: 12, backgroundColor: '#000' }}
                  resizeMode="cover"
                  shouldPlay
                  isLooping
                  positionMillis={coverFramePosition * 1000}
                  useNativeControls={false}
                />
                <Text style={flowStyles.coverSliderLabel}>Drag to pick a frame</Text>
                <View style={flowStyles.coverSliderTrack}>
                  <View
                    style={[flowStyles.coverSliderThumb, { left: (coverFramePosition / 15) * (width - 80) - 12 }]}
                    {...PanResponder.create({
                      onStartShouldSetPanResponder: () => true,
                      onPanResponderMove: (evt, gs) => {
                        const pct = Math.max(0, Math.min(1, (gs.moveX - 16) / (width - 80)));
                        setCoverFramePosition(pct * 15);
                      },
                    }).panHandlers}
                  />
                </View>
                <TouchableOpacity style={flowStyles.coverSaveBtn} onPress={() => setShowCoverSelection(false)}>
                  <Text style={flowStyles.coverSaveBtnText}>Save Cover</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ── TAG PEOPLE MODAL ── */}
          <Modal visible={showTagPeopleModal} animationType="slide" transparent onRequestClose={() => setShowTagPeopleModal(false)}>
            <TouchableOpacity style={flowStyles.ttModalOverlay} activeOpacity={1} onPress={() => setShowTagPeopleModal(false)}>
              <TouchableOpacity activeOpacity={1} style={[flowStyles.ttMoreSheet, { maxHeight: '85%', position: 'relative' }]}>
                <View style={flowStyles.ttSheetHandle} />
                <View style={flowStyles.ttSheetHeader}>
                  <TouchableOpacity onPress={() => setShowTagPeopleModal(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                  <Text style={flowStyles.ttSheetTitle}>Tag People</Text>
                  <TouchableOpacity onPress={() => setShowTagPeopleModal(false)}>
                    <Text style={{ color: '#FE2C55', fontSize: 15, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                </View>
                {/* Search bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 12, marginBottom: 14, marginTop: 4 }}>
                  <Ionicons name="search-outline" size={18} color="#888" style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10 }}
                    placeholder="Search friends..."
                    placeholderTextColor="#666"
                    value={tagSearchText}
                    onChangeText={setTagSearchText}
                    autoFocus
                    returnKeyType="search"
                    onSubmitEditing={() => triggerSearchLoading(setTagSearchLoading, tagSearchLoadingTimerRef)}
                  />
                  {tagSearchText.length > 0 && (
                    <TouchableOpacity onPress={() => setTagSearchText('')}>
                      <Ionicons name="close-circle" size={18} color="#888" />
                    </TouchableOpacity>
                  )}
                </View>
                {/* Tagged people chips */}
                {taggedPeople.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {taggedPeople.map(person => (
                      <TouchableOpacity
                        key={person}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FE2C5522', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
                        onPress={() => setTaggedPeople(prev => prev.filter(p => p !== person))}
                      >
                        <Text style={{ color: '#FE2C55', fontSize: 13, marginRight: 6 }}>{person}</Text>
                        <Ionicons name="close" size={14} color="#FE2C55" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* Suggested users list */}
                {[
                  { name: '@rahul_sharma', avatar: 'R' },
                  { name: '@priya.456', avatar: 'P' },
                  { name: '@dev_rocks99', avatar: 'D' },
                  { name: '@sunita_jain', avatar: 'S' },
                  { name: '@vikas_2026', avatar: 'V' },
                  { name: '@neha_star', avatar: 'N' },
                  { name: '@amit_king07', avatar: 'A' },
                ].filter(u => tagSearchText.length === 0 || u.name.toLowerCase().includes(tagSearchText.toLowerCase()))
                  .map((user, i, arr) => {
                    const isTagged = taggedPeople.includes(user.name);
                    return (
                      <TouchableOpacity
                        key={user.name}
                        style={[flowStyles.ttSheetRow, { paddingVertical: 12 }, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A' }]}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (isTagged) {
                            setTaggedPeople(prev => prev.filter(p => p !== user.name));
                          } else {
                            setTaggedPeople(prev => [...prev, user.name]);
                            setTagSearchText('');
                          }
                        }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FE2C55', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{user.avatar}</Text>
                        </View>
                        <Text style={[flowStyles.ttSheetRowLabel, { flex: 1 }]}>{user.name}</Text>
                        {isTagged && <Ionicons name="checkmark-circle" size={22} color="#FE2C55" />}
                      </TouchableOpacity>
                    );
                  })}
                {tagSearchLoading && (
                  <View style={styles.circularLoaderOverlay} pointerEvents="none">
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* ── ADD LINK MODAL ── */}
          <Modal visible={showAddLinkModal} animationType="slide" transparent onRequestClose={() => setShowAddLinkModal(false)}>
            <TouchableOpacity style={flowStyles.ttModalOverlay} activeOpacity={1} onPress={() => setShowAddLinkModal(false)}>
              <TouchableOpacity activeOpacity={1} style={flowStyles.ttMoreSheet}>
                <View style={flowStyles.ttSheetHandle} />
                <View style={flowStyles.ttSheetHeader}>
                  <TouchableOpacity onPress={() => setShowAddLinkModal(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                  <Text style={flowStyles.ttSheetTitle}>Add Link</Text>
                  <View style={{ width: 22 }} />
                </View>

                <Text style={{ color: '#888', fontSize: 13, marginBottom: 10 }}>Link title</Text>
                <View style={{ backgroundColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 14, marginBottom: 14 }}>
                  <TextInput
                    style={{ color: '#fff', fontSize: 15, paddingVertical: 12 }}
                    placeholder="e.g. My Channel"
                    placeholderTextColor="#555"
                    value={linkTitle}
                    onChangeText={setLinkTitle}
                  />
                </View>

                <Text style={{ color: '#888', fontSize: 13, marginBottom: 10 }}>URL</Text>
                <View style={{ backgroundColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 14, marginBottom: 20 }}>
                  <TextInput
                    style={{ color: '#fff', fontSize: 15, paddingVertical: 12 }}
                    placeholder="https://..."
                    placeholderTextColor="#555"
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Saved links */}
                {savedLinks.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Added links</Text>
                    {savedLinks.map((link, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 }}>
                        <Ionicons name="link-outline" size={16} color="#FE2C55" style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{link.title || 'Link'}</Text>
                          <Text style={{ color: '#888', fontSize: 11 }} numberOfLines={1}>{link.url}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSavedLinks(prev => prev.filter((_, idx) => idx !== i))} hitSlop={10}>
                          <Ionicons name="trash-outline" size={16} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[flowStyles.coverSaveBtn, { opacity: linkUrl.trim().length > 0 ? 1 : 0.4 }]}
                  disabled={linkUrl.trim().length === 0}
                  onPress={() => {
                    if (linkUrl.trim()) {
                      setSavedLinks(prev => [...prev, { title: linkTitle.trim() || linkUrl.trim(), url: linkUrl.trim() }]);
                      setLinkUrl('');
                      setLinkTitle('');
                      setShowAddLinkModal(false);
                      showSuccessToast('Link successfully added to your video.');
                    }
                  }}
                >
                  <Text style={flowStyles.coverSaveBtnText}>Add Link</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

        </View>
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!cameraHasPermission) {
      return (
        <View style={styles.cameraContainer}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Ionicons name="camera" size={80} color="#555" />
            <Text style={{ color: '#fff', fontSize: 18, marginTop: 20, textAlign: 'center' }}>
              Camera permission required
            </Text>
            <TouchableOpacity 
              onPress={requestCameraPermission} 
              style={{ backgroundColor: '#FE2C55', padding: 15, borderRadius: 10, marginTop: 20 }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCamera(false)} style={{ marginTop: 20 }}>
              <Text style={{ color: '#999' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        {/* Force transparent status bar so camera fills edge-to-edge on Android,
            regardless of which screen (home feed OR Sound Detail modal) opened the camera */}
        <StatusBar translucent={true} backgroundColor="transparent" barStyle="light-content" />
        {/* Cinematic black bars */}
        <View style={[flowStyles.cinematicBar, { top: 0 }]} />
        <View style={[flowStyles.cinematicBar, { bottom: 0, height: 80 }]} />

        {/* Keep the camera at the exact same full-screen size and position;
            only round the preview's outer frame like the reference image. */}
        <View style={[{
          position: 'absolute',
          top: 50,
          left: 0,
          width,
          height: Math.max(0, height - 50 - 28),
        }, { borderRadius: 18, overflow: 'hidden' }]}>
          <CameraView
            style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]}
            facing={facing}
            mode="video"
            videoQuality="1080p"
            ref={cameraRef}
            active={showCamera}
            enableTorch={flash === 'on'}
            zoom={cameraZoom}
          />
        </View>
        {/* Gesture overlay: pinch-to-zoom + double-tap-to-flip + tap-to-focus */}
        <TouchableWithoutFeedback onPress={handleCameraTap}>
          <View
            style={StyleSheet.absoluteFillObject}
            {...cameraPanResponder.panHandlers}
          >
            {focusPoint && (
              <View
                style={[
                  flowStyles.focusReticle,
                  { top: focusPoint.y - 30, left: focusPoint.x - 30 },
                ]}
              />
            )}
          </View>
        </TouchableWithoutFeedback>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: '#000', opacity: cameraFlipAnim, zIndex: 20 },
          ]}
        />
        <View pointerEvents="none" style={styles.cameraBottomBlackBand} />

{/* Top Bar */}
{!isRecording && (
  <View style={styles.cameraTopBar}>
    <TouchableOpacity onPress={() => { setShowCamera(false); setSelectedSong(null); }}>
      <Ionicons name="close" size={32} color="#fff" />
    </TouchableOpacity>

    <TouchableOpacity style={styles.addSoundBtn} onPress={() => selectedSong ? setShowMusicTrimmer(true) : setShowMusicModal(true)}>
      <Ionicons name="musical-notes" size={18} color={selectedSong ? '#4FC3F7' : '#fff'} />
      <Text style={[styles.addSoundText, selectedSong ? { color: '#4FC3F7' } : {}]}>{selectedSong ? selectedSong.title : 'Add sound'}</Text>
    </TouchableOpacity>

    <View style={{ width: 32 }} />
  </View>
)}

{/* Recording Timer - top-right pink pill */}
{isRecording && (
  <View
    style={{
      position: "absolute",
      top: 54,
      right: 16,
      backgroundColor: "#FF2D55",
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      zIndex: 999,
    }}
  >
    <Text
      style={{
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
      }}
    >
      {`0:${String(recordSeconds).padStart(2, "0")}`}
    </Text>
  </View>
)}

{/* Right Side Options */}
{!isRecording && (
  <View style={styles.cameraRightOptions}>
    <View style={styles.cameraRightDivider} />

    <TouchableOpacity
      style={styles.cameraOptionItem}
      onPress={toggleCameraFacing}
    >
      <View style={styles.cameraOptionIcon}>
        <Ionicons name="camera-reverse" size={23} color="#fff" />
      </View>
      <Text style={styles.cameraOptionText}>Flip</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.cameraOptionItem}
      onPress={changeSpeed}
    >
      <View style={styles.cameraOptionIcon}>
        <Ionicons name="speedometer" size={23} color="#fff" />
      </View>
      <Text style={styles.cameraOptionText}>{speed}</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.cameraOptionItem}
      onPress={() => setShowFilters(true)}
    >
      <View style={styles.cameraOptionIcon}>
        <Ionicons name="color-filter" size={23} color="#FFD21F" />
      </View>
      <Text style={styles.cameraOptionText}>Filter</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.cameraOptionItem}
      onPress={() => setShowEffects(true)}
    >
      <View style={styles.cameraOptionIcon}>
        <Ionicons name="sparkles" size={23} color="#FF4FA3" />
      </View>
      <Text style={styles.cameraOptionText}>Enhance</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.cameraOptionItem}
      onPress={() => {
        Alert.alert('Timer', 'Countdown chunno', [
          { text: 'Off', onPress: () => setTimerSeconds(0) },
          { text: '3s', onPress: () => setTimerSeconds(3) },
          { text: '5s', onPress: () => setTimerSeconds(5) },
          { text: '10s', onPress: () => setTimerSeconds(10) },
        ]);
      }}
    >
      <View style={styles.cameraOptionIcon}>
        <Ionicons name="timer-outline" size={23} color="#fff" />
      </View>
      <Text style={styles.cameraOptionText}>Timer</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.cameraOptionItem}
      onPress={toggleFlash}
    >
      <View style={styles.cameraOptionIcon}>
        <Ionicons
          name={flash === "off" ? "flash-off" : "flash"}
          size={23}
          color={flash === "off" ? "#fff" : "#FFD700"}
        />
      </View>
      <Text style={styles.cameraOptionText}>Flash</Text>
    </TouchableOpacity>

  </View>
)}

{/* ── Beauty Panel ── */}
{showBeautyPanel && !isRecording && (
  <View style={{
    position: 'absolute', left: 0, right: 0, bottom: 160,
    backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 20, paddingVertical: 16,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, zIndex: 999,
  }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✨ Beauty Camera</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity onPress={() => { setBeautySmooth(0); setBeautyBright(0); setBeautySlim(0); setBeautyEye(0); }}>
          <Text style={{ color: '#aaa', fontSize: 13 }}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowBeautyPanel(false)}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
    {[
      { label: '💆 Smooth Skin', value: beautySmooth, setter: setBeautySmooth, color: '#FF6EB4' },
      { label: '☀️ Brightness',  value: beautyBright, setter: setBeautyBright, color: '#FFD700' },
      { label: '🪄 Slim Face',   value: beautySlim,   setter: setBeautySlim,   color: '#A78BFA' },
      { label: '👁️ Big Eyes',    value: beautyEye,    setter: setBeautyEye,    color: '#60A5FA' },
    ].map(({ label, value, setter, color }) => (
      <View key={label} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: '#ddd', fontSize: 13 }}>{label}</Text>
          <Text style={{ color: color, fontSize: 13, fontWeight: '700' }}>{value}</Text>
        </View>
        <View style={{ height: 4, backgroundColor: '#333', borderRadius: 2 }}>
          <View style={{ height: 4, width: `${value}%`, backgroundColor: color, borderRadius: 2 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <TouchableOpacity onPress={() => setter(Math.max(0, value - 10))} style={{ padding: 4 }}>
            <Ionicons name="remove-circle-outline" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setter(Math.min(100, value + 10))} style={{ padding: 4 }}>
            <Ionicons name="add-circle-outline" size={22} color={color} />
          </TouchableOpacity>
        </View>
      </View>
    ))}
  </View>
)}

{/* Zoom Level Indicator */}
{showZoomLabel && !isRecording && (
  <View
    style={{
      position: "absolute",
      bottom: 185,
      alignSelf: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      zIndex: 999,
    }}
  >
    <Text
      style={{
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
        letterSpacing: 0.5,
      }}
    >
      {`${Math.max(1, Math.min(10, Math.round(1 + cameraZoom * 9)))}x`}
    </Text>
  </View>
)}

<View style={styles.cameraBottomSection}>

  {!isRecording && (
    <>
      <View style={styles.timerOptions}>
        <TouchableOpacity onPress={() => { setRecordTime('3m'); recordTimeRef.current = '3m'; }}>
          <View style={recordTime === '3m' ? styles.timerSelected : null}>
            <Text style={[styles.timerText, recordTime === '3m' && styles.timerTextActive]}>3m</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setRecordTime('60s'); recordTimeRef.current = '60s'; }}>
          <View style={recordTime === '60s' ? styles.timerSelected : null}>
            <Text style={[styles.timerText, recordTime === '60s' && styles.timerTextActive]}>60s</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setRecordTime('15s'); recordTimeRef.current = '15s'; }}
        >
          <View style={recordTime === '15s' ? styles.timerSelected : null}>
            <Text style={[styles.timerText, recordTime === '15s' && styles.timerTextActive]}>
              15s
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  )}

  <View style={styles.recordButtonsRow}>

    {!isRecording && (
      <TouchableOpacity style={styles.sideBtn} onPress={() => setShowEffects(true)}>
        <View style={styles.sideBtnBox}>
          <Ionicons name="sparkles" size={21} color="white" />
        </View>
        <Text style={styles.sideBtnText}>Effects</Text>
      </TouchableOpacity>
    )}

<View style={[{ alignItems: 'center', justifyContent: 'center' }, styles.recordButtonWrap]}>

  <Animated.View
    style={{
      position: "absolute",
      transform: [
        {
          rotate: rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ["0deg", "360deg"],
          }),
        },
      ],
    }}
  >
    <Svg
      width={84}
      height={84}
    >
      <Circle
        cx="42"
        cy="42"
        r={radius}
        stroke="#FE2C55"
        strokeWidth={5}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
  </Svg>
</Animated.View>

  
<View
  {...recordButtonResponder.panHandlers}
  style={styles.recordBtn}
>
  <View
    style={[
      styles.recordBtnInner,
      isRecording && {
        backgroundColor: "#FF0000",
        width: 26,
        height: 26,
        borderRadius: 6,
      },
    ]}
  />
</View>

</View>

{!isRecording && (
  <TouchableOpacity
    style={styles.sideBtn}
    onPress={pickVideoFromGallery}
  >
    <View style={styles.sideBtnBox}>
      <Ionicons
        name="images"
        size={21}
        color="white"
      />
    </View>
    <Text style={styles.sideBtnText}>Upload</Text>
  </TouchableOpacity>
)}

</View>

{isRecording && <View style={{ height: 44 }} />}
{!isRecording && <View style={styles.cameraTabs}>

  <TouchableOpacity
    style={{ width: 110, alignItems: "center" }}
    onPress={() => setCameraTab("Templates")}
  >
    <Text
      numberOfLines={1}
      style={[
        styles.cameraTabText,
        cameraTab === "Templates" && styles.cameraTabActive,
      ]}
    >
      Templates
    </Text>
    {cameraTab === "Templates" ? (
      <View style={styles.cameraTabDot} />
    ) : (
      <View style={{ height: 9 }} />
    )}
  </TouchableOpacity>

  <TouchableOpacity
  style={{
    width: 110,
    alignItems: "center",
    marginLeft: -30,
  }}
  onPress={() => setCameraTab("Camera")}
>
    <Text
      style={[
        styles.cameraTabText,
        cameraTab === "Camera" && styles.cameraTabActive,
      ]}
    >
      Camera
    </Text>
    {cameraTab === "Camera" ? (
      <View style={styles.cameraTabDot} />
    ) : (
      <View style={{ height: 9 }} />
    )}
  </TouchableOpacity>
  
  <TouchableOpacity
    style={{ width: 80, alignItems: "center" }}
    onPress={() => setCameraTab("Live")}
  >
    <Text
      style={[
        styles.cameraTabText,
        cameraTab === "Live" && styles.cameraTabActive,
      ]}
    >
      Live
    </Text>
    {cameraTab === "Live" ? (
      <View style={styles.cameraTabDot} />
    ) : (
      <View style={{ height: 9 }} />
    )}
  </TouchableOpacity>

</View>}
      </View>
    </View>
  );
  };

const FiltersModal = () => (
    <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{flex: 1}} onPress={() => setShowFilters(false)} />
        <View style={[styles.shareModalContent, { height: 300 }]}>
          <View style={styles.shareDragHandle} />
          <Text style={styles.shareTitle}>Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 20 }}>
            {FILTERS_LIST.map((filter) => (
              <TouchableOpacity key={filter} style={{ marginRight: 15, alignItems: 'center' }} onPress={() => { setSelectedFilter(filter); setShowFilters(false); }}>
                <View style={[styles.filterCircle, selectedFilter === filter && styles.filterActive]}>
                  <Text style={{ fontSize: 30 }}>🎨</Text>
                </View>
                <Text style={{ color: selectedFilter === filter? '#FE2C55' : '#fff', fontSize: 12, marginTop: 8 }}>{filter}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const EffectsModal = () => (
    <Modal visible={showEffects} animationType="slide" transparent onRequestClose={() => setShowEffects(false)}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{flex: 1}} onPress={() => setShowEffects(false)} />
        <View style={[styles.shareModalContent, { height: 300 }]}>
          <View style={styles.shareDragHandle} />
          <Text style={styles.shareTitle}>Effects</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 20 }}>
            {EFFECTS_LIST.map((effect) => (
              <TouchableOpacity key={effect} style={{ marginRight: 15, alignItems: 'center' }} onPress={() => { setSelectedEffect(effect); setShowEffects(false); }}>
                <View style={[styles.filterCircle, selectedEffect === effect && styles.filterActive]}>
                  <Text style={{ fontSize: 30 }}>✨</Text>
                </View>
             <Text style={{ color: selectedEffect === effect? '#FE2C55' : '#fff', fontSize: 12, marginTop: 8 }}>{effect}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const FollowersModal = ({ visible, type, onClose }) => {
    const currentUser = selectedUser || { user: userId, name, followers: ownFollowers, following: followingUsers.length };
    const displayUser = videos.find(v => v.user === currentUser.user) || currentUser;

    // Followers list: local store se real data
    // Following list: followingUsers array se — videos mein match karke profile info nikalo
    const users = type === 'followers'
      ? followersList.map(f => ({
          id: f.followerId,
          user: f.followerId,
          userId: f.followerUserId || f.followerId,
          name: f.followerName || f.followerId,
          profileImage: f.followerPic || 'https://i.pravatar.cc/300?img=1',
        }))
      : videos.filter(v => followingUsers.includes(v.user)).filter((v, i, arr) => arr.findIndex(x => x.user === v.user) === i);

    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* ── STICKY HEADER — fixed at very top, does not scroll ── */}
          <View style={{ paddingTop: Platform.OS === 'ios' ? 54 : 32, paddingBottom: 14, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#333', backgroundColor: '#000' }}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 15 }}>
              {displayUser.name}
            </Text>
          </View>
          {/* ── SCROLLABLE LIST below the fixed header ── */}
          <View style={{ flex: 1, position: 'relative' }}>
            <ScrollView
              style={[{ flex: 1, marginBottom: 10 }, followersModalLoading && { opacity: 0 }]}
              alwaysBounceVertical
              overScrollMode="always"
            >
              {users.map((item) => {
                const isFollowing = followingUsers.includes(item.user);
                return (
                  <View key={item.id} style={{ flexDirection: 'row', padding: 15, alignItems: 'center' }}>
                    <TouchableOpacity style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }} onPress={() => { onClose(); openUserProfile(item); }}>
                      <Image source={{ uri: item.profileImage }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 15 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{item.name}</Text>
                        <Text style={{ color: '#999', fontSize: 13 }}>{item.userId}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.followBtnBlue, isFollowing && styles.followBtnGray]}
                       onPress={() => toggleFollow(item)}
                    >
                      <Ionicons
                        name={isFollowing ? "checkmark-circle" : "person-add"}
                        size={18}
                        color={isFollowing ? '#fff' : '#fff'}
                      />
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', marginLeft: 6 }}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            {followersModalLoading && (
              <View style={styles.circularLoaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };
  const MusicModal = () => {
    const allSongs = [...mastiAudioSongs, ...customSongs, ...SONGS_LIST];
    const q = musicSearchQuery.trim().toLowerCase();

    // Jab search ho: pehle local results, phir iTunes live results
    const localFiltered = q
      ? allSongs.filter(s =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          (s.genre || '').toLowerCase().includes(q)
        )
      : musicTab === 'forYou'    ? allSongs
      : musicTab === 'audioSave' ? [...mastiAudioSongs, ...customSongs]
      : musicTab === 'trending'  ? allSongs.filter(s => s.genre === 'Bollywood')
      : allSongs.filter(s => s.genre === musicTab);

    // iTunes results deduplicate karo
    const itunesDeduped = itunesResults.filter(
      ir => !localFiltered.some(l => l.title.toLowerCase() === ir.title.toLowerCase() && l.artist.toLowerCase() === ir.artist.toLowerCase())
    );

    const filtered = q ? [...localFiltered, ...itunesDeduped] : localFiltered;
    const musicListLoading = musicModalLoading || itunesSearching;

    const addCustom = () => {
      if (!musicSearchQuery.trim()) return;
      const custom = {
        id: 'c_' + Date.now(),
        title: musicSearchQuery.trim(),
        artist: 'Custom / Original',
        duration: '—',
        cover: 'https://i.pravatar.cc/80?img=' + (53 + customSongs.length),
        genre: 'Custom',
        isCustom: true,
      };
      setCustomSongs(prev => [custom, ...prev]);
      setSelectedSong(custom);
      setMusicSearchQuery('');
      setShowMusicModal(false);
    };

    const TABS = [
      { id: 'forYou',    icon: 'musical-notes', label: 'For You'    },
      { id: 'trending',  icon: 'trending-up',   label: 'Trending'   },
      { id: 'audioSave', icon: 'bookmark',      label: 'Audio Save' },
    ];

    return (
      <Modal visible={showMusicModal} animationType="slide" transparent={false} onRequestClose={() => { setShowMusicModal(false); setMusicSearchQuery(''); setPreviewingSongId(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#000' }}>

          {/* ── TikTok-style Header ── */}
          <View style={{ backgroundColor: '#000', paddingTop: Platform.OS === 'ios' ? 44 : 32, paddingBottom: 0 }}>
            {/* Top row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => { setShowMusicModal(false); setMusicSearchQuery(''); setPreviewingSongId(null); }} style={{ marginRight: 12 }}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 }}>Sounds</Text>
              {selectedSong && (
                <TouchableOpacity onPress={() => setSelectedSong(null)}>
                  <Text style={{ color: '#FE2C55', fontSize: 13, fontWeight: '600' }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Search bar + Import button row */}
            <View
              style={{
                marginHorizontal: 14,
                marginBottom: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* Search Box */}
              <View
                style={{
                  flex: 1,
                  height: 50,
                  backgroundColor: '#0F1016',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#2A2A36',
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}
              >
                <Ionicons
                  name="search"
                  size={24}
                  color="#FF0A6C"
                  style={{ marginRight: 12 }}
                />
                <TextInput
                  style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' }}
                  placeholder="Gaane, artist ya koi dialog..."
                  placeholderTextColor="#6F7482"
                  value={musicSearchQuery}
                  onChangeText={setMusicSearchQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                  onSubmitEditing={() => triggerSearchLoading(setMusicModalLoading, musicModalLoadingTimerRef)}
                />
                {musicSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setMusicSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#6F7482" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Import Button */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  width: 126,
                  height: 50,
                  backgroundColor: '#0F1016',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#2A2A36',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 14,
                }}
                onPress={addCustom}
              >
                <Ionicons
                  name="musical-notes"
                  size={24}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 17,
                    fontWeight: '700',
                  }}
                >
                  Import
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category tabs — 3 fixed pills */}
            {!musicSearchQuery && (
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, paddingBottom: 14 }}>
                {TABS.map(tab => {
                  const active = musicTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setMusicTab(tab.id)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        paddingVertical: 10, borderRadius: 22,
                        backgroundColor: active ? '#FE2C55' : '#1C1C1C',
                        borderWidth: active ? 0 : 1, borderColor: '#2A2A2A' }}
                    >
                      <Ionicons name={tab.icon as any} size={15} color={active ? '#fff' : '#aaa'} />
                      <Text style={{ color: active ? '#fff' : '#aaa', fontSize: 13, fontWeight: '700' }}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Selected song strip */}
            {selectedSong && (
              <View style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: 'rgba(254,44,85,0.14)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FE2C55' }}>
                <Ionicons name="musical-note" size={16} color="#FE2C55" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{selectedSong.title}</Text>
                  <Text style={{ color: '#aaa', fontSize: 11 }}>{selectedSong.artist}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedSong(null)}>
                  <Ionicons name="close-circle" size={20} color="#FE2C55" />
                </TouchableOpacity>
              </View>
            )}

            {/* Custom add buttons */}
            {musicSearchQuery.trim().length > 0 && (
              <TouchableOpacity
                style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: filtered.length === 0 ? '#FE2C55' : 'rgba(254,44,85,0.15)', borderRadius: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: filtered.length > 0 ? 1 : 0, borderColor: '#FE2C55' }}
                onPress={addCustom}
              >
                <Ionicons name="add-circle" size={18} color={filtered.length === 0 ? '#fff' : '#FE2C55'} />
                <Text style={{ color: filtered.length === 0 ? '#fff' : '#FE2C55', fontWeight: '700', fontSize: 14 }}>
                  "{musicSearchQuery.trim()}" — Custom add karo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Song list ── */}
          <View style={{ flex: 1, position: 'relative' }}>
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              style={[{ flex: 1, backgroundColor: '#000' }, musicListLoading && { opacity: 0 }]}
              ListHeaderComponent={itunesSearching ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 }}>
                  <Text style={{ color: '#FE2C55', fontSize: 13 }}>🔍 Searching live...</Text>
                </View>
              ) : null}
              ListEmptyComponent={
                itunesSearching ? null : (
                  <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                    <Text style={{ fontSize: 48 }}>🎵</Text>
                    <Text style={{ color: '#555', fontSize: 15, marginTop: 12 }}>Koi sound nahi mila</Text>
                    <Text style={{ color: '#444', fontSize: 12, marginTop: 6 }}>Upar se custom add kar sakte ho</Text>
                  </View>
                )
              }
              ItemSeparatorComponent={() => <View style={{ height: 0.5, backgroundColor: '#1C1C1C' }} />}
              renderItem={({ item: song }) => {
                const isSelected = selectedSong?.id === song.id;
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: isSelected ? 'rgba(254,44,85,0.07)' : '#000' }}
                    onPress={() => { if (isSelected) { setSelectedSong(null); } else { setTrimmerSong(song); setShowMusicTrimmer(true); } }}
                  >
                  {/* Cover art — 80×80 with play/pause overlay */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setPreviewingSongId((prev: any) => prev === song.id ? null : song.id);
                    }}
                    style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1A' }}
                  >
                    <Image source={{ uri: song.cover }} style={{ width: 80, height: 80 }} resizeMode="cover" />
                    {/* Selected overlay */}
                    {isSelected && previewingSongId !== song.id && (
                      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(254,44,85,0.50)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="musical-note" size={28} color="#fff" />
                      </View>
                    )}
                    {/* Play / Pause overlay */}
                    {previewingSongId === song.id ? (
                      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="pause" size={28} color="#fff" />
                      </View>
                    ) : (
                      !isSelected && (
                        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="play" size={26} color="#fff" />
                        </View>
                      )
                    )}
                    {song.isCustom && (
                      <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#FE2C55', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>MY</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Info */}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={{ color: isSelected ? '#FE2C55' : '#fff', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{song.title}</Text>
                    <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }} numberOfLines={1}>{song.artist}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                      {song.genre && (
                        <View style={{ backgroundColor: '#1C1C1C', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: '#999', fontSize: 11, fontWeight: '600' }}>{song.genre}</Text>
                        </View>
                      )}
                      <Text style={{ color: '#555', fontSize: 12 }}>{song.duration}</Text>
                    </View>
                  </View>

                  {/* Right: check or + */}
                  {isSelected ? (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FE2C55', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="checkmark" size={22} color="#fff" />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#333', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => { setTrimmerSong(song); setShowMusicTrimmer(true); }}
                    >
                      <Ionicons name="add" size={22} color="#aaa" />
                    </TouchableOpacity>
                  )}
                  </TouchableOpacity>
                );
              }}
            />
            {musicListLoading && (
              <View style={styles.circularLoaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const SoundDetailModal = () => {
    const song    = currentVideoItem?.song;
    const title   = song?.title  || 'Original Audio';
    const artist  = song?.artist || currentVideoItem?.name || 'Unknown Artist';
    // Original Audio → creator ki profile image; Song → album art
    const cover   = song?.cover  || currentVideoItem?.profileImage || currentVideoItem?.musicCover || 'https://i.pravatar.cc/300?img=5';
    const dur     = song?.duration || '00:30';
    // A sound belongs to the user who posted the video/audio. Prefer an
    // explicit owner on the song metadata, then fall back to the source video.
    const soundOwnerId = song?.userId || song?.user || currentVideoItem?.userId || currentVideoItem?.user || artist;

    const useThisSound = () => {
      const selectedSound = song || {
        id: `original-${currentVideoItem?.id || Date.now()}`,
        title,
        artist,
        cover,
        duration: dur,
        audioUrl: currentVideoItem?.audioUrl || undefined,
        isOriginal: true,
      };

      // Sound detail audio band karo jab "Use this sound" tap ho
      if (soundDetailAudioRef.current) {
        soundDetailAudioRef.current.stopAsync().catch(() => {});
        soundDetailAudioRef.current.unloadAsync().catch(() => {});
        soundDetailAudioRef.current = null;
      }
      setIsSoundDetailAudioPlaying(false);

      setCustomSongs(prev => [
        selectedSound,
        ...prev.filter(saved => saved.id !== selectedSound.id),
      ]);
      setSelectedSong(selectedSound);
      setShowSoundDetail(false);
      setShowMusicModal(false);
      setShowMusicTrimmer(false);
      setTrimmerSong(null);
      setPreviewingSongId(null);
      setRecordingFlowStep(null);
      setMusicTab('audioSave');
      setMusicSearchQuery('');
      // Camera open karo with this sound pre-selected (requireAuth — plus button jaisa)
      setTimeout(() => requireAuth(() => setShowCamera(true)), 200);
    };

    const audioId = song?.id || `original-${currentVideoItem?.id}`;

    // ── Thumbnail play/pause toggle ───────────────────────────────────────────
    const toggleSoundDetailAudio = async () => {
      const audioUrl = song?.audioUrl || currentVideoItem?.audioUrl || currentVideoItem?.url;
      if (!audioUrl) return;
      if (isSoundDetailAudioPlaying) {
        try { await soundDetailAudioRef.current?.pauseAsync(); } catch (_) {}
        setIsSoundDetailAudioPlaying(false);
      } else {
        try {
          if (soundDetailAudioRef.current) {
            await soundDetailAudioRef.current.playAsync();
          } else {
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
            const { sound } = await Audio.Sound.createAsync(
              { uri: audioUrl },
              { shouldPlay: true, isLooping: true, volume: 1.0 }
            );
            soundDetailAudioRef.current = sound;
          }
          setIsSoundDetailAudioPlaying(true);
        } catch (_) {}
      }
    };

    const relatedVideos = videos.filter(video => {
      // Video ne explicitly yahi sound select karke upload kiya ho
      if (video.song?.id && video.song.id === audioId) return true;
      // Original Audio mode: sirf source video khud dikhe
      if (!song && video.id === currentVideoItem?.id) return true;
      return false;
    });
    const soundUsers = Array.from(
      new Map(relatedVideos.map(video => [video.userId || video.user, video])).values()
    ).map(video => ({
      ...video,
      soundVideos: relatedVideos.filter(item => (item.userId || item.user) === (video.userId || video.user)).length,
    }));
    const cellW = width / 3;
    const cellH = cellW * 1.55;

    return (
      <Modal visible={showSoundDetail} animationType="slide" transparent={false} onRequestClose={() => setShowSoundDetail(false)}>
        <View style={{ flex: 1, backgroundColor: '#141414' }}>

          {/* ── Header ── */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingTop: insets.top - 50,
            paddingHorizontal: 14, paddingBottom: 10,
          }}>
            <TouchableOpacity onPress={() => setShowSoundDetail(false)} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={{ marginRight: 18 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="share-social-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={{ marginRight: 18 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="bookmark-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSoundDetail(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ── Song Info Row ── */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 16 }}>
            {/* Album art with play/pause button — tap to play/pause audio preview */}
            <TouchableOpacity
              onPress={toggleSoundDetailAudio}
              activeOpacity={0.85}
              style={{ width: 100, height: 100, borderRadius: 10, overflow: 'hidden', backgroundColor: '#333', marginRight: 14 }}>
              <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} />
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.28)' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.85)',
                  alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons
                    name={isSoundDetailAudioPlaying ? 'pause' : 'play'}
                    size={16}
                    color="#000"
                    style={{ marginLeft: isSoundDetailAudioPlaying ? 0 : 2 }}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {/* Text info */}
            <View style={{ flex: 1, paddingTop: 4 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 22 }} numberOfLines={2}>{title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <Text style={{ color: '#ccc', fontSize: 13, fontWeight: '600' }}>{artist}</Text>
                <Ionicons name="checkmark-circle" size={14} color="#3897F0" style={{ marginLeft: 4 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <Ionicons name="musical-note" size={13} color="#aaa" />
                <Text style={{ color: '#aaa', fontSize: 12, marginLeft: 4 }}>{
                  relatedVideos.length >= 1000000 ? (relatedVideos.length / 1000000).toFixed(1) + 'M' :
                  relatedVideos.length >= 1000 ? (relatedVideos.length / 1000).toFixed(1) + 'K' :
                  String(relatedVideos.length)
                } Videos</Text>
                <Text style={{ color: '#555', fontSize: 12, marginHorizontal: 5 }}>•</Text>
                <Ionicons name="play" size={11} color="#aaa" />
                <Text style={{ color: '#aaa', fontSize: 12, marginLeft: 4 }}>{(() => {
                  const total = relatedVideos.reduce((sum, v) => sum + (v.views || v.likes || 0), 0);
                  if (total >= 1000000) return (total / 1000000).toFixed(1) + 'M';
                  if (total >= 1000) return (total / 1000).toFixed(1) + 'K';
                  return String(total);
                })()} Plays</Text>
              </View>
              {/* Live audio progress */}
              {feedDurationMs > 0 ? (
                <View style={{ marginTop: 6 }}>
                  <View style={{ height: 2, backgroundColor: '#333', borderRadius: 1, marginBottom: 4 }}>
                    <View style={{ height: 2, backgroundColor: '#1877F2', borderRadius: 1,
                      width: `${Math.min(100, (feedPositionMs / feedDurationMs) * 100)}%` }} />
                  </View>
                  <Text style={{ color: '#aaa', fontSize: 12 }}>
                    {`${String(Math.floor(feedPositionMs / 60000)).padStart(2,'0')}:${String(Math.floor((feedPositionMs % 60000) / 1000)).padStart(2,'0')} / ${String(Math.floor(feedDurationMs / 60000)).padStart(2,'0')}:${String(Math.floor((feedDurationMs % 60000) / 1000)).padStart(2,'0')}`}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: '#aaa', fontSize: 12, marginTop: 6 }}>{dur}</Text>
              )}
            </View>
          </View>

          {/* ── Action Buttons ── */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
            <TouchableOpacity
              onPress={useThisSound}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: '#555', borderRadius: 6, paddingVertical: 8, gap: 5 }}>
              <Ionicons name="videocam" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Use this sound</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => requireAuth(() => toggleFollow(soundOwnerId))}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center',
                backgroundColor: followingUsers.includes(soundOwnerId) ? '#222' : '#1877F2',
                borderWidth: followingUsers.includes(soundOwnerId) ? 1 : 0,
                borderColor: '#555',
                borderRadius: 6, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {followingUsers.includes(soundOwnerId) ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Tabs ── */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#2a2a2a' }}>
            {(['Videos','Users'] as const).map(tab => (
              <TouchableOpacity key={tab} onPress={() => setSoundDetailTab(tab)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}>
                <Text style={{ color: soundDetailTab === tab ? '#fff' : '#666', fontSize: 15,
                  fontWeight: soundDetailTab === tab ? '700' : '400' }}>{tab}</Text>
                {soundDetailTab === tab && (
                  <View style={{ position: 'absolute', bottom: 0, width: 44, height: 2.5,
                    backgroundColor: '#1877F2', borderRadius: 2 }} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Content ── */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {soundDetailTab === 'Videos' ? (
              /* 3-column portrait grid */
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {relatedVideos.map((video) => {
                  const isThisPlaying = playingGridVideoId === video.id;
                  return (
                  <View key={video.id} style={{ width: cellW, backgroundColor: '#141414' }}>
                    {/* Portrait thumbnail — tap to open full-screen player */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        // Pause all grid videos and open full-screen player
                        soundDetailVideoRefsArray.current.forEach(ref => ref?.pauseAsync?.());
                        setPlayingGridVideoId(null);
                        setSoundFullScreenVideo(video);
                      }}
                    >
                    <View style={{ width: cellW, height: cellH, position: 'relative' }}>
                      {video.url ? (
                        <Video
                          ref={(r) => { soundDetailVideoRefsArray.current[relatedVideos.indexOf(video)] = r; }}
                          source={{ uri: video.url }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                          shouldPlay={isThisPlaying}
                          isLooping
                          isMuted={false}
                          useNativeControls={false}
                        />
                      ) : (
                        <Image
                          source={{ uri: video.thumbnail || video.url }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      )}
                      {/* Play icon overlay when not playing */}
                      {!isThisPlaying && (
                        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18,
                            backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
                          </View>
                        </View>
                      )}
                      {/* gradient overlay at bottom */}
                      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 56,
                        backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', padding: 5 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Image source={{ uri: video.profileImage }} style={{ width: 18, height: 18, borderRadius: 9,
                            borderWidth: 1, borderColor: '#fff', marginRight: 4 }} />
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                            {video.user || video.userId}
                          </Text>
                          <Ionicons name="checkmark-circle" size={11} color="#3897F0" />
                        </View>
                      </View>
                    </View>
                    </TouchableOpacity>
                    {/* View count below image */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 5 }}>
                      <Ionicons name="play" size={11} color="#aaa" />
                      <Text style={{ color: '#aaa', fontSize: 11, marginLeft: 3 }}>{video.likes || 0}</Text>
                    </View>
                  </View>
                  );
                })}
              </View>
            ) : (
              /* Users list */
              <View>
                {soundUsers.map(u => (
                  <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 11,
                    borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e' }}>
                    <Image source={{ uri: u.profileImage }}
                      style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#333' }} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginRight: 4 }}>{u.user}</Text>
                        <Ionicons name="checkmark-circle" size={13} color="#3897F0" />
                      </View>
                      <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{u.soundVideos} videos with this sound</Text>
                    </View>
                    <TouchableOpacity style={{ backgroundColor: '#1877F2', borderRadius: 6,
                      paddingHorizontal: 16, paddingVertical: 7 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Follow</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

        </View>

        {/* ── Full-Screen Video Player (opens when thumbnail is tapped) ── */}
        <Modal
          visible={!!soundFullScreenVideo}
          animationType="slide"
          transparent={false}
          statusBarTranslucent
          onRequestClose={() => setSoundFullScreenVideo(null)}
        >
          {soundFullScreenVideo && (() => {
            const fsVideo = soundFullScreenVideo;
            const fsTitle = fsVideo.song?.title || 'Original Audio';
            const fsArtist = fsVideo.song?.artist || fsVideo.name || 'Unknown';
            const fsCover = fsVideo.song?.cover || fsVideo.musicCover || fsVideo.profileImage;
            const fsDetailsExpanded = expandedVideoDetailsId === String(fsVideo.id);
            const fsVideoTitle = String(fsVideo.title || fsVideo.desc || '').trim();
            const fsVideoCaption = String(fsVideo.desc || '').trim();
            const fsUploadDate =
              fsVideo.createdAt ??
              fsVideo.created_at ??
              fsVideo.uploadedAt ??
              fsVideo.uploaded_at ??
              fsVideo.publishedAt ??
              fsVideo.published_at ??
              fsVideo.timestamp;
            const fsViews = viewCounts[fsVideo.id] ?? fsVideo.views ?? fsVideo.social?.views ?? 0;
            const fsLikes =
              liveLikeCounts[fsVideo.id] ??
              mastiBaseCount(fsVideo.social?.likes ?? fsVideo.likes) ??
              0;
            const fsComments = Math.max(
              (videoComments[fsVideo.id] || []).length,
              mastiBaseCount(fsVideo.social?.comments ?? fsVideo.comments) ?? 0,
            );
            return (
              <View style={{ flex: 1, backgroundColor: '#000' }}>
                <StatusBar hidden={false} barStyle="light-content" />
                {/* Full-screen video */}
                <Video
                  source={{ uri: fsVideo.url }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  resizeMode="cover"
                  shouldPlay
                  isLooping
                  isMuted={false}
                  useNativeControls={false}
                  onPlaybackStatusUpdate={(status) => {
                    if (!status.isLoaded || !status.durationMillis || status.durationMillis <= 0) return;
                    setSoundDetailPlaybackProgress(
                      Math.max(0, Math.min(1, (status.positionMillis || 0) / status.durationMillis))
                    );
                  }}
                />

                {/* Top bar — back arrow + camera icon */}
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  paddingTop: Platform.OS === 'ios' ? 52 : 36,
                  paddingHorizontal: 16,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <TouchableOpacity
                    onPress={() => setSoundFullScreenVideo(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="arrow-back" size={26} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => {
                    const fsVideo = soundFullScreenVideo;
                    const fsSong = fsVideo?.song;
                    const fsSound = fsSong || {
                      id: `original-${fsVideo?.id || Date.now()}`,
                      title: fsSong?.title || 'Original Audio',
                      artist: fsSong?.artist || fsVideo?.name || fsVideo?.user || 'Unknown Artist',
                      cover: fsSong?.cover || fsVideo?.musicCover || undefined,
                      duration: fsSong?.duration || '00:30',
                      audioUrl: fsVideo?.audioUrl || undefined,
                      isOriginal: true,
                    };
                    setCustomSongs((prev: any[]) => [fsSound, ...prev.filter((s: any) => s.id !== fsSound.id)]);
                setSelectedSong(fsSound);

                setRecordingFlowStep(null);

                setMusicTab('audioSave');

                setMusicSearchQuery('');

                setSoundFullScreenVideo(null);

                setShowCamera(true);

                setShowSoundDetail(false);
                  }}>
                    <Ionicons name="camera-outline" size={26} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Right-side action buttons */}
                {(() => {
                  const fsIsLiked = likedVideos[fsVideo.id] ?? fsVideo.isLiked === true;
                  const fsIsSaved = savedVideos[fsVideo.id] || false;
                  const fsCommentCount = Math.max(
                    (videoComments[fsVideo.id] || []).length,
                    mastiBaseCount(fsVideo.social?.comments ?? fsVideo.comments) ?? 0,
                  );
                  const fsShareCount = shareCounts[fsVideo.id] ??
                    mastiBaseCount(fsVideo.social?.shares) ?? fsVideo.shares ?? 0;
                  const fsSaveCount = saveCounts[fsVideo.id] ??
                    mastiBaseCount(fsVideo.social?.saves) ?? fsVideo.saves ?? 0;
                  const fsLikeCount = liveLikeCounts[fsVideo.id] ??
                    mastiBaseCount(fsVideo.social?.likes) ?? fsVideo.likes ?? 0;
                  return (
                <View style={{
                  position: 'absolute', right: 10, bottom: 120,
                  alignItems: 'center', gap: 18,
                }}>
                  {/* Creator profile avatar (DP) */}
                  <TouchableOpacity
                    style={{ alignItems: 'center' }}
                    onPress={() => requireAuth(() => openUserProfile(fsVideo))}
                  >
                    <View style={{
                      width: 48, height: 48, borderRadius: 24,
                      borderWidth: 2, borderColor: '#fff', overflow: 'hidden',
                      backgroundColor: '#333',
                    }}>
                      {(() => {
                        // Current user ke apne video mein fresh profileImage state use karo
                        const isOwnVideo = fsVideo.user === userId || fsVideo.userId === userId;
                        const avatarUri = isOwnVideo
                          ? (profileImage || fsVideo.profileImage || '')
                          : (fsVideo.profileImage || '');
                        return avatarUri ? (
                          <Image
                            source={{ uri: avatarUri }}
                            style={{ width: '100%', height: '100%' }}
                            onError={() => {}}
                            defaultSource={undefined}
                          />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="person" size={24} color="#fff" />
                          </View>
                        );
                      })()}
                    </View>
                    {/* Red + badge */}
                    <View style={{
                      width: 18, height: 18, borderRadius: 9,
                      backgroundColor: '#FE2C55', alignItems: 'center',
                      justifyContent: 'center', marginTop: -9,
                    }}>
                      <Ionicons name="add" size={13} color="#fff" />
                    </View>
                  </TouchableOpacity>

                  {/* Like / Heart — live count */}
                  <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => requireAuth(() => handleLike(fsVideo))}>
                    <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                      <Ionicons
                        name={fsIsLiked ? 'heart' : 'heart-outline'}
                        size={34}
                        color={fsIsLiked ? '#FE2C55' : '#fff'}
                      />
                    </Animated.View>
                    <Text style={{ color: '#fff', fontSize: 12, marginTop: 3, fontWeight: '600' }}>
                      {fsLikeCount}
                    </Text>
                  </TouchableOpacity>

                  {/* Comment — live count */}
                  <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => requireAuth(() => openVideoComments(fsVideo))}>
                    <Ionicons name="chatbubble-ellipses-outline" size={33} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, marginTop: 3, fontWeight: '600' }}>{fsCommentCount}</Text>
                  </TouchableOpacity>

                  {/* Bookmark / Save — live count */}
                  <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => requireAuth(() => handleSave(fsVideo))}>
                    <Ionicons
                      name={fsIsSaved ? 'bookmark' : 'bookmark-outline'}
                      size={32}
                      color={fsIsSaved ? '#FFD700' : '#fff'}
                    />
                    <Text style={{ color: '#fff', fontSize: 12, marginTop: 3, fontWeight: '600' }}>{fsSaveCount}</Text>
                  </TouchableOpacity>

                  {/* Share / Paper-plane — live count */}
                  <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => { setCurrentVideoItem(fsVideo); setShareOpenedFromProfile(false); setShowShare(true); }}>
                    <Ionicons name="paper-plane-outline" size={31} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, marginTop: 3, fontWeight: '600' }}>{fsShareCount}</Text>
                  </TouchableOpacity>

                  {/* Music / Audio disc — TikTok/Instagram style spinning */}
                  <TouchableOpacity
                    onPress={() => { setCurrentVideoItem(fsVideo); setShowSoundDetail(true); }}
                    style={{ alignItems: 'center' }}
                  >
                    {/* Outer vinyl ring */}
                    <View style={{
                      width: 48, height: 48, borderRadius: 24,
                      borderWidth: 3, borderColor: '#444',
                      backgroundColor: '#111',
                      alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {/* Spinning disc image — song cover ya creator DP */}
                      {(() => {
                        const discImg = fsVideo.song?.cover
                          ? fsVideo.song.cover          // gana hai → album art
                          : (fsVideo.profileImage || fsVideo.musicCover || null); // Original Audio → creator DP
                        return discImg ? (
                          <Animated.Image
                            source={{ uri: discImg }}
                            style={{
                              width: '100%', height: '100%',
                              transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                            }}
                          />
                        ) : (
                          <Animated.View style={{
                            width: '100%', height: '100%',
                            backgroundColor: '#222',
                            alignItems: 'center', justifyContent: 'center',
                            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                          }}>
                            <Ionicons name="musical-notes" size={18} color="#fff" />
                          </Animated.View>
                        );
                      })()}
                      {/* Center hole (vinyl look) */}
                      <View style={{
                        position: 'absolute', width: 10, height: 10, borderRadius: 5,
                        backgroundColor: '#111', borderWidth: 1.5, borderColor: '#555',
                      }} pointerEvents="none" />
                    </View>
                  </TouchableOpacity>
                </View>
                  );
                })()}

                {/* Bottom info — username + follow + description + song */}
                <View style={{
                  position: 'absolute', left: 0, right: 68,
                  bottom: Math.max(34, insets.bottom + 12) + 70,
                  paddingHorizontal: 14,
                }}>
                  {/* Username + User ID + Follow */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                    {(() => {
                      // Apne video mein profile ka current username dikhao (Instagram/TikTok style)
                      const isOwnFeedVideo = fsVideo.user === userId || fsVideo.userId === userId
                        || (fsVideo.accountId != null && fsVideo.accountId === appAuth.currentUser?.uid);
                      const rawUid = isOwnFeedVideo ? userId : (fsVideo.user || fsVideo.userId || '@user');
                      const displayUid = rawUid.startsWith('@') ? rawUid : '@' + rawUid;
                      return (
                        <>
                          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginRight: 1 }}>
                            {displayUid}
                          </Text>
                          {fsVideo.isVerified === true && <VerifiedBadge size={16} />}
                        </>
                      );
                    })()}
                    <TouchableOpacity style={{
                      borderWidth: 1.5, borderColor: '#fff', borderRadius: 8,
                      paddingHorizontal: 16, paddingVertical: 7, marginLeft: 10,
                      backgroundColor: followingUsers.some(
                        (handle) => normalizedIdentity(handle) === normalizedIdentity(fsVideo.user || fsVideo.userId),
                      ) ? 'rgba(0,0,0,0.5)' : 'transparent',
                    }} onPress={() => requireAuth(() => toggleFollow(fsVideo))}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                        {followingUsers.some(
                          (handle) => normalizedIdentity(handle) === normalizedIdentity(fsVideo.user || fsVideo.userId),
                        ) ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Display name (if different from user ID) */}
                  {fsVideo.name && fsVideo.name !== fsVideo.user && (
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 3 }}>
                      {fsVideo.name}
                    </Text>
                  )}

                  {/* Video description */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={fsDetailsExpanded ? 'Close video details' : 'Open video date and details'}
                    onPress={() => setExpandedVideoDetailsId(
                      (current) => current === String(fsVideo.id) ? null : String(fsVideo.id),
                    )}
                    style={{ alignSelf: 'flex-start', maxWidth: '100%', marginVertical: 4 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}>
                      <Text
                        style={{ color: '#fff', fontSize: 13, lineHeight: 19, flexShrink: 1 }}
                        numberOfLines={fsDetailsExpanded ? undefined : 1}
                      >
                        {fsVideoTitle || 'Video'}
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 16, lineHeight: 19, fontWeight: '800', marginLeft: 2 }}>
                        ...
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {fsDetailsExpanded && (
                    <View style={{
                      marginTop: 5,
                      marginBottom: 5,
                      paddingHorizontal: 9,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: 'rgba(0,0,0,0.48)',
                    }}>
                      {!!fsVideoCaption && fsVideoCaption !== fsVideoTitle && (
                        <Text style={{ color: '#fff', fontSize: 12, lineHeight: 17, marginBottom: 4 }}>
                          {fsVideoCaption}
                        </Text>
                      )}
                      <Text style={{ color: '#fff', fontSize: 12, lineHeight: 17 }}>
                        Uploaded {formatVideoUploadDate(fsUploadDate)}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17 }}>
                        {fsViews} views · {fsLikes} likes · {fsComments} comments
                      </Text>
                    </View>
                  )}

                  {/* Song / Audio name */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="musical-note" size={13} color="#fff" style={{ marginRight: 5 }} />
                    <Text style={{ color: '#fff', fontSize: 13 }}>
                      {fsTitle} • {fsArtist}
                    </Text>
                  </View>
                </View>

                {/* Bottom — "Use audio" button */}
                <View style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                   paddingBottom: Platform.OS === 'ios' ? 30 : Math.max(34, insets.bottom + 12),
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                }}>
                  <TouchableOpacity
                    onPress={() => {
                      const fsVideo = soundFullScreenVideo;
                      const fsSong = fsVideo?.song;
                      const fsSound = fsSong || {
                        id: `original-${fsVideo?.id || Date.now()}`,
                        title: fsSong?.title || 'Original Audio',
                        artist: fsSong?.artist || fsVideo?.name || fsVideo?.user || 'Unknown Artist',
                        cover: fsSong?.cover || fsVideo?.musicCover || undefined,
                        duration: fsSong?.duration || '00:30',
                        audioUrl: fsVideo?.audioUrl || undefined,
                        isOriginal: true,
                      };
                      setCustomSongs((prev: any[]) => [fsSound, ...prev.filter((s: any) => s.id !== fsSound.id)]);
                      setSelectedSong(fsSound);

setRecordingFlowStep(null);

setMusicTab('audioSave');

setMusicSearchQuery('');

setSoundFullScreenVideo(null);

setShowSoundDetail(false);

setShowCamera(true);
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: '#fff', borderRadius: 24,
                      paddingHorizontal: 32, paddingVertical: 12,
                      width: '100%', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="camera-outline" size={18} color="#000" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>Use audio</Text>
                  </TouchableOpacity>
                </View>

                {/* Progress bar — same playback line as the For You feed */}
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: Platform.OS === 'ios' ? 90 : Math.max(90, insets.bottom + 70),
                    height: 2,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    zIndex: 31,
                  }}
                >
                  <View
                    style={{
                      height: 2,
                      width: `${soundDetailPlaybackProgress * 100}%`,
                      backgroundColor: '#fff',
                    }}
                  />
                </View>
              </View>
            );
          })()}
        </Modal>

      </Modal>
    );
  };

     const ShareModal = () => (
    <Modal visible={showShare} animationType="slide" transparent onRequestClose={() => { setShowShare(false); setShareSearchQuery(''); }}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => { setShowShare(false); setShareSearchQuery(''); }} />
        <View style={[styles.shareModalContent, { paddingBottom: 28, position: 'relative' }]}>

          {/* ── Drag handle ── */}
          <View style={styles.shareDragHandle} />

          {/* ── Search bar ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#2A2A2A', borderRadius: 22, marginHorizontal: 16,
            marginBottom: 20, paddingHorizontal: 14, height: 44 }}>
            <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
            <TextInput
              value={shareSearchQuery}
              onChangeText={setShareSearchQuery}
              placeholder="Search"
              placeholderTextColor="#888"
              style={{ flex: 1, color: '#fff', fontSize: 15 }}
              returnKeyType="search"
              onSubmitEditing={() => triggerSearchLoading(setShareSearchLoading, shareSearchLoadingTimerRef)}
            />
          </View>

          {/* ── Contacts row ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 18, paddingBottom: 4 }}
            style={{ marginBottom: 22 }}>
            {(() => {
              const allContacts = dmUsers.map(u => ({
                ...u,
                name: u.name.split(' ')[0],
              }));
              const filtered = shareSearchQuery.trim()
                ? allContacts.filter(c => c.name.toLowerCase().includes(shareSearchQuery.toLowerCase()))
                : allContacts;
              return filtered.map(contact => (
                <TouchableOpacity key={contact.id} style={{ alignItems: 'center', width: 66 }}
                  onPress={() => {
                    // Share modal band karo
                    setShowShare(false);
                    setShareSearchQuery('');
                    // Us user ka chat kholo
                    const dmUser = dmUsers.find(u => u.id === contact.id) || contact;
                    openChat(dmUser);
                    // Save the shared video as a real message on the shared
                    // chat server so the other user receives it live too.
                    if (currentVideoItem?.id) {
                      void sendMessageToPeer(
                        dmUser,
                        getMastiVideoAppLink(currentVideoItem.id),
                      ).then(async () => {
                        try {
                          await recordMastiBaseShare(currentVideoItem, 'direct');
                          notifyVideoOwner(currentVideoItem, 'share').catch(() => {});
                        } catch (error) {
                          Alert.alert('Share count not saved', error instanceof Error ? error.message : 'MastiBase share count sync nahi ho saka.');
                        }
                      }).catch(error => {
                        Alert.alert('Share failed', error instanceof Error ? error.message : 'Video message send nahi ho saka.');
                      });
                    }
                  }}>
                  <View style={{ position: 'relative', marginBottom: 6 }}>
                    <Image source={{ uri: contact.avatar }}
                      style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#333' }} />
                    {contact.isOnline && (
                      <View style={{ position: 'absolute', bottom: 1, right: 1,
                        width: 14, height: 14, borderRadius: 7,
                        backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#1A1A1A' }} />
                    )}
                  </View>
                  <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>{contact.name}</Text>
                </TouchableOpacity>
              ));
            })()}
          </ScrollView>
          {dmUsers.length === 0 && (
            <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: -16, marginBottom: 16 }}>
              No creator accounts are available to message yet.
            </Text>
          )}

          {/* ── Action buttons row ──
              Download ke baad Delete aur Pin swipe karne par dikhte hain. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            style={{ flexGrow: 0 }}
          >
            <View style={{ width: width - 32, flexDirection: 'row', justifyContent: 'space-around' }}>
            {/* Share video app link */}
            <TouchableOpacity style={{ alignItems: 'center', width: 74 }}
              onPress={async () => {
                if (!currentVideoItem?.id) return;
                const url = getMastiVideoAppLink(currentVideoItem.id);
                try {
                  const result = await Share.share({
                    message: `${currentVideoItem?.desc || 'Dekho yeh video Masti Video par'}\n${url}`,
                    url,
                  });
                  if (result.action === Share.sharedAction) {
                    if (currentVideoItem?.id) {
                      try {
                        await recordMastiBaseShare(currentVideoItem, 'direct');
                        notifyVideoOwner(currentVideoItem, 'share').catch(() => {});
                      } catch (error) {
                        Alert.alert('Share count not saved', error instanceof Error ? error.message : 'MastiBase share count sync nahi ho saka.');
                      }
                    }
                  }
                } catch (error) {
                  console.warn('[Share] Native share failed:', error);
                }
                setShowShare(false);
                setShareSearchQuery('');
              }}>
              <View style={{ width: 62, height: 62, borderRadius: 14, backgroundColor: '#2A2A2A',
                alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="link" size={26} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>Share link</Text>
            </TouchableOpacity>

            {/* WhatsApp */}
            <TouchableOpacity style={{ alignItems: 'center', width: 74 }}
              onPress={async () => {
                if (!currentVideoItem?.id) return;
                const videoLink = getMastiVideoAppLink(currentVideoItem.id);
                const msg = encodeURIComponent(`${currentVideoItem?.desc || 'Dekho yeh video!'}\n${videoLink}`);
                let opened = false;
                try {
                  await Linking.openURL(`whatsapp://send?text=${msg}`);
                  opened = true;
                } catch {
                  try {
                    await Linking.openURL(`https://wa.me/?text=${msg}`);
                    opened = true;
                  } catch (error) {
                    Alert.alert('Share failed', error instanceof Error ? error.message : 'WhatsApp share nahi ho saka.');
                  }
                }
                if (opened) {
                  try {
                    await recordMastiBaseShare(currentVideoItem, 'whatsapp');
                  } catch (error) {
                    Alert.alert('Share count not saved', error instanceof Error ? error.message : 'MastiBase share count sync nahi ho saka.');
                  }
                  notifyVideoOwner(currentVideoItem, 'share').catch(() => {});
                }
                setShowShare(false);
                setShareSearchQuery('');
              }}>
              <View style={{ width: 62, height: 62, borderRadius: 14, backgroundColor: '#25D366',
                alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="logo-whatsapp" size={30} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>WhatsApp</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity style={{ alignItems: 'center', width: 74 }}
              onPress={() => handleShare(currentVideoItem)}>
              <View style={{ width: 62, height: 62, borderRadius: 14, backgroundColor: '#2A2A2A',
                alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="share-social-outline" size={26} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>Share</Text>
            </TouchableOpacity>

            {/* Download */}
            <TouchableOpacity style={{ alignItems: 'center', width: 74 }}
              disabled={isDownloadingVideo || Boolean(deletingVideoId)}
              onPress={async () => {
                if (isDownloadingVideo || deletingVideoId) return;
                setIsDownloadingVideo(true);
                let downloaded = false;
                try {
                  const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
                  if (status !== 'granted') {
                    Alert.alert('Permission', 'Gallery permission chahiye download ke liye.');
                    return;
                  }
                  const url = currentVideoItem?.url;
                  if (!url) { Alert.alert('Error', 'Video URL nahi mili.'); return; }
                  const fileUri = FileSystem.cacheDirectory + `masti_${Date.now()}.mp4`;
                  await FileSystem.downloadAsync(url, fileUri);
                  await MediaLibrary.saveToLibraryAsync(fileUri);
                  downloaded = true;
                  showSuccessToast('Video gallery mein save ho gayi.');
                } catch (_) {
                  Alert.alert('Error', 'Download nahi ho saka, dobara try karo.');
                } finally {
                  setIsDownloadingVideo(false);
                  if (downloaded) {
                    setShowShare(false);
                    setShareSearchQuery('');
                  }
                }
              }}>
              <View style={{ width: 62, height: 62, borderRadius: 14, backgroundColor: '#2A2A2A',
                opacity: isDownloadingVideo || Boolean(deletingVideoId) ? 0.55 : 1,
                alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="download-outline" size={26} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>Download</Text>
            </TouchableOpacity>
            </View>

             {shareOpenedFromProfile && isVideoOwnedByCurrentUser(currentVideoItem) && (
               <>
                 {/* Delete — only for the current user's video opened from their profile */}
                 <TouchableOpacity
                   style={{ alignItems: 'center', width: 74, marginLeft: 20 }}
                   disabled={Boolean(deletingVideoId) || isDownloadingVideo}
                   onPress={handleDeleteSharedVideo}
                 >
                   <View style={{ width: 62, height: 62, borderRadius: 14, backgroundColor: '#2A2A2A',
                     opacity: deletingVideoId || isDownloadingVideo ? 0.55 : 1,
                     alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                     <Ionicons name="trash-outline" size={26} color="#FF4D67" />
                   </View>
                   <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>Delete</Text>
                 </TouchableOpacity>

                 {/* Pin — only for the current user's video opened from their profile */}
                 <TouchableOpacity
                   style={{ alignItems: 'center', width: 74, marginLeft: 12 }}
                   onPress={handlePinSharedVideo}
                 >
                   <View style={{ width: 62, height: 62, borderRadius: 14,
                     backgroundColor: pinnedVideos[currentVideoItem?.id] ? '#FFD700' : '#2A2A2A',
                     alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                     <Ionicons
                       name={pinnedVideos[currentVideoItem?.id] ? 'pin' : 'pin-outline'}
                       size={26}
                       color={pinnedVideos[currentVideoItem?.id] ? '#111' : '#fff'}
                     />
                   </View>
                   <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>
                     {pinnedVideos[currentVideoItem?.id] ? 'Unpin' : 'Pin'}
                   </Text>
                 </TouchableOpacity>
               </>
             )}
          </ScrollView>

           {(shareSearchLoading || isDownloadingVideo || Boolean(deletingVideoId)) && (
             <View style={styles.circularLoaderOverlay} pointerEvents="none">
               <ActivityIndicator size="large" color="#fff" />
             </View>
           )}

        </View>
      </View>
    </Modal>
  );

  const CommentsModal = () => (
    <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
      <ControllerKeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={styles.commentModalContainer}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setShowComments(false)} />
          <View style={styles.commentModalContent}>
            <View style={[styles.commentHeader, commentsPTR.refreshing && { opacity: 0 }]}>
              <View style={styles.commentDragHandle} />
              <Text style={styles.commentTitle}>{(videoComments[currentVideoItem?.id] || []).length} Comments</Text>
            </View>
            <FlatList
              data={videoComments[currentVideoItem?.id] || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => commentsPTR.refreshing ? null : (
                <View style={[styles.commentItem, item.isReply && styles.commentReply]}>
                  <Image source={{ uri: item.profilePic }} style={styles.commentAvatar} />
                  <View style={styles.commentBody}>
                    <Text style={styles.commentUsername}>
                      {item.username}
                      <Text style={styles.commentTime}> {item.time}</Text>
                      {item.authorBadge && <Text style={styles.authorBadge}> · {item.authorBadge}</Text>}
                    </Text>
            <Text style={styles.commentText}>{item.comment}</Text>
                    <TouchableOpacity><Text style={styles.replyBtn}>Reply</Text></TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.commentLike} onPress={() => {
                    setVideoComments(prev => ({
                      ...prev,
                      [currentVideoItem?.id]: (prev[currentVideoItem?.id] || []).map(cm =>
                        cm.id === item.id ? { ...cm, likes: cm.likes + 1 } : cm
                      ),
                    }));
                  }}>
                    <Ionicons name={item.likes > 0? "heart" : "heart-outline"} size={16} color={item.likes > 0? "red" : "#999"} />
                    {item.likes > 0 && <Text style={styles.likeCount}>{item.likes}</Text>}
                  </TouchableOpacity>
                </View>
              )}
              style={styles.commentList}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              refreshControl={
                <RefreshControl
                  refreshing={commentsPTR.refreshing}
                  onRefresh={commentsPTR.onRefresh}
                  tintColor="#ffffff"
                  colors={['#ffffff']}
                  progressBackgroundColor="#171717"
                />
              }
              onScroll={commentsPTR.onScroll}
              scrollEventThrottle={16}
            />
            <View style={[styles.commentInputContainer, commentsPTR.refreshing && { opacity: 0 }]}>
              <View style={styles.emojiRow}>
                <TouchableOpacity onPress={() => setCommentText(commentText + '❤️')}><Text style={styles.emoji}>❤️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCommentText(commentText + '🙌')}><Text style={styles.emoji}>🙌</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCommentText(commentText + '🔥')}><Text style={styles.emoji}>🔥</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCommentText(commentText + '👏')}><Text style={styles.emoji}>👏</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCommentText(commentText + '😢')}><Text style={styles.emoji}>😢</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCommentText(commentText + '😍')}><Text style={styles.emoji}>😍</Text></TouchableOpacity>
              </View>
              <View style={styles.inputRow}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.inputAvatar} />
                ) : (
                  <View style={[styles.inputAvatar, { backgroundColor: '#000' }]} />
                )}
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#999"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                  blurOnSubmit={false}
                />
                <TouchableOpacity onPress={() => {
                  if(commentText.trim()) {
                     const textToSave = commentText.trim();
                     const videoId = currentVideoItem?.id;
                        const actorId =
                          appAuth.currentUser?.email?.trim().toLowerCase() ||
                          appAuth.currentUser?.uid;
                       const mediaId = String(videoId ?? '').replace(/^db-/, '');
                        if (!actorId || !mediaId) {
                          Alert.alert('Sign in required', 'MastiBase par comment karne ke liye sign in karein.');
                         return;
                       }
                        const newCmt = { id: Date.now().toString(), username: name || actorId, profilePic: profileImage || '', comment: textToSave, time: 'now', likes: 0 };
                       setVideoComments(prev => ({
                         ...prev,
                         [videoId]: [...(prev[videoId] || []), newCmt],
                       }));
                       setCommentText('');
                       void (async () => {
                         try {
                            const response = normalizeMastiBaseActionResponse(await commentOnMastiBaseVideo({
                             mediaId,
                              userId: actorId,
                              userName: name || actorId,
                             comment: textToSave,
                            }));
                            if (response.success === false) {
                              throw new Error(response.error || 'MastiBase could not save this comment.');
                            }
                           await appendVideoCommentLive(videoId, newCmt);
                           notifyVideoOwner(currentVideoItem, 'comment', { comment: textToSave }).catch(() => {});
                         } catch (error) {
                           setVideoComments(prev => ({
                             ...prev,
                             [videoId]: (prev[videoId] || []).filter((comment) => comment.id !== newCmt.id),
                           }));
                           Alert.alert('Comment failed', error instanceof Error ? error.message : 'Comment save nahi ho saka.');
                         }
                       })();
                  }
                }}>
                  <Ionicons name="send" size={24} color={commentText.trim()? "#0095f6" : "#555"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ControllerKeyboardAvoidingView>
    </Modal>
  );

  // ── Instagram-style user search ─────────────────────────────────────────
  const searchUsers = useMemo(() => {
    // The feed is incomplete, so merge its authors with the full profile index.
    const map = new Map<string, any>();
    const keyForUser = (value: unknown) =>
      String(value ?? '').trim().replace(/^@+/, '').toLowerCase();

    for (const v of videos) {
      const uid = v.userId || v.user;
      const key = keyForUser(uid);
      if (!key) continue;
      if (map.has(key)) {
        map.get(key).videoCount += 1;
      } else {
        map.set(key, {
          user: uid,
          userId: uid,
          name: v.name || v.userName || uid,
          profileImage: v.profileImage || '',
          videoCount: 1,
        });
      }
    }

    for (const user of directorySearchUsers) {
      const uid = user.userId || user.user;
      const key = keyForUser(uid);
      if (!key) continue;
      const existing = map.get(key);
      map.set(key, {
        ...existing,
        user: uid,
        userId: uid,
        name: user.name || existing?.name || uid,
        profileImage: user.profileImage || existing?.profileImage || '',
        videoCount: existing?.videoCount ?? 0,
        ...(user.backendUserId ? { backendUserId: user.backendUserId } : {}),
      });
    }

    for (const user of remoteSearchUsers) {
      const uid = user.userId || user.user;
      const key = keyForUser(uid);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        map.set(key, {
          ...existing,
          ...(user.backendUserId ? { backendUserId: user.backendUserId } : {}),
          ...(user.email ? { email: user.email } : {}),
          ...(user.profile ? { profile: user.profile } : {}),
        });
        continue;
      }
      map.set(key, {
        user: uid,
        userId: uid,
        name: user.name || uid,
        profileImage: user.profileImage || '',
        videoCount: 0,
        ...(user.backendUserId ? { backendUserId: user.backendUserId } : {}),
        ...(user.email ? { email: user.email } : {}),
        ...(user.profile ? { profile: user.profile } : {}),
      } as any);
    }
    return Array.from(map.values());
  }, [directorySearchUsers, remoteSearchUsers, videos]);

  const filteredSearchUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchUsers.slice(0, 20);
    return searchUsers.filter(
      u =>
        u.userId.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q),
    );
  }, [searchQuery, searchUsers]);

  const SearchModal = () => {
    return (
    <Modal visible={showSearch} animationType="slide" onRequestClose={() => { setShowSearch(false); setSearchQuery(''); }}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
          <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 10, marginLeft: 10, paddingHorizontal: 10, height: 40 }}>
            <Ionicons name="search" size={16} color="#888" style={{ marginRight: 6 }} />
            <TextInput
              style={{ flex: 1, color: 'white', fontSize: 15 }}
              placeholder="Search name or username..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => triggerSearchLoading(setSearchLoading, searchLoadingTimerRef)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Section label */}
        {searchQuery.trim().length === 0 && (
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>SUGGESTED</Text>
        )}

        {/* Results */}
        <View style={{ flex: 1, position: 'relative' }}>
          <FlatList
            data={filteredSearchUsers}
            keyExtractor={item => item.userId}
            ListHeaderComponent={
              searchQuery.trim().length >= 2 &&
              (remoteSearchVideos.length > 0 || remoteSearchHashtags.length > 0) ? (
                <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                  {remoteSearchHashtags.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
                        HASHTAGS
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {remoteSearchHashtags.slice(0, 12).map((result, index) => {
                          const rawTag = typeof result === 'string'
                            ? result
                            : String((result as any)?.hashtag ?? (result as any)?.tag ?? (result as any)?.name ?? '');
                          const tag = rawTag.replace(/^#+/, '').trim();
                          if (!tag) return null;
                          return (
                            <TouchableOpacity
                              key={`${tag}-${index}`}
                              onPress={() => setSearchQuery(`#${tag}`)}
                              style={{ backgroundColor: '#1b1b1b', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }}
                            >
                              <Text style={{ color: '#fff', fontSize: 13 }}>#{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {remoteSearchVideos.length > 0 && (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={{ color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
                        VIDEOS
                      </Text>
                      {remoteSearchVideos.slice(0, 8).map((item, index) => {
                        const thumbnail = item.thumbnailUrl || item.thumbnail_url || '';
                        const creatorId =
                          item.profile?.username ||
                          item.profile?.userName ||
                          item.profile?.userId ||
                          item.userId ||
                          '';
                        return (
                          <TouchableOpacity
                            key={String(item.id ?? item.videoUrl ?? index)}
                            onPress={() => {
                              const mappedVideo = mapBackendVideo(item);
                              if (!mappedVideo) return;
                              setVideos((previous) => dedupeVideoItems([
                                mappedVideo,
                                ...previous.filter((video) => String(video.id) !== String(mappedVideo.id)),
                              ]));
                              setActiveTab(false);
                              setCurrentVideoIndex(0);
                              setPendingScrollVideoId(mappedVideo.id);
                              setShowSearch(false);
                              setSearchQuery('');
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                          >
                            {thumbnail ? (
                              <Image
                                source={{ uri: thumbnail }}
                                style={{ width: 58, height: 72, borderRadius: 8, backgroundColor: '#222' }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={{ width: 58, height: 72, borderRadius: 8, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="play" size={22} color="#888" />
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
                                {item.caption || item.title || 'Masti video'}
                              </Text>
                              {creatorId ? (
                                <Text style={{ color: '#888', fontSize: 12, marginTop: 5 }} numberOfLines={1}>
                                  {creatorId.startsWith('@') ? creatorId : `@${creatorId}`}
                                </Text>
                              ) : null}
                            </View>
                            <Ionicons name="play-circle-outline" size={24} color="#aaa" />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {filteredSearchUsers.length > 0 && (
                    <Text style={{ color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
                      CREATORS
                    </Text>
                  )}
                </View>
              ) : null
            }
            keyboardShouldPersistTaps="handled"
            style={searchLoading ? { opacity: 0 } : undefined}
            ListEmptyComponent={
              remoteSearchVideos.length > 0 || remoteSearchHashtags.length > 0
                ? null
                :
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Ionicons name="person-outline" size={48} color="#444" />
                <Text style={{ color: '#666', marginTop: 12, fontSize: 15 }}>No users found</Text>
                <Text style={{ color: '#444', marginTop: 6, fontSize: 13 }}>Try another name or username</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isFollowing = followingUsers.includes(item.userId);
              return (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
                  onPress={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                    openUserProfile(item);
                  }}
                >
                  {/* Avatar */}
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#222' }} />
                  ) : (
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={26} color="#555" />
                    </View>
                  )}
                  {/* Info */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{item.userId}</Text>
                    {item.name !== item.userId && (
                      <Text style={{ color: '#888', fontSize: 13, marginTop: 1 }} numberOfLines={1}>{item.name}</Text>
                    )}
                    <Text style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{item.videoCount} {item.videoCount === 1 ? 'video' : 'videos'}</Text>
                  </View>
                  {/* Follow badge */}
                  {isFollowing && (
                    <View style={{ backgroundColor: '#222', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Following</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
          {searchLoading && (
            <View style={styles.circularLoaderOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>
      </View>
    </Modal>
    );
  };

  // ✅ Like aur Save alag - Instagram jaisa
  const renderVideoItem = useCallback(({ item, index, tabIsActive = true }) => {
    if (!item || !item.id) return null;
    const isLiked = likedVideos[item.id] ?? item.isLiked === true;
    const isSaved = savedVideos[item.id] || false;
    const videoDetailsExpanded = expandedVideoDetailsId === String(item.id);
    const videoTitle = String(item.title || item.desc || '').trim();
    const videoCaption = String(item.desc || '').trim();
    const uploadDate =
      item.createdAt ??
      item.created_at ??
      item.uploadedAt ??
      item.uploaded_at ??
      item.publishedAt ??
      item.published_at ??
      item.timestamp;
    const detailViews = viewCounts[item.id] ?? item.views ?? item.social?.views ?? 0;
    const detailLikes =
      liveLikeCounts[item.id] ??
      mastiBaseCount(item.social?.likes ?? item.likes) ??
      0;
    const detailComments = Math.max(
      (videoComments[item.id] || []).length,
      mastiBaseCount(item.social?.comments ?? item.comments) ?? 0,
    );
    const isFollowingCreator = followingUsers.some(
      (handle) => normalizedIdentity(handle) === normalizedIdentity(item.user || item.userId),
    );
    const isActiveFeedVideo =
      tabIsActive &&
      currentVideoIndex === index &&
      !showCamera &&
      !recordedVideoUri &&
      !isUploading &&
      !showSoundDetail;
    const feedVideoState = feedVideoStates[item.id] || 'loading';
    const feedVideoHasBeenReady =
      feedVideoEverReadyRef.current[item.id] || feedVideoState === 'ready';
    const retryKey = feedVideoRetryKeys[item.id] || 0;
    const qualityFallbackKey = `${item.id}:${mastiVideoQuality}`;
    const useProgressiveFallback =
      Boolean(feedVideoProgressiveFallbacks[qualityFallbackKey]);
    const videoQualitySelection = resolveMastiVideoQuality(
      item,
      mastiVideoQuality,
    );
    const useLocalPreview =
      Boolean(item.localAsset) &&
      mastiVideoQuality === 'auto' &&
      !useProgressiveFallback;
    const useServerQualityStream =
      !useProgressiveFallback &&
      videoQualitySelection.source !== 'original' &&
      Boolean(videoQualitySelection.url) &&
      videoQualitySelection.url !== item.url;
    const feedVideoPlaybackUrl = useProgressiveFallback
      ? item.url
      : useLocalPreview
        ? item.localAsset
        : useServerQualityStream
          ? videoQualitySelection.url
          : item.url;
    const chooseVideoQuality = async (quality: MastiVideoQuality) => {
      setShowVideoQualityPicker(false);
      if (quality === mastiVideoQuality) return;
      let positionMillis = 0;
      try {
        const status = await videoRefs.current[item.id]?.getStatusAsync?.();
        if (status?.isLoaded && Number.isFinite(status.positionMillis)) {
          positionMillis = Math.max(0, status.positionMillis);
        }
      } catch {
        // A not-yet-loaded player starts the new rendition from the beginning.
      }
      pendingQualitySeekRef.current = { videoId: item.id, positionMillis };
      feedVideoEverReadyRef.current[item.id] = false;
      setFeedVideoStates((previous) => ({ ...previous, [item.id]: 'loading' }));
      setFeedVideoProgressiveFallbacks((previous) => ({
        ...previous,
        [`${item.id}:${quality}`]: false,
      }));
      setMastiVideoQuality(quality);
      const accountId = appAuth.currentUser?.uid;
      if (accountId) {
        void AsyncStorage.setItem(
          getMastiVideoQualityStorageKey(accountId),
          quality,
        ).catch(() => {});
      }
    };
    const isLocalVideo = useLocalPreview;
    const isOfflineUnstartedRemoteVideo =
      feedConnectivity === 'offline' &&
      !isLocalVideo &&
      !feedVideoStartedRef.current[item.id] &&
      feedVideoState === 'loading';
    const displayedFeedVideoState = isOfflineUnstartedRemoteVideo ? 'error' : feedVideoState;
    const shouldShowFeedVideoState =
      isActiveFeedVideo &&
      (displayedFeedVideoState === 'error' ||
        (displayedFeedVideoState === 'loading' &&
          !feedVideoHasBeenReady &&
          isFeedInitialLoading));
    return (
      <View style={styles.videoFullScreen}>
        {/* ✅ ADDED: double-tap-to-like wrapper around the video */}
        <TouchableWithoutFeedback onPress={() => handleVideoTap(item)}>
          <View style={StyleSheet.absoluteFillObject}>
            {isRenderableThumbnail(item.thumbnail) && !feedVideoHasBeenReady && (
              <Image
                source={{ uri: item.thumbnail }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            )}
            {item.url ? (
              <Video
                key={`${item.id}-${retryKey}-${mastiVideoQuality}-${useProgressiveFallback ? 'original' : 'server'}`}
                ref={(ref) => {
                  if (ref) videoRefs.current[item.id] = ref;
                  else delete videoRefs.current[item.id];
                }}
                 source={getVideoPlaybackSource(feedVideoPlaybackUrl) || undefined}
                style={[
                  StyleSheet.absoluteFillObject,
                  { opacity: feedVideoHasBeenReady ? 1 : 0 },
                ]}
                resizeMode="cover"
                shouldPlay={
                  tabIsActive &&
                  currentVideoIndex === index &&
                  displayedFeedVideoState !== 'error' &&
                  !showCamera &&
                  !recordedVideoUri &&
                  !isUploading &&
                  !showSoundDetail &&
                  !isManuallyPaused
                }
                isLooping
                isMuted={!feedVideoHasBeenReady}
                useNativeControls={false}
                rate={1.0}
                volume={feedVideoHasBeenReady ? 1.0 : 0}
                onLoadStart={() => {
                  feedVideoLoadStartedAtRef.current[item.id] = Date.now();
                  const readyTimer = feedVideoReadyTimersRef.current[item.id];
                  if (readyTimer) {
                    clearTimeout(readyTimer);
                    delete feedVideoReadyTimersRef.current[item.id];
                  }
                  safeMediaCall(videoRefs.current[item.id], 'pauseAsync');
                  setFeedVideoStates((prev) => (
                    prev[item.id] === 'loading' || prev[item.id] === 'ready'
                      ? prev
                      : { ...prev, [item.id]: 'loading' }
                  ));
                }}
                onReadyForDisplay={() => {
                  scheduleFeedVideoReady(item.id);
                  const pendingSeek = pendingQualitySeekRef.current;
                  const restorePlayback = () => {
                    if (isActiveFeedVideo && !isManuallyPaused && !showSoundDetail) {
                      requestAnimationFrame(() => {
                        safeMediaCall(videoRefs.current[item.id], 'playAsync');
                      });
                    }
                  };
                  if (pendingSeek?.videoId === item.id) {
                    pendingQualitySeekRef.current = null;
                    Promise.resolve(
                      videoRefs.current[item.id]?.setPositionAsync?.(
                        pendingSeek.positionMillis,
                      ),
                    )
                      .catch(() => {})
                      .then(restorePlayback);
                  } else {
                    restorePlayback();
                  }
                }}
                onError={() => {
                  const readyTimer = feedVideoReadyTimersRef.current[item.id];
                  if (readyTimer) {
                    clearTimeout(readyTimer);
                    delete feedVideoReadyTimersRef.current[item.id];
                  }
                  if (
                    !useProgressiveFallback &&
                    (useLocalPreview || useServerQualityStream) &&
                    item.url
                  ) {
                    setFeedVideoProgressiveFallbacks((prev) => ({
                      ...prev,
                      [qualityFallbackKey]: true,
                    }));
                    setFeedVideoStates((prev) => ({ ...prev, [item.id]: 'loading' }));
                    return;
                  }
                  feedVideoEverReadyRef.current[item.id] = false;
                  finishInitialFeedLoading();
                  setFeedVideoStates((prev) => ({ ...prev, [item.id]: 'error' }));
                }}
                onPlaybackStatusUpdate={(status) => {
                  if (!status.isLoaded || currentVideoIndex !== index) return;
                  if (status.isPlaying || (status.positionMillis || 0) > 0) {
                    feedVideoStartedRef.current[item.id] = true;
                  }
                  if (status.isBuffering) {
                    if (feedConnectivity === 'offline' && !isLocalVideo && feedVideoStartedRef.current[item.id]) {
                      scheduleOfflineVideoError(item.id);
                    } else {
                      setFeedVideoStates((prev) => (
                        prev[item.id] === 'loading' || prev[item.id] === 'ready'
                          ? prev
                          : { ...prev, [item.id]: 'loading' }
                      ));
                    }
                  } else {
                    scheduleFeedVideoReady(item.id);
                  }
                  if (status.durationMillis && status.durationMillis > 0) {
                    setFeedDurationMs(status.durationMillis);
                    // Only update position/progress when actually playing —
                    // prevents progress bar from advancing while manually paused
                    if (status.isPlaying) {
                      setFeedPlaybackProgress((status.positionMillis || 0) / status.durationMillis);
                      setFeedPositionMs(status.positionMillis || 0);
                    }
                  }
                }}
              />
            ) : null}
          </View>
        </TouchableWithoutFeedback>

        {isActiveFeedVideo && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Video quality: ${mastiVideoQuality}`}
            onPress={() => setShowVideoQualityPicker(true)}
            style={{
              position: 'absolute',
              top: insets.top + 12,
              right: 16,
              zIndex: 25,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(0,0,0,0.58)',
              borderRadius: themeBorderRadius,
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}
          >
            <Ionicons name="settings-outline" size={17} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: themeFontFamily }}>
              {mastiVideoQuality === 'auto' ? 'Auto' : mastiVideoQuality}
            </Text>
          </TouchableOpacity>
        )}
        {isActiveFeedVideo && layoutPreviewIndex !== null && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to feed"
            onPress={() => setLayoutPreviewIndex(null)}
            style={{
              position: 'absolute',
              top: insets.top + 12,
              left: 16,
              zIndex: 25,
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.58)',
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {isActiveFeedVideo && (
          <Modal
            visible={showVideoQualityPicker}
            animationType="slide"
            transparent
            onRequestClose={() => setShowVideoQualityPicker(false)}
          >
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)' }}>
              <TouchableOpacity
                accessibilityLabel="Close quality settings"
                style={{ flex: 1 }}
                onPress={() => setShowVideoQualityPicker(false)}
              />
              <View
                style={{
                  backgroundColor: isDarkTheme ? '#17171c' : '#fff',
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  paddingHorizontal: 20,
                  paddingTop: 14,
                  paddingBottom: Math.max(insets.bottom, 20),
                }}
              >
                <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: '#777', alignSelf: 'center', marginBottom: 18 }} />
                <Text style={{ color: isDarkTheme ? '#fff' : '#171717', fontSize: 19, fontWeight: '800', fontFamily: themeFontFamily }}>
                  Video quality
                </Text>
                <Text style={{ color: isDarkTheme ? '#aaa' : '#666', fontSize: 13, marginTop: 4, marginBottom: 12 }}>
                  Choose a stream. Playback resumes at the same position when available.
                </Text>
                {MASTI_VIDEO_QUALITY_OPTIONS.map((option) => {
                  const selected = option.quality === mastiVideoQuality;
                  return (
                    <TouchableOpacity
                      key={option.quality}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => void chooseVideoQuality(option.quality)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 11,
                        borderBottomWidth: 1,
                        borderBottomColor: isDarkTheme ? '#303038' : '#e8e8ee',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isDarkTheme ? '#fff' : '#171717', fontSize: 15, fontWeight: '700' }}>
                          {option.title}
                        </Text>
                        <Text style={{ color: isDarkTheme ? '#aaa' : '#666', fontSize: 12, marginTop: 3 }}>
                          {option.description}
                        </Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={21} color={themePrimaryColor} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Modal>
        )}

        {shouldShowFeedVideoState && (
          <View
            style={styles.feedNetworkState}
            pointerEvents={displayedFeedVideoState === 'error' ? 'auto' : 'none'}
          >
            {displayedFeedVideoState === 'loading' ? (
              <FeedLoadingPlaceholder />
            ) : (
              <>
                <Ionicons name="wifi-outline" size={62} color="#777" />
                <Text style={styles.feedNetworkTitle}>Network error</Text>
                <Text style={styles.feedNetworkMessage}>
                  No internet connection. Connect to the internet and try again.
                </Text>
                <TouchableOpacity
                  style={styles.feedNetworkRefresh}
                  onPress={() => {
                    clearOfflineVideoGraceTimer(item.id);
                    feedVideoEverReadyRef.current[item.id] = false;
                    setFeedVideoStates((prev) => ({ ...prev, [item.id]: 'loading' }));
                    setFeedVideoRetryKeys((prev) => ({ ...prev, [item.id]: retryKey + 1 }));
                    refetchBackendVideos();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.feedNetworkRefreshText}>Refresh</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Pause icon overlay — single tap se pause hone par dikhega */}
        {isManuallyPaused && currentVideoIndex === index && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', alignSelf: 'center', top: '42%',
              backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 44, padding: 16 }}>
            <Ionicons name="pause" size={44} color="rgba(255,255,255,0.92)" />
          </View>
        )}

        {showBigHeart && currentVideoIndex === index && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bigHeartOverlay,
              { opacity: bigHeartOpacity, transform: [{ scale: bigHeartScale }] },
            ]}
          >
            <Ionicons name="heart" size={120} color="#FE2C55" />
          </Animated.View>
        )}
        <View style={[styles.rightActions, { bottom: 100 + insets.bottom }]}>
          <TouchableOpacity style={styles.profileCircle} onPress={() => openUserProfile(item)}>
            {(() => {
              const isOwnVideo = item.user === userId || item.userId === userId;
              const avatarUri = isOwnVideo
                ? (profileImage || item.profileImage || '')
                : (item.profileImage || '');
              return avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 45, height: 45, borderRadius: 25 }}
                  onError={() => {}}
                />
              ) : (
                <View style={{ width: 45, height: 45, borderRadius: 25, backgroundColor: '#444', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={22} color="#fff" />
                </View>
              );
            })()}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => requireAuth(() => handleLike(item))}>
            {/* ✅ ADDED: like icon bounce animation */}
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons name={isLiked? "heart" : "heart-outline"} size={33} color={isLiked ? "#FE2C55" : "white"} />
            </Animated.View>
            <Text style={[styles.actionText, { fontSize: 13, marginTop: 3 }]}>{liveLikeCounts[item.id] ?? item.likes ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => requireAuth(() => openVideoComments(item))}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="white" />
            <Text style={styles.actionText}>{Math.max(
              videoComments[item.id]?.length ?? 0,
              mastiBaseCount(item.social?.comments ?? item.comments) ?? 0,
            )}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => requireAuth(() => handleSave(item))}>
            <Ionicons name={isSaved? "bookmark" : "bookmark-outline"} size={30} color="white" />
            <Text style={styles.actionText}>{saveCounts[item.id] ?? item.social?.saves ?? item.saves ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => { setCurrentVideoItem(item); setShareOpenedFromProfile(Boolean(profilePlaybackUserId)); setShowShare(true); }}>
            <Ionicons name="paper-plane" size={30} color="white" />
            <Text style={styles.actionText}>{shareCounts[item.id] ?? item.social?.shares ?? item.shares ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.musicDiscContainer} onPress={() => { setCurrentVideoItem(item); setShowSoundDetail(true); }}>
            {/* Vinyl center hole */}
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              {(() => {
                // Song hai → album art; Original Audio → creator DP
                const discImg = item.song?.cover
                  ? item.song.cover
                  : (item.profileImage || item.musicCover || null);
                return discImg ? (
                  <Animated.Image
                    source={{ uri: discImg }}
                    style={[styles.musicDisc, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
                  />
                ) : (
                  <Animated.View style={[styles.musicDisc, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
                    <Ionicons name="musical-notes" size={16} color="#fff" />
                  </Animated.View>
                );
              })()}
              {/* Center hole (vinyl look) */}
              <View style={{
                position: 'absolute', width: 10, height: 10, borderRadius: 5,
                backgroundColor: '#000', borderWidth: 1.5, borderColor: '#555',
              }} pointerEvents="none" />
            </View>
          </TouchableOpacity>
        </View>
        <View style={[styles.userInfo, { bottom: 100 + insets.bottom }]}>
          {item.isSponsored && (
            <View style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.58)',
              borderRadius: 5,
              paddingHorizontal: 7,
              paddingVertical: 3,
              marginBottom: 5,
            }}>
              <Ionicons name="megaphone-outline" size={11} color="#ddd" style={{ marginRight: 4 }} />
              <Text style={{ color: '#ddd', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>
                Sponsored
              </Text>
            </View>
          )}
          {isActiveFeedVideo && mastiVideoQuality !== 'auto' && (
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.62)',
                borderRadius: 12,
                paddingHorizontal: 9,
                paddingVertical: 5,
                marginBottom: 7,
              }}
              accessibilityLabel={
                videoQualitySelection.source === 'rendition'
                  ? `Video quality ${videoQualitySelection.appliedQuality} applied`
                  : `Requested ${mastiVideoQuality}; this video has no quality renditions`
              }
            >
              <Ionicons
                name={videoQualitySelection.source === 'rendition' ? 'checkmark-circle' : 'information-circle'}
                size={13}
                color={videoQualitySelection.source === 'rendition' ? themeSecondaryColor : '#FFD166'}
                style={{ marginRight: 5 }}
              />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: themeFontFamily }}>
                {videoQualitySelection.source === 'rendition'
                  ? videoQualitySelection.exactMatch
                    ? `${videoQualitySelection.appliedQuality} applied`
                    : `${videoQualitySelection.appliedQuality} available`
                  : `${mastiVideoQuality} unavailable · original`}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center" }}
              onPress={() => openUserProfile(item)}
            >
              {/* Apne video mein profile ka current username dikhao (Instagram/TikTok style) */}
              <Text style={[styles.username, themeFontFamily ? { fontFamily: themeFontFamily } : null]}>
                {(item.user === userId || item.userId === userId || (item.accountId != null && item.accountId === appAuth.currentUser?.uid))
                  ? userId
                  : item.user}
              </Text>
              {item.isVerified === true && <VerifiedBadge size={16} />}
            </TouchableOpacity>
                       <TouchableOpacity
                         style={[
                           styles.followButton,
                           {
                             borderWidth: 1.5,
                             borderColor: '#fff',
                              borderRadius: 8,
                             paddingHorizontal: 16,
                              paddingVertical: 7,
                             marginLeft: 12,
                             backgroundColor: isFollowingCreator
                               ? 'rgba(0,0,0,0.58)'
                               : 'transparent',
                           },
                         ]}
                         onPress={() => requireAuth(() => toggleFollow(item))}
                       >
                          <Text style={{ color: "white", fontWeight: "bold", fontSize: 14, fontFamily: themeFontFamily }}>{isFollowingCreator ? "Following" : "Follow"}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={videoDetailsExpanded ? 'Close video details' : 'Open video date and details'}
            onPress={() => setExpandedVideoDetailsId(
              (current) => current === String(item.id) ? null : String(item.id),
            )}
            style={{ alignSelf: 'flex-start', maxWidth: '100%', marginVertical: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}>
              <Text
                style={[
                  styles.subText,
                  { flexShrink: 1 },
                  themeFontFamily ? { fontFamily: themeFontFamily } : null,
                ]}
                numberOfLines={videoDetailsExpanded ? undefined : 1}
              >
                {videoTitle || 'Video'}
              </Text>
              <Text style={{ color: '#fff', fontSize: 16, lineHeight: 19, fontWeight: '800', marginLeft: 2 }}>
                ...
              </Text>
            </View>
          </TouchableOpacity>
          {videoDetailsExpanded && (
            <View style={{
              marginBottom: 5,
              paddingHorizontal: 9,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}>
              {!!videoCaption && videoCaption !== videoTitle && (
                <Text style={{ color: '#fff', fontSize: 12, lineHeight: 17, marginBottom: 4 }}>
                  {videoCaption}
                </Text>
              )}
              <Text style={{ color: '#fff', fontSize: 12, lineHeight: 17 }}>
                Uploaded {formatVideoUploadDate(uploadDate)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17 }}>
                {detailViews} views · {detailLikes} likes · {detailComments} comments
              </Text>
            </View>
          )}
          <Text style={[styles.songName, themeFontFamily ? { fontFamily: themeFontFamily } : null]}>🎵 {item.song ? item.song.title + ' • ' + item.song.artist : 'Original Audio • ' + (item.name || item.user || 'Masti India')}</Text>
        </View>
        {isActiveFeedVideo && (
          <FeedBannerAd
            config={adsConfig}
            bottomOffset={176 + insets.bottom}
          />
        )}
      </View>
    );
  }, [adsConfig, likedVideos, savedVideos, followingUsers, expandedVideoDetailsId, currentVideoIndex, selectedFilter, selectedEffect, videoComments, liveLikeCounts, viewCounts, shareCounts, saveCounts, showCamera, recordedVideoUri, isUploading, isManuallyPaused, showSoundDetail, requireAuth, feedConnectivity, feedVideoStates, feedVideoRetryKeys, feedVideoProgressiveFallbacks, mastiVideoQuality, refetchBackendVideos, clearOfflineVideoGraceTimer, scheduleOfflineVideoError, finishInitialFeedLoading, isFeedInitialLoading, layoutPreviewIndex, themeBorderRadius, themeFontFamily, themePrimaryColor, isDarkTheme]);

  const renderRemoteLayoutItem = useCallback(({ item, index }) => {
    if (!item) return null;
    const grid = remoteFeedLayout === 'grid';
    const imageHeight = grid ? Math.round((width / 3) * 1.42) : 112;
    const imageWidth = grid ? Math.floor((width - 8) / 3) : 112;
    const cardBackground = isDarkTheme ? '#15151a' : '#fff';
    const primaryText = isDarkTheme ? '#fff' : '#18181b';
    const secondaryText = isDarkTheme ? '#aaa' : '#606068';
    const handle = String(item.user || item.userId || item.name || 'Masti Creator');
    const previewImage = item.thumbnail || item.profileImage || '';
    const likeCount = liveLikeCounts[item.id] ?? item.likes ?? 0;
    const commentCount = Math.max(
      videoComments[item.id]?.length ?? 0,
      mastiBaseCount(item.social?.comments ?? item.comments) ?? 0,
    );

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Play video by ${handle}`}
        activeOpacity={0.9}
        onPress={() => {
          setCurrentVideoIndex(index);
          setLayoutPreviewIndex(index);
        }}
        style={{
          width: grid ? imageWidth : width - 28,
          marginHorizontal: grid ? 1 : 14,
          marginBottom: grid ? 2 : 10,
          flexDirection: grid ? 'column' : 'row',
          backgroundColor: cardBackground,
          borderRadius: themeBorderRadius,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: imageWidth,
            height: imageHeight,
            backgroundColor: isDarkTheme ? '#222' : '#e6e6eb',
          }}
        >
          {previewImage ? (
            <Image
              source={{ uri: previewImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play-circle-outline" size={34} color={secondaryText} />
            </View>
          )}
          {grid && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: 7,
                paddingVertical: 6,
                backgroundColor: 'rgba(0,0,0,0.58)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Ionicons name="heart" size={13} color={themePrimaryColor} />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{likeCount}</Text>
              {item.isVerified === true && <VerifiedBadge size={13} />}
            </View>
          )}
        </View>
        <View
          style={{
            flex: 1,
            paddingHorizontal: grid ? 7 : 12,
            paddingVertical: grid ? 7 : 10,
            justifyContent: 'center',
          }}
        >
          <Text
            numberOfLines={grid ? 1 : 2}
            style={{ color: primaryText, fontSize: grid ? 11 : 15, fontWeight: '800', fontFamily: themeFontFamily }}
          >
            {handle} {item.isVerified === true ? '✓' : ''}
          </Text>
          <Text
            numberOfLines={grid ? 2 : 3}
            style={{ color: secondaryText, fontSize: grid ? 10 : 13, marginTop: 3, fontFamily: themeFontFamily }}
          >
            {item.desc || ' '}
          </Text>
          {!grid && (
            <Text style={{ color: secondaryText, fontSize: 11, marginTop: 7 }}>
              {likeCount} likes · {commentCount} comments · {item.shares ?? 0} shares
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [
    isDarkTheme,
    liveLikeCounts,
    remoteFeedLayout,
    themeBorderRadius,
    themeFontFamily,
    themePrimaryColor,
    videoComments,
    width,
  ]);
  
    if (showSplash) {
    return (
      <>
        {CameraModalOverlay()}
        {FiltersModal()}
        {EffectsModal()}
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <Animated.Text style={{ fontSize: 110, opacity: fadeAnim }}>🔥</Animated.Text>
          <Text style={{ color: '#ff4d00', fontSize: 50, fontWeight: '900' }}>Masti Video</Text>
          <Text style={{ color: '#fff', fontSize: 20, marginTop: 5, fontWeight: 'bold' }}>India Entertainment</Text>
          <ActivityIndicator style={{ marginTop: 28 }} size="small" color="#fff" />
        </View>
      </>
    );
  }

  if (editProfile) {
    return (
      <>
        {CameraModalOverlay()}
        {FiltersModal()}
        {EffectsModal()}
        <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={{ padding: 20, marginTop: 40 }}>
            <TouchableOpacity onPress={() => setEditProfile(false)}><Text style={{ fontSize: 18, fontWeight: "bold" }}>← Back</Text></TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: "bold", textAlign: "center", marginTop: 15 }}>Edit Profile</Text>
            <TouchableOpacity onPress={pickImage} style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "#000", alignSelf: "center", marginTop: 20, justifyContent: "center", alignItems: "center" }}>
              {profileImage? <Image source={{ uri: profileImage }} style={{ width: 120, height: 120, borderRadius: 60 }} /> : <Ionicons name="camera" size={40} color="white" />}
            </TouchableOpacity>
            <Text style={{ marginTop: 20 }}>Add Name</Text>
            <TextInput value={name} onChangeText={setName} style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginTop: 5 }} />
            <Text style={{ marginTop: 15 }}>User Name</Text>
            <TextInput
              value={String(userId).replace(/^@+/, "")}
              onChangeText={(text) => setUserId(text.replace(/^@+/, ""))}
              style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginTop: 5 }}
            />
            <Text style={{ marginTop: 15 }}>Bio</Text>
            <TextInput value={bio} onChangeText={setBio} maxLength={150} multiline style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, padding:12, height:80, marginTop:5, fontSize:12, textAlignVertical:"top" }} />
            <Text style={{ color:"#777", fontSize:12, textAlign:"right", marginTop:2 }}>{bio.length}/150</Text>
            <Text style={{ marginTop: 15 }}>YouTube</Text>
            <TextInput value={youtube} onChangeText={setYoutube} placeholder="YouTube Link" style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginTop: 5 }} />
            <Text style={{ marginTop: 15 }}>Facebook</Text>
            <TextInput value={facebook} onChangeText={setFacebook} placeholder="Facebook Link" style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginTop: 5 }} />
            <Text style={{ marginTop: 15 }}>Instagram</Text>
                      <TextInput value={instagram} onChangeText={setInstagram} placeholder="Instagram Link" style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginTop: 5 }} />
            <TouchableOpacity onPress={saveProfileToMastiBase} disabled={isSavingProfile} style={{ backgroundColor: "#FE2C55", padding: 15, borderRadius: 10, marginTop: 25, marginBottom: 50, opacity: isSavingProfile ? 0.65 : 1 }}>
              {isSavingProfile ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={{ color: "#fff", textAlign: "center", fontWeight: "bold", marginLeft: 9 }}>Saving...</Text>
                </View>
              ) : (
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "bold" }}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </>
    );
  }

  const FriendsScreen = () => (
    <>
      {CameraModalOverlay()}
      {FiltersModal()}
      {EffectsModal()}
      {MusicModal()}
      {SoundDetailModal()}
      <MusicTrimmerScreen visible={showMusicTrimmer} song={trimmerSong} onDone={(s, startSec, endSec) => { setSelectedSong({ ...s, trimStart: startSec, trimEnd: endSec }); setShowMusicTrimmer(false); setShowMusicModal(false); setMusicSearchQuery(''); setPreviewingSongId(null); }} onBack={() => { setShowMusicTrimmer(false); setShowMusicModal(true); }} />
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 50 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 0.5, borderBottomColor: '#333' }}>
          <TouchableOpacity onPress={restoreHomeFeed}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 15 }}>Friends</Text>
        </View>
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
              style={[{ flex: 1, marginBottom: 90 }, friendsLoading && { opacity: 0 }]}
              overScrollMode="always"
              alwaysBounceVertical
              refreshControl={
                <RefreshControl
                  refreshing={friendsPTR.refreshing}
                  onRefresh={friendsPTR.onRefresh}
                  tintColor="#ffffff"
                  colors={['#ffffff']}
                  progressBackgroundColor="#171717"
                />
              }
              onScroll={friendsPTR.onScroll}
              scrollEventThrottle={16}
            >
              <View style={{ opacity: friendsPTR.refreshing ? 0 : 1 }}>
                {friendUsers.map(item => {
                 const peerId = messagingIdentity(item) || item.id;
                 const profileVideo = videos.find(
                   video =>
                     messagingIdentity(chatParticipantFromProfile(video)) === peerId,
                 );
                 const visibleUserId =
                   item.userId || item.user || item.mastiBaseUserId || item.id;
                 const hasUnreadActivity = !!(
                   friendActivity[peerId]?.unreadMessage ||
                   friendActivity[peerId]?.unreadCall
                 );
                 return (
                  <View key={peerId} style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                     onPress={() => requireAuth(() => {
                       setShowFriends(false);
                       if (profileVideo) openUserProfile(profileVideo);
                       else openChat(item);
                     })}
                  >
                     {item.avatar ? (
                       <Image source={{ uri: item.avatar }} style={{ width: 45, height: 45, borderRadius: 25, marginRight: 22, backgroundColor: '#252525' }} />
                     ) : (
                       <View style={{ width: 45, height: 45, borderRadius: 25, marginRight: 22, backgroundColor: '#24242a', alignItems: 'center', justifyContent: 'center' }}>
                         <Ionicons name="person" size={21} color="#aaa" />
                       </View>
                     )}
                    <View style={{ flex: 1 }}>
                       <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                         <Text style={{ color: '#999', fontSize: 13 }} numberOfLines={1}>{chatDisplayId(visibleUserId)}</Text>
                        {hasUnreadActivity && (
                          <View
                            accessible
                            accessibilityRole="image"
                            accessibilityLabel="Unread message or call"
                            testID={`friend-unread-${peerId}`}
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 5,
                              backgroundColor: '#FE2C55',
                              borderWidth: 1,
                              borderColor: '#000',
                              marginLeft: 8,
                            }}
                          />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: '#5c35c8', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, minWidth: 104, alignItems: 'center' }}
                    onPress={() => requireAuth(() => {
                       openChat(item);
                    })}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Message</Text>
                  </TouchableOpacity>
                </View>
                 );
                })}
              </View>
            </ScrollView>
            {friendsLoading && (
              <View style={styles.circularLoaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
        </View>
        <BottomNav
          activeScreen='friends'
          handleHomePress={handleHomePress}
          setShowFriends={setShowFriends}
          setShowInbox={setShowInbox}
          setIsProfile={setIsProfile}
          setSelectedUser={setSelectedUser}
          openCameraWithPermissions={openCameraWithPermissions}
          requireAuth={requireAuth}
          notifUnreadCount={notifUnreadCount}
          notifUnreadCounts={unreadNotificationCounts}
          socialUnreadPillVisible={socialUnreadPillVisible}
          profileImage={profileImage}
        />
        <LoginBottomSheet
          visible={showLoginSheet}
          onClose={() => { setShowLoginSheet(false); pendingActionRef.current = null; }}
          onLogin={handleLoginSuccess}
        />
      </View>
    </>
  );
  
  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmtDuration = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // ── Audio Call Screen ─────────────────────────────────────────────────────
  const AudioCallScreen = () => (
    <View style={{ flex: 1, backgroundColor: '#0d0d1a' }}>
      {activeCallId && (
        <WebRTCCallView
          callId={activeCallId}
          kind="audio"
          isCaller={callIsCaller}
          muted={callMuted}
          onConnected={markCallConnected}
          onEnded={endCall}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={{ flex: 1, backgroundColor: 'rgba(13,13,26,0.96)', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: Platform.OS === 'ios' ? 50 : 36 }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 6 }}>
            {chatUser?.name} {chatUser?.emoji}
          </Text>
          <Text style={{ color: callActive ? '#00d46a' : '#aaa', fontSize: 15 }}>
            {callActive ? fmtDuration(callDuration) : 'Calling…'}
          </Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: 'rgba(92,53,200,0.6)', padding: 4 }}>
            <Image source={{ uri: chatUser?.avatar }} style={{ width: '100%', height: '100%', borderRadius: 66 }} />
          </View>
          {callActive && (
            <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: 'rgba(92,53,200,0.3)' }} />
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', paddingHorizontal: 20 }}>
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setCallMuted(m => !m)}
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: callMuted ? '#5c35c8' : '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={callMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>Mute</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={endCall}
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>End</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setCallSpeaker(s => !s)}
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: callSpeaker ? '#5c35c8' : '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={callSpeaker ? 'volume-high' : 'volume-mute'} size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>Speaker</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // ── Video Call Screen ─────────────────────────────────────────────────────
  const VideoCallScreen = () => (
    <View style={{ flex: 1, backgroundColor: '#050510' }}>
      {activeCallId && (
        <WebRTCCallView
          callId={activeCallId}
          kind="video"
          isCaller={callIsCaller}
          muted={callMuted}
          cameraEnabled={callCameraEnabled}
          cameraFacing={callCameraFacing}
          onConnected={markCallConnected}
          onEnded={endCall}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: 16 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
            {chatUser?.name} {chatUser?.emoji}
          </Text>
          <Text style={{ color: callActive ? '#00d46a' : '#aaa', fontSize: 13, marginTop: 2 }}>
            {callActive ? fmtDuration(callDuration) : 'Connecting…'}
          </Text>
        </View>
        <View style={{
          position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, right: 16,
          width: 110, height: 160, borderRadius: 14,
          backgroundColor: 'transparent', overflow: 'hidden',
          borderWidth: 2, borderColor: '#5c35c8',
        }} pointerEvents="none">
          <View style={{ flex: 1, backgroundColor: 'rgba(26,26,46,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            {!callCameraEnabled && <Ionicons name="videocam-off" size={28} color="#aaa" />}
          </View>
        </View>

      <View style={{
        flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
        paddingVertical: 24, paddingBottom: Platform.OS === 'ios' ? 42 : 28,
        backgroundColor: 'rgba(5,5,16,0.85)',
        position: 'absolute', left: 0, right: 0, bottom: 0,
      }}>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setCallMuted(m => !m)}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: callMuted ? '#5c35c8' : '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={callMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#aaa', fontSize: 11, marginTop: 6 }}>Mute</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setCallCameraEnabled(enabled => !enabled)}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: callCameraEnabled ? '#1e1e2e' : '#5c35c8', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={callCameraEnabled ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#aaa', fontSize: 11, marginTop: 6 }}>Camera</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={endCall}
            style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="videocam-off" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#aaa', fontSize: 11, marginTop: 6 }}>End</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setCallCameraFacing(facing => facing === 'user' ? 'environment' : 'user')}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#aaa', fontSize: 11, marginTop: 6 }}>Flip</Text>
        </View>
      </View>
      </View>
    </View>
  );

  // ── Incoming Call Screen (Instagram / WhatsApp style) ───────────────────
  const IncomingCallScreen = () => (
    <View style={{ flex: 1, backgroundColor: '#050510', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: Platform.OS === 'ios' ? 60 : 44 }}>
      {/* Top info */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#aaa', fontSize: 15, marginBottom: 6 }}>
          Incoming {incomingCallKind === 'video' ? 'Video' : 'Audio'} Call…
        </Text>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>
          {(incomingCallUser?.name || chatUser?.name || 'Unknown')}
        </Text>
        <Text style={{ color: '#888', fontSize: 14, marginTop: 4 }}>Masti Video</Text>
      </View>

      {/* Pulsing avatar */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: 'rgba(92,53,200,0.2)' }} />
        <View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1.5, borderColor: 'rgba(92,53,200,0.35)' }} />
        <View style={{ width: 150, height: 150, borderRadius: 75, borderWidth: 4, borderColor: '#5c35c8', overflow: 'hidden' }}>
          <Image
            source={{ uri: incomingCallUser?.avatar || chatUser?.avatar || 'https://i.pravatar.cc/300?img=1' }}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </View>

      {/* Accept / Decline buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', paddingHorizontal: 40 }}>
        {/* Decline */}
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            onPress={declineIncomingCall}
            style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="call" size={34} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 10 }}>Decline</Text>
        </View>

        {/* Accept */}
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            onPress={acceptIncomingCall}
            style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#00c853', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={incomingCallKind === 'video' ? 'videocam' : 'call'} size={34} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 10 }}>Accept</Text>
        </View>
      </View>
    </View>
  );

  // ── Full Chat Screen (Instagram DM style) ────────────────────────────────
  const ChatScreen = () => {
    const bgIcons = [
      { name: 'camera-outline',        top: '8%',  left: '5%',  size: 38, rot: '-15deg' },
      { name: 'heart-outline',         top: '14%', right: '6%', size: 32, rot: '12deg'  },
      { name: 'star-outline',          top: '22%', left: '10%', size: 28, rot: '20deg'  },
      { name: 'chatbubble-outline',    top: '30%', right: '8%', size: 34, rot: '-10deg' },
      { name: 'musical-note',          top: '40%', left: '4%',  size: 30, rot: '25deg'  },
      { name: 'videocam-outline',      top: '50%', right: '4%', size: 36, rot: '-20deg' },
      { name: 'thumbs-up-outline',     top: '58%', left: '8%',  size: 28, rot: '10deg'  },
      { name: 'share-social-outline',  top: '66%', right: '9%', size: 30, rot: '-8deg'  },
      { name: 'bookmark-outline',      top: '74%', left: '6%',  size: 32, rot: '18deg'  },
      { name: 'person-outline',        top: '80%', right: '5%', size: 28, rot: '-15deg' },
      { name: 'camera-outline',        top: '88%', left: '12%', size: 34, rot: '5deg'   },
      { name: 'heart-outline',         top: '92%', right: '10%',size: 30, rot: '-12deg' },
    ] as const;

    const sendMessage = async () => {
      const txt = chatInput.trim();
      if (!txt) return;
      if (isChatBlocked || isChatBlockedByOther) {
        Alert.alert('Message unavailable', 'Is user ke saath messaging available nahi hai.');
        return;
      }
      const clientId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newMsg = {
        id: clientId,
        clientId,
        text: txt,
        sent: true,
        time: chatTime(new Date().toISOString()),
        senderId: currentMessagingId,
        senderName: name || userId,
        senderAvatar: profileImage || '',
      };
      setChatMessages(prev => [...prev, newMsg]);
      setChatInput('');
      try {
        if (!activeChatConversationId || !currentMessagingId || !chatPeerMessagingId) {
          throw new Error('This conversation is not ready yet. Close it and open it again.');
        }
        const saved = await sendMessageToPeer(chatUser, txt, clientId);
        setChatMessages(prev => prev.map(message =>
          message.id === clientId
            ? mapRemoteChatMessage(saved, currentMessagingId)
            : message,
        ));
      } catch (error) {
        setChatMessages(prev => prev.filter(message => message.id !== clientId));
        Alert.alert('Message failed', error instanceof Error ? error.message : 'Message send nahi ho saka.');
      }
    };

    return (
      <>
        {CameraModalOverlay()}
        <ControllerKeyboardAvoidingView
          style={{ flex: 1, backgroundColor: '#0a0a0a' }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {/* Faded background social icons */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {bgIcons.map((ic, i) => (
              <View key={i} style={{ position: 'absolute', top: ic.top, ...(('left' in ic) ? { left: (ic as any).left } : { right: (ic as any).right }), transform: [{ rotate: ic.rot }] }}>
                <Ionicons name={ic.name as any} size={ic.size} color="rgba(255,255,255,0.06)" />
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? 52 : 38,
            paddingBottom: 12, paddingHorizontal: 12,
            borderBottomWidth: 0.5, borderBottomColor: '#222',
            backgroundColor: '#0a0a0a',
            position: 'relative',
          }}>
            <TouchableOpacity onPress={() => setShowChatScreen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={{ marginLeft: 8, position: 'relative' }}>
              <Image
                source={{ uri: chatUser?.avatar }}
                style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#333' }}
              />
              {chatUser?.isOnline && (
                <View style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 12, height: 12, borderRadius: 6,
                  backgroundColor: '#00d46a', borderWidth: 2, borderColor: '#0a0a0a',
                }} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {chatUser?.name} {chatUser?.emoji}
              </Text>
              <Text style={{ color: chatUser?.isOnline ? '#00d46a' : '#888', fontSize: 12, marginTop: 1 }}>
                {chatUser?.isOnline ? '● Online' : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity
              style={{ marginRight: 18, opacity: isChatBlocked || isChatBlockedByOther ? 0.35 : 1 }}
              onPress={() => startCall('audio')}
              disabled={isChatBlocked || isChatBlockedByOther}
            >
              <Ionicons name="call-outline" size={24} color="#4fc3f7" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginRight: 18, opacity: isChatBlocked || isChatBlockedByOther ? 0.35 : 1 }}
              onPress={() => startCall('video')}
              disabled={isChatBlocked || isChatBlockedByOther}
            >
              <Ionicons name="videocam-outline" size={26} color="#ce93d8" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowChatMenu(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Chat options"
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Instagram-style options bottom sheet */}
          <Modal
            visible={showChatMenu}
            transparent
            animationType="slide"
            onRequestClose={() => setShowChatMenu(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
              activeOpacity={1}
              onPress={() => setShowChatMenu(false)}
            />
            <View style={{
              backgroundColor: '#1c1c1e',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: Platform.OS === 'ios' ? 34 : 16,
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
            }}>
              {/* Handle bar */}
              <View style={{
                width: 36, height: 4, borderRadius: 2,
                backgroundColor: '#48484a',
                alignSelf: 'center', marginTop: 10, marginBottom: 6,
              }} />

              {/* User info row */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 20, paddingVertical: 14,
                borderBottomWidth: 0.5, borderBottomColor: '#2c2c2e',
              }}>
                <Image
                  source={{ uri: chatUser?.avatar }}
                  style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
                />
                <View>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                    {chatUser?.name}
                  </Text>
                  <Text style={{ color: '#8e8e93', fontSize: 12, marginTop: 2 }}>
                    {chatUser?.isOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>

              {/* Block / Unblock option */}
              <TouchableOpacity
                onPress={() => {
                  setShowChatMenu(false);
                  setTimeout(() => {
                    Alert.alert(
                      isChatBlocked ? `${chatUser?.name} ko Unblock karein?` : `${chatUser?.name} ko Block karein?`,
                      isChatBlocked
                        ? 'Is user ko unblock karne ke baad woh aapko message kar sakta hai.'
                        : 'Block karne ke baad yeh user aapko message nahi kar sakta. Woh nahi jaanenge ke aapne block kiya hai.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: isChatBlocked ? 'Unblock' : 'Block',
                          style: isChatBlocked ? 'default' : 'destructive',
                          onPress: toggleChatBlock,
                        },
                      ]
                    );
                  }, 300);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingVertical: 16,
                  borderBottomWidth: 0.5, borderBottomColor: '#2c2c2e',
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: isChatBlocked ? '#1c3a52' : '#3a1c1c',
                  alignItems: 'center', justifyContent: 'center', marginRight: 14,
                }}>
                  <Ionicons
                    name={isChatBlocked ? 'lock-open-outline' : 'ban-outline'}
                    size={20}
                    color={isChatBlocked ? '#4fc3f7' : '#ff6b6b'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: isChatBlocked ? '#4fc3f7' : '#ff6b6b', fontSize: 16, fontWeight: '600' }}>
                    {isChatBlocked ? `${chatUser?.name} ko Unblock karein` : `${chatUser?.name} ko Block karein`}
                  </Text>
                  <Text style={{ color: '#8e8e93', fontSize: 12, marginTop: 2 }}>
                    {isChatBlocked ? 'Messaging dobara shuru hogi' : 'Messaging band ho jaayegi'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#48484a" />
              </TouchableOpacity>

              {/* Report option */}
              <TouchableOpacity
                onPress={() => {
                  setShowChatMenu(false);
                  setTimeout(() => {
                    showSuccessToast(`${chatUser?.name} ki report bhej di gayi hai. Shukriya!`);
                  }, 300);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingVertical: 16,
                  borderBottomWidth: 0.5, borderBottomColor: '#2c2c2e',
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: '#2c2c1c',
                  alignItems: 'center', justifyContent: 'center', marginRight: 14,
                }}>
                  <Ionicons name="flag-outline" size={20} color="#ffd60a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Report karein</Text>
                  <Text style={{ color: '#8e8e93', fontSize: 12, marginTop: 2 }}>Inappropriate content report karein</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#48484a" />
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setShowChatMenu(false)}
                style={{
                  alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 16, marginHorizontal: 16, marginTop: 8,
                  backgroundColor: '#2c2c2e', borderRadius: 12,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* Messages list */}
          <View style={{ flex: 1, position: 'relative' }}>
            <FlatList
              data={[
                ...chatMessages.slice().reverse(),
                { id: '__date__', text: 'Today', sent: false, time: '' },
              ]}
              inverted
              keyExtractor={(item) => item.id}
              style={[{ flex: 1 }, chatLoading && { opacity: 0 }]}
              contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 10 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
              if (item.id === '__date__') {
                return (
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: '#1e1e1e', paddingHorizontal: 16, paddingVertical: 5, borderRadius: 12 }}>
                      <Text style={{ color: '#999', fontSize: 12 }}>Today</Text>
                    </View>
                  </View>
                );
              }

              // ── Video link detection ──────────────────────────────────────────
              const sharedVideoId = getSharedMastiVideoId(item.text);
              const httpMatch  = item.text?.match?.(/https?:\/\/[^\s\n]+/);
              let linkedVideo: any =
                sharedVideoId
                  ? videos.find((v: any) => String(v.id) === sharedVideoId) || null
                  : null;
              if (!linkedVideo && httpMatch) {
                linkedVideo = videos.find((v: any) => v.url === httpMatch[0]) || null;
              }
              const isVideoShare = Boolean(sharedVideoId || linkedVideo);

              const handleVideoTap = () => {
                const targetVideoId = sharedVideoId || linkedVideo?.id;
                if (!targetVideoId) return;
                setShowChatScreen(false);
                setShowInbox(false);
                setIsProfile(false);
                setShowFriends(false);
                setShowSearch(false);
                setActiveTab(false);
                setProfilePlaybackUserId(null);
                setProfilePlaybackVideoIds([]);
                setPendingScrollVideoId(String(targetVideoId));
                if (!videos.some((video: any) => String(video.id) === String(targetVideoId))) {
                  void refetchBackendVideos();
                }
              };

              const renderVideoShareCard = (sent: boolean) => {
                const thumbnail =
                  linkedVideo?.thumbnail ||
                  linkedVideo?.profileImage ||
                  linkedVideo?.musicCover;
                return (
                  <TouchableOpacity onPress={handleVideoTap} activeOpacity={0.85} style={{ maxWidth: sent ? '80%' : width * 0.68 }}>
                    <View style={{
                      backgroundColor: sent ? '#5c35c8' : '#1e1e24',
                      borderRadius: 16,
                      borderBottomRightRadius: sent ? 4 : 16,
                      borderBottomLeftRadius: sent ? 16 : 4,
                      overflow: 'hidden',
                    }}>
                      <View style={{ width: sent ? 220 : width * 0.68, height: 135, backgroundColor: '#101018', alignItems: 'center', justifyContent: 'center' }}>
                        {thumbnail ? (
                          <Image source={{ uri: thumbnail }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <Ionicons name="videocam-outline" size={42} color="#aaa" />
                        )}
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}>
                          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                        </View>
                      </View>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }} numberOfLines={2}>
                          {linkedVideo?.desc || linkedVideo?.name || 'Open video in Masti Video'}
                        </Text>
                        <Text style={{ color: sent ? 'rgba(255,255,255,0.65)' : '#888', fontSize: 11, marginTop: 2 }}>
                          {linkedVideo?.user || 'Masti Video'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              };

              if (item.sent) {
                return (
                  <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
                    {isVideoShare ? (
                      renderVideoShareCard(true)
                    ) : (
                      <View style={{ maxWidth: '78%', backgroundColor: '#5c35c8', backgroundGradient: true, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, marginRight: 2 }}>
                      <Text style={{ color: '#666', fontSize: 11, marginRight: 4 }}>{item.time}</Text>
                      <Ionicons name="checkmark-done" size={14} color="#5c85ff" />
                    </View>
                  </View>
                );
              } else {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 }}>
                    <Image
                      source={{ uri: item.senderAvatar || chatUser?.avatar }}
                      style={{ width: 30, height: 30, borderRadius: 15, marginRight: 8 }}
                    />
                    <View>
                      {isVideoShare ? (
                        renderVideoShareCard(false)
                      ) : (
                        <View style={{ maxWidth: width * 0.68, backgroundColor: '#1e1e24', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomLeftRadius: 4 }}>
                          <Text style={{ color: '#f0f0f0', fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
                        </View>
                      )}
                      <Text style={{ color: '#555', fontSize: 11, marginTop: 3, marginLeft: 4 }}>{item.time}</Text>
                    </View>
                  </View>
                );
              }
              }}
            />
            {chatLoading && (
              <View style={styles.circularLoaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>

          {/* Input bar */}
          {isChatBlocked || isChatBlockedByOther ? (
            <View style={{
              paddingHorizontal: 18, paddingVertical: 16,
              paddingBottom: Platform.OS === 'ios' ? 28 : 16,
              backgroundColor: '#0a0a0a', borderTopWidth: 0.5, borderTopColor: '#1a1a1a',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
                {isChatBlocked ? 'Aapne is user ko block kiya hai.' : 'Aap is user ko message nahi bhej sakte.'}
              </Text>
            </View>
          ) : <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 10, paddingVertical: 10,
            paddingBottom: Platform.OS === 'ios' ? 28 : 14,
            backgroundColor: '#0a0a0a',
            borderTopWidth: 0.5, borderTopColor: '#1a1a1a',
          }}>
            <TouchableOpacity style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#5c35c8',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10,
            }}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#1a1a2e',
              borderRadius: 22, borderWidth: 1, borderColor: '#2e2e50',
              paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
            }}>
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 15 }}
                placeholder="Type a message..."
                placeholderTextColor="#555"
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                onSubmitEditing={sendMessage}
              />
            </View>
            <TouchableOpacity
              onPress={sendMessage}
              style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: chatInput.trim() ? '#5c35c8' : '#1a1a2e',
                alignItems: 'center', justifyContent: 'center',
                marginLeft: 8,
              }}
            >
              <Ionicons name="send" size={18} color={chatInput.trim() ? '#fff' : '#444'} />
            </TouchableOpacity>
          </View>
          }
        </ControllerKeyboardAvoidingView>
      </>
    );
  };

  const InboxScreen = () => {
    const inboxFilters = [
      { id: 'All' as const, label: 'All', icon: null },
      { id: 'Like' as const, label: 'Like', icon: 'heart-outline' as const },
      { id: 'Comments' as const, label: 'Comments', icon: 'chatbubble-ellipses-outline' as const },
      { id: 'Share' as const, label: 'Share', icon: 'share-social-outline' as const },
      { id: 'Save' as const, label: 'Save', icon: 'bookmark-outline' as const },
      { id: 'Follow' as const, label: 'Follow', icon: 'person-add-outline' as const },
    ];

    // Mark all notifications as read when inbox opens
    // (useEffect moved to App level to avoid conditional hook call — see below)

    const openInboxVideo = () => {
      setShowInbox(false);
      setIsProfile(false);
      setShowFriends(false);
      const index = filteredVideos.findIndex(video => video.id === currentVideoItem?.id);
      if (index >= 0) {
        setCurrentVideoIndex(index);
        setCurrentVideoItem(filteredVideos[index]);
        feedFlatListRef.current?.scrollToIndex({ index, animated: false });
      }
    };

    return (
      <>
        {CameraModalOverlay()}
        {FiltersModal()}
        {EffectsModal()}
        {MusicModal()}
        {SoundDetailModal()}
        <MusicTrimmerScreen visible={showMusicTrimmer} song={trimmerSong} onDone={(s, startSec, endSec) => { setSelectedSong({ ...s, trimStart: startSec, trimEnd: endSec }); setShowMusicTrimmer(false); setShowMusicModal(false); setMusicSearchQuery(''); setPreviewingSongId(null); }} onBack={() => { setShowMusicTrimmer(false); setShowMusicModal(true); }} />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ paddingTop: insets.top + 8, backgroundColor: '#000', borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
            <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
              <TouchableOpacity
                onPress={restoreHomeFeed}
                accessibilityLabel="Back"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="arrow-back" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 27, fontWeight: '700', marginLeft: 20 }}>Inbox</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 12, gap: 17 }}
            >
              {inboxFilters.map(filter => {
                const selected = inboxFilter === filter.id;
                return (
                  <TouchableOpacity
                    key={filter.id}
                    onPress={() => setInboxFilter(filter.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${filter.label} activity`}
                    style={{
                      height: 40,
                      minWidth: filter.id === 'Comments' ? 139 : filter.id === 'Follow' ? 105 : filter.id === 'Save' ? 88 : filter.id === 'Like' ? 89 : 48,
                      paddingHorizontal: filter.id === 'All' ? 14 : 15,
                      borderRadius: 9,
                      backgroundColor: selected ? '#fff' : '#1b1b1d',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {filter.icon && <Ionicons name={filter.icon} size={21} color={selected ? '#111' : '#fff'} />}
                    <Text style={{ color: selected ? '#111' : '#fff', fontSize: 16, fontWeight: '700' }}>{filter.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Liked-by modal */}
          <Modal visible={showLikedByModal} transparent animationType="slide" onRequestClose={() => setShowLikedByModal(false)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowLikedByModal(false)} />
            <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 40, maxHeight: '60%', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 0.5, borderBottomColor: '#333' }}>
                <Ionicons name="heart" size={22} color="#FE2C55" />
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 10 }}>Liked by</Text>
                <TouchableOpacity onPress={() => setShowLikedByModal(false)} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close" size={24} color="#aaa" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }}>
                {likedByList.length === 0 ? (
                  <Text style={{ color: '#666', textAlign: 'center', marginTop: 30 }}>No likes yet</Text>
                ) : likedByList.map((u, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
                    <Image source={{ uri: u.profilePic }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' }} />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 14 }}>{u.userId}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </Modal>

           <View style={{ flex: 1, position: 'relative' }}>
            <ScrollView
               style={[{ flex: 1 }, inboxFilterLoading && { opacity: 0 }]}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
              refreshControl={<RefreshControl refreshing={inboxPTR.refreshing} onRefresh={inboxPTR.onRefresh} tintColor="#ffffff" colors={['#ffffff']} progressBackgroundColor="#171717" />}
              onScroll={inboxPTR.onScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
               alwaysBounceVertical
               overScrollMode="always"
            >
              <View style={{ flex: 1, opacity: inboxPTR.refreshing ? 0 : 1 }}>
              <Text style={{ color: '#9a9a9f', fontSize: 17, fontWeight: '600', paddingHorizontal: 20, paddingTop: 18 }}>
                {inboxFilter === 'All' ? 'All activity' : inboxFilter === 'Like' ? 'Likes' : inboxFilter === 'Comments' ? 'Comments' : inboxFilter === 'Share' ? 'Shares' : inboxFilter === 'Save' ? 'Saves' : 'Follows'}
              </Text>
              {inboxFilter === 'All' && (
                <View style={{ paddingHorizontal: 16, paddingTop: 2 }}>
                  {chatConversationsQuery.isLoading &&
                    (chatConversationsQuery.data?.conversations || []).length === 0 && (
                      <ActivityIndicator color="#FE2C55" style={{ marginVertical: 24 }} />
                    )}
                  {chatConversationsQuery.error && (
                    <Text style={{ color: '#aaa', textAlign: 'center', marginVertical: 18 }}>
                      Chats could not be loaded. Check your connection and try again.
                    </Text>
                  )}
                  {(chatConversationsQuery.data?.conversations || []).map(conversation => {
                    const matchingFriend = dmUsers.find(
                      peer => messagingIdentity(peer) === conversation.peerId,
                    );
                    const visibleUserId =
                      matchingFriend?.userId ||
                      matchingFriend?.user ||
                      conversation.peerId;
                    const chatPeer: ChatListItem = {
                      id: conversation.peerId,
                      name: conversation.peerName || conversation.peerId,
                      avatar: conversation.peerAvatar || '',
                      mastiBaseUserId: conversation.peerId,
                      authUid: conversation.peerAuthId || undefined,
                      userId: visibleUserId,
                      conversationId: conversation.conversationId,
                      lastMsg: conversation.lastMessage,
                      time: chatTime(conversation.lastMessageAt),
                    };
                    return (
                      <TouchableOpacity
                        key={conversation.conversationId}
                        onPress={() => openChat(chatPeer)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open chat with ${conversation.peerName || conversation.peerId}`}
                        testID={`chat-conversation-${conversation.peerId}`}
                        style={{
                          minHeight: 82,
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 12,
                          paddingHorizontal: 4,
                          borderBottomWidth: 0.5,
                          borderBottomColor: '#252525',
                        }}
                      >
                        {conversation.peerAvatar ? (
                          <Image
                            source={{ uri: conversation.peerAvatar }}
                            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#252525' }}
                          />
                        ) : (
                          <View style={{
                            width: 48, height: 48, borderRadius: 24, backgroundColor: '#24242a',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Ionicons name="person" size={22} color="#aaa" />
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 13 }}>
                          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                            {conversation.peerName || conversation.peerId}
                          </Text>
                          <Text style={{ color: '#999', fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                            {chatDisplayId(visibleUserId)}
                          </Text>
                          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 3 }} numberOfLines={1}>
                            {conversation.lastMessage || 'Sent you a message'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                          <Text style={{ color: '#777', fontSize: 11 }}>
                            {chatTime(conversation.lastMessageAt)}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color="#666" style={{ marginTop: 6 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {(() => {
                // Merge only server-owned MastiBase notifications. Local
                // Firestore activity entries are intentionally not shown here.
                 const fsNormalized = syncedNotifs.map(n => ({
                  id: 'fs_' + n.id,
                  type: n.type,
                   userId: notificationActorLabel(n),
                   actorId: n.fromUserId,
                   title: n.title,
                   message: n.message,
                   profilePic: n.fromProfilePic || '',
                  videoId: n.videoId,
                  videoOwnerId: n.videoOwnerId || n.ownerAccountId || n.ownerId,
                  recipientId: n.recipientId,
                  comment: n.comment,
                  time: n.time,
                  isLive: true,
                  read: n.read,
                }));
                 const combined = fsNormalized.map(activity => ({
                   ...activity,
                   profilePic: resolveActivityProfilePic(activity),
                 }));
                const filtered = combined.filter(a => {
                    const activityType = String(a.type ?? '').toLowerCase();
                    if (activityType === 'direct_chat_message') return false;
                    const currentIds = [
                      appAuth.currentUser?.uid,
                      appAuth.currentUser?.email,
                      mastiBaseUserId,
                      userId,
                    ]
                      .filter(Boolean)
                      .map(value => String(value).trim().toLowerCase());
                   if (['like', 'comment', 'share', 'save'].includes(a.type)) {
                    const currentUid = appAuth.currentUser?.uid;
                    const recipientMatches = [currentUid, userId].filter(Boolean).includes(a.recipientId);
                    const ownerMatches = [currentUid, userId].filter(Boolean).includes(a.videoOwnerId);
                    const relatedVideo = a.videoId
                      ? videos.find(v => String(v.id) === String(a.videoId))
                      : null;
                    // Activity is valid only when it targets this account's
                    // own video. This also hides old/sample records whose
                    // notification path was written incorrectly.
                    if (!recipientMatches && !ownerMatches && !isVideoOwnedByCurrentUser(relatedVideo)) {
                      return false;
                    }
                  }
                   if (inboxFilter === 'All') return true;
                  if (inboxFilter === 'Like') return a.type === 'like';
                  if (inboxFilter === 'Comments') return a.type === 'comment';
                  if (inboxFilter === 'Share') return a.type === 'share';
                   if (inboxFilter === 'Save') return a.type === 'save';
                  if (inboxFilter === 'Follow') return a.type === 'follow';
                  return true;
                });
                if (filtered.length === 0) {
                  const conversationCount =
                    chatConversationsQuery.data?.conversations?.length ?? 0;
                  if (
                    inboxFilter === 'All' &&
                    (chatConversationsQuery.isLoading || conversationCount > 0)
                  ) {
                    return null;
                  }
                  return (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 }}>
                      <Text style={{ color: '#9a9a9f', fontSize: 18, fontWeight: '600' }}>No activity</Text>
                    </View>
                  );
                }
                return filtered.map(activity => {
                  const activityType = String(activity.type ?? '').toLowerCase();
                  const isMessageActivity = [
                    'message',
                    'admin_message',
                    'support_chat_message',
                    'support_chat_reply',
                    'support_reply',
                    'support_message',
                    'support_bug_report',
                    'support_bug_report_sent',
                    'support_ticket_created',
                    'support_ticket_message',
                    'support_ticket_reply',
                    'support_ticket_replied',
                    'support_admin_reply',
                  ].includes(activityType) || (
                    !['like', 'comment', 'share', 'save', 'follow'].includes(activityType) &&
                    Boolean(activity.title || activity.message)
                  );
                  // Video activity ke liye thumbnail dhundho live videos list se
                    const activityVideo = ['like', 'comment', 'share', 'save'].includes(activity.type) && activity.videoId
                     ? videos.find(v =>
                       normalizedMediaIdentity(v.id) === normalizedMediaIdentity(activity.videoId) ||
                       normalizedMediaIdentity(v.backendVideoId) === normalizedMediaIdentity(activity.videoId) ||
                       normalizedMediaIdentity(v.mediaId) === normalizedMediaIdentity(activity.videoId)
                     )
                    : null;

                  // Helper: user ka profile kholne ke liye object banana
                  const activityUserObj = { userId: activity.userId, profilePic: activity.profilePic, user: activity.userId };
                  const openActivityProfile = () => {
                    setShowInbox(false);
                    openUserProfile(activityUserObj);
                  };
                  // Helper: video kholna — inbox band karo aur video pe jump karo
                  const openActivityVideo = () => {
                    if (!activityVideo) return;
                    const vidIdx = videos.findIndex(v => String(v.id) === String(activityVideo.id));
                    setCurrentVideoItem(activityVideo);
                    if (vidIdx !== -1) setCurrentVideoIndex(vidIdx);
                    setShowInbox(false);
                  };
                  const rowAnimation = inboxRowAnimationsRef.current[
                    String(activity.id).replace(/^fs_/, '')
                  ];

                  return (
                  <Animated.View
                    key={activity.id}
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 18,
                        paddingVertical: 14,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#1e1e1e',
                        backgroundColor: (activity.isLive && !activity.read)
                          ? 'rgba(254,44,85,0.07)'
                          : 'transparent',
                      },
                      rowAnimation && {
                        opacity: rowAnimation,
                        transform: [{
                          translateY: rowAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [14, 0],
                          }),
                        }],
                      },
                    ]}
                  >
                    {/* Profile picture — click karo to profile khule */}
                    <TouchableOpacity activeOpacity={0.7} onPress={openActivityProfile}>
                      <View style={{ position: 'relative' }}>
                        {activity.profilePic ? (
                          <Image source={{ uri: activity.profilePic }} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#333' }} />
                        ) : (
                          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="person" size={24} color="#888" />
                          </View>
                        )}
                        <View style={{
                          position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11,
                            backgroundColor: activity.type === 'like' ? '#FE2C55' : activity.type === 'comment' ? '#0095f6' : activity.type === 'share' ? '#25D366' : activity.type === 'save' ? '#f59e0b' : isMessageActivity ? '#f4511e' : '#8b5cf6',
                          alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#000'
                        }}>
                          <Ionicons
                             name={activity.type === 'like' ? 'heart' : activity.type === 'comment' ? 'chatbubble' : activity.type === 'share' ? 'share-social' : activity.type === 'save' ? 'bookmark' : isMessageActivity ? 'chatbubble-ellipses' : 'person-add'}
                            size={11} color="#fff"
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Text section — username click karo to profile khule */}
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      {activity.type === 'like' ? (
                        // Instagram-style: "username liked your reel. 2m" ek hi line mein
                        <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20, flexWrap: 'wrap' }}>
                          <Text
                            style={{ fontWeight: '700' }}
                            onPress={openActivityProfile}
                          >{activity.userId}</Text>
                          <Text style={{ color: '#aaa', fontWeight: '400' }}>{' liked your reel. '}</Text>
                          <Text style={{ color: '#666', fontWeight: '400', fontSize: 13 }}>{activity.time}</Text>
                        </Text>
                      ) : (
                        <>
                          <TouchableOpacity activeOpacity={0.7} onPress={openActivityProfile}>
                            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{activity.userId}</Text>
                          </TouchableOpacity>
                          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 2 }}>
                            {activity.type === 'comment'
                              ? `commented: ${activity.comment}`
                              : activity.type === 'share'
                                ? 'shared your reel'
                                : activity.type === 'save'
                                  ? 'saved your reel'
                                  : isMessageActivity
                                    ? activity.message
                                      ? `${activity.title ? `${activity.title}: ` : ''}${activity.message}`
                                      : activity.title || 'sent you a message'
                                    : 'started following you'}
                          </Text>
                        </>
                      )}
                    </View>

                    {/* Right side: like ke liye video thumbnail (clickable), baaki ke liye time */}
                    {['like', 'comment', 'share', 'save'].includes(activity.type) ? (
                      <TouchableOpacity activeOpacity={0.75} onPress={openActivityVideo} disabled={!activityVideo}>
                        {activityVideo ? (
                          <View style={{ width: 50, height: 64, borderRadius: 4, overflow: 'hidden', backgroundColor: '#222', marginLeft: 10 }}>
                            {/* MastiBase can return the MP4 itself as thumbnailUrl.
                                ProfileVideoThumbnail uses a real image when
                                available and otherwise renders the video's
                                first frame, so the activity never stays blank. */}
                            <ProfileVideoThumbnail item={activityVideo} coverPosition={activityVideo.coverFramePosition || 0} />
                          </View>
                        ) : (
                          <View style={{ width: 50, height: 64, borderRadius: 4, backgroundColor: '#222', marginLeft: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="videocam" size={20} color={activityVideo ? '#aaa' : '#555'} />
                          </View>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ color: '#666', fontSize: 12, marginLeft: 10 }}>{activity.time}</Text>
                    )}
                  </Animated.View>
                  );
                });
              })()}
              <View style={{ height: 12 }} />
              </View>
            </ScrollView>
             {inboxFilterLoading && (
               <View style={styles.inboxCircularLoaderOverlay} pointerEvents="none">
                 <ActivityIndicator size="large" color="#fff" />
               </View>
             )}
          </View>

          <BottomNav
            activeScreen='inbox'
            handleHomePress={handleHomePress}
            setShowFriends={setShowFriends}
            setShowInbox={setShowInbox}
            setIsProfile={setIsProfile}
            setSelectedUser={setSelectedUser}
            openCameraWithPermissions={openCameraWithPermissions}
            requireAuth={requireAuth}
            notifUnreadCount={notifUnreadCount}
            notifUnreadCounts={unreadNotificationCounts}
            socialUnreadPillVisible={socialUnreadPillVisible}
            profileImage={profileImage}
          />
        </View>
      </>
    );
  };

  if (showIncomingCall && !showAudioCall && !showVideoCall) return IncomingCallScreen();
  if (showAudioCall) return AudioCallScreen();
  if (showVideoCall) return VideoCallScreen();
  if (showChatScreen) return ChatScreen();
  if (showFriends) return FriendsScreen();
  if (showInbox) return InboxScreen();

  if (isProfile) {
    const profileTabsData = [
      { key: 'posts', icon: 'grid-outline' },
      { key: 'private', icon: 'lock-closed-outline' },
      { key: 'saved', icon: 'bookmark-outline' },
      { key: 'liked', icon: 'heart-outline' },
    ];

    // ✅ Har user ka apna data — own profile vs dusre ka profile alag
    const currentEmail = appAuth.currentUser?.email?.trim().toLowerCase();
    const isOwnProfile = !selectedUser
      || selectedUser.user === userId
      || selectedUser.userId === userId
      || (selectedUser.backendUserId != null && String(selectedUser.backendUserId) === String(mastiBaseUserId))
      || (selectedUser.accountId != null && (
        selectedUser.accountId === appAuth.currentUser?.uid ||
        selectedUser.accountId === currentEmail
      ));

    // Own profile → global state se (latest DP, name, bio, social links)
    // Dusre ka profile → unke video object se
    const displayName = cleanDisplayName(name);
    const displayHandle = profileHandleForDisplay(userId);
    const ownProfileData = { user: displayHandle, name: displayName, userId: displayHandle, bio, profileImage: profileImage || '', followers: ownFollowers, following: ownFollowingCount ?? followingUsers.length, youtube, instagram, facebook, backendUserId: mastiBaseUserId, isVerified };
    const currentProfileUser = isOwnProfile ? ownProfileData : selectedUser;
    const selectedVideoProfile = !isOwnProfile
      ? videos.find(v => v.user === currentProfileUser?.user) || {}
      : {};
    const cachedSelectedProfileAvatar = findCachedPublicProfileAvatar(
      publicProfileAvatarCache,
      currentProfileUser?.backendUserId,
      currentProfileUser?.mastiBaseUserId,
      currentProfileUser?.profile?.mastiBaseUserId,
      currentProfileUser?.profile?.id,
      currentProfileUser?.profile?.username,
      currentProfileUser?.profile?.userId,
      currentProfileUser?.userId,
      currentProfileUser?.username,
      currentProfileUser?.user,
    );
    const selectedProfileAvatar = isOwnProfile
      ? profileImage || ''
      : [
          currentProfileUser?.profileImage,
          currentProfileUser?.avatarUrl,
          currentProfileUser?.profile?.profileImage,
          currentProfileUser?.profile?.avatarUrl,
          selectedVideoProfile?.profileImage,
          selectedVideoProfile?.avatarUrl,
          selectedVideoProfile?.profile?.avatarUrl,
          selectedVideoProfile?.profile?.profileImage,
        ]
          .map(normalizeMastiAvatarUrl)
          .find(Boolean) || cachedSelectedProfileAvatar;
    const displayUser = isOwnProfile
      ? { ...(videos.find(v => v.user === userId) || {}), ...ownProfileData }
      : {
          ...selectedVideoProfile,
          ...currentProfileUser,
          profileImage: selectedProfileAvatar,
          avatarUrl: selectedProfileAvatar,
          profile: {
            ...(selectedVideoProfile?.profile ?? {}),
            ...(currentProfileUser?.profile ?? {}),
            profileImage: selectedProfileAvatar,
            avatarUrl: selectedProfileAvatar,
          },
        };
    const profileCountIdentity = normalizedIdentity(displayUser?.user || displayUser?.userId);
    const liveSelectedProfileCounts =
      !isOwnProfile &&
      selectedProfileCounts?.userId &&
      normalizedIdentity(selectedProfileCounts.userId) === profileCountIdentity
        ? selectedProfileCounts
        : null;
    const displayedFollowerCount = isOwnProfile
      ? ownFollowers
      : liveSelectedProfileCounts?.followers ?? displayUser?.followers ?? 0;
    const displayedFollowingCount = isOwnProfile
      ? ownFollowingCount ?? followingUsers.length
      : liveSelectedProfileCounts?.following ?? displayUser?.following ?? 0;

    const profileUserId = displayUser?.user || displayUser?.userId;
    const profileHandleKey = normalizedIdentity(profileUserId);
    const isCurrentAccountVideo = (video: any) =>
      isOwnProfile && (
        video.accountId === appAuth.currentUser?.uid ||
        video.accountId === currentEmail ||
        (video.backendUserId != null && String(video.backendUserId) === String(mastiBaseUserId))
      );
    const userVideos = dedupeVideoItems(videos.filter((video: any) => {
      const handles = [video.user, video.userId, video.username, video.profile?.username, video.backendUserId]
        .filter(Boolean)
        .map(normalizedIdentity);
      return isCurrentAccountVideo(video) || handles.includes(profileHandleKey);
    }));
    const profileVideos = isOwnProfile
      ? userVideos
      : userVideos.filter(v => v.privacy !== 'private');
    const visibleProfileVideos = profileVideos;

    // Liked/Saved sirf apne profile mein dikhao — dusre ke profile mein nahi
    const userLikedVideos = isOwnProfile ? videos.filter(v => likedVideos[v.id]) : [];
    const userSavedVideos = isOwnProfile ? videos.filter(v => savedVideos[v.id]) : [];

    const postCount = profileVideos.length;
    const profileContentLoading = isProfileTabLoading || (feedConnectivity === 'checking' && videos.length === 0);
    const withdrawalHoldActive = Boolean(
      withdrawalRequestSummary &&
      Date.parse(withdrawalRequestSummary.processAfter) > withdrawalNow,
    );
    // Pull-to-refresh intentionally blanks the profile content. The custom
    // refresh icon outside the list is the only indicator shown during it.
    const profileScreenBlank = profileContentLoading || profilePTR.refreshing;

    return (
      <>
        {CameraModalOverlay()}
        {FiltersModal()}
        {EffectsModal()}
        {FollowersModal({ visible: showFollowers, type: "followers", onClose: () => setShowFollowers(false) })}
        {FollowersModal({ visible: showFollowing, type: "following", onClose: () => setShowFollowing(false) })}
        {/* Payout requests are managed in Settings > Monetization > Payouts. */}
        {false && isOwnProfile && (
          <Modal
            visible={showWithdrawalRequest}
            animationType="slide"
            onRequestClose={closeWithdrawalRequest}
          >
            <View style={{ flex: 1, backgroundColor: '#08080d' }}>
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: 22,
                  paddingTop: Platform.OS === 'ios' ? 58 : 30,
                  paddingBottom: 42,
                }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 18,
                }}>
                  <TouchableOpacity
                    onPress={closeWithdrawalRequest}
                    disabled={isSubmittingWithdrawal}
                    accessibilityLabel="Close withdrawal request"
                    style={{ padding: 8, marginRight: 8 }}
                  >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                    Withdrawal Request
                  </Text>
                </View>

                <Text style={{ color: '#aaa', fontSize: 14, lineHeight: 21, marginBottom: 18 }}>
                  Amount aur bank details submit karne ke baad MastiBase par request jayegi.
                  Processing ke liye 72 ghante tak ka wait rahega.
                </Text>

                {withdrawalHoldActive && withdrawalRequestSummary ? (
                  <View style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#4230a5',
                    backgroundColor: '#17132d',
                    padding: 18,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Ionicons name="time-outline" size={20} color="#a99aff" />
                      <Text style={{ color: '#c5baff', fontWeight: '800', marginLeft: 8 }}>
                        Request pending
                      </Text>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                      ₹{withdrawalRequestSummary.amount.toFixed(2)}
                    </Text>
                    <Text style={{ color: '#ddd', fontSize: 16, fontWeight: '700', marginTop: 12 }}>
                      72-hour wait: {formatWithdrawalWait(withdrawalRequestSummary.processAfter, withdrawalNow)}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 12, marginTop: 10 }}>
                      Submitted {new Date(withdrawalRequestSummary.requestedAt).toLocaleString()}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 12, marginTop: 10, lineHeight: 18 }}>
                      Bank details MastiBase withdrawal request mein bhej diye gaye hain. Is device par bank details save nahi kiye gaye.
                    </Text>
                  </View>
                ) : (
                  <>
                    {withdrawalRequestSummary && (
                      <View style={{
                        borderRadius: 12,
                        backgroundColor: '#17132d',
                        padding: 14,
                        marginBottom: 16,
                      }}>
                        <Text style={{ color: '#c5baff', fontWeight: '700' }}>
                          Pichhle request ka 72-hour wait poora ho gaya.
                        </Text>
                        <Text style={{ color: '#aaa', fontSize: 12, marginTop: 5 }}>
                          Request status ke liye MastiBase withdrawal panel check karein.
                        </Text>
                      </View>
                    )}

                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
                      Withdrawal amount (₹)
                    </Text>
                    <TextInput
                      value={withdrawalAmount}
                      onChangeText={setWithdrawalAmount}
                      placeholder="Enter amount"
                      placeholderTextColor="#777"
                      keyboardType="decimal-pad"
                      style={{
                        color: '#fff',
                        backgroundColor: '#17171f',
                        borderColor: '#34343e',
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingHorizontal: 13,
                        paddingVertical: 13,
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
                      Bank name
                    </Text>
                    <TextInput
                      value={withdrawalBankName}
                      onChangeText={setWithdrawalBankName}
                      placeholder="Bank name"
                      placeholderTextColor="#777"
                      autoCapitalize="words"
                      maxLength={80}
                      style={{
                        color: '#fff',
                        backgroundColor: '#17171f',
                        borderColor: '#34343e',
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingHorizontal: 13,
                        paddingVertical: 13,
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
                      Account holder name
                    </Text>
                    <TextInput
                      value={withdrawalAccountHolder}
                      onChangeText={setWithdrawalAccountHolder}
                      placeholder="Name on bank account"
                      placeholderTextColor="#777"
                      autoCapitalize="words"
                      maxLength={80}
                      style={{
                        color: '#fff',
                        backgroundColor: '#17171f',
                        borderColor: '#34343e',
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingHorizontal: 13,
                        paddingVertical: 13,
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
                      Account number
                    </Text>
                    <TextInput
                      value={withdrawalAccountNumber}
                      onChangeText={setWithdrawalAccountNumber}
                      placeholder="9–18 digit account number"
                      placeholderTextColor="#777"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={18}
                      style={{
                        color: '#fff',
                        backgroundColor: '#17171f',
                        borderColor: '#34343e',
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingHorizontal: 13,
                        paddingVertical: 13,
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
                      Confirm account number
                    </Text>
                    <TextInput
                      value={withdrawalConfirmAccountNumber}
                      onChangeText={setWithdrawalConfirmAccountNumber}
                      placeholder="Re-enter account number"
                      placeholderTextColor="#777"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={18}
                      style={{
                        color: '#fff',
                        backgroundColor: '#17171f',
                        borderColor: '#34343e',
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingHorizontal: 13,
                        paddingVertical: 13,
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
                      IFSC code
                    </Text>
                    <TextInput
                      value={withdrawalIfscCode}
                      onChangeText={(value) => setWithdrawalIfscCode(value.toUpperCase())}
                      placeholder="e.g. ABCD0123456"
                      placeholderTextColor="#777"
                      autoCapitalize="characters"
                      maxLength={11}
                      style={{
                        color: '#fff',
                        backgroundColor: '#17171f',
                        borderColor: '#34343e',
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingHorizontal: 13,
                        paddingVertical: 13,
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ color: '#999', fontSize: 12, lineHeight: 18, marginBottom: 18 }}>
                      Bank details MastiBase withdrawal request ko bheje jayenge; app unhe device par save nahi karegi.
                    </Text>
                    <TouchableOpacity
                      onPress={() => { void submitWithdrawalRequest(); }}
                      disabled={isSubmittingWithdrawal}
                      style={{
                        borderRadius: 12,
                        paddingVertical: 15,
                        alignItems: 'center',
                        backgroundColor: isSubmittingWithdrawal ? '#45405f' : '#5538f2',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                        {isSubmittingWithdrawal ? 'Submitting…' : 'Send withdrawal request'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </Modal>
        )}
        {!isOwnProfile && (
          <Modal
            visible={showProfileOptionsMenu}
            transparent
            animationType="slide"
            onRequestClose={() => setShowProfileOptionsMenu(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)' }}
              activeOpacity={1}
              onPress={() => setShowProfileOptionsMenu(false)}
            />
            <View style={{
              backgroundColor: '#1c1c1e',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingBottom: Platform.OS === 'ios' ? 34 : 16,
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}>
              <View style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#48484a',
                alignSelf: 'center',
                marginTop: 10,
                marginBottom: 6,
              }} />

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: '#2c2c2e',
              }}>
                {displayUser?.profileImage ? (
                  <Image
                    source={{ uri: displayUser.profileImage }}
                    style={{ width: 46, height: 46, borderRadius: 23, marginRight: 12 }}
                  />
                ) : (
                  <View style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: '#2c2c2e',
                    marginRight: 12,
                  }} />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                      {cleanDisplayName(displayUser?.name || 'Masti Video User')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ color: '#8e8e93', fontSize: 12 }}>
                      {formatProfileHandle(displayUser?.userId || displayUser?.user)}
                    </Text>
                    {displayUser?.isVerified === true && <VerifiedBadge size={15} />}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowProfileOptionsMenu(false);
                  setTimeout(() => {
                    Alert.alert(
                      isProfileBlocked ? 'Unblock profile?' : 'Block profile?',
                      isProfileBlocked
                        ? 'Unblock karne ke baad aap is user ki profile dekh sakenge.'
                        : 'Block karne ke baad is user ke videos aur interactions aapko nahi dikhengi.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: isProfileBlocked ? 'Unblock' : 'Block',
                          style: isProfileBlocked ? 'default' : 'destructive',
                          onPress: () => { void toggleProfileBlock(displayUser); },
                        },
                      ],
                    );
                  }, 250);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 0.5,
                  borderBottomColor: '#2c2c2e',
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isProfileBlocked ? '#1c3a52' : '#3a1c1c',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons
                    name={isProfileBlocked ? 'lock-open-outline' : 'ban-outline'}
                    size={20}
                    color={isProfileBlocked ? '#4fc3f7' : '#ff6b6b'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: isProfileBlocked ? '#4fc3f7' : '#ff6b6b',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    {isProfileBlocked ? 'Unblock' : 'Block'}
                  </Text>
                  <Text style={{ color: '#8e8e93', fontSize: 12, marginTop: 2 }}>
                    {isProfileBlocked ? 'Profile dobara dekh sakte hain' : 'Is user se interaction band karein'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#48484a" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => reportProfile(displayUser)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 0.5,
                  borderBottomColor: '#2c2c2e',
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#2c2c1c',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons name="flag-outline" size={20} color="#ffd60a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Report</Text>
                  <Text style={{ color: '#8e8e93', fontSize: 12, marginTop: 2 }}>
                    Inappropriate profile ya content report karein
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#48484a" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { void shareProfile(displayUser); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 0.5,
                  borderBottomColor: '#2c2c2e',
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#1c3044',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons name="share-social-outline" size={20} color="#4fc3f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Share</Text>
                  <Text style={{ color: '#8e8e93', fontSize: 12, marginTop: 2 }}>
                    Profile kisi ke saath share karein
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#48484a" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowProfileOptionsMenu(false)}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 16,
                  marginHorizontal: 16,
                  marginTop: 8,
                  backgroundColor: '#2c2c2e',
                  borderRadius: 12,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        )}
        {/* ── Drafts List Screen ── */}
        <Modal visible={showDrafts} animationType="slide" onRequestClose={() => setShowDrafts(false)}>
          <View style={{ flex: 1, backgroundColor: '#1c1c1c' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 22, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
              <TouchableOpacity onPress={() => setShowDrafts(false)} style={{ marginRight: 14 }}>
                <Ionicons name="arrow-back" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', flex: 1, letterSpacing: 0.2 }}>Reels drafts</Text>
            </View>

            {/* Drafts list */}
            <FlatList
              data={drafts}
              keyExtractor={(item) => item.id}
              style={{ flex: 1, backgroundColor: '#1c1c1c' }}
              contentContainerStyle={{ paddingTop: 4 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 100 }}>
                  <Ionicons name="albums-outline" size={64} color="#333" />
                  <Text style={{ color: '#555', marginTop: 16, fontSize: 16 }}>Koi draft nahi mila</Text>
                </View>
              }
              renderItem={({ item }) => {
                const date = new Date(item.savedAt);
                const month = date.toLocaleDateString('en-IN', { month: 'short' });
                const day = date.getDate();
                const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                const isEdited = !!item.title;
                const dateStr = `${isEdited ? 'Edited' : 'Created'} ${month} ${day}, ${time}`;
                const sizeStr = item.size ? `${(item.size / (1024 * 1024)).toFixed(1)} MB` : '';
                const durationStr = item.duration ? `0:${String(Math.round(item.duration)).padStart(2, '0')}` : '0:15';
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1a1a1a' }}
                    onPress={() => {
                      setShowDrafts(false);
                      setRecordedVideoUri(item.uri);
                      setRecordingFlowStep('upload');
                      setShowCamera(true);
                      if (item.title) setUploadTitle(item.title);
                    }}
                  >
                    {/* Thumbnail — portrait style like Reels */}
                    <View style={{ width: 64, height: 86, borderRadius: 4, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 14 }}>
                      {item.uri ? (
                        <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="videocam-outline" size={26} color="#444" />
                        </View>
                      )}
                    </View>
                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 5 }} numberOfLines={1}>
                        {item.title || 'Draft video'}
                      </Text>
                      <Text style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>{dateStr}</Text>
                      <Text style={{ color: '#666', fontSize: 13 }}>
                        {durationStr}{sizeStr ? `  |  ${sizeStr}` : ''}
                      </Text>
                    </View>
                    {/* Edit + more icons */}
                    <TouchableOpacity
                      style={{ padding: 10 }}
                      onPress={() => {
                        setShowDrafts(false);
                        setRecordedVideoUri(item.uri);
                        setRecordingFlowStep('editor');
                        setShowCamera(true);
                        if (item.title) setUploadTitle(item.title);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={20} color="#bbb" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ padding: 10 }}
                      onPress={() => Alert.alert('Draft', item.title || 'Draft video', [
                        { text: 'Delete', style: 'destructive', onPress: () => setDrafts(prev => prev.filter(d => d.id !== item.id)) },
                        { text: 'Cancel', style: 'cancel' },
                      ])}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#bbb" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Modal>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.topGradient} pointerEvents="none" />
          
          {/* ✅ STICKY TABS - stickyHeaderIndices=[1] se tabs upar chipak jayenge */}
          <ScrollView
            style={{ flex: 1, backgroundColor: '#000' }}
            contentContainerStyle={{ paddingBottom: 135 }}
            showsVerticalScrollIndicator={false}
            bounces={true}
            overScrollMode="always"
            nestedScrollEnabled={true}
            stickyHeaderIndices={[1]}
            onScroll={profilePTR.onScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={profilePTR.refreshing}
                onRefresh={profilePTR.onRefresh}
                tintColor="#ffffff"
                colors={['#ffffff']}
                progressBackgroundColor="#171717"
              />
            }
          >
            <View>
            <View>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => {
                  setShowProfileOptionsMenu(false);
                   restoreHomeFeed();
                }} style={{ marginRight: 12 }}>
                  <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => isOwnProfile
                    ? router.push('/settings')
                    : setShowProfileOptionsMenu(true)}
                  accessibilityLabel={isOwnProfile ? 'Profile settings' : 'Profile options'}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="more-vertical" size={26} color="white" />
                </TouchableOpacity>
              </View>
              <View style={styles.profileContent}>
                <View style={styles.avatarContainer}>
                  {displayUser?.profileImage
                    ? <Image source={{ uri: displayUser.profileImage }} style={styles.avatar} />
                    : <View style={[styles.avatar, { backgroundColor: '#000' }]} />
                  }
                  <View style={styles.avatarPlusBadge}><Ionicons name="add" size={14} color="white" /></View>
                </View>
                <Text style={styles.usernameText}>{cleanDisplayName(displayUser.name)}</Text>
                <View style={styles.profileHandleRow}>
                  <Text
                    style={{
                      color: '#888',
                      fontSize: 12,
                      flexShrink: 1,
                      maxWidth: '100%',
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {(() => {
                      const profileHandle = isOwnProfile
                        ? displayHandle
                        : displayUser?.userId || displayUser?.user;
                      return profileHandle && profileHandle !== '@user'
                        ? profileHandle
                        : '@newuser';
                    })()}
                  </Text>
                  {displayUser?.isVerified === true && <VerifiedBadge size={20} />}
                </View>
                
              
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{postCount}</Text>
                    <Text style={styles.statLabel}>Posts</Text>
                  </View>
                  <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowers(true)}>
                    <Text style={styles.statNumber}>{displayedFollowerCount}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowing(true)}>
                    <Text style={styles.statNumber}>{displayedFollowingCount}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.buttonGroupRow}>
                  {selectedUser? (
                    <>
                      <TouchableOpacity 
                        style={{ backgroundColor: followingUsers.includes(selectedUser.user) ? '#222' : '#1877F2', paddingVertical: 10, borderRadius: 8, marginHorizontal: 22, flex: 1, alignItems: "center", justifyContent: "center", flexDirection: 'row' }} 
                        onPress={() => toggleFollow(selectedUser)}
                      >
                        <Ionicons 
                          name={followingUsers.includes(selectedUser.user)? "checkmark-circle" : "person-add"} 
                          size={20} 
                          color="white" 
                        />
                        <Text style={{ fontWeight: "bold", fontSize: 15, color: "#fff", marginLeft: 8 }}>
                          {followingUsers.includes(selectedUser.user)? "Following" : "Follow"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.grayButton}
                        onPress={() => requireAuth(() => {
                          openChat(chatParticipantFromProfile(selectedUser));
                        })}
                      >
                        <Text style={{ fontWeight: "bold", fontSize: 15, color: "#fff" }}>Message</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.grayButton}
                        onPress={() => {
                          if (isPlaceholderProfileHandle(userId)) {
                            setUserId('@newuser');
                          }
                          setEditProfile(true);
                        }}
                      >
                        <Text style={{ fontWeight: "bold", fontSize: 15, color: "#fff" }}>Edit profile</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.grayButton} onPress={() => Alert.alert("Share Profile", "Coming soon")}>
                        <Text style={{ fontWeight: "bold", fontSize: 15, color: "#fff" }}>Share Profile</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                {displayUser.bio? (
                  <View style={{ marginTop: 12, paddingHorizontal: 20 }}>
                    <Text style={{ color: "#fff", fontSize: 14, textAlign: "center", fontWeight: '500' }}>{displayUser.bio}</Text>
                  </View>
                ) : null}

                {(displayUser?.youtube || displayUser?.instagram || displayUser?.facebook)? (
                  <View style={styles.socialIconsRow}>
                    {displayUser?.youtube? (
           <TouchableOpacity onPress={() => Linking.openURL(displayUser.youtube)}>
                        <FontAwesome name="youtube-play" size={22} color="#FF0000" />
                      </TouchableOpacity>
                    ) : null}
                    {displayUser?.instagram? (
                      <TouchableOpacity onPress={() => Linking.openURL(displayUser.instagram)}>
                        <FontAwesome name="instagram" size={22} color="#E1306C" />
                      </TouchableOpacity>
                    ) : null}
                    {displayUser?.facebook? (
                      <TouchableOpacity onPress={() => Linking.openURL(displayUser.facebook)}>
                        <FontAwesome name="facebook-square" size={22} color="#1877F2" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

    
            <View style={{ backgroundColor: "#111111" }}>
              <View style={styles.contentTabsBar}>
                {profileTabsData.map((tab, index) => (
                  <TouchableOpacity 
                    key={tab.key} 
                    style={styles.contentTabItem}
                    onPress={() => changeProfileTab(index)}
                  >
                    <Ionicons
  name={tab.icon}
  size={24}
  color={profileTabIndex === index ? "white" : "#888"}
/>
</TouchableOpacity>
))}

<Animated.View
  style={[
    styles.profileTabLine,
    {
      transform: [
        {
          translateX: profileScrollX.interpolate({
            inputRange: [0, width, width * 2, width * 3],
            outputRange: [
              (width / 8) - 20,
              (width / 8) + (width / 4) - 20,
              (width / 8) + (width / 2) - 20,
              (width / 8) + (width * 3 / 4) - 20,
            ],
            extrapolate: "clamp",
          }),
        },
      ],
    },
  ]}
/>

</View>

<View style={{ height: 1, backgroundColor: "#333" }} />
</View>
          
   <AnimatedFlatList
  ref={profileTabsFlatListRef}
  data={profileTabsData}
  horizontal
  pagingEnabled
  showsHorizontalScrollIndicator={false}
  scrollEventThrottle={16}
  onScroll={Animated.event(
    [{ nativeEvent: { contentOffset: { x: profileScrollX } } }],
    { useNativeDriver: true }
  )}
  onMomentumScrollEnd={(e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setProfileTabIndex(index);
  }}
  getItemLayout={(data, index) => ({
    length: width,
    offset: width * index,
    index,
  })}
  renderItem={({ item, index }) => (
                <View style={{ width: width, backgroundColor: "#000", minHeight: 500 }}>
                  {profileScreenBlank && (
                    <View style={styles.profileTabLoadingOverlay}>
                      {profileContentLoading && <LoadingIndicator />}
                    </View>
                  )}
                  <View style={{ opacity: profileScreenBlank ? 0 : 1 }}>
                  {index === 0 && (
                    <View style={styles.videoGrid}>
                      {/* ── Drafts Folder — sirf apne profile mein, jab drafts hon ── */}
                      {isOwnProfile && drafts.length > 0 && (
                        <TouchableOpacity
                          key="drafts-folder"
                          style={styles.videoItem}
                          onPress={() => setShowDrafts(true)}
                        >
                          {drafts[0]?.uri ? (
                            <Image source={{ uri: drafts[0].uri }} style={{ flex: 1, backgroundColor: '#222' }} resizeMode="cover" />
                          ) : (
                            <View style={{ flex: 1, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="albums-outline" size={36} color="#aaa" />
                            </View>
                          )}
                          {/* Dark overlay */}
                          <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                          {/* Drafts label at bottom */}
                          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 5 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Drafts</Text>
                            <Text style={{ color: '#ccc', fontSize: 11 }}>{drafts.length} video{drafts.length > 1 ? 's' : ''}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      {visibleProfileVideos.length === 0 && !(isOwnProfile && drafts.length > 0) && (
                        <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
                          <Ionicons name="videocam-outline" size={60} color="#555" />
                          <Text style={{ color: '#999', marginTop: 15 }}>Koi video nahi</Text>
                        </View>
                      )}
                      {visibleProfileVideos.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.videoItem} onPress={() => openProfileVideo(item, visibleProfileVideos)}>
                          <ProfileVideoThumbnail item={item} coverPosition={item.coverFramePosition} />
                          <View style={styles.videoViews}>
                            <Ionicons name="play" size={14} color="white" />
                            <Text style={styles.viewsText}>
                              {viewCounts[item.id] ?? item.views ?? item.viewCount ?? 0}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {index === 1 && (
                    <View style={styles.videoGrid}>
                      {isOwnProfile && userVideos.filter(v => v.privacy === 'private').length === 0 && (
                        <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
                          <Ionicons name="lock-closed" size={60} color="#555" />
                          <Text style={{ color: '#fff', marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>Koi private video</Text>
                          <Text style={{ color: '#888', marginTop: 6, fontSize: 13 }}>Private videos sirf aap dekh sakte hain</Text>
                        </View>
                      )}
                      {isOwnProfile && userVideos.filter(v => v.privacy === 'private').map((item) => (
                        <TouchableOpacity key={item.id} style={styles.videoItem} onPress={() => openProfileVideo(item, userVideos.filter(v => v.privacy === 'private'))}>
                          <ProfileVideoThumbnail item={item} coverPosition={item.coverFramePosition} />
                          <View style={styles.videoViews}><Ionicons name="lock-closed" size={14} color="white" /></View>
                        </TouchableOpacity>
                      ))}
                      {!isOwnProfile && (
                        <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
                          <Ionicons name="lock-closed" size={60} color="#555" />
                          <Text style={{ color: '#fff', marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>Koi private video</Text>
                          <Text style={{ color: '#888', marginTop: 6, fontSize: 13 }}>Private videos sirf aap dekh sakte hain</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {index === 2 && (
                    <View style={styles.videoGrid}>
                      {userSavedVideos.length === 0 && (
                        <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
                          <Ionicons name="bookmark-outline" size={60} color="#555" />
                          <Text style={{ color: '#fff', marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>Koi saved video</Text>
                          <Text style={{ color: '#888', marginTop: 6, fontSize: 13 }}>Saved videos sirf aap dekh sakte hain</Text>
                        </View>
                      )}
                      {userSavedVideos.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.videoItem} onPress={() => openProfileVideo(item, userSavedVideos)}>
                          <ProfileVideoThumbnail item={item} coverPosition={item.coverFramePosition} />
                          <View style={styles.videoViews}><Ionicons name="bookmark" size={14} color="white" /></View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {index === 3 && (
                    <View style={styles.videoGrid}>
                      {userLikedVideos.length === 0 && (
                        <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
                          <Ionicons name="heart-outline" size={60} color="#555" />
                          <Text style={{ color: '#fff', marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>Koi liked video</Text>
                          <Text style={{ color: '#888', marginTop: 6, fontSize: 13 }}>Liked videos sirf aap dekh sakte hain</Text>
                        </View>
                      )}
                      {userLikedVideos.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.videoItem} onPress={() => openProfileVideo(item, userLikedVideos)}>
                          <ProfileVideoThumbnail item={item} coverPosition={item.coverFramePosition} />
                          <View style={styles.videoViews}><Ionicons name="heart" size={14} color="#fe2c55" /></View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  </View>
                </View>
              )}
              keyExtractor={item => item.key}
            />
            </View>
          </ScrollView>
          <BottomNav
            activeScreen='profile'
            handleHomePress={handleHomePress}
            setShowFriends={setShowFriends}
            setShowInbox={setShowInbox}
            setIsProfile={setIsProfile}
            setSelectedUser={setSelectedUser}
            openCameraWithPermissions={openCameraWithPermissions}
            requireAuth={requireAuth}
            notifUnreadCount={notifUnreadCount}
            notifUnreadCounts={unreadNotificationCounts}
            socialUnreadPillVisible={socialUnreadPillVisible}
            profileImage={profileImage}
          />
        </View>
      </>
    );
  }
  
    // Main Feed - Home Screen
  const activeFeedVideoId = playbackVideos[currentVideoIndex]?.id;
  const activeFeedVideoState = activeFeedVideoId
    ? (feedVideoStates[activeFeedVideoId] ?? 'loading')
    : 'loading';
  const showFeedLoadingPlaceholder =
    !isProfilePlayback &&
    !showCamera &&
    playbackVideos.length === 0;
  const showFeedProgress =
    !showFeedLoadingPlaceholder &&
    activeFeedVideoState === 'ready' &&
    !showCamera &&
    !recordedVideoUri &&
    !isUploading &&
    !showSoundDetail;

  return (
    <>
      {CameraModalOverlay()}
      {FiltersModal()}
      {EffectsModal()}
      {MusicModal()}
      {SoundDetailModal()}
      <MusicTrimmerScreen visible={showMusicTrimmer} song={trimmerSong} onDone={(s, startSec, endSec) => { setSelectedSong({ ...s, trimStart: startSec, trimEnd: endSec }); setShowMusicTrimmer(false); setShowMusicModal(false); setMusicSearchQuery(''); setPreviewingSongId(null); }} onBack={() => { setShowMusicTrimmer(false); setShowMusicModal(true); }} />

      {/* ── Drafts List Screen ── */}
      <Modal visible={showDrafts} animationType="slide" onRequestClose={() => setShowDrafts(false)}>
        <View style={{ flex: 1, backgroundColor: '#1c1c1c' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 22, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
            <TouchableOpacity onPress={() => setShowDrafts(false)} style={{ marginRight: 14 }}>
              <Ionicons name="arrow-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', flex: 1, letterSpacing: 0.2 }}>Reels drafts</Text>
          </View>

          {/* Drafts list */}
          <FlatList
            data={drafts}
            keyExtractor={(item) => item.id}
            style={{ flex: 1, backgroundColor: '#1c1c1c' }}
            contentContainerStyle={{ paddingTop: 4 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 100 }}>
                <Ionicons name="albums-outline" size={64} color="#333" />
                <Text style={{ color: '#555', marginTop: 16, fontSize: 16 }}>Koi draft nahi mila</Text>
              </View>
            }
            renderItem={({ item }) => {
              const date = new Date(item.savedAt);
              const month = date.toLocaleDateString('en-IN', { month: 'short' });
              const day = date.getDate();
              const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              const isEdited = !!item.title;
              const dateStr = `${isEdited ? 'Edited' : 'Created'} ${month} ${day}, ${time}`;
              const sizeStr = item.size ? `${(item.size / (1024 * 1024)).toFixed(1)} MB` : '';
              const durationStr = item.duration ? `0:${String(Math.round(item.duration)).padStart(2, '0')}` : '0:15';
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1a1a1a' }}
                  onPress={() => {
                    setShowDrafts(false);
                    setRecordedVideoUri(item.uri);
                    setRecordingFlowStep('upload');
                    setShowCamera(true);
                    if (item.title) setUploadTitle(item.title);
                  }}
                >
                  {/* Thumbnail — portrait style like Reels */}
                  <View style={{ width: 64, height: 86, borderRadius: 4, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 14 }}>
                    {item.uri ? (
                      <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="videocam-outline" size={26} color="#444" />
                      </View>
                    )}
                  </View>
                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 5 }} numberOfLines={1}>
                      {item.title || 'Draft video'}
                    </Text>
                    <Text style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>{dateStr}</Text>
                    <Text style={{ color: '#666', fontSize: 13 }}>
                      {durationStr}{sizeStr ? `  |  ${sizeStr}` : ''}
                    </Text>
                  </View>
                  {/* Edit + more icons */}
                  <TouchableOpacity
                    style={{ padding: 10 }}
                    onPress={() => {
                      setShowDrafts(false);
                      setRecordedVideoUri(item.uri);
                      setRecordingFlowStep('editor');
                      setShowCamera(true);
                      if (item.title) setUploadTitle(item.title);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={20} color="#bbb" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ padding: 10 }}
                    onPress={() => Alert.alert('Draft', item.title || 'Draft video', [
                      { text: 'Delete', style: 'destructive', onPress: () => setDrafts(prev => prev.filter(d => d.id !== item.id)) },
                      { text: 'Cancel', style: 'cancel' },
                    ])}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#bbb" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
      <View style={styles.container}>

        {/* ── PROCESSING INDICATOR — photo jaisa circular ring, top-left ── */}
        {isUploading && (() => {
          const R = 26;
          const CIRC = 2 * Math.PI * R;
          const offset = CIRC * (1 - uploadProgress / 100);
          return (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 108, left: 10, zIndex: 9999, alignItems: 'center' }}
            >
              {/* Circle + % */}
              <View style={{
                width: 68, height: 68, borderRadius: 34,
                backgroundColor: 'rgba(0,0,0,0.60)',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Svg width={68} height={68} style={{ position: 'absolute', top: 0, left: 0 }}>
                  {/* faint track */}
                  <Circle cx={34} cy={34} r={R}
                    stroke="rgba(255,255,255,0.20)" strokeWidth={4} fill="none"
                  />
                  {/* coloured arc — starts from top (rotation -90) */}
                  <Circle cx={34} cy={34} r={R}
                    stroke={uploadProgress >= 100 ? '#00FF88' : '#25F4EE'}
                    strokeWidth={4} fill="none"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 34 34)"
                  />
                </Svg>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', zIndex: 1 }}>
                  {uploadProgress}%
                </Text>
              </View>
              {/* label */}
              <Text style={{
                color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 4,
                textShadowColor: 'rgba(0,0,0,1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
              }}>
                {uploadProgress >= 100 ? 'Done! ✓' : 'Processing...'}
              </Text>
            </View>
          );
        })()}
        <AnimatedFlatList
          ref={tabFlatListRef}
          data={[{key: 'following'}, {key: 'foryou'}]}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
          initialScrollIndex={1}
           // One frame is enough for the tab indicator; 1ms events create
           // unnecessary JS work while a video is playing.
           scrollEventThrottle={16}
          getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            changeTab(index === 0);
          }}
          renderItem={({ index: tabIdx }) => (
            <View style={{ width: width, height: height }}>
              <FlatList
                ref={tabIdx === 1? feedFlatListRef : null}
                key={`masti-feed-${tabIdx}-${remoteFeedLayout}-${layoutPreviewIndex === null ? 'browse' : 'player'}`}
                 // Only mount native video players for the visible tab.
                 // Keeping both tabs populated mounted up to six Video
                 // surfaces at once and caused noticeable scrolling lag.
                data={tabIdx === (activeTab ? 0 : 1)
                  ? layoutPreviewIndex !== null
                    ? playbackVideos[layoutPreviewIndex]
                      ? [playbackVideos[layoutPreviewIndex]]
                      : []
                    : playbackVideos
                  : []}
                initialScrollIndex={layoutPreviewIndex !== null
                  ? 0
                  : tabIdx === (activeTab ? 0 : 1) && playbackVideos.length > 0
                    ? Math.min(currentVideoIndex, playbackVideos.length - 1)
                    : 0}
                numColumns={remoteFeedLayout === 'grid' && layoutPreviewIndex === null ? 3 : 1}
                columnWrapperStyle={remoteFeedLayout === 'grid' && layoutPreviewIndex === null
                  ? { justifyContent: 'flex-start' }
                  : undefined}
                contentContainerStyle={remoteFeedLayout === 'reels' || layoutPreviewIndex !== null
                  ? undefined
                  : {
                      paddingTop: 62,
                      paddingBottom: 120 + insets.bottom,
                      backgroundColor: isDarkTheme ? '#000' : '#f5f5f7',
                    }}
                renderItem={({ item, index }) => {
                  if (homePTR.refreshing) return null;
                  if (layoutPreviewIndex !== null) {
                    return renderVideoItem({
                      item,
                      index: layoutPreviewIndex,
                      tabIsActive: true,
                    });
                  }
                  if (remoteFeedLayout === 'reels') {
                    return renderVideoItem({
                      item,
                      index,
                      tabIsActive: tabIdx === 0 ? activeTab : !activeTab,
                    });
                  }
                  return renderRemoteLayoutItem({ item, index });
                }}
                keyExtractor={(item) => item.id + '_' + tabIdx}
                pagingEnabled={remoteFeedLayout === 'reels' || layoutPreviewIndex !== null}
                snapToInterval={remoteFeedLayout === 'reels' || layoutPreviewIndex !== null
                  ? height
                  : undefined}
                snapToAlignment="start"
                decelerationRate={remoteFeedLayout === 'reels' || layoutPreviewIndex !== null
                  ? 'fast'
                  : 'normal'}
                disableIntervalMomentum={remoteFeedLayout === 'reels' || layoutPreviewIndex !== null}
                  // Keep the active player and its nearest neighbors ready,
                  // while allowing off-screen native surfaces to detach.
                  removeClippedSubviews={Platform.OS === 'android'}
                 windowSize={3}
                 initialNumToRender={2}
                 maxToRenderPerBatch={2}
                updateCellsBatchingPeriod={16}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={homePTR.refreshing}
                    onRefresh={homePTR.onRefresh}
                    tintColor="#ffffff"
                    colors={['#ffffff']}
                    progressBackgroundColor="#171717"
                    progressViewOffset={60}
                  />
                }
                onScroll={(event) => {
                  homePTR.onScroll(event);
                  setExpandedVideoDetailsId(null);
                }}
                scrollEventThrottle={16}
                overScrollMode="always"
                getItemLayout={remoteFeedLayout === 'reels' && layoutPreviewIndex === null
                  ? (data, idx) => ({ length: height, offset: height * idx, index: idx })
                  : undefined}
                onScrollToIndexFailed={(info) => {
                  feedFlatListRef.current?.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: true,
                  });
                }}
                onViewableItemsChanged={remoteFeedLayout === 'reels' && layoutPreviewIndex === null
                  ? onViewableItemsChangedRef.current
                  : undefined}
                viewabilityConfig={remoteFeedLayout === 'reels' && layoutPreviewIndex === null
                  ? viewabilityConfigRef.current
                  : undefined}
              />
            </View>
          )}
          keyExtractor={item => item.key}
        />
        {showFeedLoadingPlaceholder && !activeFeedVideoId && (
          <FeedLoadingPlaceholder />
        )}
        {showFeedLoadingPlaceholder && (
          <View
            pointerEvents="none"
            style={[styles.feedLoadingTopBars, { zIndex: 30, elevation: 30 }]}
          >
            <View style={styles.feedLoadingTopBar} />
            <View style={styles.feedLoadingTopBar} />
            <View style={[styles.feedLoadingTopBar, styles.feedLoadingTopBarShort]} />
          </View>
        )}
        {!isProfilePlayback && !showFeedLoadingPlaceholder && <View style={styles.topGradient} pointerEvents="none" />}
        {!isProfilePlayback && !showFeedLoadingPlaceholder && <View style={styles.topMenuContainer}>
          <View style={styles.headerWrapperInner}>
            <View style={styles.tabsWrapper}>
              <TouchableOpacity onPress={() => changeTab(true)} style={styles.tabButton}>
                <Text style={[styles.topText, activeTab && styles.activeTopText]}>Following</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeTab(false)} style={styles.tabButton}>
                <Text style={[styles.topText,!activeTab && styles.activeTopText]}>For You</Text>
              </TouchableOpacity>
              <View style={styles.separatorWrapper}><Text style={styles.separator}>|</Text></View>
              <Animated.View style={[styles.activeLine, {
            transform: [{
                  translateX: scrollX.interpolate({
                    inputRange: [0, width],
                    outputRange: [LINE_CENTER_OFFSET, TAB_WIDTH + LINE_CENTER_OFFSET],
                    extrapolate: 'clamp'
                  })
                }]
              }]} />
            </View>
          </View>
          <TouchableOpacity style={styles.searchIcon} onPress={() => requireAuth(() => setShowSearch(true))}>
            <Ionicons name="search" size={26} color="white" />
          </TouchableOpacity>
        </View>}

        {isProfilePlayback && (
          <TouchableOpacity
            style={[styles.profilePlaybackBackButton, { top: insets.top + 10 }]}
            onPress={() => {
              setIsProfile(true);
              setProfilePlaybackUserId(null);
              setProfilePlaybackVideoIds([]);
              setShareOpenedFromProfile(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {feedLoadError && feedErrorBannerReady && (
          <TouchableOpacity
            style={styles.feedErrorBanner}
            onPress={() => { setFeedLoadError(null); refetchBackendVideos(); }}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
            <Text style={styles.feedErrorBannerText}>{feedLoadError} Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {/* Progress bar — thin white line just above the bottom nav, fills L→R with playback (Instagram-style) */}
        {showFeedProgress && (
          <View style={[styles.feedProgressTrack, { bottom: 90 + insets.bottom }]} pointerEvents="none">
            <View style={[styles.feedProgressFill, { width: width * feedPlaybackProgress }]} />
          </View>
        )}

        {!recordingFlowStep && !showCamera && (
          <BottomNav
            activeScreen='home'
            handleHomePress={handleHomePress}
            setShowFriends={setShowFriends}
            setShowInbox={setShowInbox}
            setIsProfile={setIsProfile}
            setSelectedUser={setSelectedUser}
            openCameraWithPermissions={openCameraWithPermissions}
            requireAuth={requireAuth}
            notifUnreadCount={notifUnreadCount}
            notifUnreadCounts={unreadNotificationCounts}
            socialUnreadPillVisible={socialUnreadPillVisible}
            profileImage={profileImage}
          />
        )}

        {CommentsModal()}
        {ShareModal()}
        {SearchModal()}
        <LoginBottomSheet
          visible={showLoginSheet}
          onClose={() => {
            setShowLoginSheet(false);
            pendingActionRef.current = null;
          }}
          onLogin={handleLoginSuccess}
        />
      </View>
    </>
  );
}
   
const styles = StyleSheet.create({
         
    container: { flex: 1, backgroundColor: '#000' },
  videoFullScreen: { height: height, width: width, backgroundColor: '#000' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 38, zIndex: 5, backgroundColor: 'transparent' },
  topMenuContainer: { position: 'absolute', top: 5, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  profilePlaybackBackButton: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 30 },
  headerWrapperInner: { width: HEADER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  tabsWrapper: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', position: 'relative', paddingBottom: 6 },
  tabButton: { width: TAB_WIDTH, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  topText: { color: '#8a8a8a', fontSize: 18, fontWeight: '600' },
  activeTopText: { color: '#fff', fontWeight: 'bold' },
  separatorWrapper: { position: 'absolute', left: '50%', marginLeft: -3, top: 6, zIndex: 5 },
  separator: { color: '#333', fontSize: 16, opacity: 0.7 },
  activeLine: { height: 2, backgroundColor: 'white', width: LINE_WIDTH, position: 'absolute', bottom: -2, borderRadius: 1, left: 0 },
  searchIcon: { position: 'absolute', right: 20 },
  rightActions: { position: 'absolute', right: 10, bottom: 100, alignItems: 'center', zIndex: 20 },
  actionItem: { alignItems: 'center', marginBottom: 15 },
  actionText: { color: 'white', fontSize: 12, marginTop: 2, fontWeight: '600' },
  musicDiscContainer: { marginTop: 0, alignItems: "center" },
  musicDisc: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#fff" },
  profileCircle: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'white', marginBottom: 15, overflow: 'hidden' },
  userInfo: { position: 'absolute', bottom: 100, left: 15, zIndex: 20, maxWidth: width - 80 },
  username: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  followButton: { borderWidth: 1, borderColor: "white", paddingHorizontal: 15, paddingVertical: 4, borderRadius: 5, marginLeft: 20 },
  followBtnBlue: {
    backgroundColor: '#1877F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 9,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 26
  },
  followBtnGray: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  subText: { color: '#fff', fontSize: 14, marginVertical: 4 },
  songName: { color: 'white', fontSize: 13 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 90, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#000', zIndex: 30, borderTopWidth: 0.5, borderTopColor: '#222', paddingBottom: 10 },
  feedProgressTrack: { position: 'absolute', bottom: 90, left: 0, width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.25)', zIndex: 29, elevation: 0 },
  feedErrorBanner: { position: 'absolute', top: 96, left: 16, right: 16, backgroundColor: 'rgba(200,30,30,0.92)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 40 },
  feedErrorBannerText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  feedProgressFill: { height: 2, backgroundColor: '#fff' },
  feedTabLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0d12',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    elevation: 25,
  },
  feedBlankLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0d12',
  },
  feedLoadingPulseLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  feedLoadingTopBars: {
    position: 'absolute',
    top: 66,
    left: 32,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.72,
    zIndex: 1,
    elevation: 1,
  },
  feedLoadingTopBar: {
    height: 16,
    width: '30%',
    borderRadius: 9,
    backgroundColor: '#777',
  },
  feedLoadingTopBarShort: {
    width: '18%',
  },
  feedLoadingProfileCircle: {
    backgroundColor: '#777',
    borderColor: '#777',
  },
  feedLoadingActionText: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  feedLoadingAvatar: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: '#777',
  },
  feedLoadingMusicDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#777',
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedLoadingMusicHole: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#444',
    borderWidth: 1.5,
    borderColor: '#777',
  },
  feedLoadingCaption: {
    position: 'absolute',
    left: 15,
    right: 80,
    gap: 10,
  },
  feedLoadingLine: {
    height: 14,
    borderRadius: 8,
    backgroundColor: '#777',
  },
  feedLoadingLineShort: {
    width: '27%',
  },
  feedLoadingLineLong: {
    width: '46%',
  },
  feedLoadingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedLoadingSmallDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#777',
  },
  feedLoadingLineMedium: {
    width: '25%',
  },
  feedNetworkState: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 42,
    zIndex: 25,
    elevation: 25,
  },
  feedNetworkTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  feedNetworkMessage: {
    color: '#777',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  feedNetworkRefresh: {
    minWidth: 184,
    height: 42,
    marginTop: 34,
    backgroundColor: '#28272A',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  feedNetworkRefreshText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: 'white', fontSize: 11, marginTop: 4, fontWeight: 'bold' },
  addButtonContainer: { width: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  addButtonWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 64, height: 48 },
  addButton: { width: 54, height: 48, borderRadius: 12 },
  header: { position: "absolute", top: 0, left: 0, right: 0, height: 50, zIndex: 99999, elevation: 70, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingLeft: 25, paddingRight: 15, backgroundColor: "#111111" },
  profileContent: { alignItems: "center", justifyContent: "center", marginTop: 40, width: "100%", backgroundColor: "#111111", paddingVertical: 10 },
  loadingIndicator: { width: '100%', height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  loadingDot: { width: 14, height: 14, borderRadius: 7 },
  loadingDotPink: { backgroundColor: '#ff2bb5', marginRight: 4 },
  loadingDotCyan: { backgroundColor: '#20e6ff', marginLeft: 4 },
  profileTabLoadingOverlay: { ...StyleSheet.absoluteFillObject, minHeight: 500, backgroundColor: '#000', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 28, zIndex: 20 },
  inboxCircularLoaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  circularLoaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  avatarContainer: { width: 100, height: 100, position: "relative", alignSelf: "center", justifyContent: "center", alignItems: "center" },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#D85CD5" },
  avatarPlusBadge: { position: "absolute", bottom: 0, right: 10, backgroundColor: "#25F4EE", width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  profileHandleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    width: "92%",
    marginTop: 4,
  },
  profileHandleText: {
    color: "#999",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    flexShrink: 1,
  },
  usernameText: {
    fontWeight: "bold",
    marginTop: 12,
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 0
  },
  statItem: {
    alignItems: "center",
    width: "33.3333%",
    flex: 0,
    paddingHorizontal: 0
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center"
  },
  statLabel: {
    width: "100%",
    fontSize: 12,
    color: "#999",
    marginTop: 2,
    textAlign: "center",
    includeFontPadding: false
  },
  buttonGroupRow: { flexDirection: "row", width: "100%", paddingHorizontal: 30, justifyContent: "center", alignItems: "center", marginTop: 16 },
  grayButton: { backgroundColor: "#222", paddingVertical: 10, borderRadius: 8, marginHorizontal: 22, flex: 1, alignItems: "center", justifyContent: "center" },
  socialIconsRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'center', gap: 24, alignItems: 'center' },
  contentTabsBar: { flexDirection: "row", width: "100%", marginTop: 45, backgroundColor: "#101010", zIndex: 10, position: 'relative' },
  contentTabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  profileTabLine: { height: 2, backgroundColor: 'white', width: 40, position: 'absolute', bottom: 0 },
  videoGrid: { flexDirection: "row", flexWrap: "wrap", width: "100%", backgroundColor: "#000", marginTop: 1 },
  videoItem: { width: "33.33%", aspectRatio: 9/16, backgroundColor: "#1A1A1A", borderWidth: 0.5, borderColor: "#000", overflow: 'hidden' },
  videoViews: { position: "absolute", bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center' },
  viewsText: { color: "#fff", fontSize: 12, fontWeight: "600", marginLeft: 4 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  shareModalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  shareDragHandle: { width: 40, height: 4, backgroundColor: '#555', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 15 },
  shareTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingHorizontal: 20 },
  shareItem: { alignItems: 'center', width: '25%', marginBottom: 20 },
  shareIconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  shareText: { color: '#fff', fontSize: 12 },
  shareCancelBtn: { backgroundColor: '#2A2A2A', marginHorizontal: 20, padding: 15, borderRadius: 10, marginTop: 10 },
  shareCancelText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '600' },
  commentModalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentModalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 15, borderTopRightRadius: 15, height: height * 0.65, paddingBottom: Platform.OS === 'ios'? 20 : 0 },
  commentHeader: { alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  commentDragHandle: { width: 40, height: 4, backgroundColor: '#555', borderRadius: 2, marginBottom: 10 },
  commentTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  commentList: { flex: 1, paddingHorizontal: 15 },
  commentItem: { flexDirection: 'row', paddingVertical: 12, alignItems: 'flex-start' },
  commentReply: { marginLeft: 50 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  commentBody: { flex: 1 },
  commentUsername: { color: '#fff', fontSize: 13, fontWeight: '600' },
  commentTime: { color: '#777', fontWeight: 'normal' },
  authorBadge: { color: '#999', fontWeight: 'normal', fontSize: 12 },
  commentText: { color: '#fff', fontSize: 14, marginBottom: 6 },
  replyBtn: { color: '#777', fontSize: 12, fontWeight: '600' },
  commentLike: { alignItems: 'center', marginLeft: 10, paddingTop: 2 },
  likeCount: { color: '#777', fontSize: 11, marginTop: 2 },
  commentInputContainer: { borderTopWidth: 0.5, borderTopColor: '#333', paddingTop: 10, paddingBottom: Platform.OS === 'ios'? 10 : 10, paddingHorizontal: 15, backgroundColor: '#1A1A1A' },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12, paddingHorizontal: 5 },
  emoji: { fontSize: 26 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  commentInput: { flex: 1, backgroundColor: '#2A2A2A', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 100 },
  
  filterCircle: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#333', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  filterActive: {
    borderColor: '#FE2C55'
  },
  
  cameraContainer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 9999 },
  cameraTopBar: { position: "absolute", top: 52, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, zIndex: 100 },
  addSoundBtn: { backgroundColor: "#171717", borderWidth: 1, borderColor: "#242424", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 16, flexDirection: "row", alignItems: "center" },
  addSoundText: { color: "#fff", marginLeft: 8, fontWeight: "600", fontSize: 14 },
  cameraRightOptions: { position: "absolute", right: 14, top: 78, width: 58, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#242424", backgroundColor: "#050505", alignItems: "center" },
  cameraRightDivider: { display: 'none' },
  cameraOptionItem: { width: 54, alignItems: "center", marginBottom: 7, paddingVertical: 1 },
  cameraOptionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#171717", borderWidth: 1, borderColor: "#292929", alignItems: "center", justifyContent: "center" },
  cameraOptionIconActive: { backgroundColor: "#3A1527", borderColor: "#FE2C55" },
  cameraOptionText: { color: "#fff", fontSize: 10, marginTop: 3, fontWeight: "500" },
  cameraBottomBlackBand: { position: "absolute", left: 0, right: 0, bottom: 0, height: 28, backgroundColor: "#000", borderTopLeftRadius: 18, borderTopRightRadius: 18, zIndex: 1 },
  cameraBottomSection: { position: "absolute", bottom: 0, width: "100%", alignItems: "center", backgroundColor: "transparent", paddingTop: 10, paddingBottom: 18, zIndex: 10 },
  timerOptions: { flexDirection: "row", width: 206, height: 36, alignItems: "center", justifyContent: "space-around", borderWidth: 1, borderColor: "#242424", backgroundColor: "#050505", borderRadius: 18, marginBottom: 24, padding: 3, transform: [{ translateY: -12 }] },
  timerText: { color: "#999", width: 62, textAlign: "center", fontSize: 14 },
  timerTextActive: { color: "#111", fontWeight: "700", fontSize: 14 },
  timerSelected: { backgroundColor: "#fff", paddingHorizontal: 0, paddingVertical: 7, borderRadius: 16 },
  recordButtonsRow: { flexDirection: "row", width: "100%", justifyContent: "space-evenly", alignItems: "center", marginBottom: 6, transform: [{ translateY: -20 }] },
  recordButtonWrap: { transform: [{ translateY: -8 }] },
  sideBtn: { alignItems: "center" },
  sideBtnBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: "#151515", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#2D2D2D" },
  sideBtnText: { color: "#fff", marginTop: 5, fontSize: 11, fontWeight: "500" },
  recordBtn: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#090909", borderWidth: 4, borderColor: "#fff", justifyContent: "center", alignItems: "center" },
  recordBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#FF0050" },
  cameraTabs: {
  flexDirection: "row",
  justifyContent: "space-evenly",
  alignItems: "center",
  width: "100%",
  marginTop: 15,
},
  cameraTabText: { color: "#777", fontSize: 15, fontWeight: "600" },
  cameraTabActive: { color: "#fff", fontWeight: "bold" },
  cameraTabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff", alignSelf: "center", marginTop: 4 },

  bigHeartOverlay: { position: "absolute", top: "42%", left: "50%", marginLeft: -60, marginTop: -60, zIndex: 50 },
});

// ─── NEW: Styles for recording flow screens ──────────────────────────────────
const flowStyles = StyleSheet.create({
  // Cinematic bars (thin black, top and bottom)
  cinematicBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: '#000',
    zIndex: 50,
  },
  cinematicBarThin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: '#000',
    zIndex: 50,
  },

  // Focus reticle
  focusReticle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    borderRadius: 4,
    zIndex: 200,
  },

  // ── Review Screen (rv*) ────────────────────────────────────────────────────
  rvTopBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  rvTopBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rvBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 110 : 96,
    paddingHorizontal: 16,
  },
  rvThumbBox: {
    width: 170,
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  rvSideOptions: {
    flex: 1,
    paddingLeft: 20,
    paddingTop: 10,
    gap: 26,
  },
  rvOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rvOptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  rvBottomBar: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  rvDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  rvDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rvReRecordBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(60,60,60,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555',
  },
  rvReRecordInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rvNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  rvNextText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  rvGalleryThumb: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 86,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
    zIndex: 100,
  },
  rvFlipBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 86,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },

  // ── Editor Screen (ed*) ────────────────────────────────────────────────────
  edTopBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 100,
  },
  edBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  edAudioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    marginHorizontal: 10,
  },
  edAudioBannerTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  edAudioBannerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  editorTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  edDotsBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  edBottomBar: {
    position: 'absolute',
    top: 62 + width * (16 / 9) - 50,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    paddingTop: 22,
    zIndex: 100,
  },
  edToolItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  edToolIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  edToolLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  edNextCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#3897F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 2,
  },

  // ── Upload Screen ──────────────────────────────────────────────────────────
  uploadTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 32,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  // TikTok-style Post screen
  ttListCard: {
    marginHorizontal: 0,
    marginTop: 12,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#1f1f1f',
  },
  ttDescRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  ttDescInput: {
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ttTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 0,
  },
  ttTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 5,
    marginBottom: 5,
    backgroundColor: '#1c1c1e',
  },
  ttTabActive: {
    backgroundColor: '#FE2C55',
  },
  ttTabText: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '600',
  },
  ttTabTextActive: {
    color: '#fff',
  },
  ttThumb: {
    width: 80,
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  ttSelectCoverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  ttSelectCoverText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  ttRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0d0d0d',
  },
  ttRowIcon: {
    marginRight: 14,
    color: '#fff',
  },
  ttRowLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  ttRowSub: {
    color: '#999',
    fontSize: 13,
    marginRight: 4,
  },
  ttRowSubLine: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  ttDivider: {
    height: 0.5,
    backgroundColor: '#1f1f1f',
    marginLeft: 50,
  },
  ttShareIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  ttShareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttDraftsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  ttDraftsBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // More options sheet
  ttModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  ttMoreSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
  },
  ttSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#555',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  ttSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  ttSheetTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  ttSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  ttSheetRowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttSheetRowLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  ttSheetRowSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 3,
  },
  // kept for cover modal
  uploadThumbContainer: { alignItems: 'center', marginTop: 20, marginBottom: 4 },
  uploadVideoThumb: { width: width * 0.42, height: width * 0.42 * (16/9), borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' },
  uploadThumbEditLabel: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20 },
  uploadThumbText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  uploadInputWrapper: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#333', padding: 12 },
  uploadTextInput: { color: '#fff', fontSize: 15, minHeight: 70, textAlignVertical: 'top' },
  uploadCharCount: { color: '#555', fontSize: 11, textAlign: 'right', marginTop: 4 },
  uploadSection: { marginHorizontal: 16, marginTop: 20, backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 0.5, borderColor: '#333', overflow: 'hidden' },
  uploadSectionTitle: { color: '#999', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  uploadOptionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 0.5, borderTopColor: '#2A2A2A' },
  uploadOptionLabel: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 12 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#555' },
  radioCircleActive: { borderColor: '#FE2C55', backgroundColor: '#FE2C55' },
  uploadToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: '#2A2A2A' },
  uploadToggleLabel: { color: '#fff', fontSize: 15 },
  uploadBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: '#111',
    borderTopWidth: 0.5,
    borderTopColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 100,
  },
  uploadEditBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A2A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, gap: 8 },
  uploadEditText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 6 },
  uploadPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE2C55',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 6,
  },
  uploadPostText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Cover selection modal
  coverModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  coverModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  coverModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  coverSliderLabel: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  coverSliderTrack: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginHorizontal: 16,
    position: 'relative',
  },
  coverSliderThumb: {
  position: 'absolute',
  top: -9,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: '#FE2C55',
  borderWidth: 3,
  borderColor: '#fff',
},

coverSaveBtn: {
  backgroundColor: '#FE2C55',
  marginTop: 24,
  paddingVertical: 14,
  borderRadius: 30,
  alignItems: 'center',
},

coverSaveBtnText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
},

// ── Network Upload Indicator (top-left corner) ──
uploadProcessingWrap: {
  position: 'absolute',
  top: 56,
  left: 10,
  width: 100,
  zIndex: 9999,
  borderRadius: 20,
  shadowColor: '#20D5EC',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.8,
  shadowRadius: 16,
  elevation: 20,
  overflow: 'hidden',
},
uploadProcessing: {
  width: '100%',
  borderRadius: 20,
  borderWidth: 1,
  borderColor: 'rgba(32,213,236,0.5)',
  paddingVertical: 10,
  paddingHorizontal: 10,
  alignItems: 'center',
  overflow: 'hidden',
},
uploadNetBars: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  gap: 3,
  marginBottom: 8,
  height: 14,
},
uploadNetBar: {
  width: 5,
  borderRadius: 2,
},
uploadRingWrap: {
  width: 54,
  height: 54,
  borderRadius: 27,
  borderWidth: 3,
  borderColor: '#20D5EC',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 7,
  overflow: 'hidden',
},
uploadRingGlow: {
  position: 'absolute',
  width: 54,
  height: 54,
  borderRadius: 27,
  backgroundColor: '#20D5EC',
},
uploadRingInner: {
  flexDirection: 'row',
  alignItems: 'flex-end',
},
uploadPercent: {
  color: '#fff',
  fontSize: 17,
  fontWeight: '800',
  letterSpacing: -0.5,
},
uploadPercentSign: {
  color: '#20D5EC',
  fontSize: 10,
  fontWeight: '700',
  marginBottom: 2,
  marginLeft: 1,
},
uploadText: {
  color: '#bbb',
  fontSize: 9,
  fontWeight: '700',
  letterSpacing: 0.3,
  marginBottom: 8,
  textAlign: 'center',
},
uploadBarTrack: {
  width: '100%',
  height: 3,
  backgroundColor: 'rgba(255,255,255,0.12)',
  borderRadius: 2,
  overflow: 'hidden',
},
uploadBarFill: {
  height: 3,
  borderRadius: 2,
  backgroundColor: '#20D5EC',
},

});

// ── Edit-Modal StyleSheet ──────────────────────────────────────────────────
const EM_VIDEO_W = width * 0.52;
const EM_VIDEO_H = EM_VIDEO_W * (16 / 9);

const emStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Top bar
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topCancel: { color: '#fff', fontSize: 16, fontWeight: '400' },
  topDone:   { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Video preview
  videoWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  video: {
    width: EM_VIDEO_W,
    height: EM_VIDEO_H,
    borderRadius: 12,
  },

  // Playback controls row
  // Controls row: Play | Time | Undo Redo
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  // Time display — now inline inside controlsRow
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeCurrent: { color: '#fff',  fontSize: 14, fontWeight: '600' },
  timeSep:     { color: '#555',  fontSize: 14, fontWeight: '400' },
  timeTotal:   { color: '#777',  fontSize: 14, fontWeight: '400' },
  undoRedoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // Toolbar — explicit height so it never collapses when song panel is present
  toolbarScroll: { height: 84, flexShrink: 0 },
  toolbarContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  toolItem: {
    alignItems: 'center',
    marginRight: 14,
  },
  toolBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBoxSelected: {
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  toolLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 4,
  },
  toolLabelSelected: {
    fontWeight: '700',
  },
  toolAa: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Reset pill — between toolbar and track area
  resetPill: {
    alignSelf: 'center',
    backgroundColor: '#2C2C2C',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 5,
    marginBottom: 8,
  },
  resetPillText: { color: '#888', fontSize: 13, fontWeight: '500' },

  // Filmstrip + track area
  filmWrap: {
    paddingHorizontal: 12,
    marginBottom: Platform.OS === 'ios' ? 24 : 14,
  },

  // Video filmstrip — full width
  filmStrip: {
    width: '100%' as any,
    height: 54,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    marginBottom: 6,
  },
  filmFrame: {
    flex: 1,
    height: 54,
  },
  filmDim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  filmBorder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#FFD700',
  },
  filmHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 18,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmHandleLeft:  { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  filmHandleRight: { borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  filmHandlePips:  { color: '#000', fontSize: 12, fontWeight: '900' },

  // Audio/text track rows with yellow side handles
  trackAddRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#1C1C1C',
    borderRadius: 6,
    marginBottom: 6,
    overflow: 'hidden',
    height: 36,
  },
  // yellow side handles on track rows
  trackHandle: {
    width: 16,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackHandlePips: { color: '#000', fontSize: 10, fontWeight: '900' },
  // content area inside a track row
  trackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  trackAudio: {
    backgroundColor: '#E8206E',
  },
  trackText: {
    backgroundColor: '#6B4EFF',
  },
  trackAddLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 5,
    flex: 1,
  },
  trackAddWave: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Waveform bars
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveBar: {
    width: 2,
    backgroundColor: '#3897F0',
    borderRadius: 1,
    marginRight: 1.5,
    opacity: 0.9,
  },
});