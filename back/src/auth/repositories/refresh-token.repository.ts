import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export type StoredRefreshToken = {
  id: string; // jti
  userId: number;
  hashedToken: string;
  expiresAt: Date;
  revoked: boolean;
};

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(token: StoredRefreshToken): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { id: token.id },
      update: {
        hashedToken: token.hashedToken,
        expiresAt: token.expiresAt,
        revoked: token.revoked,
        userId: token.userId,
      },
      create: {
        id: token.id,
        userId: token.userId,
        hashedToken: token.hashedToken,
        expiresAt: token.expiresAt,
        revoked: token.revoked,
      },
    });
  }

  async find(id: string): Promise<StoredRefreshToken | undefined> {
    const token = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!token) return undefined;

    const { id: tokenId, userId, hashedToken, expiresAt, revoked } = token;
    return { id: tokenId, userId, hashedToken, expiresAt, revoked };
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id },
      data: { revoked: true },
    });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }
}
