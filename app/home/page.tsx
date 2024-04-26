'use client';
import { redirect } from 'next/navigation';

const page = () => {  
  redirect('/home/list');
}

export default page