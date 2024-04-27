export const getDashDate = (date: Date) => {
  return date.toLocaleDateString('sv-SE');
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

export const getTime = (date?: Date) => {
  if (!date) {
    return '--:--';
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();

  const hh = hours < 10 ? '0' + hours : hours;
  const mm = minutes < 10 ? '0' + minutes : minutes;

  return `${hh}:${mm}`;
};
