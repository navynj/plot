import React from 'react';
import Tab from '../tab/Tab';
import { FaCalendar, FaCalendarWeek } from 'react-icons/fa';
import { FaClock } from 'react-icons/fa6';
import { useAtom } from 'jotai';
import { dateViewAtom } from '@/store/ui';

const DateViewTab = () => {
  const [view, setView] = useAtom(dateViewAtom);
  return (
    <Tab
      id="date-view-tab"
      className="text-xs gap-x-2"
      value={view}
      setValue={setView}
      tabs={[
        { icon: <FaCalendar />, label: 'Monthly', value: 'monthly' },
        { icon: <FaCalendarWeek />, label: 'Weekly', value: 'weekly' },
        { icon: <FaClock />, label: 'Daily', value: 'daily' },
      ]}
    />
  );
};

export default DateViewTab;
