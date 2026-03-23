import { UserId } from "@recipe/domain";
import type { AuthStrategy } from "../../../application/ports/auth-strategy.js";
import { JwtService } from "../../jwt-service.js";

/**
 * JWT Authentication Strategy
 * High priority (100) - should be tried first in production
 */
export class JwtAuthStrategy implements AuthStrategy {
  readonly name = "jwt";
  readonly priority = 100;

  private readonly jwtService: JwtService;

  constructor() {
    this.jwtService = new JwtService();
  }

  supports(request: { headers: Record<string, string> }): boolean {
    const authHeader = request.headers.authorization;
    return typeof authHeader === "string" && authHeader.startsWith("Bearer ");
  }

  async authenticate(request: { headers: Record<string, string> }): Promise<{ userId: UserId }> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or invalid Authorization header");
    }

    const token = authHeader.substring(7);
    const payload = this.jwtService.verifyToken(token);
    return { userId: new UserId(payload.sub) };
  }

  createToken(userId: string): string {
    return this.jwtService.createToken(userId);
  }
}
