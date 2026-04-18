import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import sharedAuthConfig, { getOAuthProviderMetadata } from '@/auth.config';
import { prisma } from '@/lib/db';

const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  ...sharedAuthConfig,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return true;

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch {
        // Ignore tracking failures, login should still proceed.
      }

      return true;
    },
  },
};

export { getOAuthProviderMetadata };

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
