import Button from '@/components/button/Button';
import { signIn } from '@/lib/auth';
import Image from 'next/image';

const page = () => {
  const kakaoAuthHandler = async () => {
    'use server';
    await signIn('kakao', { callbackUrl: '/' });
  };

  return (
    <div className="flex flex-col space-y-8 justify-center items-center h-[100dvh]">
      <h1 className="text-3xl font-extrabold">PLOT</h1>
      <div className="flex justify-center items-center bg-gray-100 rounded-full w-[300px] h-[300px]">
        <Image src="/logo.png" width={260} height={260} alt="plot logo" priority />
      </div>
      <form action={kakaoAuthHandler}>
        <Button
          type="submit"
          className="flex items-center space-x-2 bg-yellow-300 text-black"
        >
          <Image
            src="/kakao.png"
            alt="kakao logo"
            width={0}
            height={0}
            className="w-[20px] h-auto"
          />
          <p>카카오톡으로 로그인하기</p>
        </Button>
      </form>
    </div>
  );
};

export default page;
