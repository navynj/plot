import { cn } from '@/util/cn';
import { useEffect, useState } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa6';
interface PlayButtonProps {
  onPlay?: () => void;
  onPause?: () => void;
  isPlaying?: boolean;
}

const PlayButton = ({ onPlay, onPause, isPlaying }: PlayButtonProps) => {
  const [showPlayIcon, setShowPlayIcon] = useState(
    isPlaying === undefined ? true : isPlaying
  );

  // NOTE: play/pause 버튼이 아닌 다른 외부 동작으로 인해 재생될 경우의 상태 업데이트를 위한 처리
  useEffect(() => {
    setShowPlayIcon(isPlaying === undefined ? true : isPlaying);
  }, [isPlaying]);

  const togglePlayPause = () => {
    setShowPlayIcon((prevIsPlaying) => {
      if (prevIsPlaying) {
        onPause && onPause();
      } else {
        onPlay && onPlay();
      }

      return !prevIsPlaying;
    });
  };

  return (
    <button
      type="button"
      onClick={togglePlayPause}
      className={cn(
        'flex justify-center items-center shrink-0 text-white bg-primary w-4 h-4 text-[0.625rem] rounded-full',
        showPlayIcon ? 'pl-[1.5px]' : ''
      )}
    >
      {showPlayIcon ? <FaPlay /> : <FaPause />}
    </button>
  );
};

export default PlayButton;
