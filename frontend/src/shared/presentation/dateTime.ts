type DateTimeFormatMode = 'date' | 'dateTime';

const COMPACT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
};

const COMPACT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...COMPACT_DATE_OPTIONS,
  hour: '2-digit',
  minute: '2-digit',
};

const FULL_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  ...COMPACT_DATE_TIME_OPTIONS,
};

export function formatCompactDate(value: string) {
  return formatDateValue(value, COMPACT_DATE_OPTIONS, 'date');
}

export function formatCompactDateTime(value: string) {
  return formatDateValue(value, COMPACT_DATE_TIME_OPTIONS, 'dateTime');
}

export function formatFullDateTime(value: string) {
  return formatDateValue(value, FULL_DATE_TIME_OPTIONS, 'dateTime');
}

function formatDateValue(value: string, options: Intl.DateTimeFormatOptions, mode: DateTimeFormatMode) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return mode === 'date' ? parsed.toLocaleDateString('ko-KR', options) : parsed.toLocaleString('ko-KR', options);
}
