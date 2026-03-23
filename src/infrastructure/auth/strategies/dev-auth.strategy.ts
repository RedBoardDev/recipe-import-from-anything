import { UserId } from "@recipe/domain";
import type { AuthStrategy } from "../../../application/ports/auth-strategy.js";

/**
 * Dev Mode Authentication Strategy
 * Lower priority (10) - should be tried after JWT, only in non-production
 */
export class DevAuthStrategy implements AuthStrategy {
  readonly name = "dev";
  readonly priority = 10;

  private readonly isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
  }

  supports(request: { headers: Record<string, string> }): boolean {
    if (this.isProduction) {
      return false;
    }
    const userId = request.headers["x-user-id"];
    return typeof userId === "string" && userId.trim().length > 0;
  }

  async authenticate(request: { headers: Record<string, string> }): Promise<{ userId: UserId }> {
    if (this.isProduction) {
      throw new Error("Dev authentication is not allowed in production");
    }

    const userId = request.headers["x-user-id"];
    if (!userId || typeof userId !== "string") {
      throw new Error("Missing x-user-id header in dev mode");
    }
    return { userId: new UserId(userId) };
  }
}
