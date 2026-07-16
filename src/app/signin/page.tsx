import { redirect } from 'next/navigation';

import { auth, signIn } from '@/auth';

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-24">
      <div className="text-center">
        <h1 className="text-lg font-semibold">PLOT</h1>
        <p className="text-sm text-neutral-500">Rapid capture, later organization.</p>
      </div>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/' });
        }}
      >
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
