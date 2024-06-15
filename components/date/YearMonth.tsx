import React from 'react';

const YearMonth = ({ date }: { date: Date }) => {
  return (
    <div className="flex flex-col items-start font-extrabold leading-tight">
      <div className="text-lg">{date.getFullYear()}</div>
      <div className="text-4xl">
        {date.toLocaleDateString('en-US', { month: 'long' })}
      </div>
    </div>
  );
};

export default YearMonth;
