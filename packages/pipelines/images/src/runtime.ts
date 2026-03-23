import { Warning } from "@recipe/domain";
import type { Logger, OcrClient, PipelineInput, PipelineRuntime } from "@recipe/pipeline-contracts";
import { detectImageFormat, isSupportedImageFormat } from "./image-format.js";
import { processImageWithOcr } from "./image-ocr.js";
import type { meta } from "./meta.js";

type ImagesInput = PipelineInput<typeof meta.inputSchema>;

type PreparedImage = Readonly<{
  inputRef: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
}>;

const sourceValueFromRefs = (imageRefs: readonly string[]): string =>
  imageRefs.length === 1 ? imageRefs[0] : imageRefs.join(",");

/**
 * Estimates OCR confidence from success rate and extracted text volume.
 */
const calculateExtractionConfidence = (totalImages: number, successfulOcr: number, totalTextLength: number): number => {
  if (totalImages === 0) return 0;

  const successRate = successfulOcr / totalImages;
  let confidence = successRate * 0.7;

  const averageTextLength = totalTextLength / successfulOcr;
  if (averageTextLength > 100) {
    confidence += 0.3;
  } else if (averageTextLength > 50) {
    confidence += 0.15;
  }

  return Math.min(1, Math.max(0, confidence));
};

const ensureActive = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new Error("Pipeline aborted");
  }
};

const appendWarning = (warnings: readonly Warning[], code: Warning["code"], message: string): Warning[] => [
  ...warnings,
  new Warning(code, message),
];

/**
 * Collects images from input refs.
 */
const collectImages = async (
  imageRefs: readonly string[],
  deps: Parameters<PipelineRuntime<ImagesInput>["execute"]>[1],
): Promise<readonly PreparedImage[]> => {
  const images: PreparedImage[] = [];

  for (let i = 0; i < imageRefs.length; i++) {
    const index = i;
    const imageRef = imageRefs[i];
    ensureActive(deps.signal);

    const bytes = await deps.inputs.get(imageRef);
    if (!bytes) {
      deps.logger.warn(`Image input not found for ref: ${imageRef}`, {
        jobId: deps.context.jobId,
      });
      continue;
    }

    if (!isSupportedImageFormat(bytes)) {
      deps.logger.warn(`Unsupported image format for ref: ${imageRef}`, {
        jobId: deps.context.jobId,
      });
      continue;
    }

    const descriptor = detectImageFormat(bytes);
    if (!descriptor) {
      deps.logger.warn(`Could not detect image format for ref: ${imageRef}`, {
        jobId: deps.context.jobId,
      });
      continue;
    }

    images.push({
      inputRef: imageRef,
      bytes,
      filename: `recipe-${index + 1}.${descriptor.extension}`,
      mimeType: descriptor.mimeType,
    });
  }

  return images;
};

/**
 * Processes one image with OCR and returns the extracted markdown.
 */
const processImageWithOcrWrapper = async (
  image: PreparedImage,
  index: number,
  ocr: OcrClient | undefined,
  logger: Logger | undefined,
): Promise<{ markdown: string; success: boolean }> => {
  if (!ocr) {
    throw new Error("OCR client is not configured for images pipeline");
  }

  return processImageWithOcr(image, ocr, index, logger);
};

export const runtime: PipelineRuntime<ImagesInput> = {
  execute: async (input, deps, reporter) => {
    let warnings: Warning[] = [];

    reporter.checkpoint("job_pickup");
    ensureActive(deps.signal);

    reporter.setStatus("collecting");

    const images = await collectImages(input.imageRefs, deps);

    if (images.length === 0) {
      throw new Error("No supported images available to process");
    }

    reporter.checkpoint("images_loaded");
    ensureActive(deps.signal);

    reporter.setStatus("extracting");
    reporter.checkpoint("ocr_started");

    const ocrResults = await Promise.all(
      images.map((image, index) => processImageWithOcrWrapper(image, index, deps.ocr, deps.logger)),
    );

    const successfulResults = ocrResults.filter((r) => r.success);
    const markdowns = successfulResults.map((r) => r.markdown);

    if (markdowns.length === 0) {
      throw new Error("No recipe data could be extracted from any image");
    }

    const rawText = markdowns.join("\n\n---\n\n");

    for (let i = 0; i < markdowns.length; i++) {
      reporter.log(`Processed image ${i + 1}/${markdowns.length}`);
    }

    const totalTextLength = markdowns.reduce((sum, text) => sum + text.length, 0);
    const extractionConfidence = calculateExtractionConfidence(
      images.length,
      successfulResults.length,
      totalTextLength,
    );

    if (successfulResults.length < images.length) {
      warnings = appendWarning(
        warnings,
        "PARTIAL_EXTRACTION",
        `${images.length - successfulResults.length} image(s) could not be processed`,
      );
    }

    ensureActive(deps.signal);

    return {
      rawText,
      artifactRefs: input.imageRefs,
      metadata: {
        sourceType: "images",
        sourceValue: sourceValueFromRefs(input.imageRefs),
        extractionConfidence,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};
