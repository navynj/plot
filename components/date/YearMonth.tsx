import React from 'react';

interface YearMonthProps {
  date: Date;
  onClick?: React.MouseEventHandler;
}

const YearMonth = ({ date, onClick }: YearMonthProps) => {
  return (
    <div
      className="flex flex-col items-start font-extrabold leading-tight"
      onClick={onClick}
    >
      <div className="text-lg">{date.getFullYear()}</div>
      <div className="text-3xl">
        {date.toLocaleDateString('en-US', { month: 'long' })}
      </div>
    </div>
  );
};

export default YearMonth;
