import { useEffect, useMemo, useState } from 'react';
import type { TextureInfo, VrmData, VrmMeta } from '../types';

export type MetadataField = {
  label: string;
  value: string | number;
  linkUrl?: string;
};

export function useVrmMetadata(vrmData: VrmData | null, textures: TextureInfo[]) {
  const [vrmMetadata, setVrmMetadata] = useState<VrmMeta | null>(null);
  const [metadataThumbnailImageIndex, setMetadataThumbnailImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!vrmData) {
      setVrmMetadata(null);
      setMetadataThumbnailImageIndex(null);
      return;
    }

    const extensions = vrmData.json?.extensions;
    const meta =
      (extensions?.VRM?.meta as VrmMeta | undefined) ??
      (extensions?.VRMC_vrm?.meta as VrmMeta | undefined);
    if (!meta) {
      setVrmMetadata(null);
      setMetadataThumbnailImageIndex(null);
      return;
    }

    const textureIndex =
      typeof meta.texture === 'number'
        ? meta.texture
        : typeof meta.thumbnailImage === 'number'
        ? meta.thumbnailImage
        : null;
    const texturesDef = vrmData.json?.textures;
    const imageIndex =
      textureIndex !== null && texturesDef?.[textureIndex]?.source !== undefined
        ? texturesDef[textureIndex].source
        : null;
    setVrmMetadata(meta);
    setMetadataThumbnailImageIndex(imageIndex);
  }, [vrmData]);

  const metadataThumbnailTexture = useMemo(() => {
    if (metadataThumbnailImageIndex === null) {
      return null;
    }

    return textures.find(texture => texture.index === metadataThumbnailImageIndex) ?? null;
  }, [metadataThumbnailImageIndex, textures]);

  const metadataFields = useMemo(() => {
    if (!vrmMetadata) return [];

    const labelMap: Record<string, string> = {
      title: 'Title',
      name: 'Name',
      version: 'Version',
      author: 'Author',
      contactInformation: 'Contact',
      description: 'Description',
      reference: 'Reference',
      allowedUserName: 'Allowed Users',
      violentUsageName: 'Violent Usage',
      violentUssageName: 'Violent Usage',
    };

    const formatLabel = (key: string) => {
      const spaced = key.replace(/([A-Z])/g, ' $1');
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    };

    const entries: MetadataField[] = Object.entries(vrmMetadata)
      .filter(([key]) => key !== 'texture' && key !== 'licenseName' && key !== 'licenseUrl')
      .map(([key, value]) => ({
        label: labelMap[key] || formatLabel(key),
        value: value as string | number,
      }))
      .filter(field => field.value !== undefined && field.value !== null && field.value !== '');

    if (vrmMetadata.licenseName || vrmMetadata.licenseUrl) {
      const licenseLabel = vrmMetadata.licenseName || 'License';
      entries.push({
        label: 'License',
        value: licenseLabel,
        linkUrl: vrmMetadata.licenseUrl ?? undefined,
      });
    }

    return entries;
  }, [vrmMetadata]);

  return {
    vrmMetadata,
    metadataThumbnailImageIndex,
    metadataThumbnailTexture,
    metadataFields,
  };
}
