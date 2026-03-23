type ImageDescriptor = Readonly<{
  extension: string;
  mimeType: string;
}>;

const MAGIC_NUMBERS: Readonly<Record<string, ImageDescriptor>> = {
  ffd8ffe0: { extension: "jpg", mimeType: "image/jpeg" },
  ffd8ffe1: { extension: "jpg", mimeType: "image/jpeg" },
  "89504e47": { extension: "png", mimeType: "image/png" },
  "47494638": { extension: "gif", mimeType: "image/gif" },
  "52494646": { extension: "webp", mimeType: "image/webp" },
};

export const detectImageFormat = (bytes: Buffer): ImageDescriptor | null => {
  if (bytes.length < 4) return null;

  const magic = bytes.subarray(0, 4).toString("hex").toLowerCase();
  return MAGIC_NUMBERS[magic] ?? null;
};

export const isSupportedImageFormat = (bytes: Buffer): boolean => {
  return detectImageFormat(bytes) !== null;
};

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
