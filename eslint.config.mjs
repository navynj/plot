import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

/* Layer boundaries as lint rules (CLAUDE.md §1).
 *
 * 1. The DB client is reachable ONLY from src/repository/ (and src/db/ itself).
 *    `db.` outside repository/ is a violation; blocking the imports makes it
 *    unrepresentable. Type-only imports from `@/db/schema` stay allowed.
 * 2. Session/auth is read ONLY at entry points: src/app/ plus the auth config
 *    (src/auth.ts). Services and repositories take `userId` as a parameter.
 *
 * Flat config: for files matched by several blocks, the LAST block's rule
 * value wins, so the specific blocks below fully restate the rule. */

const dbPaths = [
  {
    name: '@/db',
    message:
      'DB queries live only in src/repository/ (CLAUDE.md §1). Call a service, which calls a repository.',
  },
  {
    name: '@/db/schema',
    importNames: ['node', 'link', 'fieldValue', 'user', 'account', 'session', 'verificationToken'],
    message:
      'Query-building table objects are repository-only (CLAUDE.md §1). Import domain types instead.',
  },
];
const dbPatterns = [
  {
    group: ['drizzle-orm', 'drizzle-orm/*', '@neondatabase/*'],
    message: 'Drizzle/Neon are repository-layer details (CLAUDE.md §2, dependency inversion).',
  },
];
const authPaths = [
  {
    name: '@/auth',
    message:
      'Session/auth is read only at entry points in src/app/ (CLAUDE.md §1). Resolve userId there and pass it down.',
  },
];
const authPatterns = [
  {
    group: ['next-auth', 'next-auth/*', '@auth/*'],
    message:
      'Session/auth is read only at entry points in src/app/ (CLAUDE.md §1). Resolve userId there and pass it down.',
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // default for src/: neither db nor auth
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [...dbPaths, ...authPaths], patterns: [...dbPatterns, ...authPatterns] },
      ],
    },
  },
  // entry points: auth allowed, db still forbidden
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: dbPaths, patterns: dbPatterns }],
    },
  },
  // data layer: db allowed, auth still forbidden
  {
    files: ['src/repository/**/*.{ts,tsx}', 'src/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: authPaths, patterns: authPatterns }],
    },
  },
  // the auth config itself: needs the db client for the adapter
  {
    files: ['src/auth.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // generated migrations
    'drizzle/**',
  ]),
]);

export default eslintConfig;
