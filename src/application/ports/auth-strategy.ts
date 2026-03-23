import type { UserId } from "@recipe/domain";

export interface AuthStrategy {
  readonly name: string;

  /**
   * Priority for strategy selection (higher = checked first)
   */
  readonly priority: number;

  /**
   * Check if this strategy can handle the request
   */
  supports(request: AuthRequest): boolean;

  authenticate(request: AuthRequest): Promise<{ userId: UserId }>;
}

export interface AuthRequest {
  headers: Record<string, string>;
  url?: string;
}
