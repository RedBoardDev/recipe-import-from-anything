import type { AuthPort } from "../../application/ports/auth.port.js";
import { AuthStrategyRegistry } from "./registry/auth-registry.js";
import { DevAuthStrategy, JwtAuthStrategy } from "./strategies/index.js";

/**
 * AuthPort implementation using AuthStrategyRegistry
 * Provides clean separation between interface and strategy management
 */
export class StrategyAuthPort implements AuthPort {
  private readonly registry: AuthStrategyRegistry;

  constructor() {
    const strategies = [new JwtAuthStrategy(), new DevAuthStrategy()];
    this.registry = new AuthStrategyRegistry(strategies);
  }

  async authenticate(request: {
    headers: Record<string, string>;
  }): Promise<{ userId: import("@recipe/domain").UserId }> {
    return this.registry.authenticate(request);
  }

  isDevMode(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  getRegistry(): AuthStrategyRegistry {
    return this.registry;
  }
}

export function createAuthPort(): AuthPort {
  return new StrategyAuthPort();
}
