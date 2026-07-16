import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';

import { db } from '@/db';
import { account, session, user, verificationToken } from '@/db/schema';

/**
 * Auth configuration — the ONE file outside app/ allowed to touch auth and the
 * db client (the adapter is auth-table infrastructure, not domain data access).
 * Everything else reads the session only at entry points (CLAUDE.md §1).
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: user,
    accountsTable: account,
    sessionsTable: session,
    verificationTokensTable: verificationToken,
  }),
  providers: [Google],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
