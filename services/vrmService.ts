
import type { TextureInfo } from '../types';

const GLB_HEADER_SIZE = 12;
const CHUNK_HEADER_SIZE = 8;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

const textDecoder = new TextDecoder('utf-8');

/**
 * Parses a GLB file buffer into its JSON and BIN chunks.
 */
export const parseGlb = (arrayBuffer: ArrayBuffer): { json: any; bin: Uint8Array } => {
  const dataView = new DataView(arrayBuffer);
  const magic = dataView.getUint32(0, true);
  if (magic !== 0x46546c67) {
    throw new Error('Invalid GLB file: Missing magic number.');
  }
  const version = dataView.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported glTF version: ${version}. Only version 2 is supported.`);
  }

  let json;
  let bin;

  let chunkOffset = GLB_HEADER_SIZE;
  while (chunkOffset < arrayBuffer.byteLength) {
    const chunkLength = dataView.getUint32(chunkOffset, true);
    const chunkType = dataView.getUint32(chunkOffset + 4, true);
    const chunkDataOffset = chunkOffset + CHUNK_HEADER_SIZE;

    if (chunkType === JSON_CHUNK_TYPE) {
      const jsonBytes = new Uint8Array(arrayBuffer, chunkDataOffset, chunkLength);
      const jsonString = textDecoder.decode(jsonBytes);
      json = JSON.parse(jsonString);
    } else if (chunkType === BIN_CHUNK_TYPE) {
      bin = new Uint8Array(arrayBuffer, chunkDataOffset, chunkLength);
    }

    chunkOffset += CHUNK_HEADER_SIZE + chunkLength;
  }

  if (!json || !bin) {
    throw new Error('Invalid GLB file: Missing JSON or BIN chunk.');
  }

  return { json, bin };
};

/**
 * Extracts texture information from parsed GLB data.
 */
export const extractTextures = async (json: any, bin: Uint8Array): Promise<TextureInfo[]> => {
  const { images, bufferViews, textures } = json;
  if (!images || !bufferViews) return [];

  const textureInfos: TextureInfo[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const bufferView = bufferViews[image.bufferView];
    const imageData = bin.slice(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength);
    const blob = new Blob([imageData], { type: image.mimeType });
    const blobUrl = URL.createObjectURL(blob);
    
    const { width, height } = await getImageDimensions(blobUrl);
    
    const textureName = textures?.find((t: any) => t.source === i)?.name || image.name;

    textureInfos.push({
      index: i,
      name: textureName || `Texture ${i}`,
      originalWidth: width,
      originalHeight: height,
      blobUrl,
      mimeType: image.mimeType,
      bufferViewIndex: image.bufferView,
    });
  }

  return textureInfos;
};

const getImageDimensions = (blobUrl: string): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = blobUrl;
  });
};

/**
 * Resizes an image blob to a new maximum dimension.
 */
export const resizeImage = (blobUrl: string, mimeType: string, newSize: number): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            
            let { width, height } = img;
            if (width > height) {
                if (width > newSize) {
                    height = Math.round(height * (newSize / width));
                    width = newSize;
                }
            } else {
                if (height > newSize) {
                    width = Math.round(width * (newSize / height));
                    height = newSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(async (resizedBlob) => {
                if (!resizedBlob) return reject(new Error('Failed to create blob from canvas'));
                resolve(await resizedBlob.arrayBuffer());
            }, mimeType, 0.9);
        };
        img.onerror = reject;
        img.src = blobUrl;
    });
};

/**
 * Rebuilds the GLB file with resized textures.
 */
export const rebuildGlb = (
  originalJson: any,
  originalBin: Uint8Array,
  resizedImages: Map<number, { data: ArrayBuffer; mimeType: string }>
): ArrayBuffer => {
  const newJson = JSON.parse(JSON.stringify(originalJson));
  const bufferViewDataMap = new Map<number, Uint8Array>();
  
  // Create a map from bufferView index to image index
  const bufferViewToImageIndex = new Map<number, number>();
  newJson.images.forEach((img: any, index: number) => {
    bufferViewToImageIndex.set(img.bufferView, index);
  });

  // Populate map with original or resized data for each buffer view
  for(let i = 0; i < newJson.bufferViews.length; i++) {
    const bv = newJson.bufferViews[i];
    const imageIndex = bufferViewToImageIndex.get(i);
    
    if (imageIndex !== undefined && resizedImages.has(imageIndex)) {
      const resizedData = resizedImages.get(imageIndex)!.data;
      bufferViewDataMap.set(i, new Uint8Array(resizedData));
    } else {
      const originalData = originalBin.slice(bv.byteOffset, bv.byteOffset + bv.byteLength);
      bufferViewDataMap.set(i, originalData);
    }
  }

  // Reconstruct BIN and update JSON offsets
  const newBinChunks: Uint8Array[] = [];
  let currentOffset = 0;
  for (let i = 0; i < newJson.bufferViews.length; i++) {
    const data = bufferViewDataMap.get(i)!;
    newJson.bufferViews[i].byteOffset = currentOffset;
    newJson.bufferViews[i].byteLength = data.byteLength;
    newBinChunks.push(data);
    currentOffset += data.byteLength;
  }
  
  newJson.buffers[0].byteLength = currentOffset;

  const newBin = new Uint8Array(currentOffset);
  let offset = 0;
  for (const chunk of newBinChunks) {
    newBin.set(chunk, offset);
    offset += chunk.length;
  }
  
  // Serialize JSON and pad
  let jsonString = JSON.stringify(newJson);
  const jsonPadding = (4 - (jsonString.length % 4)) % 4;
  jsonString += ' '.repeat(jsonPadding);
  const jsonBytes = new TextEncoder().encode(jsonString);

  // Pad BIN
  const binPadding = (4 - (newBin.byteLength % 4)) % 4;
  const finalBin = new Uint8Array(newBin.byteLength + binPadding);
  finalBin.set(newBin, 0);

  // Create final GLB
  const totalLength = GLB_HEADER_SIZE + (CHUNK_HEADER_SIZE + jsonBytes.length) + (CHUNK_HEADER_SIZE + finalBin.length);
  const finalBuffer = new ArrayBuffer(totalLength);
  const dataView = new DataView(finalBuffer);

  let bufferOffset = 0;

  // GLB Header
  dataView.setUint32(bufferOffset, 0x46546c67, true); // magic
  dataView.setUint32(bufferOffset + 4, 2, true); // version
  dataView.setUint32(bufferOffset + 8, totalLength, true); // length
  bufferOffset += GLB_HEADER_SIZE;

  // JSON Chunk
  dataView.setUint32(bufferOffset, jsonBytes.length, true);
  dataView.setUint32(bufferOffset + 4, JSON_CHUNK_TYPE, true);
  new Uint8Array(finalBuffer, bufferOffset + CHUNK_HEADER_SIZE, jsonBytes.length).set(jsonBytes);
  bufferOffset += CHUNK_HEADER_SIZE + jsonBytes.length;

  // BIN Chunk
  dataView.setUint32(bufferOffset, finalBin.length, true);
  dataView.setUint32(bufferOffset + 4, BIN_CHUNK_TYPE, true);
  new Uint8Array(finalBuffer, bufferOffset + CHUNK_HEADER_SIZE, finalBin.length).set(finalBin);
  
  return finalBuffer;
};
