import { formatDistance as formatDistanceFns, format, parseISO } from 'date-fns';

/**
 * Trả về chuỗi thời gian tương đối (vd: "5 minutes ago").
 * An toàn với input không hợp lệ: trả chuỗi rỗng nếu không parse được.
 */
export const getRelativeTime = (date: string | Date | undefined | null): string => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
  return formatDistanceFns(dateObj, new Date(), { addSuffix: true });
};

/**
 * Định dạng thời gian theo pattern (mặc định HH:mm).
 * An toàn với input không hợp lệ: trả chuỗi rỗng nếu không parse được.
 * Ví dụ: formatTime('2025-11-01T10:00:00Z') => '10:00'
 */
export const formatTime = (
  date: string | Date | undefined | null,
  pattern: string = 'HH:mm'
): string => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
  return format(dateObj, pattern);
};

/**
 * Alias nếu bạn đang dùng tên formatTimestamp ở nơi khác.
 * Thực chất dùng cùng logic với formatTime.
 */
export const formatTimestamp = formatTime;