import { 
  formatDistance as formatDistanceFns, 
  format, 
  parseISO, 
  isToday, 
  isYesterday, 
  isThisWeek,
  isThisYear 
} from 'date-fns';

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

/**
 * Định dạng ngày tháng (mặc định 'MMM dd, yyyy').
 * An toàn với input không hợp lệ: trả chuỗi rỗng nếu không parse được.
 * Ví dụ: formatDate('2025-11-01T10:00:00Z') => 'Nov 01, 2025'
 */
export const formatDate = (
  date: string | Date | undefined | null,
  pattern: string = 'MMM dd, yyyy'
): string => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
  return format(dateObj, pattern);
};

/**
 * Format message timestamp like Facebook Messenger:
 * - Today: just time (e.g., "10:30")
 * - Yesterday: "Yesterday 10:30"
 * - This week: day name + time (e.g., "Monday 10:30")
 * - This year: date + time (e.g., "Nov 15, 10:30")
 * - Older: full date + time (e.g., "Nov 15, 2024 10:30")
 * 
 * Safe with invalid input: returns empty string if can't parse.
 */
export const formatMessageTime = (date: string | Date | undefined | null): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
    
    const time = format(dateObj, 'HH:mm');
    
    if (isToday(dateObj)) {
      // Just show time if today
      return time;
    } else if (isYesterday(dateObj)) {
      // Show "Yesterday" + time
      return `Yesterday ${time}`;
    } else if (isThisWeek(dateObj, { weekStartsOn: 1 })) {
      // Show day name + time if this week
      return format(dateObj, 'EEEE HH:mm');
    } else if (isThisYear(dateObj)) {
      // Show date + time if this year
      return format(dateObj, 'MMM d, HH:mm');
    } else {
      // Show full date + time if older
      return format(dateObj, 'MMM d, yyyy HH:mm');
    }
  } catch (error) {
    console.error('Error formatting message time:', error);
    return '';
  }
};