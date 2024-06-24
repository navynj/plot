import { getDashDate, getTime } from '@/util/date';
import React, { useEffect, useRef, useState } from 'react';

export interface timeStateType {
  hour: string;
  minute: string;
  isAm: boolean;
}

interface TimeInputProps {
  time: timeStateType;
  setTime: React.Dispatch<React.SetStateAction<timeStateType>>;
}

const setHour = (hour: string) => {
  return (prev: timeStateType) => ({
    ...prev,
    hour,
  });
};

const setMinute = (minute: string) => {
  return (prev: timeStateType) => ({
    ...prev,
    minute,
  });
};

const TimeInput = ({ time, setTime }: TimeInputProps) => {
  const minuteRef = useRef<HTMLInputElement>(null);
  const [isHourChanged, setIsHourChanged] = useState(false);

  const hourChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^0-9]/g, '');

    if (value.length >= 3) {
      const hour = value.substring(0, 2);
      if (parseInt(hour) === 0) {
        setTime(setHour(value.substring(value.length - 1)));
      } else {
        setTime(setHour(hour));
      }
      return;
    } else if (value.length === 2) {
      const valueNum = parseInt(value);

      if (valueNum >= 24) {
        setTime(setHour('00'));
      } else if (valueNum > 12) {
        const hour = valueNum - 12;
        if (hour < 10) {
          setTime((prev) => ({ ...prev, hour: '0' + hour.toString(), isAm: false }));
        } else {
          setTime((prev) => ({ ...prev, hour: hour.toString(), isAm: false }));
        }
      } else if (valueNum === 12) {
        setTime((prev) => ({ ...prev, hour: '12', isAm: false }));
      } else {
        setTime(setHour(value));
      }
    } else {
      setTime(setHour(value));
    }
    setIsHourChanged(true);
  };

  const hourBlurHandler = () => {
    const hour = time.hour;
    if (hour.length === 1) {
      setTime(setHour('0' + hour));
    } else if (hour.length === 0) {
      setTime(setHour('00'));
    }
  };

  const minuteBlurHandler = () => {
    const minute = time.minute;
    if (minute.length === 1) {
      setTime(setMinute('0' + minute));
    } else if (minute.length === 0) {
      setTime(setMinute('00'));
    }
  };

  const minuteChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    let minute = event.target.value.replace(/[^0-9]/g, '');

    if (minute.length >= 3) {
      minute = minute.substring(minute.length - 2);
    }

    const minuteNum = parseInt(minute);

    if (minuteNum < 10) {
      minute = '0' + minute;
    }

    if (minuteNum >= 60) {
      minute = '0' + minute[minute.length - 1];
    }

    setTime((prev: timeStateType) => ({ ...prev, minute }));
  };

  const amToggleHandler = () => {
    setTime((prev) => ({ ...prev, isAm: !prev.isAm }));
  };

  useEffect(() => {
    if (time.hour.length === 2 && isHourChanged) {
      minuteRef.current?.focus();
      setIsHourChanged(false);
    }
  }, [time.hour]);

  useEffect(() => {
    if (time.hour === '12' && time.isAm) {
      setTime((prev) => ({ ...prev, hour: '00' }));
    } else if (time.hour === '00' && !time.isAm) {
      setTime((prev) => ({ ...prev, hour: '12' }));
    }
  }, [time.isAm]);

  return (
    <div className="flex w-fit p-2 bg-gray-100 rounded-lg">
      <div className="flex">
        <input
          type="number"
          inputMode="numeric"
          onChange={hourChangeHandler}
          onBlur={hourBlurHandler}
          min={0}
          max={24}
          value={time.hour}
          className="box-content w-[2ch] px-2 mx-1 focus:bg-gray-200 text-center bg-transparent rounded-md"
        />
        <span>:</span>
        <input
          ref={minuteRef}
          type="number"
          inputMode="numeric"
          onChange={minuteChangeHandler}
          onBlur={minuteBlurHandler}
          min={0}
          max={59}
          value={time.minute}
          className="box-content w-[2ch] px-2 mx-1 focus:bg-gray-200 text-center bg-transparent rounded-md"
        />
      </div>
      <button type="button" className="px-3" onClick={amToggleHandler}>
        {time.isAm ? 'AM' : 'PM'}
      </button>
    </div>
  );
};

export const getDateFromTimeInput = (time: timeStateType, date?: Date) => {};

export const getIntervalFromTimeInput = (
  start: timeStateType,
  end: timeStateType,
  date?: Date
) => {
  const startHourStr = start.hour;
  const startMinuteStr = start.minute;
  const endHourStr = end.hour;
  const endMinuteStr = end.minute;

  const startHourNum = parseInt(startHourStr);
  const startMinuteNum = parseInt(startMinuteStr);
  const endHourNum = parseInt(endHourStr);
  const endMinuteNum = parseInt(endMinuteStr);

  const isEmpty = !startHourNum && !startMinuteNum && !endHourNum && !endMinuteNum;
  const isFull = startHourStr && startMinuteStr && endHourStr && endMinuteStr;

  if (isFull) {
    const startDate = date ? new Date(date) : new Date(0);
    const endDate = date ? new Date(date) : new Date(0);

    let startHour = startHourNum;
    if (!start.isAm && startHour !== 12) {
      startHour = startHourNum + 12;
    }

    let endHour = endHourNum;
    if (!end.isAm && endHour !== 12) {
      endHour = endHourNum + 12;
    }

    startDate.setHours(startHour);
    startDate.setMinutes(startMinuteNum);
    startDate.setSeconds(0);

    endDate.setHours(endHour);
    endDate.setMinutes(endMinuteNum);
    endDate.setSeconds(0);

    if (!startDate) {
      throw Error('Please enter valid start schedule time value.');
    }

    if (!endDate) {
      throw Error('Please enter valid end schedule time value.');
    }

    if (startDate >= endDate) {
      throw Error(
        `Start time is same or over end time: \n${getDashDate(startDate)} ${getTime(
          startDate
        )} >= \n${getDashDate(endDate)} ${getTime(endDate)}`
      );
    }

    return [startDate, endDate];
  } else if (isEmpty) {
    return [null, null];
  } else {
    throw Error('Please enter valid schedule time value.');
  }
};

export default TimeInput;
