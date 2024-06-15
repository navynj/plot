import { emojiAtom } from '@/store/emoji';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { useAtomValue } from 'jotai';
import React from 'react';
import Link from 'next/link';

const EmojiInput = ({ className }: ClassNameProps) => {
  const emoji = useAtomValue(emojiAtom);
  return (
    <Link
      className={cn(
        'w-24 h-24 bg-gray-100 rounded-xl flex justify-center items-center text-5xl shrink-0',
        className
      )}
      href="/home/list?emoji-select=show"
    >
      {emoji}
    </Link>
  );
};

export default EmojiInput;
