import type { UserId } from "@recipe/domain";

export interface AuthPort {
  authenticate(request: { headers: Record<string, string> }): Promise<{ userId: UserId }>;
  isDevMode(): boolean;
}
