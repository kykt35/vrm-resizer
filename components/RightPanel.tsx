import React from 'react';
import type { TextureInfo, VrmMeta } from '../types';
import TextureCard from './TextureCard';
import GlobalResizeControl from './GlobalResizeControl';

export type RightTabId = 'metadata' | 'thumbnail' | 'textures';

type MetadataField = {
  label: string;
  value: React.ReactNode;
};

type MetadataTabProps = {
  metadata: VrmMeta | null;
  fields: MetadataField[];
};

const MetadataTab = ({ metadata, fields }: MetadataTabProps) => (
  <>
    {metadata ? (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">Model Metadata</h3>
          <span className="text-xs uppercase tracking-wide text-gray-500">Read-only</span>
        </div>
        {fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(field => (
              <div key={field.label} className="flex flex-col gap-1 rounded border border-gray-800 bg-gray-800/60 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-gray-400">{field.label}</dt>
                <dd className="text-sm text-gray-200">{field.value}</dd>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No metadata fields were provided in this VRM.</p>
        )}
      </div>
    ) : (
      <p className="text-sm text-gray-400">No metadata was provided in this VRM.</p>
    )}
  </>
);

type ThumbnailTabProps = {
  metadataThumbnailTexture: TextureInfo | null;
  metadataThumbnailImageIndex: number | null;
  metadataThumbnailInputRef: React.RefObject<HTMLInputElement>;
  onThumbnailClick: () => void;
  onThumbnailSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const ThumbnailTab = ({
  metadataThumbnailTexture,
  metadataThumbnailImageIndex,
  metadataThumbnailInputRef,
  onThumbnailClick,
  onThumbnailSelected,
}: ThumbnailTabProps) => (
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
      onChange={onThumbnailSelected}
    />
    <button
      onClick={onThumbnailClick}
      disabled={metadataThumbnailImageIndex === null}
      className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:border-blue-500 enabled:hover:text-blue-200 disabled:opacity-50"
    >
      {metadataThumbnailImageIndex === null ? 'Thumbnail not defined' : 'Upload new thumbnail'}
    </button>
    <p className="text-sm text-gray-400 max-w-sm">
      Upload a replacement thumbnail to keep metadata in sync with your model preview.
    </p>
  </div>
);

type TexturesTabProps = {
  textures: TextureInfo[];
  hasTextures: boolean;
  resizeOptions: Map<number, number>;
  onResizeChange: (textureIndex: number, size: number) => void;
  onReplace: (textureIndex: number, file: File) => void;
  onGlobalResize: (size: number) => void;
  globalResizeValue: number;
};

const TexturesTab = ({
  textures,
  hasTextures,
  resizeOptions,
  onResizeChange,
  onReplace,
  onGlobalResize,
  globalResizeValue,
}: TexturesTabProps) => (
  <div className="space-y-4">
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 flex flex-col gap-4">
      <GlobalResizeControl value={globalResizeValue} onChange={onGlobalResize} />
    </div>
    {hasTextures ? (
      <div className="max-h-[55vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {textures.map(texture => (
            <TextureCard
              key={texture.index}
              texture={texture}
              selectedSize={resizeOptions.get(texture.index) || 0}
              onSizeChange={size => onResizeChange(texture.index, size)}
              onReplace={file => onReplace(texture.index, file)}
            />
          ))}
        </div>
      </div>
    ) : (
      <p className="text-sm text-gray-400">No textures were extracted from this VRM.</p>
    )}
  </div>
);

type RightPanelProps = {
  activeRightTab: RightTabId;
  setActiveRightTab: (tab: RightTabId) => void;
  vrmMetadata: VrmMeta | null;
  metadataFields: MetadataField[];
  metadataThumbnailTexture: TextureInfo | null;
  metadataThumbnailImageIndex: number | null;
  metadataThumbnailInputRef: React.RefObject<HTMLInputElement>;
  handleMetadataThumbnailClick: () => void;
  handleMetadataThumbnailSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  textures: TextureInfo[];
  resizeOptions: Map<number, number>;
  handleResizeChange: (textureIndex: number, size: number) => void;
  handleTextureReplace: (textureIndex: number, file: File) => void;
  handleGlobalResize: (size: number) => void;
  globalResizeValue: number;
  hasTextures: boolean;
};

const rightTabs: { id: RightTabId; label: string }[] = [
  { id: 'metadata', label: 'Metadata' },
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'textures', label: 'Textures' },
];

const RightPanel = ({
  activeRightTab,
  setActiveRightTab,
  vrmMetadata,
  metadataFields,
  metadataThumbnailTexture,
  metadataThumbnailImageIndex,
  metadataThumbnailInputRef,
  handleMetadataThumbnailClick,
  handleMetadataThumbnailSelected,
  textures,
  resizeOptions,
  handleResizeChange,
  handleTextureReplace,
  handleGlobalResize,
  globalResizeValue,
  hasTextures,
}: RightPanelProps) => (
  <section className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col">
    <div className="flex flex-wrap gap-2 border-b border-gray-700 px-4 py-3">
      {rightTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveRightTab(tab.id)}
          className={`flex-1 rounded-md border border-transparent px-3 py-2 text-sm font-semibold transition-colors ${
            activeRightTab === tab.id
              ? 'bg-gray-900 border-blue-500 text-white'
              : 'bg-gray-900/60 text-gray-400 hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
    <div className="space-y-4 p-4">
      {activeRightTab === 'metadata' ? (
        <MetadataTab metadata={vrmMetadata} fields={metadataFields} />
      ) : activeRightTab === 'thumbnail' ? (
        <ThumbnailTab
          metadataThumbnailTexture={metadataThumbnailTexture}
          metadataThumbnailImageIndex={metadataThumbnailImageIndex}
          metadataThumbnailInputRef={metadataThumbnailInputRef}
          onThumbnailClick={handleMetadataThumbnailClick}
          onThumbnailSelected={handleMetadataThumbnailSelected}
        />
      ) : (
        <TexturesTab
          textures={textures}
          hasTextures={hasTextures}
          resizeOptions={resizeOptions}
          onResizeChange={handleResizeChange}
          onReplace={handleTextureReplace}
          onGlobalResize={handleGlobalResize}
          globalResizeValue={globalResizeValue}
        />
      )}
    </div>
  </section>
);

export default RightPanel;
