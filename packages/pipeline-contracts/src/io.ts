export type FetchResult = Readonly<{
  html: string;
  status: number;
  headers: Record<string, string>;
}>;

export type FetchClient = Readonly<{
  fetch(
    url: string,
    options?: Readonly<{ signal?: AbortSignal; headers?: Record<string, string> }>,
  ): Promise<FetchResult>;
}>;

export type TempInputStore = Readonly<{
  save(data: Buffer): Promise<string>;
  get(ref: string): Promise<Buffer | null>;
  delete(ref: string): Promise<void>;
}>;

export type Logger = Readonly<{
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, context?: object): void;
  debug(message: string, context?: object): void;
}>;
