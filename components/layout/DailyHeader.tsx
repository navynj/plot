import DayNav from '@/components/date/DayNav';
import YearMonthNav from '@/components/date/YearMonthNav';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';

const DailyHeader = ({ className }: ClassNameProps) => {
  return (
    <div className={cn('pl-4 pr-2 flex justify-between items-end', className)}>
      <YearMonthNav />
      <DayNav />
    </div>
  );
};

export default DailyHeader;
