import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { TextureInfo, VrmData } from './types';
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

  const statusMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [textures, updateStatusMessage]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.vrm')) {
      setError('Invalid file type. Please upload a .vrm file.');
      return;
    }

    resetState();
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

    } catch (e: any) {
      setError(`Failed to process VRM file: ${e.message}`);
      resetState();
    } finally {
      setIsLoading(false);
      updateStatusMessage('');
    }
  }, [resetState]);

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
        <label htmlFor="global-resize" className="text-gray-300">Resize all to (max):</label>
        <select
            id="global-resize"
            onChange={(e) => handleGlobalResize(parseInt(e.target.value, 10))}
            className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
        >
            <option value={0}>-- Select Size --</option>
            {TEXTURE_SIZES.slice(1).map(size => (
                <option key={size} value={size}>{size} x {size}</option>
            ))}
        </select>
    </div>
);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white">VRM Texture Resizer</h1>
          <p className="text-lg text-gray-400 mt-2">Reduce VRM file size by optimizing or replacing textures in your browser.</p>
        </header>

        <main>
          <div className={`grid gap-6 ${textures.length > 0 ? 'xl:grid-cols-2' : ''}`}>
            <section className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-white">Model Preview</h2>
                <p className="text-sm text-gray-400">Orbit with mouse / pinch to zoom</p>
              </div>
              <div className="min-h-[360px]">
                {vrmPreviewBuffer ? (
                  <VrmViewer arrayBuffer={vrmPreviewBuffer} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-600 bg-gray-900/40 p-6 text-center text-sm text-gray-400">
                    <UploadIcon className="w-10 h-10 text-gray-500" />
                    <p>Upload a VRM file to see a live preview of your model.</p>
                    <label className="mt-2 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                      Select File
                      <input type="file" className="hidden" accept=".vrm" onChange={handleFileChange} />
                    </label>
                  </div>
                )}
              </div>
              {!isLoading && textures.length > 0 && (
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

            <section className="flex flex-col gap-6">
              {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative" role="alert">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              {(isLoading || statusMessage) && (
                <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-12 text-center">
                  <Spinner className="w-16 h-16 mb-4" />
                  <p className="text-xl text-gray-300">{statusMessage}</p>
                </div>
              )}



              {!isLoading && textures.length > 0 && (
                <div className="flex flex-col gap-6">
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
                          onSizeChange={(size) => handleResizeChange(texture.index, size)}
                          onReplace={(file) => handleTextureReplace(texture.index, file)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;