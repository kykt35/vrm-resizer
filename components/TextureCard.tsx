import React, { useRef } from 'react';
import type { TextureInfo } from '../types';
import { TEXTURE_SIZES } from '../constants/textureSizes';

interface TextureCardProps {
  texture: TextureInfo;
  selectedSize: number;
  onSizeChange: (size: number) => void;
  onReplace: (file: File) => void;
}

const TextureCard: React.FC<TextureCardProps> = ({
  texture,
  selectedSize,
  onSizeChange,
  onReplace,
}) => {
  const availableSizes = TEXTURE_SIZES.filter(
    (size) => size <= texture.originalWidth || size <= texture.originalHeight
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onReplace(file);
    }

    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105 relative">
      {texture.isReplaced && (
        <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
          Replaced
        </span>
      )}
      <img
        src={texture.blobUrl}
        alt={texture.name}
        className="w-full h-48 object-contain bg-gray-700"
      />
      <div className="p-4">
        <h3
          className="font-bold text-lg truncate"
          title={texture.name}
        >
          {texture.name}
        </h3>
        <p className="text-sm text-gray-400">
          {texture.originalWidth} x {texture.originalHeight}
        </p>
        <select
          value={selectedSize}
          onChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
          className="mt-3 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={texture.isReplaced}
        >
          <option value={0}>Keep Original</option>
          {availableSizes.map((size) => (
            <option key={size} value={size}>
              {size} x {size} (Max)
            </option>
          ))}
        </select>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/png, image/jpeg"
          onChange={handleFileSelected}
        />
        <button
          onClick={handleReplaceClick}
          className="mt-2 w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          Replace Texture
        </button>
      </div>
    </div>
  );
};

export default TextureCard;

