export interface TextureInfo {
  index: number;
  name: string;
  originalWidth: number;
  originalHeight: number;
  blobUrl: string;
  mimeType: string;
  bufferViewIndex: number;
  isReplaced?: boolean;
}

export interface VrmData {
  json: any;
  bin: Uint8Array;
}
