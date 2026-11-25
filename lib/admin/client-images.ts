'use client';

// Browser-side replacement for the server sharp() sanitiser in ./images.ts.
// Mirrors its contract: strip all metadata (EXIF/ICC), cap dimensions to
// 2400x2400, re-encode as WebP, enforce min 320x240 and max 5 MiB. Canvas
// re-encoding never carries EXIF, so the privacy guarantee is preserved.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

export interface SanitisedImage {
  data: ArrayBuffer;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image.'));
    img.src = src;
  });
}

export async function sanitiseImageClient(file: File): Promise<SanitisedImage> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Choose an image no larger than 5 MiB');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (img.naturalWidth < MIN_WIDTH || img.naturalHeight < MIN_HEIGHT) {
      throw new Error('Photograph must be at least 320 × 240 pixels');
    }
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(MIN_WIDTH, Math.round(img.naturalWidth * scale));
    const height = Math.max(MIN_HEIGHT, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process the image.');
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob) throw new Error('Could not encode the image as WebP.');
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('Processed photograph is outside supported bounds');
    return { data: await blob.arrayBuffer(), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
