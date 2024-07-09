import dayjs from 'dayjs';

export const getDashDate = (date: Date) => {
  return dayjs(date).format('YYYY-MM-DD');
};

export const getISODate = (date: Date) => {
  return dayjs(date).format('YYYY-MM-DDTHH:mm:ss[Z]');
};

export const getTimestamp = (duration: number) => {
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  const hh = hours < 10 ? '0' + hours : hours;
  const mm = minutes < 10 ? '0' + minutes : minutes;
  const ss = seconds < 10 ? '0' + seconds : seconds;

  return `${hh}:${mm}:${ss}`;
};

export const getTime = (inputDate?: Date | null) => {
  const date = inputDate && new Date(inputDate);

  if (!date || !isValidDate(date)) {
    return '--:--';
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();

  const hh = hours < 10 ? '0' + hours : hours;
  const mm = minutes < 10 ? '0' + minutes : minutes;

  return `${hh}:${mm}`;
};

export const getTimeState = (date?: Date) => {
  if (!date || !isValidDate(date)) {
    return {
      hour: '',
      minute: '',
      isAm: true,
    };
  }

  let hour = date?.getHours();
  const minute = date?.getMinutes();
  let isAm = true;

  if (hour && hour >= 12) {
    if (hour > 12) {
      hour = hour - 12;
    }
    isAm = false;
  }

  let hourStr = hour?.toString() || '';
  let minuteStr = minute?.toString() || '';

  return {
    hour: hourStr.length === 1 ? '0' + hourStr : hourStr,
    minute: minuteStr.length === 1 ? '0' + minuteStr : minuteStr,
    isAm,
  };
};

export const isValidDate = (date: any) => {
  return date instanceof Date && isFinite(+date) && date.getTime();
};
