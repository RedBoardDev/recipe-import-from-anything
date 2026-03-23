export type OcrDocument = Readonly<{
  bytes: Buffer;
  filename: string;
  mimeType: string;
}>;

export type OcrPage = Readonly<{
  index: number;
  markdown: string;
}>;

export type OcrUsageInfo = Readonly<{
  pagesProcessed?: number;
  docSizeBytes?: number;
}>;

export type OcrRequest = Readonly<{
  document: OcrDocument;
  model?: string;
  documentAnnotationPrompt?: string;
  documentAnnotationSchema?: Record<string, unknown>;
}>;

export type OcrResponse = Readonly<{
  model: string;
  pages: readonly OcrPage[];
  documentAnnotation?: string;
  usage?: OcrUsageInfo;
}>;

export type OcrClient = Readonly<{
  extract(request: OcrRequest, options?: Readonly<{ signal?: AbortSignal }>): Promise<OcrResponse>;
}>;
