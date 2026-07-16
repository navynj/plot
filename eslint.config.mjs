import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Layer boundary (CLAUDE.md §1): the DB client is reachable ONLY from
  // src/repository/. `db.` outside repository/ is a violation; blocking the
  // import of `@/db` (and drizzle/neon directly) makes that unrepresentable.
  // Type-only imports from `@/db/schema` stay allowed everywhere.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/db',
              message:
                'DB queries live only in src/repository/ (CLAUDE.md §1). Call a service, which calls a repository.',
            },
            {
              name: '@/db/schema',
              importNames: ['node', 'link', 'fieldValue'],
              message:
                'Query-building table objects are repository-only (CLAUDE.md §1). Import domain types instead.',
            },
          ],
          patterns: [
            {
              group: ['drizzle-orm', 'drizzle-orm/*', '@neondatabase/*'],
              message:
                'Drizzle/Neon are repository-layer details (CLAUDE.md §2, dependency inversion).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/repository/**', 'src/db/**'],
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
