'use client';

import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaChartBar, FaHome, FaRegCalendar } from 'react-icons/fa';
import { FaList, FaPlus } from 'react-icons/fa6';
import { IoChatbox, IoPeople } from 'react-icons/io5';

const NAV_DATA: { [key: string]: any } = {
  main: [
    <span key="down" className="text-primary text-xs">
      ↓
    </span>,
    <FaHome key="home" className="text-3xl" />,
    <IoPeople key="social" className="text-3xl" />,
    <IoChatbox key="channel" className="text-3xl" />,
  ],
  sub: {
    home: [
      // { icon: <span key="up" className="text-primary text-xs">↑</span> },
      { path: 'list', icon: <FaList />, title: 'Todolist' },
      { path: 'calendar', icon: <FaRegCalendar />, title: 'Calendar' },
      { path: 'statistics', icon: <FaChartBar />, title: 'Statistics' },
      {
        icon: (
          <div key="add" className="bg-primary w-9 h-9 rounded-md">
            <FaPlus className="text-base text-white" />
          </div>
        ),
      },
    ],
    social: [],
    channel: [],
  },
};

const Nav = ({ className }: ClassNameProps) => {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex justify-center items-center gap-10 text-xl text-gray-300 bg-white',
        '[&>a]:flex [&>a]:flex-col [&>a]:space-y-1 [&>a]:justify-center [&>a]:items-center',
        '[&>div]:flex [&>div]:flex-col [&>div]:space-y-1 [&>div]:justify-center [&>div]:items-center',
        '[&_span]:text-xs [&_span]:font-bold',
        className
      )}
    >
      {NAV_DATA.sub[pathname.split('/')[1]].map((nav: any) =>
        nav.path ? (
          <Link
            href={nav.path}
            key={nav.path}
            className={pathname.split('/')[2] === nav.path ? 'text-primary' : undefined}
          >
            {nav.icon}
            <span>{nav.title}</span>
          </Link>
        ) : (
          nav.icon
        )
      )}
    </nav>
  );
};

export default Nav;
