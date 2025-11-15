import React from 'react';
import { DownloadIcon, ResetIcon } from './icons';
import VrmViewer from './VrmViewer';

type ModelPreviewProps = {
  vrmPreviewBuffer: ArrayBuffer | null;
  changesCount: number;
  hasTextures: boolean;
  onPreviewUpdate: () => Promise<void> | void;
  onProcessAndDownload: () => Promise<void> | void;
  onReset: () => void;
};

const ModelPreview = ({
  vrmPreviewBuffer,
  changesCount,
  hasTextures,
  onPreviewUpdate,
  onProcessAndDownload,
  onReset,
}: ModelPreviewProps) => (
  <section className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-2xl font-semibold text-white">Model Preview</h2>
      <p className="text-sm text-gray-400">Orbit with mouse / pinch to zoom</p>
    </div>
    <div className="mb-4 flex flex-wrap gap-3 justify-between">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onPreviewUpdate}
          disabled={changesCount === 0 || !hasTextures}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          Apply ({changesCount} {changesCount === 1 ? 'change' : 'changes'})
        </button>
        <button
          onClick={onProcessAndDownload}
          disabled={changesCount === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2 transition-colors"
        >
          <DownloadIcon className="w-5 h-5" />
          Download
        </button>
      </div>
      <button
        onClick={onReset}
        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2 transition-colors"
      >
        <ResetIcon className="w-5 h-5" />
        Reset
      </button>
    </div>
    <div className="min-h-[360px]">
      {vrmPreviewBuffer && <VrmViewer arrayBuffer={vrmPreviewBuffer} />}
    </div>
  </section>
);

export default ModelPreview;
