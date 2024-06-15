import React from 'react';

const DayDate = ({ date }: { date: Date }) => {
  return (
    <div className="text-center font-extrabold">
      <p className="text-xs leading-3">
        {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
      </p>
      <p className="text-2xl">{date.getDate()}</p>
    </div>
  );
};

export default DayDate;
