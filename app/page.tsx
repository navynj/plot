import { redirect } from 'next/navigation';

export default async function Home() {
  redirect('/home/list');

  // const signOutHandler = async () => {
  //   'use server';
  //   await signOut();
  // };

  // return (
  //   <form action={signOutHandler}>
  //     <Button type="submit">로그아웃</Button>
  //   </form>
  // );
}
