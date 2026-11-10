import React, { useEffect, useRef, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import {
  View,
  Text as NativeText,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  FlatList,
  Alert,
  Modal,
  Switch,
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as NavigationBar from 'expo-navigation-bar';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSuccessToast } from '../components/SuccessToastProvider';
import { onAuthStateChanged, signOutUser } from '../lib/auth';
import { appAuth } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MASTI_VIDEO_DEFAULT_QUALITY,
  MASTI_VIDEO_QUALITY_OPTIONS,
  getMastiVideoQualityStorageKey,
  isMastiVideoQuality,
  type MastiVideoQuality,
} from '../lib/videoDelivery';
import {
  getMastiBaseMonetization,
  getMastiBaseProfile,
  requestMastiBasePayout,
} from '../lib/mastiBase';
import {
  getSupportConversation,
  getSupportIdentity,
  sendSupportChatMessage,
  submitSupportBugReport,
  type SupportChatMessage,
  type SupportIdentity,
} from '../lib/mastiSupport';
import { uploadSupportBugReportPhotoToMastiBash } from '../lib/mastiBash';
import {
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from '../lib/localStore';
import {
  LANGUAGE_OPTIONS,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  translateText,
  useAppLanguage,
} from '../lib/i18n';

const blockDocId = (blockerId: string, blockedId: string) =>
  `${encodeURIComponent(blockerId)}__${encodeURIComponent(blockedId)}`;

const getDirectorySizeBytes = (directory: Directory): number => {
  if (!directory.exists) return 0;

  return directory.list().reduce((total, entry) => {
    if (entry instanceof Directory) {
      return total + getDirectorySizeBytes(entry);
    }
    return total + (entry instanceof File ? entry.size : 0);
  }, 0);
};

const getAppCacheSizeBytes = (): number | null => {
  if (Platform.OS === 'web') return null;
  try {
    return getDirectorySizeBytes(Paths.cache);
  } catch {
    return null;
  }
};

const clearAppCacheFiles = (): number => {
  if (Platform.OS === 'web') {
    throw new Error('Device cache can only be cleared from the Masti Video mobile app.');
  }
  const cacheDirectory = Paths.cache;
  if (!cacheDirectory.exists) return 0;

  let failedDeletes = 0;
  for (const entry of cacheDirectory.list()) {
    try {
      entry.delete();
    } catch {
      failedDeletes += 1;
    }
  }

  const remainingBytes = getDirectorySizeBytes(cacheDirectory);
  if (failedDeletes > 0 || remainingBytes > 0) {
    throw new Error('Some temporary files are still in use. Close video playback or downloads and try again.');
  }
  return remainingBytes;
};

const formatCacheSize = (bytes: number | null): string => {
  if (bytes === null) return Platform.OS === 'web' ? 'Mobile app only' : 'Unavailable';
  if (bytes === 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

type BlockedAccount = {
  id: string;
  blockedId: string;
  blockedName?: string;
  blockedHandle?: string;
  blockedUsername?: string;
  blockedAvatar?: string;
};

const displayBlockedHandle = (account: BlockedAccount) => {
  const value = String(
    account.blockedHandle || account.blockedUsername || account.blockedId || '',
  ).trim();
  if (!value) return '';
  return value.startsWith('@') ? value : `@${value}`;
};

type MonetizationOptionProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  locked?: boolean;
  active?: boolean;
  inactive?: boolean;
  onPress?: () => void;
};

const MONETIZATION_CRITERIA = {
  badges: {
    kind: 'followers' as const,
    icon: 'ribbon-outline' as const,
    title: 'Badges',
    threshold: 10000,
    description: 'Earn money when your fans send you badges during live sessions.',
  },
  subscriptions: {
    kind: 'followers' as const,
    icon: 'gift-outline' as const,
    title: 'Subscriptions',
    threshold: 10000,
    description: 'Earn recurring income from fans who subscribe to your content.',
  },
  stars: {
    kind: 'followers' as const,
    icon: 'star-outline' as const,
    title: 'Stars',
    threshold: 500,
    description: 'Let your fans support you by sending Stars and gifts.',
  },
};

type MonetizationCriteria = (typeof MONETIZATION_CRITERIA)[keyof typeof MONETIZATION_CRITERIA];

const VIEWFUND_DETAILS = {
  kind: 'views' as const,
  icon: 'sparkles-outline' as const,
  title: 'View Rewards',
  description: 'Earn from eligible views on your original content.',
  descriptionHindi: 'अपने original (मूल) content पर मिलने वाले eligible views से कमाई करें।',
};

type MonetizationDetail = MonetizationCriteria | typeof VIEWFUND_DETAILS;

type MonetizationEarningRecord = {
  id: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  views: number;
  amount: number;
  currency: string;
  earnedAt: number;
  status: string;
};

function MonetizationOption({
  icon,
  title,
  description,
  locked = false,
  active = false,
  inactive = false,
  onPress,
}: MonetizationOptionProps) {
  return (
    <TouchableOpacity
      style={styles.monetizationOption}
      activeOpacity={0.72}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.monetizationOptionIconWrap}>
        <View style={styles.monetizationOptionIcon}>
          <Ionicons name={icon} size={20} color="#f4f4f4" />
        </View>
      </View>
      <View style={styles.monetizationOptionCopy}>
        <Text style={styles.monetizationOptionTitle}>{title}</Text>
        <Text style={styles.monetizationOptionDescription}>{description}</Text>
      </View>
      <View style={styles.monetizationOptionRight}>
        {active ? (
          <View style={styles.monetizationActivePill}>
            <Text style={styles.monetizationActiveText}>Active</Text>
          </View>
        ) : locked ? (
          <View style={styles.monetizationLockedStatus}>
            <Text style={styles.monetizationInactiveText}>Inactive</Text>
            <View style={styles.monetizationLock}>
              <Ionicons name="lock-closed" size={13} color="#fff" />
            </View>
          </View>
        ) : inactive ? (
          <View style={styles.monetizationInactivePill}>
            <Text style={styles.monetizationInactiveText}>Inactive</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color="#f1f1f1" />
      </View>
    </TouchableOpacity>
  );
}

function MonetizationCriteriaDetails({
  criteria,
  followerCount,
  viewfundEnabled,
  viewfundRate,
  currency,
}: {
  criteria: MonetizationDetail;
  followerCount: number;
  viewfundEnabled: boolean;
  viewfundRate: number | null;
  currency: string;
}) {
  const isViewfund = criteria.kind === 'views';
  const eligible = isViewfund ? viewfundEnabled : followerCount >= criteria.threshold;
  const requiredFollowers = !isViewfund
    ? criteria.threshold.toLocaleString('en-IN')
    : '';
  const currentFollowers = followerCount.toLocaleString('en-IN');

  return (
    <ScrollView
      style={styles.monetizationScroll}
      contentContainerStyle={styles.criteriaContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.criteriaHero}>
        <View style={[styles.criteriaIcon, eligible && styles.criteriaIconActive]}>
          <Ionicons name={criteria.icon} size={28} color="#f5f5f5" />
        </View>
        <Text style={styles.criteriaTitle}>{criteria.title}</Text>
        <Text style={styles.criteriaDescription}>{criteria.description}</Text>
        {isViewfund ? (
          <Text style={styles.criteriaDescriptionHindi}>{criteria.descriptionHindi}</Text>
        ) : null}
        <View style={[styles.criteriaStatus, eligible ? styles.criteriaStatusActive : styles.criteriaStatusInactive]}>
          {!eligible ? <Ionicons name="lock-closed" size={14} color="#c4c4c4" /> : null}
          <Text style={[styles.criteriaStatusText, eligible && styles.criteriaStatusActiveText]}>
            {eligible ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.criteriaCard}>
        <Text style={styles.criteriaCardTitle}>
          {isViewfund
            ? 'How View Rewards works / View Rewards कैसे काम करता है'
            : 'Eligibility criteria / पात्रता की शर्तें'}
        </Text>
        {isViewfund ? (
          <>
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Content type / Content का प्रकार</Text>
              <Text style={styles.criteriaRowValue}>Original content</Text>
            </View>
            <View style={styles.criteriaDivider} />
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Earning basis / कमाई का आधार</Text>
              <Text style={styles.criteriaRowValue}>Eligible views</Text>
            </View>
            <View style={styles.criteriaDivider} />
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Rate / दर</Text>
              <Text style={styles.criteriaRowValue}>
                {viewfundRate !== null
                  ? `${formatMonetizationAmount(viewfundRate, currency)} / 1,000 views`
                  : 'Set by MastiBase'}
              </Text>
            </View>
            <View style={styles.criteriaDivider} />
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Access / पहुंच</Text>
              <Text style={styles.criteriaRowValue}>Invite only</Text>
            </View>
            <View style={styles.criteriaDivider} />
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Content quality / Content की गुणवत्ता</Text>
              <Text style={styles.criteriaRowValue}>Quality videos</Text>
            </View>
            <View style={styles.criteriaDivider} />
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Posting / पोस्ट करने की नियमितता</Text>
              <Text style={styles.criteriaRowValue}>Regular videos</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Required followers</Text>
              <Text style={styles.criteriaRowValue}>{requiredFollowers}</Text>
            </View>
            <View style={styles.criteriaDivider} />
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaRowLabel}>Your followers</Text>
              <Text style={styles.criteriaRowValue}>{currentFollowers}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.criteriaInfoBox}>
        <Ionicons
          name={eligible ? 'checkmark-circle-outline' : 'information-circle-outline'}
          size={21}
          color={eligible ? '#86efac' : '#c4c4c4'}
        />
        <Text style={styles.criteriaInfoText}>
          {isViewfund
            ? eligible
               ? 'English: View Rewards is active. Earnings are calculated from eligible views on your original content.\nहिंदी: View Rewards active है। कमाई आपके original (मूल) content पर मिलने वाले eligible views के आधार पर होगी।'
               : 'English: View Rewards is currently inactive and is controlled by Masti Bash. It is invite only; quality content and regular videos may help you receive an invite.\nहिंदी: View Rewards अभी inactive है और इसे केवल Masti Bash से control किया जाता है। यह invite only है; quality content और regular videos से आपको भी invite मिल सकता है।'
            : eligible
              ? `${criteria.title} is active because you meet the follower requirement.`
              : `${criteria.title} will unlock automatically when you reach ${requiredFollowers} followers.`}
        </Text>
      </View>
    </ScrollView>
  );
}

const formatMonetizationAmount = (amount: number, currency: string) =>
  currency.toUpperCase() === 'INR'
    ? `₹${amount.toFixed(2)}`
    : `${currency} ${amount.toFixed(2)}`;

const PAYOUT_LOCK_DURATION_MS = 72 * 60 * 60 * 1000;
const payoutLockStorageKey = (uid: string) => `@masti_payout_lock_${uid}`;
const formatPayoutRemaining = (remainingMs: number) => {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

const parsePayoutTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getRemotePayoutLock = (data: Record<string, any>) => {
  const nestedData =
    data.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? data.data
      : {};
  const payoutCandidates = [
    data.pendingPayout,
    data.pendingPayoutRequest,
    data.latestPayout,
    data.lastPayout,
    data.payoutRequest,
    data.payout,
    ...(Array.isArray(data.payouts) ? data.payouts : []),
    ...(Array.isArray(data.payoutRequests) ? data.payoutRequests : []),
    nestedData.pendingPayout,
    nestedData.pendingPayoutRequest,
    nestedData.latestPayout,
    nestedData.lastPayout,
    nestedData.payoutRequest,
    nestedData.payout,
    ...(Array.isArray(nestedData.payouts) ? nestedData.payouts : []),
    ...(Array.isArray(nestedData.payoutRequests) ? nestedData.payoutRequests : []),
  ];
  const payout = payoutCandidates.find(
    (value) => value && typeof value === 'object' && !Array.isArray(value),
  ) ?? {};
  const submittedAtValue = parsePayoutTimestamp(
    payout.requestedAt ??
      payout.submittedAt ??
      payout.createdAt ??
      payout.requested_at ??
      data.payoutRequestedAt ??
      data.payoutSubmittedAt ??
      data.payout_requested_at,
  );

  const processAfterValue = parsePayoutTimestamp(
    payout.processAfter ??
      payout.holdUntil ??
      payout.process_at ??
      payout.processBy ??
      data.payoutProcessAfter ??
      data.payoutHoldUntil,
  );
  const submittedAt =
    submittedAtValue ||
    (processAfterValue
      ? Math.max(0, processAfterValue - PAYOUT_LOCK_DURATION_MS)
      : 0);
  if (!submittedAt) return null;
  const processAfter =
    processAfterValue || submittedAt + PAYOUT_LOCK_DURATION_MS;
  const amount = Number(
    payout.amount ??
      payout.requestedAmount ??
      data.payoutRequestedAmount ??
      0,
  );

  return {
    submittedAt,
    processAfter,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
  };
};

const getViewfundEnabled = (data: Record<string, any>) => {
  const viewfundFlag =
    data.viewfundEnabled ??
    data.viewFundEnabled ??
    data.viewfund?.enabled ??
    data.viewfund?.isEnabled ??
    data.viewFund?.enabled ??
    data.viewFund?.isEnabled;

  if (typeof viewfundFlag === 'boolean') return viewfundFlag;
  if (typeof viewfundFlag === 'string') {
    return ['true', '1', 'enabled', 'active'].includes(viewfundFlag.trim().toLowerCase());
  }
  if (typeof viewfundFlag === 'number') return viewfundFlag === 1;

  if (typeof data.isEnabled === 'boolean') return data.isEnabled;
  const status = String(
    data.monetizationStatus ?? data.status ?? data.appSyncStatus ?? '',
  ).trim().toLowerCase();
  return ['active', 'enabled', 'monetized_active', 'monetized-active'].includes(status);
};

const asEarningRecordArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, any>).map(([key, item]) => ({
    ...(item && typeof item === 'object' ? item : { amount: item }),
    id: item?.id ?? key,
  }));
};

const getViewRewardRecords = (data: Record<string, any>): MonetizationEarningRecord[] => {
  const nestedData =
    data.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? data.data
      : {};
  const earningSources = [
    data.viewRewards,
    data.viewRewardEarnings,
    data.viewRewardsEarnings,
    data.viewfundEarnings,
    data.viewFundEarnings,
    data.viewfund?.earnings,
    data.viewfund?.transactions,
    data.viewFund?.earnings,
    data.viewFund?.transactions,
    data.earningHistory,
    data.earningsHistory,
    data.videoEarnings,
    data.videoBreakdown,
    data.earningsByVideo,
    data.earnings,
    data.transactions,
    nestedData.viewRewards,
    nestedData.viewRewardEarnings,
    nestedData.viewfundEarnings,
    nestedData.viewFundEarnings,
    nestedData.earningHistory,
    nestedData.earningsHistory,
    nestedData.videoEarnings,
    nestedData.videoBreakdown,
    nestedData.earningsByVideo,
    nestedData.earnings,
    nestedData.transactions,
  ];

  const records = earningSources.flatMap((source) => {
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      return asEarningRecordArray(
        source.records ??
          source.items ??
          source.history ??
          source.entries ??
          source.videos ??
          source.transactions ??
          source.earnings,
      );
    }
    return asEarningRecordArray(source);
  });

  const seen = new Set<string>();
  return records
    .map((item, index) => {
      const video = item?.video ?? item?.content ?? {};
      const videoId = String(
        item?.videoId ??
          item?.contentId ??
          item?.postId ??
          video?.id ??
          '',
      ).trim();
      const earnedAt = parsePayoutTimestamp(
        item?.earnedAt ??
          item?.createdAt ??
          item?.date ??
          item?.timestamp ??
          item?.updatedAt ??
          video?.createdAt,
      );
      const amount = Number(
        item?.amount ??
          item?.earnedAmount ??
          item?.earned ??
          item?.earning ??
          item?.reward ??
          item?.payout ??
          item?.revenue ??
          0,
      );
      const views = Number(
        item?.eligibleViews ??
          item?.views ??
          item?.viewCount ??
          item?.totalViews ??
          video?.views ??
          0,
      );
      const title = String(
        item?.videoTitle ??
          item?.contentTitle ??
          item?.videoName ??
          item?.title ??
          item?.name ??
          video?.title ??
          video?.name ??
          (videoId ? `Video ${videoId.slice(0, 10)}` : `Video ${index + 1}`),
      ).trim();
      const thumbnail = String(
        item?.thumbnailUrl ??
          item?.thumbnail ??
          item?.coverImage ??
          video?.thumbnailUrl ??
          video?.thumbnail ??
          video?.coverImage ??
          '',
      ).trim();
      const status = String(
        item?.status ?? item?.state ?? item?.payoutStatus ?? 'earned',
      ).trim().toLowerCase() || 'earned';
      const id = String(item?.id ?? `${videoId}:${earnedAt}:${amount}:${index}`);
      return {
        id,
        videoId,
        title,
        thumbnail: thumbnail || undefined,
        views: Number.isFinite(views) && views >= 0 ? views : 0,
        amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
        currency: String(item?.currency ?? data.currency ?? 'INR'),
        earnedAt,
        status,
      };
    })
    .filter((record) => {
      const key = record.id || `${record.videoId}:${record.earnedAt}:${record.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.earnedAt - a.earnedAt);
};

const formatEarningDateTime = (timestamp: number) => {
  if (!timestamp) return 'Date/time not available';
  return new Date(timestamp).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function ViewRewardsDetails({
  records,
  totalEarned,
  availableBalance,
  currency,
  enabled,
}: {
  records: MonetizationEarningRecord[];
  totalEarned: number;
  availableBalance: number;
  currency: string;
  enabled: boolean;
}) {
  const totalViews = records.reduce((sum, record) => sum + record.views, 0);
  const statusLabel = (status: string) => {
    if (['paid', 'completed', 'processed'].includes(status)) return 'Paid';
    if (['pending', 'processing', 'under_review'].includes(status)) return 'Pending';
    if (['rejected', 'failed', 'cancelled', 'canceled'].includes(status)) return 'Rejected';
    return 'Earned';
  };

  return (
    <ScrollView
      style={styles.monetizationScroll}
      contentContainerStyle={styles.viewRewardsContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.viewRewardsHero}>
        <View style={[styles.viewRewardsIcon, enabled && styles.viewRewardsIconActive]}>
          <Ionicons name="sparkles-outline" size={28} color="#f5f5f5" />
        </View>
        <Text style={styles.viewRewardsTitle}>View Rewards</Text>
        <Text style={styles.viewRewardsDescription}>
          Video-wise earnings from eligible views
        </Text>
        <Text style={styles.viewRewardsDescriptionHindi}>
          हर eligible video से कितनी कमाई हुई, यहाँ देखें।
        </Text>
        <View style={[styles.criteriaStatus, enabled ? styles.criteriaStatusActive : styles.criteriaStatusInactive]}>
          {!enabled ? <Ionicons name="lock-closed" size={14} color="#c4c4c4" /> : null}
          <Text style={[styles.criteriaStatusText, enabled && styles.criteriaStatusActiveText]}>
            {enabled ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.viewRewardsSummaryCard}>
        <View style={styles.viewRewardsSummaryItem}>
          <Text style={styles.viewRewardsSummaryLabel}>Total earned</Text>
          <Text style={styles.viewRewardsSummaryAmount}>
            {formatMonetizationAmount(totalEarned, currency)}
          </Text>
        </View>
        <View style={styles.viewRewardsSummaryDivider} />
        <View style={styles.viewRewardsSummaryItem}>
          <Text style={styles.viewRewardsSummaryLabel}>Available</Text>
          <Text style={styles.viewRewardsSummaryAmount}>
            {formatMonetizationAmount(availableBalance, currency)}
          </Text>
        </View>
        <View style={styles.viewRewardsSummaryDivider} />
        <View style={styles.viewRewardsSummaryItem}>
          <Text style={styles.viewRewardsSummaryLabel}>Eligible views</Text>
          <Text style={styles.viewRewardsSummaryAmount}>{totalViews.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <View style={styles.viewRewardsSectionHeader}>
        <Text style={styles.viewRewardsSectionTitle}>Video earnings</Text>
        <Text style={styles.viewRewardsSectionCount}>{records.length} videos</Text>
      </View>

      {records.length > 0 ? (
        <View style={styles.viewRewardsRecordsCard}>
          {records.map((record, index) => (
            <View
              key={record.id}
              style={[
                styles.viewRewardsRecord,
                index < records.length - 1 && styles.viewRewardsRecordBorder,
              ]}
            >
              {record.thumbnail ? (
                <Image source={{ uri: record.thumbnail }} style={styles.viewRewardsThumbnail} />
              ) : (
                <View style={styles.viewRewardsThumbnailPlaceholder}>
                  <Ionicons name="videocam-outline" size={23} color="#bdbdbd" />
                </View>
              )}
              <View style={styles.viewRewardsRecordCopy}>
                <Text style={styles.viewRewardsRecordTitle} numberOfLines={2}>
                  {record.title}
                </Text>
                <Text style={styles.viewRewardsRecordMeta}>
                  {record.views.toLocaleString('en-IN')} eligible views
                </Text>
                <Text style={styles.viewRewardsRecordDate}>
                  {formatEarningDateTime(record.earnedAt)}
                </Text>
              </View>
              <View style={styles.viewRewardsRecordAmount}>
                <Text style={styles.viewRewardsRecordValue}>
                  {formatMonetizationAmount(record.amount, record.currency || currency)}
                </Text>
                <View style={styles.viewRewardsStatusPill}>
                  <Text style={styles.viewRewardsStatusText}>{statusLabel(record.status)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.viewRewardsEmpty}>
          <View style={styles.viewRewardsEmptyIcon}>
            <Ionicons name="videocam-outline" size={30} color="#a3a3a3" />
          </View>
          <Text style={styles.viewRewardsEmptyTitle}>No video earnings yet</Text>
          <Text style={styles.viewRewardsEmptyText}>
            जब आपके original videos पर eligible views मिलेंगे, उनकी कमाई और date/time यहाँ दिखाई देगी।
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const getFollowerCountForUser = async (email: string) => {
  const uid = appAuth.currentUser?.uid;
  if (!uid) return 0;

  try {
    const profileSnapshot = await getDoc(doc(db, 'users', uid));
    const profile = profileSnapshot.data() ?? {};
    const handle = String(profile.userId ?? profile.username ?? '').trim();

    if (handle) {
      const followersSnapshot = await getDocs(
        query(collection(db, 'follows'), where('followeeId', '==', handle)),
      );
      return followersSnapshot.docs.length;
    }

    const storedCount = Number(profile.followersCount);
    if (Number.isFinite(storedCount) && storedCount >= 0) return storedCount;
  } catch {
    // Fall through to the synced profile when local follower data is unavailable.
  }

  try {
    const profile = await getMastiBaseProfile(email);
    const remoteCount = Number(profile.followersCount);
    return Number.isFinite(remoteCount) && remoteCount >= 0 ? remoteCount : 0;
  } catch {
    return 0;
  }
};

export default function SettingsScreen() {
  const { showSuccessToast } = useSuccessToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language: selectedLang, setLanguage: setSelectedLang } = useAppLanguage();
  const modalTopInset =
    Math.max(
      insets.top,
      Platform.OS === 'android'
        ? StatusBar.currentHeight ?? 24
        : 44,
    ) + (Platform.OS === 'android' ? 24 : 12);
  const [dataUsage, setDataUsage] = useState(1); // 0 = Wi-Fi Only, 1 = Mobile Data & Wi-Fi
  const [cacheSizeBytes, setCacheSizeBytes] = useState<number | null>(null);
  const [cacheSizeLoaded, setCacheSizeLoaded] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [videoQualityModal, setVideoQualityModal] = useState(false);
  const [videoQuality, setVideoQuality] = useState<MastiVideoQuality>(
    MASTI_VIDEO_DEFAULT_QUALITY,
  );
  const [videoQualityAccountId, setVideoQualityAccountId] = useState<string | null>(
    appAuth.currentUser?.uid ?? null,
  );
  const videoQualityLoadVersionRef = useRef(0);
  const [blockedAccountsModal, setBlockedAccountsModal] = useState(false);
  const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccount[]>([]);
  const [blockedAccountsLoading, setBlockedAccountsLoading] = useState(false);
  const [blockedAccountsError, setBlockedAccountsError] = useState('');
  const [languageModal, setLanguageModal] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [supportChatVisible, setSupportChatVisible] = useState(false);
  const [supportIdentity, setSupportIdentity] = useState<SupportIdentity | null>(null);
  const [supportChatMessages, setSupportChatMessages] = useState<SupportChatMessage[]>([]);
  const [supportChatDraft, setSupportChatDraft] = useState('');
  const [supportChatLoading, setSupportChatLoading] = useState(false);
  const [supportChatSending, setSupportChatSending] = useState(false);
  const [supportChatError, setSupportChatError] = useState('');
  const [bugReportVisible, setBugReportVisible] = useState(false);
  const [bugReportDraft, setBugReportDraft] = useState('');
  const [bugReportPhoto, setBugReportPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [bugReportPhotoUrl, setBugReportPhotoUrl] = useState('');
  const [bugReportSending, setBugReportSending] = useState(false);
  const [bugReportError, setBugReportError] = useState('');
  const [bugReportTicketDelivered, setBugReportTicketDelivered] = useState(false);
  const [bugReportHistorySynced, setBugReportHistorySynced] = useState(false);
  const [communityModal, setCommunityModal] = useState(false);
  const [monetizeModal, setMonetizeModal] = useState(false);
  const [payoutScreen, setPayoutScreen] = useState(false);
  const [monetization, setMonetization] = useState({
    available: 0,
    total: 0,
    pending: 0,
    currency: 'INR',
    viewfundEnabled: false,
    viewfundRate: null as number | null,
  });
  const [monetizationLoading, setMonetizationLoading] = useState(false);
  const [monetizationRefreshing, setMonetizationRefreshing] = useState(false);
  const [monetizationError, setMonetizationError] = useState('');
  const [followerCount, setFollowerCount] = useState(0);
  const [criteriaTool, setCriteriaTool] = useState<MonetizationDetail | null>(null);
  const [viewRewardsScreen, setViewRewardsScreen] = useState(false);
  const [earningRecords, setEarningRecords] = useState<MonetizationEarningRecord[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutSubmitted, setPayoutSubmitted] = useState(false);
  const [payoutSubmittedAt, setPayoutSubmittedAt] = useState<number | null>(null);
  const [payoutProcessAfter, setPayoutProcessAfter] = useState<number | null>(null);
  const [payoutSubmittedAmount, setPayoutSubmittedAmount] = useState(0);
  const [payoutRemainingMs, setPayoutRemainingMs] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    NavigationBar.setStyle('dark');
  }, [
    aboutModal,
    accountModal,
    blockedAccountsModal,
    communityModal,
    criteriaTool,
    helpModal,
    languageModal,
    monetizeModal,
    privacyModal,
    videoQualityModal,
    viewRewardsScreen,
  ]);

  // Privacy toggles
  const [privateAccount, setPrivateAccount] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  const languages = LANGUAGE_OPTIONS;
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    setCacheSizeBytes(getAppCacheSizeBytes());
    setCacheSizeLoaded(true);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(appAuth, (user) => {
        setVideoQualityAccountId(user?.uid ?? null);
      }),
    [],
  );

  useEffect(() => {
    const loadVersion = ++videoQualityLoadVersionRef.current;
    const accountId = videoQualityAccountId;
    if (!accountId) {
      setVideoQuality(MASTI_VIDEO_DEFAULT_QUALITY);
      return;
    }

    let disposed = false;
    const storageKey = getMastiVideoQualityStorageKey(accountId);
    AsyncStorage.getItem(storageKey)
      .then(async (savedQuality) => {
        if (
          disposed ||
          loadVersion !== videoQualityLoadVersionRef.current ||
          appAuth.currentUser?.uid !== accountId
        ) {
          return;
        }
        const quality = isMastiVideoQuality(savedQuality)
          ? savedQuality
          : MASTI_VIDEO_DEFAULT_QUALITY;
        setVideoQuality(quality);
        if (!isMastiVideoQuality(savedQuality)) {
          await AsyncStorage.setItem(storageKey, quality);
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [videoQualityAccountId]);

  const saveVideoQuality = async (quality: MastiVideoQuality) => {
    const accountId = videoQualityAccountId ?? appAuth.currentUser?.uid ?? null;
    videoQualityLoadVersionRef.current += 1;
    try {
      if (accountId) {
        await AsyncStorage.setItem(
          getMastiVideoQualityStorageKey(accountId),
          quality,
        );
      }
      setVideoQuality(quality);
      setVideoQualityModal(false);
    } catch {
      Alert.alert('Could not save', 'Video quality preference could not be saved.');
    }
  };

  useEffect(() => {
    const uid = appAuth.currentUser?.uid;
    if (!uid) return;

    AsyncStorage.getItem(`@masti_settings_${uid}`)
      .then((raw) => {
        let saved: any = null;
        try {
          saved = raw ? JSON.parse(raw) : null;
        } catch {
          saved = null;
        }
        if (!saved || typeof saved !== 'object') return;
        if (typeof saved.dataUsage === 'number') setDataUsage(saved.dataUsage);
        if (typeof saved.privateAccount === 'boolean') setPrivateAccount(saved.privateAccount);
        if (typeof saved.allowComments === 'boolean') setAllowComments(saved.allowComments);
        if (typeof saved.showActivity === 'boolean') setShowActivity(saved.showActivity);
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (!supportChatVisible || !supportIdentity) return;
    let disposed = false;
    let firstLoad = true;

    const refreshSupportMessages = async () => {
      try {
        const messages = await getSupportConversation(supportIdentity);
        if (!disposed) {
          setSupportChatMessages(current => {
            const localOnly = current.filter(message => message.id.startsWith('local_'));
            const unseenLocal = localOnly.filter(localMessage =>
              !messages.some(remoteMessage =>
                remoteMessage.isMine === localMessage.isMine &&
                remoteMessage.senderId === localMessage.senderId &&
                remoteMessage.text === localMessage.text &&
                Math.abs(
                  (Date.parse(remoteMessage.createdAt) || 0) -
                  (Date.parse(localMessage.createdAt) || 0),
                ) < 60000,
              ),
            );
            return [...messages, ...unseenLocal].sort(
              (a, b) =>
                (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
            );
          });
          setSupportChatError('');
        }
      } catch (error: any) {
        if (!disposed) {
          setSupportChatError(
            error?.message || 'Could not load messages from MastiBase.',
          );
        }
      } finally {
        if (!disposed && firstLoad) {
          setSupportChatLoading(false);
          firstLoad = false;
        }
      }
    };

    void refreshSupportMessages();
    const interval = setInterval(() => void refreshSupportMessages(), 5000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [supportChatVisible, supportIdentity]);

  useEffect(() => {
    const uid = appAuth.currentUser?.uid;
    if (!uid || !settingsLoaded) return;

    AsyncStorage.setItem(`@masti_settings_${uid}`, JSON.stringify({
      dataUsage,
      privateAccount,
      allowComments,
      showActivity,
    })).catch(() => {});
  }, [dataUsage, privateAccount, allowComments, showActivity, settingsLoaded]);

  const loadBlockedAccounts = async () => {
    const uid = appAuth.currentUser?.uid;
    if (!uid) {
      setBlockedAccounts([]);
      setBlockedAccountsError('Block list dekhne ke liye pehle login karein.');
      return;
    }

    setBlockedAccountsLoading(true);
    setBlockedAccountsError('');
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'userBlocks'),
          where('blockerId', '==', uid),
          orderBy('createdAt', 'desc'),
        ),
      );
      const accounts = snapshot.docs.reduce<BlockedAccount[]>((result, item) => {
        const data = item.data() as Record<string, any>;
        const blockedId = String(data.blockedId || '').trim();
        if (!blockedId) return result;
        result.push({
          id: item.id,
          blockedId,
          blockedName: typeof data.blockedName === 'string' ? data.blockedName : '',
          blockedHandle: typeof data.blockedHandle === 'string' ? data.blockedHandle : '',
          blockedUsername: typeof data.blockedUsername === 'string' ? data.blockedUsername : '',
          blockedAvatar: typeof data.blockedAvatar === 'string' ? data.blockedAvatar : '',
        });
        return result;
      }, []);
      setBlockedAccounts(accounts);
    } catch (error: any) {
      setBlockedAccountsError(
        error?.message || 'Blocked accounts load nahi ho sake. Dobara try karein.',
      );
    } finally {
      setBlockedAccountsLoading(false);
    }
  };

  const confirmUnblockAccount = (account: BlockedAccount) => {
    const title = account.blockedName || displayBlockedHandle(account) || 'this account';
    Alert.alert(
      'Unblock account?',
      `${title} ko unblock karne ke baad aap unki profile aur videos dobara dekh sakenge.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            const uid = appAuth.currentUser?.uid;
            if (!uid) return;
            try {
              await deleteDoc(doc(db, 'userBlocks', blockDocId(uid, account.blockedId)));
              setBlockedAccounts((previous) =>
                previous.filter((item) => item.blockedId !== account.blockedId),
              );
            } catch {
              Alert.alert('Error', 'Account unblock nahi ho saka. Dobara try karein.');
            }
          },
        },
      ],
    );
  };

  const loadMonetization = async (showLoadingState = true) => {
    const email = appAuth.currentUser?.email?.trim().toLowerCase();
    if (!email) {
      setMonetizationError('Please sign in with an email account first.');
      return;
    }

    // Initial open gets a centered loading state. Pull-to-refresh keeps the
    // existing content visible so the native RefreshControl is the only
    // spinner shown during the gesture.
    setMonetizationLoading(showLoadingState);
    setMonetizationError('');
    try {
      const [response, currentFollowerCount] = await Promise.all([
        getMastiBaseMonetization(email) as Promise<any>,
        getFollowerCountForUser(email),
      ]);
      setFollowerCount(currentFollowerCount);
      const data = response?.data ?? response ?? {};
      setEarningRecords(getViewRewardRecords(data));
      const remotePayoutLock = getRemotePayoutLock(data);
      if (remotePayoutLock && remotePayoutLock.processAfter > Date.now()) {
        const remaining = remotePayoutLock.processAfter - Date.now();
        setPayoutSubmittedAmount(remotePayoutLock.amount);
        setPayoutSubmittedAt(remotePayoutLock.submittedAt);
        setPayoutProcessAfter(remotePayoutLock.processAfter);
        setPayoutRemainingMs(remaining);
        setPayoutSubmitted(true);
        if (appAuth.currentUser?.uid) {
          AsyncStorage.setItem(
            payoutLockStorageKey(appAuth.currentUser.uid),
            JSON.stringify({
              submittedAt: remotePayoutLock.submittedAt,
              amount: remotePayoutLock.amount,
              processAfter: remotePayoutLock.processAfter,
            }),
          ).catch(() => {});
        }
      }
      const savedUpiId = String(
        data.bankDetails?.upiId ?? data.upiId ?? '',
      ).trim();
      if (savedUpiId) {
        setUpiId(savedUpiId);
      }
      const savedBankDetails = data.bankDetails ?? data.bankAccount ?? {};
      const savedAccountHolder = String(
        savedBankDetails.accountHolderName ??
          savedBankDetails.accountName ??
          savedBankDetails.holderName ??
          data.accountHolderName ??
          '',
      ).trim();
      const savedBankName = String(
        savedBankDetails.bankName ??
          savedBankDetails.bank ??
          data.bankName ??
          '',
      ).trim();
      const savedAccountNumber = String(
        savedBankDetails.accountNumber ??
          savedBankDetails.bankAccountNumber ??
          data.accountNumber ??
          '',
      ).trim();
      const savedIfscCode = String(
        savedBankDetails.ifscCode ??
          savedBankDetails.ifsc ??
          data.ifscCode ??
          '',
      ).trim().toUpperCase();
      if (savedAccountHolder) setAccountHolderName(savedAccountHolder);
      if (savedBankName) setBankName(savedBankName);
      if (savedAccountNumber) setAccountNumber(savedAccountNumber);
      if (savedIfscCode) setIfscCode(savedIfscCode);
      if (String(data.payoutMethod ?? savedBankDetails.method ?? '').toLowerCase() === 'bank') {
        setPayoutMethod('bank');
      }
      const rawViewfundRate =
        data.rpm ??
        data.ratePerThousandViews ??
        data.viewfund?.rpm ??
        data.viewFund?.rpm;
      const parsedViewfundRate = Number(rawViewfundRate);
      setMonetization({
        available: Number(
          data.availableBalance ??
            data.available ??
            data.balance ??
            data.walletBalance ??
            data.earnings ??
            0,
        ) || 0,
        total: Number(
          data.totalEarned ??
            data.totalEarnings ??
            data.total ??
            data.lifetimeEarnings ??
            0,
        ) || 0,
        pending: Number(data.pendingBalance ?? data.pending ?? 0) || 0,
        currency: String(data.currency ?? 'INR'),
        viewfundEnabled: getViewfundEnabled(data),
        viewfundRate:
          Number.isFinite(parsedViewfundRate) && parsedViewfundRate >= 0
            ? parsedViewfundRate
            : null,
      });
    } catch (error: any) {
      setMonetizationError(
        error?.message || 'Could not load monetization details from MastiBase.',
      );
    } finally {
      setMonetizationLoading(false);
    }
  };

  const refreshMonetization = async () => {
    setMonetizationRefreshing(true);
    try {
      // Pull refresh keeps the native indicator only. The content area is
      // blank during the request and is filled again with fresh data after it
      // completes.
      await loadMonetization(false);
    } finally {
      setMonetizationRefreshing(false);
    }
  };

  const restorePayoutLock = async () => {
    const uid = appAuth.currentUser?.uid;
    if (!uid) {
      setPayoutSubmitted(false);
      setPayoutSubmittedAt(null);
      setPayoutProcessAfter(null);
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(payoutLockStorageKey(uid));
      if (!raw) {
        setPayoutSubmitted(false);
        setPayoutSubmittedAt(null);
        setPayoutProcessAfter(null);
        return;
      }

      const saved = JSON.parse(raw);
      const submittedAt = Number(saved?.submittedAt);
      const amount = Number(saved?.amount);
      const processAfter =
        Number(saved?.processAfter) ||
        submittedAt + PAYOUT_LOCK_DURATION_MS;
      const remaining = processAfter - Date.now();
      if (!Number.isFinite(submittedAt) || remaining <= 0) {
        await AsyncStorage.removeItem(payoutLockStorageKey(uid));
        setPayoutSubmitted(false);
        setPayoutSubmittedAt(null);
        setPayoutProcessAfter(null);
        setPayoutRemainingMs(0);
        return;
      }

      setPayoutSubmittedAmount(Number.isFinite(amount) && amount > 0 ? amount : 0);
      setPayoutSubmittedAt(submittedAt);
      setPayoutProcessAfter(processAfter);
      setPayoutRemainingMs(remaining);
      setPayoutSubmitted(true);
    } catch {
      setPayoutSubmitted(false);
      setPayoutSubmittedAt(null);
      setPayoutProcessAfter(null);
    }
  };

  useEffect(() => {
    if (!monetizeModal || !payoutScreen) return;
    void restorePayoutLock();
  }, [monetizeModal, payoutScreen]);

  useEffect(() => {
    if (!payoutSubmittedAt) return;

    const updateRemaining = () => {
      const lockUntil =
        payoutProcessAfter ?? payoutSubmittedAt + PAYOUT_LOCK_DURATION_MS;
      const remaining = lockUntil - Date.now();
      if (remaining <= 0) {
        const uid = appAuth.currentUser?.uid;
        if (uid) {
          AsyncStorage.removeItem(payoutLockStorageKey(uid)).catch(() => {});
        }
        setPayoutSubmitted(false);
        setPayoutSubmittedAt(null);
        setPayoutProcessAfter(null);
        setPayoutRemainingMs(0);
        return;
      }
      setPayoutRemainingMs(remaining);
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [payoutSubmittedAt, payoutProcessAfter]);

  const submitPayout = async () => {
    const email = appAuth.currentUser?.email?.trim().toLowerCase();
    const uid = appAuth.currentUser?.uid;

    const amount = Number(payoutAmount);
    if (!email) {
      Alert.alert('Sign in required', 'Please sign in before requesting a payout.');
      return;
    }

    // Keep the 72-hour cooldown enforced even if the payout screen is reopened
    // before the async restore effect has finished.
    if (uid) {
      try {
        const rawLock = await AsyncStorage.getItem(payoutLockStorageKey(uid));
        if (rawLock) {
          const savedLock = JSON.parse(rawLock);
          const savedSubmittedAt = Number(savedLock?.submittedAt);
          const savedAmount = Number(savedLock?.amount);
          const savedProcessAfter =
            Number(savedLock?.processAfter) ||
            savedSubmittedAt + PAYOUT_LOCK_DURATION_MS;
          const remaining = savedProcessAfter - Date.now();

          if (Number.isFinite(savedSubmittedAt) && remaining > 0) {
            setPayoutSubmittedAmount(
              Number.isFinite(savedAmount) && savedAmount > 0 ? savedAmount : 0,
            );
            setPayoutSubmittedAt(savedSubmittedAt);
            setPayoutProcessAfter(savedProcessAfter);
            setPayoutRemainingMs(remaining);
            setPayoutSubmitted(true);
            return;
          }

          await AsyncStorage.removeItem(payoutLockStorageKey(uid));
        }
      } catch {
        // The normal form validation and API request below remain available if
        // a malformed local lock cannot be read.
      }
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid payout amount.');
      return;
    }
    if (amount > monetization.available) {
      Alert.alert(
        'Insufficient balance',
        `You can request up to ${formatMonetizationAmount(monetization.available, monetization.currency)}.`,
      );
      return;
    }
    const trimmedUpiId = upiId.trim().toLowerCase();
    const trimmedHolderName = accountHolderName.trim();
    const trimmedAccountNumber = accountNumber.replace(/\s/g, '');
    const trimmedIfscCode = ifscCode.trim().toUpperCase();
    if (payoutMethod === 'upi' && (!trimmedUpiId || !/^[\w.-]{2,}@[a-z0-9.-]{2,}$/i.test(trimmedUpiId))) {
      Alert.alert('Invalid UPI ID', 'Enter a valid UPI ID, for example name@bank.');
      return;
    }
    if (payoutMethod === 'bank') {
      if (bankName.trim().length < 2) {
        Alert.alert('Bank name required', 'Enter the name of your bank.');
        return;
      }
      if (trimmedHolderName.length < 2) {
        Alert.alert('Account holder required', 'Enter the bank account holder name.');
        return;
      }
      if (!/^\d{9,18}$/.test(trimmedAccountNumber)) {
        Alert.alert('Invalid account number', 'Enter a valid 9–18 digit bank account number.');
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmedIfscCode)) {
        Alert.alert('Invalid IFSC code', 'Enter a valid 11-character IFSC code, for example SBIN0001234.');
        return;
      }
    }
    setPayoutSubmitting(true);
    const submittedAt = Date.now();
    const processAfter = new Date(
      submittedAt + PAYOUT_LOCK_DURATION_MS,
    ).toISOString();
    const bankDetails =
      payoutMethod === 'bank'
        ? {
            bankName: bankName.trim(),
            accountHolderName: trimmedHolderName,
            accountNumber: trimmedAccountNumber,
            ifscCode: trimmedIfscCode,
          }
        : undefined;
    try {
      let accountProfile: Record<string, any> = {};
      if (uid) {
        try {
          const profileSnapshot = await getDoc(doc(db, 'users', uid));
          accountProfile = profileSnapshot.data() ?? {};
        } catch {
          // Email and Firebase UID still identify the signed-in account.
        }
      }
      const profileUsername = String(
        accountProfile.userId ?? accountProfile.username ?? '',
      ).trim().replace(/^@+/, '');
      const profileName = String(
        accountProfile.name ??
          accountProfile.displayName ??
          appAuth.currentUser?.displayName ??
          '',
      ).trim();
      const mastiBaseProfileId = String(
        accountProfile.mastiBaseUserId ?? accountProfile.mastiBaseId ?? '',
      ).trim();

      const payoutResponse = await requestMastiBasePayout({
        // MastiBase withdrawal requests are keyed by the signed-in email.
        // Do not substitute the internal MastiBase profile ID here.
        userId: email,
        email,
        userEmail: email,
        firebaseUid: uid,
        mastiBaseUserId: mastiBaseProfileId || undefined,
        name: profileName || undefined,
        userName: profileUsername ? `@${profileUsername}` : undefined,
        username: profileUsername || undefined,
        amount,
        method: payoutMethod,
        accountInfo:
          payoutMethod === 'upi'
            ? trimmedUpiId
            : JSON.stringify(bankDetails),
        upiId: payoutMethod === 'upi' ? trimmedUpiId : undefined,
        bankDetails,
        requestedAt: new Date(submittedAt).toISOString(),
        processAfter,
        holdUntil: processAfter,
        status: 'pending',
        holdHours: 72,
      });
      const payoutResponseRecord =
        payoutResponse && typeof payoutResponse === 'object'
          ? payoutResponse as Record<string, any>
          : {};
      const confirmedPayout = getRemotePayoutLock(payoutResponseRecord);
      const confirmedSubmittedAt = confirmedPayout?.submittedAt ?? submittedAt;
      const confirmedProcessAfter =
        confirmedPayout?.processAfter ?? confirmedSubmittedAt + PAYOUT_LOCK_DURATION_MS;
      setPayoutAmount('');
      setMonetization((previous) => ({
        ...previous,
        available: Math.max(0, previous.available - amount),
        pending: previous.pending + amount,
      }));
      if (uid) {
        try {
          await AsyncStorage.setItem(
            payoutLockStorageKey(uid),
            JSON.stringify({
              submittedAt: confirmedSubmittedAt,
              amount,
              method: payoutMethod,
              processAfter: confirmedProcessAfter,
            }),
          );
        } catch {
          // The MastiBase payout record remains the source of truth if local storage fails.
        }
      }
      setPayoutSubmittedAmount(confirmedPayout?.amount || amount);
      setPayoutSubmittedAt(confirmedSubmittedAt);
      setPayoutProcessAfter(confirmedProcessAfter);
      setPayoutRemainingMs(Math.max(0, confirmedProcessAfter - Date.now()));
      setPayoutSubmitted(true);
    } catch (error: any) {
      Alert.alert(
        'Payout failed',
        error?.message || 'MastiBase could not process the payout request.',
      );
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleLogOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          const result = await signOutUser();
          if (!result.success) {
            Alert.alert('Log Out Failed', result.error || 'Please try again.');
            return;
          }
          // The home screen's auth listener opens the Login sheet after this
          // route change because the signed-out state is global.
          router.replace('/');
        },
      },
    ]);
  };

  const handleClearCache = () => {
    if (isClearingCache || Platform.OS === 'web') return;

    const currentSize = cacheSizeBytes ?? getAppCacheSizeBytes();
    Alert.alert(
      'Clear Cache',
      `Clear ${formatCacheSize(currentSize)} of temporary app cache? Temporary downloads and unsaved draft video files stored in cache will be removed. Posted videos and profile data will remain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearingCache(true);
            await new Promise((resolve) => setTimeout(resolve, 30));
            try {
              const remainingBytes = clearAppCacheFiles();
              setCacheSizeBytes(remainingBytes);
              showSuccessToast('Cache cleared successfully. 0 MB remaining.');
            } catch (error) {
              setCacheSizeBytes(getAppCacheSizeBytes());
              Alert.alert(
                'Cache could not be fully cleared',
                error instanceof Error
                  ? error.message
                  : 'Some temporary files could not be removed. Please try again.',
              );
            } finally {
              setIsClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            showSuccessToast('Your account has been permanently deleted.'),
        },
      ]
    );
  };

  const openSupportChat = async () => {
    setHelpModal(false);
    setSupportChatVisible(true);
    setSupportChatLoading(true);
    setSupportChatError('');
    setSupportChatMessages([]);
    try {
      const identity = await getSupportIdentity();
      setSupportIdentity(identity);
    } catch (error: any) {
      setSupportIdentity(null);
      setSupportChatLoading(false);
      setSupportChatError(error?.message || 'Sign in to contact Support.');
    }
  };

  const openBugReport = async () => {
    setHelpModal(false);
    setBugReportVisible(true);
    setBugReportError('');
    try {
      setSupportIdentity(await getSupportIdentity());
    } catch (error: any) {
      setSupportIdentity(null);
      setBugReportError(error?.message || 'Sign in to report a bug.');
    }
  };

  const handleSendSupportChatMessage = async () => {
    const text = supportChatDraft.trim();
    if (!text || supportChatSending) return;

    setSupportChatSending(true);
    try {
      const identity = supportIdentity || await getSupportIdentity();
      if (!supportIdentity) setSupportIdentity(identity);
      const result = await sendSupportChatMessage(identity, text);
      const localMessage: SupportChatMessage = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        senderId: identity.senderId,
        senderName: identity.senderName,
        text,
        createdAt: new Date().toISOString(),
        isMine: true,
      };
      setSupportChatDraft('');
      setSupportChatError('');

      if (result.historySynced) {
        try {
          const messages = await getSupportConversation(identity);
          const mirrored = messages.some(message =>
            message.isMine &&
            message.senderId === identity.senderId &&
            message.text === text,
          );
          setSupportChatMessages(mirrored ? messages : [...messages, localMessage]);
        } catch {
          setSupportChatMessages(current => [...current, localMessage]);
        }
      } else {
        setSupportChatMessages(current => [...current, localMessage]);
        Alert.alert(
          'Message sent',
          'MastiBase Support received your message, but your chat copy could not be synced.',
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Message not sent',
        error?.message || 'Could not send your message to MastiBase Support.',
      );
    } finally {
      setSupportChatSending(false);
    }
  };

  const handleSubmitBugReport = async () => {
    const description = bugReportDraft.trim();
    if (!description || bugReportSending) return;

    setBugReportSending(true);
    setBugReportError('');
    try {
      const identity = await getSupportIdentity();
      let attachedPhotoUrl = bugReportPhotoUrl;
      if (bugReportPhoto && !attachedPhotoUrl) {
        const email = appAuth.currentUser?.email?.trim().toLowerCase();
        if (!email) {
          throw new Error('Add an email address to your account before attaching a photo.');
        }
        const uploaded = await uploadSupportBugReportPhotoToMastiBash(
          bugReportPhoto.uri,
          email,
          bugReportPhoto.mimeType,
        );
        attachedPhotoUrl = uploaded.secure_url.trim();
        if (!attachedPhotoUrl) {
          throw new Error('The photo upload did not return an attachment link. Please try again.');
        }
        setBugReportPhotoUrl(attachedPhotoUrl);
      }
      const report = attachedPhotoUrl
        ? `${description}\n\nPhoto attachment: ${attachedPhotoUrl}`
        : description;
      const result = await submitSupportBugReport(identity, report, {
        ticketAlreadyDelivered: bugReportTicketDelivered,
        historyAlreadySynced: bugReportHistorySynced,
      });
      setBugReportTicketDelivered(result.ticketDelivered);
      setBugReportHistorySynced(result.historySynced);
      if (!result.directChatSynced) {
        setBugReportError(
          'The Help & Support ticket was sent, but Direct Chat delivery failed. Tap "Retry Direct Chat" to retry without creating another ticket.',
        );
        return;
      }

      setBugReportDraft('');
      setBugReportPhoto(null);
      setBugReportPhotoUrl('');
      setBugReportTicketDelivered(false);
      setBugReportHistorySynced(false);
      setBugReportVisible(false);
      const historyMessage = result.historySynced
        ? ''
        : ' Your Masti Video Inbox copy could not be synced.';
      Alert.alert(
        'Report sent',
        `MastiBase Help & Support and Direct Chat received your report.${historyMessage}${attachedPhotoUrl ? ' The photo was attached.' : ''}`,
      );
    } catch (error: any) {
      const message =
        error?.message || 'Could not send your bug report to MastiBase Support.';
      setBugReportError(message);
      Alert.alert('Report not sent', message);
    } finally {
      setBugReportSending(false);
    }
  };

  const handlePickBugReportPhoto = async () => {
    if (bugReportSending) return;
    setBugReportError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setBugReportPhoto(result.assets[0]);
        setBugReportPhotoUrl('');
        setBugReportTicketDelivered(false);
        setBugReportHistorySynced(false);
      }
    } catch (error) {
      setBugReportError(
        error instanceof Error ? error.message : 'Could not open your photo library.',
      );
    }
  };

  const starsEligible = followerCount >= 500;
  const subscriptionsEligible = followerCount >= 10000;
  const badgesEligible = followerCount >= 10000;

  const settingsItems = [
    {
      id: 'privacy',
      icon: 'shield-checkmark' as const,
      iconBg: '#2563eb',
      label: 'Privacy',
      subtitle: 'Manage your privacy settings',
      onPress: () => setPrivacyModal(true),
    },
    {
      id: 'videoQuality',
      icon: 'videocam-outline' as const,
      iconBg: '#7c3aed',
      label: 'Video Quality',
      subtitle: 'Choose quality for videos with available renditions',
      rightText: videoQuality === 'auto' ? 'Auto' : videoQuality,
      onPress: () => setVideoQualityModal(true),
    },
    {
      id: 'blockedAccounts',
      icon: 'ban-outline' as const,
      iconBg: '#991b1b',
      label: 'Blocked Accounts',
      subtitle: 'See and manage people you\'ve blocked',
      onPress: () => {
        setBlockedAccountsModal(true);
        void loadBlockedAccounts();
      },
    },
    {
      id: 'language',
      icon: 'globe' as const,
      iconBg: '#dc2626',
      label: 'Language',
      subtitle: 'Choose your preferred language',
      onPress: () => setLanguageModal(true),
    },
    {
      id: 'account',
      icon: 'person-circle' as const,
      iconBg: '#059669',
      label: 'Account Management',
      subtitle: 'Manage account, security & details',
      onPress: () => setAccountModal(true),
    },
    {
      id: 'monetize',
      icon: 'cash-outline' as const,
      iconBg: '#d97706',
      label: 'Monetize',
      subtitle: 'View earnings and request UPI or bank payouts',
      onPress: () => {
        setMonetizeModal(true);
        loadMonetization();
      },
    },
    {
      id: 'help',
      icon: 'headset' as const,
      iconBg: '#ea580c',
      label: 'Help & Support',
      subtitle: 'Get help and support',
      onPress: () => setHelpModal(true),
    },
    {
      id: 'community',
      icon: 'people' as const,
      iconBg: '#7c3aed',
      label: 'Community',
      subtitle: 'Join our community',
      onPress: () => setCommunityModal(true),
    },
    {
      id: 'cache',
      icon: 'trash' as const,
      iconBg: '#0d9488',
      label: 'Clear Cache',
      subtitle: 'Free up storage space',
      rightText: isClearingCache
        ? 'Clearing…'
        : cacheSizeLoaded
          ? formatCacheSize(cacheSizeBytes)
          : 'Calculating…',
      onPress: handleClearCache,
    },
    {
      id: 'about',
      icon: 'information-circle' as const,
      iconBg: '#7c3aed',
      label: 'About Us',
      subtitle: 'App info and legal details',
      onPress: () => setAboutModal(true),
    },
    {
      id: 'delete',
      icon: 'person-remove' as const,
      iconBg: '#dc2626',
      label: 'Delete Account',
      subtitle: 'Permanently delete your account',
      onPress: handleDeleteAccount,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Data Usage Card ── */}
        <View style={styles.card}>
          <View style={styles.dataUsageHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dataUsageTitle}>Data Usage</Text>
              <Text style={styles.dataUsageSub}>
                Choose how to use data for videos
              </Text>
            </View>
            <View style={styles.dataUsageIconBox}>
              <Ionicons name="swap-vertical" size={22} color="#a855f7" />
            </View>
          </View>

          {/* Wi-Fi Only */}
          <TouchableOpacity
            style={styles.dataOption}
            activeOpacity={0.7}
            onPress={() => setDataUsage(0)}
          >
            <View style={[styles.dataOptionIcon, { backgroundColor: '#2563eb' }]}>
              <Ionicons name="wifi" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dataOptionLabel}>Wi-Fi Only</Text>
              <Text style={styles.dataOptionSub}>Use Wi-Fi for better experience</Text>
            </View>
            <View style={[styles.radio, dataUsage === 0 && styles.radioSelected]}>
              {dataUsage === 0 && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Mobile Data & Wi-Fi */}
          <TouchableOpacity
            style={styles.dataOption}
            activeOpacity={0.7}
            onPress={() => setDataUsage(1)}
          >
            <View style={[styles.dataOptionIcon, { backgroundColor: '#312e81' }]}>
              <Ionicons name="cellular" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dataOptionLabel}>Mobile Data &amp; Wi-Fi</Text>
              <Text style={styles.dataOptionSub}>
                Use mobile data when Wi-Fi is not available
              </Text>
            </View>
            <View style={[styles.radio, dataUsage === 1 && styles.radioSelected]}>
              {dataUsage === 1 && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── General Section ── */}
        <Text style={styles.sectionLabel}>General</Text>

        <View style={styles.listCard}>
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.listItem,
                index < settingsItems.length - 1 && styles.listItemBorder,
              ]}
              activeOpacity={0.6}
              disabled={item.id === 'cache' && (isClearingCache || Platform.OS === 'web')}
              onPress={item.onPress}
            >
              <View style={[styles.listIconBox, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listLabel}>{item.label}</Text>
                <Text style={styles.listSub}>{item.subtitle}</Text>
              </View>
              {item.rightText ? (
                <Text style={styles.rightText}>{item.rightText}</Text>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Log Out Button ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Monetize Modal ── */}
      <Modal
        visible={monetizeModal}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => {
          setPayoutScreen(false);
          setMonetizeModal(false);
        }}
      >
        <View style={styles.monetizationScreen}>
          <View
            style={[
              styles.monetizationHeader,
              { paddingTop: modalTopInset },
            ]}
          >
            <Pressable
              onPress={() => {
                if (payoutSubmitted) {
                  setPayoutSubmitted(false);
                  setPayoutScreen(false);
                } else if (payoutScreen) {
                  setPayoutScreen(false);
                } else {
                  setMonetizeModal(false);
                }
              }}
              style={styles.monetizationHeaderButton}
              hitSlop={10}
              accessibilityLabel={
                payoutSubmitted || payoutScreen ? 'Back to monetization' : 'Close monetization'
              }
            >
              <Ionicons name="chevron-back" size={28} color="#f5f5f5" />
            </Pressable>
            <Text style={styles.monetizationHeaderTitle}>
              {payoutSubmitted ? 'Payout Submitted' : payoutScreen ? 'Payouts' : 'Monetization'}
            </Text>
            <Pressable
              onPress={() => Alert.alert(
                'Monetization',
                'Earn through badges, subscriptions and Stars. Your available earnings can be requested through UPI or a bank account.',
              )}
              style={styles.monetizationHeaderButton}
              hitSlop={10}
              accessibilityLabel="About monetization"
            >
              <Ionicons name="information-circle-outline" size={27} color="#f5f5f5" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.monetizationScroll}
            contentContainerStyle={[
              styles.monetizationContent,
              (monetizationRefreshing || monetizationLoading || !!monetizationError) &&
                styles.monetizationStateContent,
              {
                paddingBottom: monetizationRefreshing || monetizationLoading || !!monetizationError
                  ? 0
                  : Math.max(insets.bottom + 32, 56),
              },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={monetizationRefreshing}
                onRefresh={refreshMonetization}
                tintColor="#ffffff"
                colors={['#ffffff']}
                progressBackgroundColor="#1c1c1e"
              />
            }
          >
            {monetizationRefreshing ? (
              <View style={styles.monetizationState} />
            ) : monetizationLoading ? (
              <View style={styles.monetizationState}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.monetizationMessage}>Loading earnings…</Text>
              </View>
            ) : monetizationError ? (
              <View style={styles.monetizationState}>
                <Ionicons name="alert-circle-outline" size={34} color="#fca5a5" />
                <Text style={styles.monetizationError}>{monetizationError}</Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => { void loadMonetization(); }}>
                  <Text style={styles.secondaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : payoutSubmitted ? (
              <View style={styles.payoutSubmittedContent}>
                <View style={styles.payoutSuccessIcon}>
                  <Ionicons name="checkmark" size={82} color="#43f27b" />
                </View>
                <Text style={styles.payoutSuccessTitle}>Payout Submitted</Text>
                <Text style={styles.payoutSuccessDescription}>
                  Your payout request has been submitted successfully.
                </Text>
                {payoutSubmittedAmount > 0 ? (
                  <Text style={styles.payoutSuccessAmount}>
                    {formatMonetizationAmount(payoutSubmittedAmount, monetization.currency)} requested
                  </Text>
                ) : null}
                <View style={styles.payoutWaitCard}>
                  <Ionicons name="time-outline" size={38} color="#43f27b" />
                  <View>
                    <Text style={styles.payoutWaitLabel}>Please wait up to</Text>
                    <Text style={styles.payoutWaitAmount}>72 hours</Text>
                    <Text style={styles.payoutCountdown}>
                      Time remaining: {formatPayoutRemaining(payoutRemainingMs)}
                    </Text>
                  </View>
                </View>
                <View style={styles.payoutInfoCard}>
                  <Ionicons name="information-circle-outline" size={28} color="#f1f1f1" />
                  <Text style={styles.payoutInfoText}>
                    MastiBase verification complete hone ke baad aapka payout 72 hours ke andar process kiya jayega.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.payoutBackButton}
                  onPress={() => {
                    setPayoutSubmitted(false);
                    setPayoutScreen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.payoutBackButtonText}>Back to Payouts</Text>
                </TouchableOpacity>
              </View>
            ) : payoutScreen ? (
              <>
                <Text style={styles.payoutScreenIntro}>
                  Request your available earnings directly to your UPI ID or bank account.
                </Text>
                <View style={styles.payoutBalanceCard}>
                  <Text style={styles.payoutBalanceLabel}>Available balance</Text>
                  <Text style={styles.payoutBalanceAmount}>
                    {formatMonetizationAmount(monetization.available, monetization.currency)}
                  </Text>
                </View>
                <Text style={styles.fieldLabel}>Payout amount</Text>
                <TextInput
                  value={payoutAmount}
                  onChangeText={setPayoutAmount}
                  placeholder="Enter amount"
                  placeholderTextColor="#777"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Receive payout via</Text>
                <View style={styles.payoutMethodRow}>
                  <TouchableOpacity
                    style={[
                      styles.payoutMethodButton,
                      payoutMethod === 'upi' && styles.payoutMethodButtonActive,
                    ]}
                    onPress={() => setPayoutMethod('upi')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={18}
                      color={payoutMethod === 'upi' ? '#000' : '#ddd'}
                    />
                    <Text
                      style={[
                        styles.payoutMethodButtonText,
                        payoutMethod === 'upi' && styles.payoutMethodButtonTextActive,
                      ]}
                    >
                      UPI / PhonePe
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.payoutMethodButton,
                      payoutMethod === 'bank' && styles.payoutMethodButtonActive,
                    ]}
                    onPress={() => setPayoutMethod('bank')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={payoutMethod === 'bank' ? '#000' : '#ddd'}
                    />
                    <Text
                      style={[
                        styles.payoutMethodButtonText,
                        payoutMethod === 'bank' && styles.payoutMethodButtonTextActive,
                      ]}
                    >
                      Bank Account
                    </Text>
                  </TouchableOpacity>
                </View>
                {payoutMethod === 'upi' ? (
                  <>
                    <Text style={styles.fieldLabel}>UPI ID</Text>
                    <TextInput
                      value={upiId}
                      onChangeText={setUpiId}
                      placeholder="yourname@bank"
                      placeholderTextColor="#777"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                    <Text style={styles.payoutHint}>
                      PhonePe, Google Pay या किसी भी UPI app का UPI ID इस्तेमाल करें।
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Bank name</Text>
                    <TextInput
                      value={bankName}
                      onChangeText={setBankName}
                      placeholder="Example: State Bank of India"
                      placeholderTextColor="#777"
                      autoCapitalize="words"
                      style={styles.input}
                    />
                    <Text style={styles.fieldLabel}>Account holder name</Text>
                    <TextInput
                      value={accountHolderName}
                      onChangeText={setAccountHolderName}
                      placeholder="Name as per bank account"
                      placeholderTextColor="#777"
                      autoCapitalize="words"
                      style={styles.input}
                    />
                    <Text style={styles.fieldLabel}>Bank account number</Text>
                    <TextInput
                      value={accountNumber}
                      onChangeText={(value) => setAccountNumber(value.replace(/[^\d\s]/g, ''))}
                      placeholder="Enter bank account number"
                      placeholderTextColor="#777"
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                    <Text style={styles.fieldLabel}>IFSC code</Text>
                    <TextInput
                      value={ifscCode}
                      onChangeText={(value) => setIfscCode(value.toUpperCase())}
                      placeholder="Example: SBIN0001234"
                      placeholderTextColor="#777"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={11}
                      style={styles.input}
                    />
                    <Text style={styles.payoutHint}>
                      Account number और IFSC code अपने bank statement या passbook से मिलाकर भरें।
                    </Text>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.payoutRequestButton, payoutSubmitting && styles.disabledBtn]}
                  onPress={submitPayout}
                  disabled={payoutSubmitting}
                >
                  <Text style={styles.payoutRequestButtonText}>
                    {payoutSubmitting
                      ? 'Sending Request…'
                      : payoutMethod === 'upi'
                        ? 'Request UPI Payout'
                        : 'Request Bank Payout'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.payoutProcessingNote}>
                  <Ionicons name="time-outline" size={17} color="#c4c4c4" />
                  <Text style={styles.payoutProcessingNoteText}>
                    Request submit hone ke baad MastiBase verification complete karke
                    payout ko 72 hours ke andar process karega.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.monetizationSectionHeader}>
                  <Text style={styles.monetizationSectionTitle}>Earnings</Text>
                  <Pressable
                    style={styles.seeAllButton}
                    onPress={() => Alert.alert(
                      'Earnings',
                      `Total earned: ${formatMonetizationAmount(monetization.total, monetization.currency)}\nPending: ${formatMonetizationAmount(monetization.pending, monetization.currency)}`,
                    )}
                  >
                    <Text style={styles.seeAllText}>See all</Text>
                    <Ionicons name="chevron-forward" size={18} color="#f5f5f5" />
                  </Pressable>
                </View>

                <View style={styles.earningsSummaryCard}>
                  <Text style={styles.earningsSummaryLabel}>Total balance</Text>
                  <Text style={styles.earningsSummaryAmount}>
                    {formatMonetizationAmount(monetization.available, monetization.currency)}
                  </Text>
                  <Text style={styles.nextPayoutText}>Next payout • --</Text>
                  <View style={styles.earningsSummaryDivider} />
                  <TouchableOpacity
                    style={styles.earningsSummaryRow}
                    onPress={() => setPayoutScreen(true)}
                    activeOpacity={0.72}
                  >
                    <Text style={styles.earningsSummaryRowLabel}>Payouts</Text>
                    <View style={styles.earningsSummaryRowRight}>
                      <Text style={styles.earningsSummaryRowAmount}>
                        {formatMonetizationAmount(monetization.available, monetization.currency)}
                      </Text>
                      <Ionicons name="chevron-forward" size={25} color="#f5f5f5" />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.earningsSummaryRow}>
                    <Text
                      style={[
                        styles.earningsSummaryStatus,
                        monetization.viewfundEnabled && styles.earningsSummaryStatusActive,
                      ]}
                    >
                      {monetization.viewfundEnabled ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.monetizationGroupTitle}>Ways you can earn</Text>
                <View style={styles.monetizationOptionsGroup}>
                  <MonetizationOption
                    icon="sparkles-outline"
                    title="View Rewards"
                    description="Earn money based on the views your content gets."
                    active={monetization.viewfundEnabled}
                    locked={!monetization.viewfundEnabled}
                    onPress={() => {
                      if (monetization.viewfundEnabled) {
                        setViewRewardsScreen(true);
                      } else {
                        setCriteriaTool(VIEWFUND_DETAILS);
                      }
                    }}
                  />
                  <MonetizationOption
                    icon="ribbon-outline"
                    title="Badges"
                    description="Earn money when your fans send you badges on live."
                    active={badgesEligible}
                    locked={!badgesEligible}
                    onPress={() => setCriteriaTool(MONETIZATION_CRITERIA.badges)}
                  />
                  <MonetizationOption
                    icon="gift-outline"
                    title="Subscriptions"
                    description="Earn recurring income from fans who subscribe to you."
                    active={subscriptionsEligible}
                    locked={!subscriptionsEligible}
                    onPress={() => setCriteriaTool(MONETIZATION_CRITERIA.subscriptions)}
                  />
                  <MonetizationOption
                    icon="star-outline"
                    title="Stars"
                    description="Let your fans support you by sending Stars and gifts."
                    active={starsEligible}
                    locked={!starsEligible}
                    onPress={() => setCriteriaTool(MONETIZATION_CRITERIA.stars)}
                  />
                </View>

                <View style={styles.monetizationOptionsGroup}>
                  <MonetizationOption
                    icon="help-circle-outline"
                    title="Learn more about monetization"
                    description="Visit our Help Center to learn more."
                    onPress={() => setHelpModal(true)}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── View Rewards earnings screen ── */}
      <Modal
        visible={viewRewardsScreen}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setViewRewardsScreen(false)}
      >
        <View style={styles.monetizationScreen}>
          <View style={[styles.monetizationHeader, { paddingTop: modalTopInset }]}>
            <Pressable
              style={styles.monetizationHeaderButton}
              onPress={() => setViewRewardsScreen(false)}
              hitSlop={10}
              accessibilityLabel="Back to monetization"
            >
              <Ionicons name="chevron-back" size={28} color="#f5f5f5" />
            </Pressable>
            <Text style={styles.monetizationHeaderTitle}>View Rewards</Text>
            <Pressable
              style={styles.monetizationHeaderButton}
              onPress={() =>
                Alert.alert(
                  'View Rewards',
                  'हर original video की eligible views के आधार पर मिलने वाली earning, date/time और status यहाँ दिखाई देते हैं।',
                )
              }
              hitSlop={10}
              accessibilityLabel="About View Rewards"
            >
              <Ionicons name="information-circle-outline" size={27} color="#f5f5f5" />
            </Pressable>
          </View>
          <ViewRewardsDetails
            records={earningRecords}
            totalEarned={monetization.total}
            availableBalance={monetization.available}
            currency={monetization.currency}
            enabled={monetization.viewfundEnabled}
          />
        </View>
      </Modal>

      {/* ── Monetization Criteria Modal ── */}
      <Modal
        visible={criteriaTool !== null}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setCriteriaTool(null)}
      >
        <View style={styles.monetizationScreen}>
          <View style={[styles.monetizationHeader, { paddingTop: modalTopInset }]}>
            <Pressable
              style={styles.monetizationHeaderButton}
              onPress={() => setCriteriaTool(null)}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={28} color="#f5f5f5" />
            </Pressable>
            <Text style={styles.monetizationHeaderTitle}>
              {criteriaTool?.title ?? 'Eligibility'}
            </Text>
            <View style={styles.monetizationHeaderButton} />
          </View>
          {criteriaTool ? (
            <MonetizationCriteriaDetails
              criteria={criteriaTool}
              followerCount={followerCount}
              viewfundEnabled={monetization.viewfundEnabled}
              viewfundRate={monetization.viewfundRate}
              currency={monetization.currency}
            />
          ) : null}
        </View>
      </Modal>

      {/* ── Privacy Modal ── */}
      <Modal
        visible={privacyModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy</Text>
              <Pressable onPress={() => setPrivacyModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Control who can see your content</Text>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Private Account</Text>
                <Text style={styles.toggleSub}>Only followers can see your videos</Text>
              </View>
              <Switch
                value={privateAccount}
                onValueChange={setPrivateAccount}
                trackColor={{ false: '#333', true: '#a855f7' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.dividerFull} />
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Allow Comments</Text>
                <Text style={styles.toggleSub}>Let others comment on your videos</Text>
              </View>
              <Switch
                value={allowComments}
                onValueChange={setAllowComments}
                trackColor={{ false: '#333', true: '#a855f7' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.dividerFull} />
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Show Activity Status</Text>
                <Text style={styles.toggleSub}>Let others see when you're active</Text>
              </View>
              <Switch
                value={showActivity}
                onValueChange={setShowActivity}
                trackColor={{ false: '#333', true: '#a855f7' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.dividerFull} />
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => {
                setPrivacyModal(false);
                showSuccessToast('Privacy settings updated!');
              }}
            >
              <Text style={styles.modalSaveTxt}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Video Quality Modal ── */}
      <Modal
        visible={videoQualityModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setVideoQualityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Video Quality</Text>
              <Pressable onPress={() => setVideoQualityModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Videos use the selected rendition when available. If a video has no quality versions, it keeps its original stream.
            </Text>
            {MASTI_VIDEO_QUALITY_OPTIONS.map((option, index) => (
              <React.Fragment key={option.quality}>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => void saveVideoQuality(option.quality)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>{option.title}</Text>
                    <Text style={styles.toggleSub}>{option.description}</Text>
                  </View>
                  <Ionicons
                    name={videoQuality === option.quality ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={videoQuality === option.quality ? '#ff2d55' : '#666'}
                  />
                </TouchableOpacity>
                {index < MASTI_VIDEO_QUALITY_OPTIONS.length - 1 && (
                  <View style={styles.dividerFull} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Blocked Accounts Modal ── */}
      <Modal
        visible={blockedAccountsModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setBlockedAccountsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.blockedAccountsSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <View style={styles.blockedAccountsTitleRow}>
                <Pressable
                  onPress={() => {
                    setBlockedAccountsModal(false);
                    setPrivacyModal(true);
                  }}
                  hitSlop={10}
                  style={styles.modalBackButton}
                >
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.modalTitle}>Blocked Accounts</Text>
              </View>
              <Pressable
                onPress={() => setBlockedAccountsModal(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Accounts you block won't be able to interact with you.
            </Text>

            {blockedAccountsLoading ? (
              <View style={styles.blockedAccountsState}>
                <ActivityIndicator color="#a855f7" />
                <Text style={styles.blockedAccountsStateText}>Loading blocked accounts…</Text>
              </View>
            ) : blockedAccountsError ? (
              <View style={styles.blockedAccountsState}>
                <Ionicons name="alert-circle-outline" size={34} color="#ff6b6b" />
                <Text style={styles.blockedAccountsStateText}>{blockedAccountsError}</Text>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => void loadBlockedAccounts()}
                >
                  <Text style={styles.secondaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : blockedAccounts.length === 0 ? (
              <View style={styles.blockedAccountsState}>
                <Ionicons name="ban-outline" size={42} color="#555" />
                <Text style={styles.blockedAccountsEmptyTitle}>No blocked accounts</Text>
                <Text style={styles.blockedAccountsStateText}>
                  Aapne abhi kisi account ko block nahi kiya hai.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.blockedAccountsScroll}
                showsVerticalScrollIndicator={false}
              >
                {blockedAccounts.map((account, index) => {
                  const name =
                    account.blockedName || displayBlockedHandle(account) || 'Masti Video user';
                  const handle = displayBlockedHandle(account);
                  return (
                    <View
                      key={account.id}
                      style={[
                        styles.blockedAccountRow,
                        index < blockedAccounts.length - 1 && styles.listItemBorder,
                      ]}
                    >
                      {account.blockedAvatar ? (
                        <Image
                          source={{ uri: account.blockedAvatar }}
                          style={styles.blockedAccountAvatar}
                        />
                      ) : (
                        <View style={styles.blockedAccountAvatarFallback}>
                          <Ionicons name="person" size={19} color="#aaa" />
                        </View>
                      )}
                      <View style={styles.blockedAccountInfo}>
                        <Text style={styles.blockedAccountName} numberOfLines={1}>
                          {name}
                        </Text>
                        {handle ? (
                          <Text style={styles.blockedAccountHandle} numberOfLines={1}>
                            {handle}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.unblockButton}
                        activeOpacity={0.75}
                        onPress={() => confirmUnblockAccount(account)}
                      >
                        <Text style={styles.unblockButtonText}>Unblock</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Language Modal ── */}
      <Modal
        visible={languageModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Language</Text>
              <Pressable onPress={() => setLanguageModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Choose your preferred language</Text>
            {languages.map((option, i) => (
              <TouchableOpacity
                key={option.value}
                testID={`language-option-${option.value.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedLang === option.value }}
                style={[
                  styles.langRow,
                  i < languages.length - 1 && styles.listItemBorder,
                ]}
                onPress={() => {
                  void setSelectedLang(option.value)
                    .then(() => {
                      setLanguageModal(false);
                      Alert.alert(
                        translateText('Language Changed', option.value),
                        translateText('Your app language has been updated.', option.value),
                      );
                    })
                    .catch(() => {
                      Alert.alert(
                        translateText('Language', selectedLang),
                        translateText(
                          'Could not save your language choice. Please try again.',
                          selectedLang,
                        ),
                      );
                    });
                }}
              >
                <NativeText style={styles.langLabel}>{option.label}</NativeText>
                {selectedLang === option.value && (
                  <Ionicons name="checkmark" size={20} color="#a855f7" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Account Management Modal ── */}
      <Modal
        visible={accountModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account Management</Text>
              <Pressable onPress={() => setAccountModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Manage your account details</Text>
            {[
              { icon: 'person-outline' as const, label: 'Edit Profile', sub: 'Change name, bio & photo' },
              { icon: 'lock-closed-outline' as const, label: 'Change Password', sub: 'Update your password' },
              { icon: 'mail-outline' as const, label: 'Change Email', sub: 'Update your email address' },
              { icon: 'phone-portrait-outline' as const, label: 'Change Phone', sub: 'Update your phone number' },
            ].map((opt, i, arr) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.listItem, i < arr.length - 1 && styles.listItemBorder]}
                onPress={() => {
                  setAccountModal(false);
                  Alert.alert(opt.label, `${opt.sub} — Feature coming soon!`);
                }}
              >
                <View style={[styles.listIconBox, { backgroundColor: '#1c3a5e' }]}>
                  <Ionicons name={opt.icon} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listLabel}>{opt.label}</Text>
                  <Text style={styles.listSub}>{opt.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Help & Support Modal ── */}
      <Modal
        visible={helpModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help &amp; Support</Text>
              <Pressable onPress={() => setHelpModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>We're here to help you</Text>
            {[
              { icon: 'chatbubble-ellipses-outline' as const, label: 'Chat with Support', sub: 'Talk to our support team' },
              { icon: 'document-text-outline' as const, label: 'FAQs', sub: 'Frequently asked questions' },
              { icon: 'bug-outline' as const, label: 'Report a Bug', sub: 'Help us improve the app' },
              { icon: 'star-outline' as const, label: 'Rate the App', sub: 'Share your feedback' },
            ].map((opt, i, arr) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.listItem, i < arr.length - 1 && styles.listItemBorder]}
                onPress={() => {
                  if (opt.label === 'Chat with Support') {
                    void openSupportChat();
                    return;
                  }
                  if (opt.label === 'Report a Bug') {
                    void openBugReport();
                    return;
                  }
                  setHelpModal(false);
                  Alert.alert(opt.label, `${opt.sub} — Feature coming soon!`);
                }}
              >
                <View style={[styles.listIconBox, { backgroundColor: '#7c3000' }]}>
                  <Ionicons name={opt.icon} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listLabel}>{opt.label}</Text>
                  <Text style={styles.listSub}>{opt.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Support Chat Modal ── */}
      <Modal
        visible={supportChatVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSupportChatVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: '#000' }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <View style={[styles.modalSheet, { paddingTop: modalTopInset, paddingBottom: 0 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chat with Support</Text>
              <Pressable onPress={() => setSupportChatVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={[styles.modalSub, { marginBottom: 8 }]}>
              Messages are saved as MastiBase notifications. Replies appear here and in Inbox.
            </Text>
            {supportIdentity?.appUserId ? (
              <Text
                selectable
                style={{ color: '#777', fontSize: 11, marginBottom: 8 }}
              >
                Your Masti Video ID: {supportIdentity.appUserId}
              </Text>
            ) : null}
            {supportChatError ? (
              <Text style={{ color: '#ff7676', fontSize: 12, marginBottom: 8 }}>
                {supportChatError}
              </Text>
            ) : null}
            {supportChatLoading && supportChatMessages.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <FlatList
                data={[...supportChatMessages].reverse()}
                inverted
                keyExtractor={item => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 12 }}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View
                    style={{
                      alignItems: item.isMine ? 'flex-end' : 'flex-start',
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      selectable
                      style={{
                        color: '#85858d',
                        fontSize: 10,
                        marginBottom: 4,
                        maxWidth: '92%',
                        textAlign: item.isMine ? 'right' : 'left',
                      }}
                    >
                      {item.isMine ? 'You' : item.senderName}
                      {item.senderId ? ` · ID: ${item.senderId}` : ''}
                    </Text>
                    <View
                      style={{
                        maxWidth: '88%',
                        borderRadius: 16,
                        paddingHorizontal: 13,
                        paddingVertical: 10,
                        backgroundColor: item.isMine ? '#7c3000' : '#202024',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>
                        {item.text}
                      </Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <View
                    style={{
                      minHeight: 240,
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ scaleY: -1 }],
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={34} color="#666" />
                    <Text style={{ color: '#aaa', fontSize: 14, fontWeight: '600', marginTop: 12 }}>
                      Start a conversation
                    </Text>
                    <Text style={{ color: '#777', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                      Send a message and MastiBase Support will see your user ID with it.
                    </Text>
                  </View>
                }
              />
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 10,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 12),
                borderTopWidth: 1,
                borderTopColor: '#222',
              }}
            >
              <TextInput
                testID="support-chat-input"
                value={supportChatDraft}
                onChangeText={setSupportChatDraft}
                placeholder="Write a message..."
                placeholderTextColor="#777"
                multiline
                maxLength={1500}
                editable={!supportChatSending}
                style={{
                  flex: 1,
                  maxHeight: 120,
                  minHeight: 44,
                  borderRadius: 18,
                  backgroundColor: '#19191d',
                  color: '#fff',
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 10,
                  fontSize: 14,
                }}
              />
              <TouchableOpacity
                testID="support-chat-send"
                accessibilityLabel="Send message to support"
                onPress={() => void handleSendSupportChatMessage()}
                disabled={!supportChatDraft.trim() || supportChatSending}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    !supportChatDraft.trim() || supportChatSending ? '#39393f' : '#f4511e',
                }}
              >
                {supportChatSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Bug Report Modal ── */}
      <Modal
        visible={bugReportVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setBugReportVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: '#000' }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report a Bug</Text>
              <Pressable onPress={() => setBugReportVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Describe the problem. Your Masti Video user ID will be included in the report.
            </Text>
            <Text selectable style={{ color: '#85858d', fontSize: 12, marginBottom: 10 }}>
              Masti Video ID: {supportIdentity?.appUserId || appAuth.currentUser?.uid || 'Sign in required'}
            </Text>
            {bugReportError ? (
              <Text style={{ color: '#ff7676', fontSize: 12, marginBottom: 10 }}>
                {bugReportError}
              </Text>
            ) : null}
            <TextInput
              testID="bug-report-input"
              value={bugReportDraft}
              onChangeText={text => {
                if (text !== bugReportDraft) {
                  setBugReportTicketDelivered(false);
                  setBugReportHistorySynced(false);
                }
                setBugReportDraft(text);
              }}
              placeholder="What happened? Include the steps that caused it."
              placeholderTextColor="#777"
              multiline
              maxLength={3000}
              editable={!bugReportSending}
              textAlignVertical="top"
              style={{
                minHeight: 190,
                borderWidth: 1,
                borderColor: '#29292f',
                borderRadius: 14,
                backgroundColor: '#141417',
                color: '#fff',
                padding: 14,
                fontSize: 14,
                lineHeight: 21,
              }}
            />
            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                testID="bug-report-attach-photo"
                accessibilityRole="button"
                accessibilityLabel={bugReportPhoto ? 'Choose a different photo' : 'Attach a photo'}
                onPress={() => void handlePickBugReportPhoto()}
                disabled={bugReportSending}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: '#38383f',
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                  opacity: bugReportSending ? 0.55 : 1,
                }}
              >
                <Ionicons name="image-outline" size={20} color="#ff7448" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {bugReportPhoto ? 'Choose a different photo' : 'Attach a photo (optional)'}
                </Text>
              </TouchableOpacity>
              {bugReportPhoto ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 10,
                    padding: 9,
                    borderRadius: 10,
                    backgroundColor: '#171719',
                  }}
                >
                  <Image
                    source={{ uri: bugReportPhoto.uri }}
                    style={{ width: 60, height: 60, borderRadius: 7, backgroundColor: '#29292f' }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                      {bugReportPhoto.fileName || 'Photo attached'}
                    </Text>
                    <Text style={{ color: '#85858d', fontSize: 11, marginTop: 4 }}>
                      Included with your bug report
                    </Text>
                  </View>
                  <Pressable
                    testID="bug-report-remove-photo"
                    accessibilityRole="button"
                    accessibilityLabel="Remove attached photo"
                    onPress={() => {
                      setBugReportPhoto(null);
                      setBugReportPhotoUrl('');
                      setBugReportTicketDelivered(false);
                      setBugReportHistorySynced(false);
                    }}
                    disabled={bugReportSending}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={23} color="#aaa" />
                  </Pressable>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              testID="bug-report-submit"
              onPress={() => void handleSubmitBugReport()}
              disabled={!bugReportDraft.trim() || bugReportSending}
              style={[
                styles.modalSaveBtn,
                (!bugReportDraft.trim() || bugReportSending) && { opacity: 0.55 },
              ]}
            >
              {bugReportSending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSaveTxt}>
                  {bugReportTicketDelivered ? 'Retry Direct Chat' : 'Send Report'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Community Modal ── */}
      <Modal
        visible={communityModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Community</Text>
              <Pressable onPress={() => setCommunityModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>Connect with our community</Text>
            {[
              { icon: 'logo-discord' as const, label: 'Discord Server', sub: 'Join our Discord community' },
              { icon: 'logo-instagram' as const, label: 'Instagram', sub: 'Follow us on Instagram' },
              { icon: 'logo-youtube' as const, label: 'YouTube', sub: 'Subscribe to our channel' },
              { icon: 'people-outline' as const, label: 'Forums', sub: 'Discuss with other creators' },
            ].map((opt, i, arr) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.listItem, i < arr.length - 1 && styles.listItemBorder]}
                onPress={() => {
                  setCommunityModal(false);
                  Alert.alert(opt.label, `${opt.sub} — Coming soon!`);
                }}
              >
                <View style={[styles.listIconBox, { backgroundColor: '#4c1d95' }]}>
                  <Ionicons name={opt.icon} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listLabel}>{opt.label}</Text>
                  <Text style={styles.listSub}>{opt.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── About Us Modal ── */}
      <Modal
        visible={aboutModal}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About Us</Text>
              <Pressable onPress={() => setAboutModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.aboutLogoBox}>
              <Ionicons name="play-circle" size={56} color="#a855f7" />
              <Text style={styles.aboutAppName}>Masti Video</Text>
              <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            </View>
            {[
              { label: 'Privacy Policy', icon: 'shield-outline' as const },
              { label: 'Terms of Service', icon: 'document-outline' as const },
              { label: 'Licenses', icon: 'code-slash-outline' as const },
            ].map((opt, i, arr) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.listItem, i < arr.length - 1 && styles.listItemBorder]}
                onPress={() => {
                  setAboutModal(false);
                  Alert.alert(opt.label, 'Opening ' + opt.label + '...');
                }}
              >
                <View style={[styles.listIconBox, { backgroundColor: '#2e1065' }]}>
                  <Ionicons name={opt.icon} size={18} color="#fff" />
                </View>
                <Text style={[styles.listLabel, { flex: 1 }]}>{opt.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#000',
  },
  backBtn: { marginRight: 10 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 36 },

  /* Data Usage */
  card: {
    backgroundColor: '#171717',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    marginBottom: 22,
  },
  dataUsageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dataUsageTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dataUsageSub: { color: '#888', fontSize: 12, marginTop: 2 },
  dataUsageIconBox: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2a1a4a', alignItems: 'center', justifyContent: 'center',
  },
  dataOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  dataOptionIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  dataOptionLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dataOptionSub: { color: '#888', fontSize: 12, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#444',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#a855f7', backgroundColor: '#a855f7' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#2a2a2a', marginLeft: 52 },
  dividerFull: { height: StyleSheet.hairlineWidth, backgroundColor: '#2a2a2a' },

  /* General List */
  sectionLabel: { color: '#666', fontSize: 13, marginBottom: 8, marginLeft: 4 },
  listCard: { backgroundColor: '#171717', borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 12 },
  listItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2a' },
  listIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  listSub: { color: '#777', fontSize: 12, marginTop: 2 },
  rightText: { color: '#3b82f6', fontSize: 13, marginRight: 4, fontWeight: '500' },

  /* Log Out */
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#171717', borderWidth: 1.5, borderColor: '#ef444455',
    borderRadius: 14, paddingVertical: 16, marginBottom: 8,
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },

  /* Modals */
  modalOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: '100%',
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
    zIndex: 9999,
    elevation: 20,
  },
  modalSheet: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#000',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 36,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalSub: { color: '#888', fontSize: 13, marginBottom: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  toggleLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  toggleSub: { color: '#888', fontSize: 12, marginTop: 2, maxWidth: 220 },
  privacyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  privacyActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3a1c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtn: {
    backgroundColor: '#a855f7', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  modalSaveTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },
  blockedAccountsSheet: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#000',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },
  blockedAccountsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalBackButton: { marginRight: 7 },
  blockedAccountsScroll: { flex: 1 },
  blockedAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 11,
  },
  blockedAccountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2c2c2e',
  },
  blockedAccountAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAccountInfo: { flex: 1, minWidth: 0 },
  blockedAccountName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  blockedAccountHandle: { color: '#888', fontSize: 12, marginTop: 3 },
  unblockButton: {
    borderWidth: 1,
    borderColor: '#a855f7',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  unblockButtonText: { color: '#c084fc', fontSize: 12, fontWeight: '700' },
  blockedAccountsState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    paddingHorizontal: 18,
  },
  blockedAccountsStateText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 10,
  },
  blockedAccountsEmptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  monetizationScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: '100%',
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    elevation: 20,
  },
  monetizationHeader: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000',
  },
  monetizationHeaderButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monetizationHeaderTitle: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  monetizationScroll: {
    flex: 1,
    backgroundColor: '#000',
  },
  monetizationContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  criteriaContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 36,
  },
  criteriaHero: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  criteriaIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: '#3b3b3b',
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  criteriaIconActive: {
    borderColor: '#277a48',
    backgroundColor: '#123b22',
  },
  criteriaTitle: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  criteriaDescription: {
    color: '#bdbdbd',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 330,
  },
  criteriaDescriptionHindi: {
    color: '#bdbdbd',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 3,
    maxWidth: 330,
  },
  criteriaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  criteriaStatusActive: {
    backgroundColor: '#123b22',
  },
  criteriaStatusInactive: {
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  criteriaStatusText: {
    color: '#c4c4c4',
    fontSize: 13,
    fontWeight: '700',
  },
  criteriaStatusActiveText: {
    color: '#86efac',
  },
  criteriaCard: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 4,
  },
  criteriaCardTitle: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 9,
  },
  criteriaRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  criteriaRowLabel: {
    color: '#bdbdbd',
    fontSize: 13,
  },
  criteriaRowValue: {
    color: '#f5f5f5',
    fontSize: 14,
    fontWeight: '700',
  },
  criteriaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#333',
  },
  criteriaInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#171717',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  criteriaInfoText: {
    flex: 1,
    color: '#bdbdbd',
    fontSize: 12,
    lineHeight: 18,
  },
  viewRewardsContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 48,
  },
  viewRewardsHero: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 25,
  },
  viewRewardsIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#3b3b3b',
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  viewRewardsIconActive: {
    borderColor: '#277a48',
    backgroundColor: '#123b22',
  },
  viewRewardsTitle: {
    color: '#f5f5f5',
    fontSize: 23,
    fontWeight: '700',
  },
  viewRewardsDescription: {
    color: '#bdbdbd',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  viewRewardsDescriptionHindi: {
    color: '#bdbdbd',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 3,
  },
  viewRewardsSummaryCard: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 26,
  },
  viewRewardsSummaryItem: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  viewRewardsSummaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#3a3a3a',
  },
  viewRewardsSummaryLabel: {
    color: '#a8a8a8',
    fontSize: 12,
    lineHeight: 17,
  },
  viewRewardsSummaryAmount: {
    color: '#f5f5f5',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  viewRewardsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  viewRewardsSectionTitle: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '700',
  },
  viewRewardsSectionCount: {
    color: '#a8a8a8',
    fontSize: 13,
  },
  viewRewardsRecordsCard: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewRewardsRecord: {
    minHeight: 106,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 13,
    gap: 10,
  },
  viewRewardsRecordBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#363636',
  },
  viewRewardsThumbnail: {
    width: 58,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#252525',
  },
  viewRewardsThumbnailPlaceholder: {
    width: 58,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewRewardsRecordCopy: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  viewRewardsRecordTitle: {
    color: '#f5f5f5',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  viewRewardsRecordMeta: {
    color: '#c2c2c2',
    fontSize: 12,
    marginTop: 5,
  },
  viewRewardsRecordDate: {
    color: '#858585',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  viewRewardsRecordAmount: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 76,
  },
  viewRewardsRecordValue: {
    color: '#86efac',
    fontSize: 14,
    fontWeight: '800',
  },
  viewRewardsStatusPill: {
    backgroundColor: '#123b22',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginTop: 7,
  },
  viewRewardsStatusText: {
    color: '#86efac',
    fontSize: 10,
    fontWeight: '700',
  },
  viewRewardsEmpty: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 14,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 35,
  },
  viewRewardsEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  viewRewardsEmptyTitle: {
    color: '#f5f5f5',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  viewRewardsEmptyText: {
    color: '#a8a8a8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  monetizationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  monetizationSectionTitle: {
    color: '#f4f4f4',
    fontSize: 18,
    fontWeight: '700',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 5,
  },
  seeAllText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '500',
  },
  earningsSummaryCard: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 12,
    paddingHorizontal: 19,
    paddingTop: 22,
    paddingBottom: 7,
    marginBottom: 25,
  },
  earningsSummaryLabel: {
    color: '#c4c4c4',
    fontSize: 14,
    fontWeight: '400',
  },
  earningsSummaryAmount: {
    color: '#f5f5f5',
    fontSize: 39,
    lineHeight: 46,
    fontWeight: '500',
    letterSpacing: -0.7,
    marginTop: 3,
  },
  nextPayoutText: {
    color: '#c4c4c4',
    fontSize: 14,
    marginTop: 11,
  },
  earningsSummaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#3a3a3a',
    marginTop: 17,
  },
  earningsSummaryRow: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsSummaryRowLabel: {
    color: '#ededed',
    fontSize: 16,
    fontWeight: '400',
  },
  earningsSummaryStatus: {
    color: '#a3a3a3',
    fontSize: 16,
    fontWeight: '500',
  },
  earningsSummaryStatusActive: {
    color: '#60a5fa',
  },
  earningsSummaryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  earningsSummaryRowAmount: {
    color: '#ededed',
    fontSize: 16,
    fontWeight: '400',
  },
  monetizationGroupTitle: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  monetizationOptionsGroup: {
    marginBottom: 12,
  },
  monetizationOption: {
    minHeight: 107,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2b2b2b',
    paddingVertical: 13,
  },
  monetizationOptionIconWrap: {
    width: 54,
    height: 54,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monetizationOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#353535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monetizationLock: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monetizationActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  monetizationActiveText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '700',
  },
  monetizationInactivePill: {
    backgroundColor: '#252525',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  monetizationInactiveText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '700',
  },
  monetizationLockedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  monetizationOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 4,
  },
  monetizationOptionCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 9,
  },
  monetizationOptionTitle: {
    color: '#f5f5f5',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  monetizationOptionDescription: {
    color: '#c2c2c2',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 2,
  },
  monetizationState: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  monetizationStateContent: {
    flexGrow: 1,
    paddingTop: 0,
  },
  payoutScreenIntro: {
    color: '#c4c4c4',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 18,
  },
  payoutBalanceCard: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
  },
  payoutBalanceLabel: {
    color: '#c4c4c4',
    fontSize: 14,
  },
  payoutBalanceAmount: {
    color: '#f5f5f5',
    fontSize: 32,
    fontWeight: '600',
    marginTop: 6,
  },
  payoutRequestButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 13,
  },
  payoutRequestButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  payoutMethodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  payoutMethodButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#383838',
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  payoutMethodButtonActive: {
    backgroundColor: '#f5f5f5',
    borderColor: '#f5f5f5',
  },
  payoutMethodButtonText: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '600',
  },
  payoutMethodButtonTextActive: {
    color: '#000',
  },
  payoutHint: {
    color: '#8f8f8f',
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10,
  },
  payoutProcessingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 15,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
  },
  payoutProcessingNoteText: {
    flex: 1,
    color: '#bdbdbd',
    fontSize: 12,
    lineHeight: 18,
  },
  payoutSubmittedContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 10,
  },
  payoutSuccessIcon: {
    width: 142,
    height: 142,
    borderRadius: 71,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#061b0e',
    borderWidth: 2,
    borderColor: '#43f27b',
    shadowColor: '#20e968',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    marginBottom: 30,
  },
  payoutSuccessTitle: {
    color: '#f5f5f5',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  payoutSuccessDescription: {
    color: '#c8c8c8',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 320,
  },
  payoutSuccessAmount: {
    color: '#43f27b',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  payoutWaitCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 12,
    padding: 18,
    marginTop: 30,
  },
  payoutWaitLabel: {
    color: '#c4c4c4',
    fontSize: 15,
  },
  payoutWaitAmount: {
    color: '#43f27b',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 2,
  },
  payoutCountdown: {
    color: '#8f8f8f',
    fontSize: 12,
    marginTop: 4,
  },
  payoutInfoCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 12,
    padding: 16,
    marginTop: 30,
  },
  payoutInfoText: {
    flex: 1,
    color: '#c4c4c4',
    fontSize: 15,
    lineHeight: 23,
  },
  payoutBackButton: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 11,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 'auto',
    marginBottom: 4,
  },
  payoutBackButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  monetizationMessage: { color: '#aaa', fontSize: 14, paddingVertical: 18 },
  monetizationError: { color: '#fca5a5', fontSize: 13, lineHeight: 19 },
  secondaryBtn: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: '#555',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14,
  },
  secondaryBtnText: { color: '#fff', fontWeight: '600' },
  earningsCard: {
    backgroundColor: '#241b0b', borderColor: '#8a5a13', borderWidth: 1,
    borderRadius: 16, padding: 16, marginBottom: 18,
  },
  earningsLabel: { color: '#d6b477', fontSize: 12, fontWeight: '600' },
  earningsAmount: { color: '#ffd166', fontSize: 28, fontWeight: '800', marginTop: 6 },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  earningsMeta: { color: '#a89573', fontSize: 11, flex: 1 },
  fieldLabel: { color: '#ddd', fontSize: 13, fontWeight: '600', marginBottom: 7, marginTop: 5 },
  input: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#383838',
    borderRadius: 10, color: '#fff', paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, marginBottom: 10,
  },
  langRow: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  langLabel: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 120,
    color: '#fff',
    fontSize: 16,
    lineHeight: 30,
    includeFontPadding: true,
  },
  aboutLogoBox: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  aboutAppName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  aboutVersion: { color: '#888', fontSize: 13 },
});
