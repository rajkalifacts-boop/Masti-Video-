export type MastiVideoQuality = '260p' | '360p' | '460p' | '720p' | '1080p';

export const MASTI_VIDEO_DEFAULT_QUALITY: MastiVideoQuality = '260p';

export interface MastiVideoQualityOption {
  id: MastiVideoQuality;
  quality: MastiVideoQuality;
  title: string;
  label: string;
  description: string;
}

export const MASTI_VIDEO_QUALITY_OPTIONS: MastiVideoQualityOption[] = [
  { id: '260p', quality: '260p', title: 'Basic (260p)', label: '260p', description: 'Lowest data usage, starts instantly' },
  { id: '360p', quality: '360p', title: 'Data Saver (360p)', label: '360p', description: 'Fast loading on slow networks' },
  { id: '460p', quality: '460p', title: 'Standard (460p)', label: '460p', description: 'Balanced performance and quality' },
  { id: '720p', quality: '720p', title: 'High Definition (720p)', label: '720p', description: 'Clear and sharp visuals' },
  { id: '1080p', quality: '1080p', title: 'Full HD (1080p)', label: '1080p', description: 'Highest visual detail' },
];

export const getMastiVideoQualityStorageKey = (accountId?: string | null) =>
  `@masti_video_quality_${accountId || 'global'}`;

export const isMastiVideoQuality = (val: any): val is MastiVideoQuality => {
  return ['260p', '360p', '460p', '720p', '1080p'].includes(String(val));
};

export interface MastiVideoQualityResolution {
  quality: MastiVideoQuality;
  url: string;
  source: 'transcode' | 'original';
}

export const resolveMastiVideoQuality = (
  itemOrQuality?: any,
  preferredQuality: MastiVideoQuality = '260p'
): MastiVideoQualityResolution => {
  let targetQuality: MastiVideoQuality = '260p';
  let item: any = null;

  if (typeof itemOrQuality === 'string' && isMastiVideoQuality(itemOrQuality)) {
    targetQuality = itemOrQuality;
  } else if (itemOrQuality && typeof itemOrQuality === 'object') {
    item = itemOrQuality;
    if (preferredQuality && isMastiVideoQuality(preferredQuality)) {
      targetQuality = preferredQuality;
    }
  }

  const originalUrl = item?.videoUrl || item?.url || item?.mediaUrl || '';
  if (!item) {
    return {
      quality: targetQuality,
      url: originalUrl,
      source: 'original',
    };
  }

  // 1. Direct qualityUrls dictionary mapping (e.g., qualityUrls['260p'])
  if (item.qualityUrls && typeof item.qualityUrls === 'object') {
    const directUrl = item.qualityUrls[targetQuality];
    if (directUrl && typeof directUrl === 'string') {
      return {
        quality: targetQuality,
        url: directUrl,
        source: 'transcode',
      };
    }
  }

  // 2. Qualities array list (e.g., qualities: [{ quality: '260p', url: '...' }])
  if (Array.isArray(item.qualities)) {
    const match = item.qualities.find(
      (q: any) => q?.quality === targetQuality || q?.id === targetQuality
    );
    if (match?.url) {
      return {
        quality: targetQuality,
        url: match.url,
        source: 'transcode',
      };
    }
  }

  return {
    quality: targetQuality,
    url: originalUrl,
    source: 'original',
  };
};

export const getMastiBashQualityStreamUrl = (
  itemOrUrl: any,
  quality: MastiVideoQuality = '260p'
): string => {
  if (!itemOrUrl) return '';
  if (typeof itemOrUrl === 'string') return itemOrUrl;
  const res = resolveMastiVideoQuality(itemOrUrl, quality);
  return res.url;
};

export default {
  MASTI_VIDEO_DEFAULT_QUALITY,
  MASTI_VIDEO_QUALITY_OPTIONS,
  getMastiVideoQualityStorageKey,
  isMastiVideoQuality,
  resolveMastiVideoQuality,
  getMastiBashQualityStreamUrl,
};
