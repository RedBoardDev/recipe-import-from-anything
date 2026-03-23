import type { PipelineMeta } from "@recipe/pipeline-contracts";
import { z } from "zod";

const imageRefSchema = z.string().trim().min(1);

const rawImagesInputSchema = z
  .object({
    imageRef: imageRefSchema.optional(),
    imageRefs: z.array(imageRefSchema).min(1).max(4).optional(),
  })
  .superRefine((value, context) => {
    const hasSingleRef = value.imageRef !== undefined;
    const hasMultipleRefs = value.imageRefs !== undefined && value.imageRefs.length > 0;

    if (!hasSingleRef && !hasMultipleRefs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one image reference is required (max 4)",
        path: ["imageRef"],
      });
    }
  });

const normalizeImageRefs = (value: z.output<typeof rawImagesInputSchema>): readonly string[] => {
  const refs = [...(value.imageRefs ?? []), ...(value.imageRef ? [value.imageRef] : [])];
  return refs.filter((entry, index) => refs.indexOf(entry) === index);
};

export const imagesInputSchema = rawImagesInputSchema.transform((value) => ({
  imageRefs: normalizeImageRefs(value),
}));

export const meta: PipelineMeta<typeof imagesInputSchema> = {
  pipelineId: "images",
  title: "Image Import",
  description: "Extract a recipe from one or more images (screenshots, Instagram, photos).",
  steps: [
    { id: "collecting", label: "Loading images", category: "collecting" },
    { id: "extracting", label: "Extracting text", category: "extracting" },
  ],
  inputSchema: imagesInputSchema,
};
