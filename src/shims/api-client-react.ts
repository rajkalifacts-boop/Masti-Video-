let _baseUrl = '';
let _tokenGetter: (() => Promise<string | null>) | null = null;

export const setBaseUrl = (url: string) => {
  _baseUrl = url;
};

export const setAuthTokenGetter = (getter: () => Promise<string | null>) => {
  _tokenGetter = getter;
};

export const getBaseUrl = () => _baseUrl;

export const getAuthToken = () => (_tokenGetter ? _tokenGetter() : Promise.resolve(null));

export default {
  setBaseUrl,
  setAuthTokenGetter,
  getBaseUrl,
  getAuthToken,
};
