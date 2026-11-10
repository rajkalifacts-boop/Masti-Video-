export const MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
};

export const launchImageLibraryAsync = async (options?: any) => {
  return new Promise<{ canceled: boolean; assets: any[] }>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options?.mediaTypes === MediaTypeOptions.Videos) {
      input.accept = 'video/*';
    } else if (options?.mediaTypes === MediaTypeOptions.Images) {
      input.accept = 'image/*';
    } else {
      input.accept = 'image/*,video/*';
    }

    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video');
        resolve({
          canceled: false,
          assets: [
            {
              uri: url,
              width: 720,
              height: 1280,
              type: isVideo ? 'video' : 'image',
              fileName: file.name,
              fileSize: file.size,
              duration: 15,
            },
          ],
        });
      } else {
        resolve({ canceled: true, assets: [] });
      }
    };

    input.click();
  });
};

export const launchCameraAsync = launchImageLibraryAsync;

export const requestMediaLibraryPermissionsAsync = async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
});

export const requestCameraPermissionsAsync = async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
});

export default {
  MediaTypeOptions,
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
};
