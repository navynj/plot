import { redirect } from 'next/navigation';

import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>PLOT</CardTitle>
          <CardDescription>Rapid capture, later organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
