import { UserId } from "@recipe/domain";
import type { AuthPort } from "../application/ports.js";
import { JwtService } from "./jwt-service.js";

class DevAuthPort implements AuthPort {
  async authenticate(request: { headers: Record<string, string> }): Promise<{ userId: UserId }> {
    const userId = request.headers["x-user-id"];
    if (!userId || typeof userId !== "string") {
      throw new Error("Missing x-user-id header in dev mode");
    }
    return { userId: new UserId(userId) };
  }

  isDevMode(): boolean {
    return true;
  }
}

class JwtAuthPort implements AuthPort {
  private readonly jwtService: JwtService;

  constructor() {
    this.jwtService = new JwtService();
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

  isDevMode(): boolean {
    return false;
  }

  createToken(userId: string): string {
    return this.jwtService.createToken(userId);
  }
}

class PriorityAuthPort implements AuthPort {
  private readonly jwtPort: JwtAuthPort;
  private readonly devPort: DevAuthPort;
  private readonly isProduction: boolean;

  constructor() {
    this.jwtPort = new JwtAuthPort();
    this.devPort = new DevAuthPort();
    this.isProduction = process.env.NODE_ENV === "production";
  }

  async authenticate(request: { headers: Record<string, string> }): Promise<{ userId: UserId }> {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        return await this.jwtPort.authenticate(request);
      } catch {
        throw new Error("JWT authentication failed");
      }
    }

    if (this.isProduction) {
      throw new Error("Authorization header with Bearer token is required in production");
    }

    return this.devPort.authenticate(request);
  }

  isDevMode(): boolean {
    return !this.isProduction;
  }
}

export function createAuthPort(): AuthPort {
  return new PriorityAuthPort();
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET is required");
  }
  return secret;
}
