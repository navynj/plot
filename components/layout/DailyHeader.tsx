import DayNav from '@/components/date/DayNav';
import YearMonthNav from '@/components/date/YearMonthNav';
import { ClassNameType } from '@/types/className';
import { cn } from '@/util/cn';

const DailyHeader = ({ className }: ClassNameType) => {
  return (
    <div className={cn('flex justify-between items-end', className)}>
      <YearMonthNav />
      <DayNav />
    </div>
  );
};

export default DailyHeader;
