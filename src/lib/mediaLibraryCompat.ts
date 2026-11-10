export const requestPermissionsAsync = async () => ({
  granted: true,
  status: 'granted',
  canAskAgain: true,
});

export const getPermissionsAsync = async () => ({
  granted: true,
  status: 'granted',
  canAskAgain: true,
});

export const saveToLibraryAsync = async (uri: string) => {
  try {
    const a = document.createElement('a');
    a.href = uri;
    a.download = `masti_video_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {}
  return true;
};

export const createAssetAsync = async (uri: string) => {
  return { id: 'asset_' + Date.now(), uri };
};

export default {
  requestPermissionsAsync,
  getPermissionsAsync,
  saveToLibraryAsync,
  createAssetAsync,
};
