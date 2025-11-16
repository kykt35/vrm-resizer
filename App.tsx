import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { TextureInfo, VrmData, VrmMeta } from './types';
import ModelPreview from './components/ModelPreview';
import RightPanel, { type RightTabId } from './components/RightPanel';
import AppHeader from './components/AppHeader';
import ErrorBanner from './components/ErrorBanner';
import LoadingIndicator from './components/LoadingIndicator';
import UploadPrompt from './components/UploadPrompt';
import { parseGlb, extractTextures, resizeImage, rebuildGlb } from './services/vrmService';

function App() {
  const [vrmFile, setVrmFile] = useState<File | null>(null);
  const [vrmData, setVrmData] = useState<VrmData | null>(null);
  const [vrmPreviewBuffer, setVrmPreviewBuffer] = useState<ArrayBuffer | null>(null);
  const [textures, setTextures] = useState<TextureInfo[]>([]);
  const [resizeOptions, setResizeOptions] = useState<Map<number, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasFinishedInitialLoad, setHasFinishedInitialLoad] = useState(false);
  const [isInitialUploadLoading, setIsInitialUploadLoading] = useState(false);
  const [vrmMetadata, setVrmMetadata] = useState<VrmMeta | null>(null);
  const [metadataThumbnailImageIndex, setMetadataThumbnailImageIndex] = useState<number | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<RightTabId>('metadata');
  const [globalResizeValue, setGlobalResizeValue] = useState(0);

  const statusMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metadataThumbnailInputRef = useRef<HTMLInputElement>(null);

  const cancelStatusMessageTimer = useCallback(() => {
    if (statusMessageTimerRef.current) {
      clearTimeout(statusMessageTimerRef.current);
      statusMessageTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelStatusMessageTimer, [cancelStatusMessageTimer]);

  const updateStatusMessage = useCallback(
    (message: string, autoClearMs?: number) => {
      cancelStatusMessageTimer();
      setStatusMessage(message);

      if (autoClearMs && message) {
        statusMessageTimerRef.current = setTimeout(() => {
          setStatusMessage(current => (current === message ? '' : current));
          statusMessageTimerRef.current = null;
        }, autoClearMs);
      }
    },
    [cancelStatusMessageTimer]
  );

  const resetState = useCallback(() => {
    textures.forEach(t => URL.revokeObjectURL(t.blobUrl));
    setVrmFile(null);
    setVrmData(null);
    setVrmPreviewBuffer(null);
    setTextures([]);
    setResizeOptions(new Map());
    setIsLoading(false);
    updateStatusMessage('');
    setError(null);
    setHasFinishedInitialLoad(false);
    setIsInitialUploadLoading(false);
    setVrmMetadata(null);
    setMetadataThumbnailImageIndex(null);
    setActiveRightTab('metadata');
  }, [textures, updateStatusMessage]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.vrm')) {
      setError('Invalid file type. Please upload a .vrm file.');
      return;
    }

    resetState();
    setIsInitialUploadLoading(true);
    setIsLoading(true);
    updateStatusMessage('Parsing VRM file...');
    setError(null);
    setVrmFile(file);

    try {
    const arrayBuffer = await file.arrayBuffer();
    setVrmPreviewBuffer(arrayBuffer);
      const { json, bin } = parseGlb(arrayBuffer);
      setVrmData({ json, bin });

      updateStatusMessage('Extracting textures...');
      const extracted = await extractTextures(json, bin);
      setTextures(extracted);
      setHasFinishedInitialLoad(true);

    } catch (e: any) {
      setError(`Failed to process VRM file: ${e.message}`);
      resetState();
    } finally {
      setIsLoading(false);
      setIsInitialUploadLoading(false);
      updateStatusMessage('');
    }
  }, [resetState]);

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

  const handleResizeChange = useCallback((textureIndex: number, size: number) => {
    setResizeOptions(prev => new Map(prev).set(textureIndex, size));
  }, []);

  const buildProcessedGlb = useCallback(async (onProgress?: (processed: number, total: number) => void): Promise<ArrayBuffer | null> => {
    if (!vrmData) {
      return null;
    }

    const replacedTextures = textures.filter(t => t.isReplaced);
    const resizedTextureOptions = ([...resizeOptions.entries()] as [number, number][])
      .filter(([, size]) => size > 0);

    const totalToProcess = replacedTextures.length + resizedTextureOptions.length;
    let processedCount = 0;
    onProgress?.(processedCount, totalToProcess);

    const imagesToProcess = new Map<number, { data: ArrayBuffer; mimeType: string }>();
    const tasks: Promise<void>[] = [];

    for (const texture of replacedTextures) {
      const task = fetch(texture.blobUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          imagesToProcess.set(texture.index, { data: buffer, mimeType: texture.mimeType });
          processedCount++;
          onProgress?.(processedCount, totalToProcess);
        });
      tasks.push(task);
    }

    for (const [textureIndex, size] of resizedTextureOptions) {
      const texture = textures.find(t => t.index === textureIndex);
      if (!texture || texture.isReplaced) {
        continue;
      }

      const task = resizeImage(texture.blobUrl, texture.mimeType, size)
        .then(resizedData => {
          imagesToProcess.set(textureIndex, { data: resizedData, mimeType: texture.mimeType });
          processedCount++;
          onProgress?.(processedCount, totalToProcess);
        });
      tasks.push(task);
    }

    await Promise.all(tasks);

    if (totalToProcess === 0) {
      return null;
    }

    return rebuildGlb(vrmData.json, vrmData.bin, imagesToProcess);
  }, [vrmData, resizeOptions, textures]);

  const handleTextureReplace = useCallback(async (textureIndex: number, file: File) => {
    const newBlobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setTextures(prevTextures => {
        const newTextures = [...prevTextures];
        const targetTextureIndex = newTextures.findIndex(t => t.index === textureIndex);
        if (targetTextureIndex > -1) {
          // Revoke old blob url before replacing
          URL.revokeObjectURL(newTextures[targetTextureIndex].blobUrl);
          newTextures[targetTextureIndex] = {
            ...newTextures[targetTextureIndex],
            blobUrl: newBlobUrl,
            originalWidth: img.width,
            originalHeight: img.height,
            mimeType: file.type,
            isReplaced: true,
          };
        }
        return newTextures;
      });
      // When a texture is replaced, remove its resize option
      setResizeOptions(prev => {
        const newOptions = new Map(prev);
        newOptions.delete(textureIndex);
        return newOptions;
      });
    };
    img.src = newBlobUrl;
  }, []);

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

    const entries = Object.entries(vrmMetadata)
      .filter(([key]) => key !== 'texture' && key !== 'licenseName' && key !== 'licenseUrl')
      .map(([key, value]) => ({
        label: labelMap[key] || formatLabel(key),
        value,
      }))
      .filter(field => field.value !== undefined && field.value !== null && field.value !== '');

    if (vrmMetadata.licenseName || vrmMetadata.licenseUrl) {
      const licenseLabel = vrmMetadata.licenseName || 'License';
      const licenseValue = vrmMetadata.licenseUrl ? (
        <a
          href={vrmMetadata.licenseUrl}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          {licenseLabel}
        </a>
      ) : (
        licenseLabel
      );

      entries.push({ label: 'License', value: licenseValue });
    }

    return entries;
  }, [vrmMetadata]);

  const handleMetadataThumbnailUpload = useCallback(
    (file: File) => {
      if (metadataThumbnailImageIndex === null) {
        return;
      }
      handleTextureReplace(metadataThumbnailImageIndex, file);
    },
    [handleTextureReplace, metadataThumbnailImageIndex]
  );

  const handleMetadataThumbnailClick = useCallback(() => {
    metadataThumbnailInputRef.current?.click();
  }, []);

  const handleMetadataThumbnailSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleMetadataThumbnailUpload(file);
      }

      if (event.target) {
        event.target.value = '';
      }
    },
    [handleMetadataThumbnailUpload]
  );

  const handleGlobalResize = useCallback((size: number) => {
      setGlobalResizeValue(size);
      const newOptions = new Map<number, number>();
      if (size === 0) {
          setResizeOptions(newOptions);
          return;
      }
      textures.forEach(texture => {
        // Don't apply global resize to replaced textures
        if(texture.isReplaced) return;

        const largestDim = Math.max(texture.originalWidth, texture.originalHeight);
        if (size < largestDim) {
            newOptions.set(texture.index, size);
        }
      });
      setResizeOptions(newOptions);
  }, [textures]);

  const changesCount = useMemo(() => {
    const resizedCount = Array.from(resizeOptions.values()).filter((size: number) => size > 0).length;
    const replacedCount = textures.filter(t => t.isReplaced).length;
    return resizedCount + replacedCount;
  }, [resizeOptions, textures]);

  const handleProcessAndDownload = useCallback(async () => {
    if (!vrmData) return;

    setIsLoading(true);
    setError(null);
    updateStatusMessage('Processing textures...');

    try {
      const processedBuffer = await buildProcessedGlb((processed, total) => {
        updateStatusMessage(`Processing textures... (${processed}/${total})`);
      });

      if (!processedBuffer) {
        updateStatusMessage('No texture changes to process.');
        return;
      }

      updateStatusMessage('Rebuilding VRM file...');
      const blob = new Blob([processedBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const originalFilename = vrmFile?.name.replace('.vrm', '') || 'model';
      a.download = `${originalFilename}_processed.vrm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateStatusMessage('Download complete! You can now reset and process another file.');
    } catch (e) {
      if (e instanceof Error) {
        setError(`An error occurred during processing: ${e.message}`);
      } else {
        setError('An unknown error occurred during processing.');
      }
      updateStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [vrmData, vrmFile, buildProcessedGlb]);

  const handlePreviewUpdate = useCallback(async () => {
    if (!vrmData || changesCount === 0) return;

    setIsLoading(true);
    setError(null);
    updateStatusMessage('Processing textures...');

    try {
      const processedBuffer = await buildProcessedGlb((processed, total) => {
        updateStatusMessage(`Processing textures... (${processed}/${total})`);
      });

      if (!processedBuffer) {
        updateStatusMessage('No texture changes to preview.');
        return;
      }

      setVrmPreviewBuffer(processedBuffer);
      updateStatusMessage('Preview updated with your texture changes.', 3000);
    } catch (e) {
      if (e instanceof Error) {
        setError(`An error occurred while updating the preview: ${e.message}`);
      } else {
        setError('An unknown error occurred while updating the preview.');
      }
      updateStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [vrmData, changesCount, buildProcessedGlb]);

  const rightTabs: { id: RightTabId; label: string }[] = [
    { id: 'metadata', label: 'Metadata' },
    { id: 'thumbnail', label: 'Thumbnail' },
    { id: 'textures', label: 'Textures' },
  ];

  const hasTextures = textures.length > 0;
  const showModelSections = hasFinishedInitialLoad && !isInitialUploadLoading;


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-7xl">
        <AppHeader />
        <main className="space-y-6">
          {error && <ErrorBanner message={error} />}
          {(isLoading || statusMessage) && (
            <LoadingIndicator statusMessage={statusMessage} />
          )}

          {!showModelSections ? (
            <UploadPrompt onFileChange={handleFileChange} />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <ModelPreview
                vrmPreviewBuffer={vrmPreviewBuffer}
                changesCount={changesCount}
                hasTextures={hasTextures}
                onPreviewUpdate={handlePreviewUpdate}
                onProcessAndDownload={handleProcessAndDownload}
                onReset={resetState}
              />
              <RightPanel
                activeRightTab={activeRightTab}
                setActiveRightTab={setActiveRightTab}
                vrmMetadata={vrmMetadata}
                metadataFields={metadataFields}
                metadataThumbnailTexture={metadataThumbnailTexture}
                metadataThumbnailImageIndex={metadataThumbnailImageIndex}
                metadataThumbnailInputRef={metadataThumbnailInputRef}
                handleMetadataThumbnailClick={handleMetadataThumbnailClick}
                handleMetadataThumbnailSelected={handleMetadataThumbnailSelected}
                textures={textures}
                resizeOptions={resizeOptions}
                handleResizeChange={handleResizeChange}
                handleTextureReplace={handleTextureReplace}
                handleGlobalResize={handleGlobalResize}
                globalResizeValue={globalResizeValue}
                hasTextures={hasTextures}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;