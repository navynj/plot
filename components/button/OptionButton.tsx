import { PropsWithChildren, useState } from 'react';

interface OptionButtonProps {
  menu: { name: string; action: () => void }[];
  onSelect?: () => void;
}

const OptionButton = ({
  menu,
  onSelect,
  children,
}: PropsWithChildren<OptionButtonProps>) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const clickHandler = (action: () => void) => {
    return () => {
      setIsShowMenu(false);
      onSelect && onSelect();
      action();
    };
  };

  const outside = (
    <div
      className="fixed top-0 bottom-0 left-0 right-0"
      onClick={(event: React.MouseEvent) => {
        event.stopPropagation();
        setIsShowMenu(false);
      }}
    ></div>
  );

  const contextMenu = (
    <ul className="absolute top-[0.5rem] right-0 min-w-[7.5rem] p-[0.5rem] bg-white rounded-lg shadow-[0_4px_60px_0_rgba(99,99,99,0.2)]">
      {menu.map((item) => {
        const { name, action } = item;
        return (
          <li key={name} onClick={clickHandler(action)} className="text-md p-sm">
            {name}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {isShowMenu && outside}
      <div className="relative">
        <button
          type="button"
          className={`font-extrabold`}
          onClick={() => {
            setIsShowMenu(true);
          }}
        >
          {children ? children : '…'}
        </button>
        {isShowMenu && contextMenu}
      </div>
    </>
  );
};

export default OptionButton;
