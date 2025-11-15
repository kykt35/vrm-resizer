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

export interface VrmMeta {
  title?: string;
  version?: string;
  author?: string;
  contactInformation?: string;
  reference?: string;
  allowedUserName?: string;
  violentUssageName?: string;
  licenseName?: string;
  licenseUrl?: string;
  texture?: number;
  thumbnailImage?: number;
  name?: string;
  description?: string;
  allowAntisocialOrHateUsage?: boolean;
  allowExcessivelySexualUsage?: boolean;
  allowExcessivelyViolentUsage?: boolean;
  allowPoliticalOrReligiousUsage?: boolean;
  allowRedistribution?: boolean;
  authors?: string[];
  avatarPermission?: string;
  commercialUsage?: string;
  copyrightInformation?: string;
  creditNotation?: string;
  modification?: string;
  contactInformationUrl?: string;
}
