import React from 'react';

interface YearMonthProps {
  date: Date;
  onClick?: React.MouseEventHandler;
}

const DayDate = ({ date, onClick }: YearMonthProps) => {
  return (
    <div className="text-center font-extrabold" onClick={onClick}>
      <p className="text-xs leading-3">
        {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
      </p>
      <p className="text-2xl">{date.getDate()}</p>
    </div>
  );
};

export default DayDate;
