import Button from '@/components/button/Button';
import { signOut } from '@/lib/auth';

export default async function Home() {
  const signOutHandler = async () => {
    'use server';
    await signOut();
  };

  return (
    <form action={signOutHandler}>
      <Button type="submit">로그아웃</Button>
    </form>
  );
}
