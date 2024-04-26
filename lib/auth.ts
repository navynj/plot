import { prisma } from '@/prisma/client';
import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import Kakao from 'next-auth/providers/kakao';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Kakao({
      clientId: process.env.AUTH_KAKAO_CLIENT_ID as string,
      clientSecret: process.env.AUTH_KAKAO_CLIENT_SECRET as string,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
  },
});
