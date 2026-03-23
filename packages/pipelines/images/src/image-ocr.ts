import type { Logger, OcrClient } from "@recipe/pipeline-contracts";

type ImageToProcess = Readonly<{
  inputRef: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
}>;

/**
 * Vérifie si l'OCR a produit du texte significatif
 */
const isSignificantOcrResult = (markdown: string): boolean => {
  return markdown.trim().length > 20; // Minimum 20 caractères
};

export const processImageWithOcr = async (
  image: ImageToProcess,
  ocrClient: OcrClient,
  index: number,
  logger?: Logger,
): Promise<{
  markdown: string;
  success: boolean;
}> => {
  try {
    const ocrResult = await ocrClient.extract({
      document: {
        bytes: image.bytes,
        filename: image.filename,
        mimeType: image.mimeType,
      },
    });

    const markdown = ocrResult.pages
      .map((page) => page.markdown.trim())
      .filter(Boolean)
      .join("\n\n");

    const success = isSignificantOcrResult(markdown);

    if (!success && logger) {
      logger.warn(`Image ${index + 1}: No significant text extracted from OCR`);
    }

    return { markdown, success };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (logger) {
      logger.warn(`Image ${index + 1} OCR failed: ${errorMessage}`);
    }
    return { markdown: "", success: false };
  }
};
