import * as crypto from "node:crypto";

export interface JwtPayload {
  sub: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
}

type JwtServiceOptions = Readonly<{
  secret?: string;
  issuer?: string;
  audience?: string;
  expirationMinutes?: number;
}>;

export class JwtService {
  private readonly secret?: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly expirationMinutes: number;

  constructor(options: JwtServiceOptions = {}) {
    this.secret = options.secret ?? process.env.JWT_SECRET;
    this.issuer = options.issuer ?? process.env.JWT_ISSUER ?? "recipe-import";
    this.audience = options.audience ?? process.env.JWT_AUDIENCE ?? "recipe-import-api";
    this.expirationMinutes = options.expirationMinutes ?? 15;
  }

  verifyToken(token: string): JwtPayload {
    const secret = this.secret;
    if (!secret) {
      throw new Error("JWT_SECRET is required for JWT authentication");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (signatureB64 !== expectedSignature) {
      throw new Error("Invalid token signature");
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as JwtPayload;

    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error("Token expired");
    }

    if (payload.iss && payload.iss !== this.issuer) {
      throw new Error("Invalid token issuer");
    }

    if (payload.aud && payload.aud !== this.audience) {
      throw new Error("Invalid token audience");
    }

    return payload;
  }

  createToken(userId: string): string {
    const secret = this.secret;
    if (!secret) {
      throw new Error("JWT_SECRET is required for JWT token generation");
    }

    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: userId,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + this.expirationMinutes * 60,
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest("base64url");

    return `${headerB64}.${payloadB64}.${signature}`;
  }
}
