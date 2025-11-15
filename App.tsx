import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { TextureInfo, VrmData, VrmMeta } from './types';
import Spinner from './components/Spinner';
import { DownloadIcon, ResetIcon, UploadIcon } from './components/icons';
import TextureCard from './components/TextureCard';
import VrmViewer from './components/VrmViewer';
import { parseGlb, extractTextures, resizeImage, rebuildGlb } from './services/vrmService';
import { TEXTURE_SIZES } from './constants/textureSizes';

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

  const GlobalResizeControl = () => (
    <div className="flex flex-col sm:flex-row items-center gap-2">
      <label htmlFor="global-resize" className="text-gray-300">
        Resize all to (max):
      </label>
      <select
        id="global-resize"
        onChange={e => handleGlobalResize(parseInt(e.target.value, 10))}
        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
      >
        <option value={0}>-- Select Size --</option>
        {TEXTURE_SIZES.slice(1).map(size => (
          <option key={size} value={size}>
            {size} x {size}
          </option>
        ))}
      </select>
    </div>
  );

  const hasTextures = textures.length > 0;
  const showModelSections = hasFinishedInitialLoad && !isInitialUploadLoading;


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white">VRM Texture Resizer</h1>
          <p className="text-lg text-gray-400 mt-2">Reduce VRM file size by optimizing or replacing textures in your browser.</p>
        </header>

        <main className="space-y-6">
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {(isLoading || statusMessage) ? (
            <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-12 text-center">
              <Spinner className="w-16 h-16 mb-4" />
              <p className="text-xl text-gray-300">{statusMessage}</p>
            </div>
          ) : !showModelSections ? (
            <section className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col items-center justify-center gap-4 text-center">
              <UploadIcon className="w-12 h-12 text-gray-500" />
              <p className="text-lg text-gray-400 max-w-sm">
                Upload a VRM file to get started. After the file is parsed we'll show a live preview of your model and the texture controls.
              </p>
              <label className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Select File
                <input type="file" className="hidden" accept=".vrm" onChange={handleFileChange} />
              </label>
            </section>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-2xl font-semibold text-white">Model Preview</h2>
                  <p className="text-sm text-gray-400">Orbit with mouse / pinch to zoom</p>
                </div>
                <div className="min-h-[360px]">
                  {vrmPreviewBuffer && <VrmViewer arrayBuffer={vrmPreviewBuffer} />}
                </div>
                {vrmMetadata && (
                  <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-white">Model Metadata</h3>
                      <span className="text-xs uppercase tracking-wide text-gray-500">Read-only</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1fr,auto]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {metadataFields.length > 0 ? (
                          metadataFields.map(field => (
                            <div key={field.label} className="flex flex-col gap-1 rounded border border-gray-800 bg-gray-800/60 px-3 py-2">
                              <dt className="text-[11px] uppercase tracking-wide text-gray-400">{field.label}</dt>
                              <dd className="text-sm text-gray-200">{field.value}</dd>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">No metadata fields were provided in this VRM.</p>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="relative h-32 w-32 overflow-hidden rounded border border-gray-700 bg-gray-800">
                          {metadataThumbnailTexture ? (
                            <img
                              src={metadataThumbnailTexture.blobUrl}
                              alt="Model thumbnail"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-800 px-2 text-center text-xs text-gray-400">
                              No thumbnail defined
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {metadataThumbnailTexture?.isReplaced ? 'Custom thumbnail applied' : 'Current thumbnail'}
                        </p>
                        <input
                          type="file"
                          ref={metadataThumbnailInputRef}
                          className="hidden"
                          accept="image/png, image/jpeg"
                          onChange={handleMetadataThumbnailSelected}
                        />
                        <button
                          onClick={handleMetadataThumbnailClick}
                          disabled={metadataThumbnailImageIndex === null}
                          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:border-blue-500 enabled:hover:text-blue-200 disabled:opacity-50"
                        >
                          {metadataThumbnailImageIndex === null ? 'Thumbnail not defined' : 'Upload new thumbnail'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {!isLoading && hasTextures && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    <button
                      onClick={handleProcessAndDownload}
                      disabled={changesCount === 0}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2 transition-colors"
                    >
                      <DownloadIcon className="w-5 h-5" />
                      Process & Download ({changesCount} {changesCount === 1 ? 'change' : 'changes'})
                    </button>
                    <button
                      onClick={resetState}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2 transition-colors"
                    >
                      <ResetIcon className="w-5 h-5" />
                      Reset
                    </button>
                  </div>
                )}
              </section>

              {hasTextures && (
                <section className="flex flex-col gap-6">
                  <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
                    <button
                      onClick={handlePreviewUpdate}
                      disabled={changesCount === 0}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2 transition-colors"
                    >
                      Apply to Preview
                    </button>
                    <GlobalResizeControl />
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
                      {textures.map(texture => (
                        <TextureCard
                          key={texture.index}
                          texture={texture}
                          selectedSize={resizeOptions.get(texture.index) || 0}
                          onSizeChange={size => handleResizeChange(texture.index, size)}
                          onReplace={file => handleTextureReplace(texture.index, file)}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;