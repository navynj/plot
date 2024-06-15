"use client";

import data from '@emoji-mart-kr/data';
import Picker from '@emoji-mart/react';
import Overlay from '../overlay/Overlay';
import { useSetAtom } from 'jotai';
import { emojiAtom, isEmojiSelectedAtom } from '@/store/emoji';
import { useRouter } from 'next/navigation';

interface EmojiValueType {
  id: string;
  keywords: string[];
  name: string;
  native: string;
  shortcodes: string;
  unified: string;
}

const EmojiOverlay = () => {
  const router = useRouter();
  const setEmoji = useSetAtom(emojiAtom);
  const setEmojiSelect = useSetAtom(isEmojiSelectedAtom);
 
  const emojiSelectHandler = (value: EmojiValueType) => {
    setEmoji(value.native);
    setEmojiSelect(true);
    router.back();
  }

  return (
    <Overlay
      id="emoji-select"
      isRight={true}
      className="p-4 flex flex-col items-center [&_em-emoji-picker]:w-full [&_em-emoji-picker]:shadow-none [&>div]:w-full"
    >
      <Picker
        data={data}
        onEmojiSelect={emojiSelectHandler}
        emojiVersion={14}
        set="native"
        navPosition="bottom"
        previewPosition="none"
        skinTonePosition="search"
        dynamicWidth={true}
      />
    </Overlay>
  );
};

export default EmojiOverlay;
