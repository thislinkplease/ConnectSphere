/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * Format distance for display
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number | null | undefined): string => {
  // Handle null/undefined cases
  if (distance === null || distance === undefined || isNaN(distance)) {
    return 'Unknown';
  }
  
  // distance is already a number, no need for Number() conversion
  if (distance < 0.001) {
    return 'Nearby';
  }
  
  if (distance < 1) {
    // Display in meters for distances under 1km
    const meters = Math.round(distance * 1000);
    return `${meters}m`;
  }
  
  if (distance < 10) {
    // Display one decimal place for distances under 10km
    return `${distance.toFixed(1)}km`;
  }
  
  // Display whole numbers for distances over 10km
  return `${Math.round(distance)}km`;
};

/**
 * Check if a distance matches a filter
 * @param distance Distance in kilometers
 * @param filter Filter string like "Under 1km", "Under 10km"
 * @returns Whether the distance matches the filter
 */
export const matchesDistanceFilter = (distance: number, filter: string): boolean => {
  const match = filter.match(/Under (\d+)km/);
  if (!match) return true;
  
  const maxDistance = parseInt(match[1], 10);
  return distance <= maxDistance;
};
