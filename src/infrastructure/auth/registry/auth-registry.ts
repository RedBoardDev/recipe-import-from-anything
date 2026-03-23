import type { UserId } from "@recipe/domain";
import type { AuthRequest, AuthStrategy } from "../../../application/ports/auth-strategy.js";

/**
 * Registry for managing authentication strategies
 * Implements Chain of Responsibility pattern for auth strategy selection
 */
export class AuthStrategyRegistry {
  private readonly strategies: AuthStrategy[];

  constructor(strategies: AuthStrategy[]) {
    // Sort by priority descending (highest priority first)
    this.strategies = [...strategies].sort((a, b) => b.priority - a.priority);
  }

  async authenticate(request: AuthRequest): Promise<{ userId: UserId }> {
    for (const strategy of this.strategies) {
      if (strategy.supports(request)) {
        return strategy.authenticate(request);
      }
    }
    throw new Error("No authentication strategy available for this request");
  }

  addStrategy(strategy: AuthStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  getStrategies(): AuthStrategy[] {
    return [...this.strategies];
  }
}
