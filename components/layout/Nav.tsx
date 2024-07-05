'use client';

import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaChartBar, FaHome, FaRegCalendar, FaRegClock } from 'react-icons/fa';
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
      // { icon: <span key="up" className="text-primary text-xs mb-2">↑</span> },
      { path: 'list', icon: <FaList />, title: 'Todolist' },
      // { path: 'schedule', icon: <FaRegClock />, title: 'Schedule' },
      // { path: 'calendar', icon: <FaRegCalendar />, title: 'Calendar' },
      // { path: 'statistics', icon: <FaChartBar />, title: 'Statistics' },
      {
        plus: (pathname: string) => (
          <Link
            href={`${pathname}?subject-select=show`}
            key="add"
            className="bg-primary w-9 h-9 mb-2 rounded-md"
          >
            <FaPlus className="text-base text-white" />
          </Link>
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
    pathname.split('/').length === 3 && (
      <nav
        className={cn(
          'flex justify-center items-center gap-6 text-xl text-gray-300 bg-white',
          '[&>a]:flex [&>a]:flex-col [&>a]:justify-center [&>a]:items-center',
          '[&>div]:flex [&>div]:flex-col [&>div]:justify-center [&>div]:items-center',
          '[&_span]:text-[0.625rem] [&_span]:font-bold',
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
          ) : nav.plus ? (
            nav.plus(pathname)
          ) : (
            nav.icon
          )
        )}
      </nav>
    )
  );
};

export default Nav;
