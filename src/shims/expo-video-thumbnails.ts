export const getThumbnailAsync = async (sourceUri: string, _options?: any) => {
  return {
    uri: sourceUri,
    width: 720,
    height: 1280,
  };
};

export default {
  getThumbnailAsync,
};
