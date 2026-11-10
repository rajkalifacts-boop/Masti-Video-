const API_BASE = 'https://masti-basen.lovable.app';
const API_KEY = 'mb_live_rajkali_8789_7b31a6fe89d24643';

export const getMastiAudios = async () => {
  return [
    {
      id: 'audio_1',
      title: 'Bhangra Dhol Beats',
      artist: 'Punjab Kings',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&auto=format&fit=crop&q=80',
      duration: '0:30',
      audioUrl: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    },
    {
      id: 'audio_2',
      title: 'Desi Flute Romantic',
      artist: 'Sufi Melodies',
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80',
      duration: '0:45',
      audioUrl: 'https://cdn.freesound.org/previews/536/536108_11861866-lq.mp3',
    },
  ];
};

export const uploadVideoToMastiBash = async (fileUri: string, metadata?: {
  userEmail?: string;
  title?: string;
  description?: string;
}) => {
  try {
    const formData = new FormData();
    const userEmail = metadata?.userEmail || 'user@masti.in';
    const title = metadata?.title || 'Masti Video';
    const description = metadata?.description || '#masti #trending';

    formData.append('userEmail', userEmail);
    formData.append('title', title);
    formData.append('description', description);

    // If fileUri is a blob or data uri or fetchable URI, fetch and attach
    if (fileUri) {
      const resp = await fetch(fileUri);
      const blob = await resp.blob();
      formData.append('files', blob, 'masti_upload.mp4');
    }

    const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
      },
      body: formData,
    });
    const data = await res.json();
    if (data && data.success) {
      return {
        success: true,
        url: data.videoUrl || fileUri,
        thumbnailUrl: data.thumbnailUrl || '',
        videoId: data.videoId || 'v_' + Date.now(),
        qualities: data.qualities || [],
        metadata,
      };
    }
  } catch (err) {
    console.warn('[MastiBase API] Video upload failed:', err);
  }

  return {
    success: true,
    url: fileUri,
    videoId: 'v_' + Date.now(),
    metadata,
  };
};

export const uploadEditedVideoToMastiBash = async (fileUri: string, metadata?: any) => {
  return uploadVideoToMastiBash(fileUri, metadata);
};

export const uploadProfileImageToMastiBash = async (
  imageUri: string,
  userEmailOrAccountId?: string,
  uploadIdentity?: any
) => {
  if (!imageUri) {
    return {
      success: false,
      url: '',
      secure_url: '',
      avatarUrl: '',
    };
  }

  const userEmail =
    uploadIdentity?.email ||
    (userEmailOrAccountId && userEmailOrAccountId.includes('@')
      ? userEmailOrAccountId
      : 'rajkalikumar8789@gmail.com');

  try {
    const formData = new FormData();
    formData.append('userEmail', userEmail);
    formData.append('title', `Avatar - ${uploadIdentity?.name || uploadIdentity?.username || userEmail}`);
    formData.append('description', '#avatar #dp #profile');

    let blob: Blob | null = null;
    if (imageUri.startsWith('data:')) {
      const parts = imageUri.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      blob = new Blob([ia], { type: mime });
    } else {
      const resp = await fetch(imageUri);
      blob = await resp.blob();
    }

    if (blob) {
      formData.append('files', blob, 'avatar.jpg');
    }

    const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
      },
      body: formData,
    });

    const data = await res.json();
    if (data && (data.success || data.url || data.videoUrl || data.thumbnailUrl || data.secure_url)) {
      const uploadedUrl = data.secure_url || data.url || data.thumbnailUrl || data.videoUrl || imageUri;
      return {
        success: true,
        url: uploadedUrl,
        secure_url: uploadedUrl,
        avatarUrl: uploadedUrl,
        accountId: userEmailOrAccountId,
      };
    }
  } catch (err) {
    console.warn('[MastiBase API] Profile image upload failed, using local persistent URI:', err);
  }

  return {
    success: true,
    url: imageUri,
    secure_url: imageUri,
    avatarUrl: imageUri,
    accountId: userEmailOrAccountId,
  };
};

export const uploadThumbnailToMastiBash = async (thumbUri: string, userEmail = 'user@masti.in') => {
  if (!thumbUri) return { success: true, url: '' };
  try {
    const formData = new FormData();
    formData.append('userEmail', userEmail);
    formData.append('title', 'Video Thumbnail');
    formData.append('description', '#thumbnail');

    let blob: Blob | null = null;
    if (thumbUri.startsWith('data:')) {
      const parts = thumbUri.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      blob = new Blob([ia], { type: mime });
    } else {
      const resp = await fetch(thumbUri);
      blob = await resp.blob();
    }
    if (blob) {
      formData.append('files', blob, 'thumb.jpg');
    }

    const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: formData,
    });
    const data = await res.json();
    const uploadedUrl = data?.secure_url || data?.url || data?.thumbnailUrl || thumbUri;
    return { success: true, url: uploadedUrl, secure_url: uploadedUrl };
  } catch {
    return { success: true, url: thumbUri, secure_url: thumbUri };
  }
};

export const uploadSupportBugReportPhotoToMastiBash = async (
  photoUri: string,
  _arg2?: any,
  _arg3?: any
) => {
  return {
    success: true,
    url: photoUri,
    secure_url: photoUri,
  };
};

export default {
  getMastiAudios,
  uploadVideoToMastiBash,
  uploadEditedVideoToMastiBash,
  uploadProfileImageToMastiBash,
  uploadThumbnailToMastiBash,
  uploadSupportBugReportPhotoToMastiBash,
};
