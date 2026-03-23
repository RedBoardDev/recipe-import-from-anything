import { imageAnnotationSchema } from "./image-schema.js";

export const imageAnnotationPrompt = [
  "Extract a schema.org Recipe object from this image of a recipe.",
  "The image may be a screenshot, Instagram post, or photo of a recipe book.",
  "Ignore UI elements (buttons, icons, likes, comments, navigation bars).",
  "Focus on actual recipe content: title, ingredients, instructions.",
  "If the image is from Instagram, ignore social media metadata (handles, hashtags).",
  "Return only recipe fields that are explicitly visible in the image.",
  "Never invent missing values.",
  "When uncertain, leave fields null or omitted.",
  "Keep ingredient and instruction order as they appear in the source.",
].join(" ");

export const imageAnnotationFallbackPrompt = [
  "Extract recipe information from this image text.",
  "The text may contain noise (buttons, comments, social elements).",
  "Focus on identifying: recipe title, ingredients list, and cooking instructions.",
  "Return a JSON object with schema.org Recipe field names.",
  "Use null or omit unknown fields.",
].join(" ");

export { imageAnnotationSchema };
