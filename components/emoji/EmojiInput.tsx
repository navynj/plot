import { emojiAtom } from '@/store/emoji';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { PropsWithChildren } from 'react';

interface EmojiInputProps extends ClassNameProps {
  params?: string;
  isCircle?: boolean;
}

const EmojiInput = ({
  params,
  isCircle,
  className,
  children,
}: PropsWithChildren<EmojiInputProps>) => {
  const emoji = useAtomValue(emojiAtom);
  return (
    <Link
      className={cn(
        'w-24 h-24 bg-gray-100 rounded-xl flex justify-center items-center text-5xl shrink-0',
        isCircle ? 'rounded-full' : '',
        className
      )}
      href={`/home/list?emoji-select=show${params || ''}`}
    >
      {emoji}
      {children}
    </Link>
  );
};

export default EmojiInput;
