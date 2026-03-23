import { Identifier } from "./Identifier";

export class UniqueEntityID extends Identifier<string> {
  constructor(id?: string) {
    // * Generates a random ID if none is provided.
    // * Note: This ID is only used for internal entity validation.
    // * For persistence, Prisma automatically generates a UUID v7 via @default(uuid(7))
    super(id ? id : Math.random().toString(36).substring(2, 15));
  }
}
