export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};

export class File {
  uri: string;
  exists: boolean = true;
  size: number = 1024;

  constructor(uri: string) {
    this.uri = uri;
  }

  delete() {
    this.exists = false;
  }

  create(_options?: any) {
    this.exists = true;
  }

  write(_content: string, _options?: any) {}

  async copy(targetFile: File, _options?: any) {
    targetFile.exists = true;
  }
}

export class Directory {
  uri: string;
  exists: boolean = true;

  constructor(uri: string) {
    this.uri = uri;
  }

  list(): Array<Directory | File> {
    return [];
  }
}

export const Paths = {
  cache: new Directory('cache://'),
  document: new Directory('document://'),
};

export const documentDirectory = 'file:///masti_docs/';
export const cacheDirectory = 'file:///masti_cache/';

export const getInfoAsync = async (fileUri: string) => ({
  exists: true,
  uri: fileUri,
  size: 2048,
  isDirectory: false,
});

export const deleteAsync = async (_fileUri: string) => {};
export const makeDirectoryAsync = async (_dirUri: string, _options?: any) => {};
export const copyAsync = async (options: { from: string; to: string }) => options.to;
export const readAsStringAsync = async (_fileUri: string, _options?: any) => '';
export const writeAsStringAsync = async (_fileUri: string, _contents: string, _options?: any) => {};

export default {
  EncodingType,
  File,
  Directory,
  Paths,
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  deleteAsync,
  makeDirectoryAsync,
  copyAsync,
  readAsStringAsync,
  writeAsStringAsync,
};
