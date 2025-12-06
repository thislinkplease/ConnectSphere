/**
 * Calculate distance between two coordinates using Haversine formula
 * This calculates the great-circle distance (đường chim bay / as the crow flies)
 * Uses WGS84 ellipsoid radius for improved accuracy
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
  // WGS84 Earth radius in km (more accurate than simple 6371)
  // This is the mean radius used by GPS systems
  const R = 6371.0088;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  
  // Haversine formula for great-circle distance
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Return with high precision, rounding will be done in formatDistance
  return distance;
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * Format distance for display with high precision
 * @param distance Distance in kilometers
 * @returns Formatted distance string (e.g., "50m", "1.2km", "15km")
 */
export const formatDistance = (distance: number | null | undefined): string => {
  // Handle null/undefined cases
  if (distance === null || distance === undefined || isNaN(distance)) {
    return 'Unknown';
  }
  
  // Very close (less than 10 meters)
  const TEN_METERS_IN_KM = 0.01;
  if (distance < TEN_METERS_IN_KM) {
    return 'Nearby';
  }
  
  // Under 1km - show in meters
  if (distance < 1) {
    const meters = Math.round(distance * 1000);
    return `${meters}m`;
  }
  
  // 1-10km - show one decimal place for precision
  if (distance < 10) {
    return `${distance.toFixed(1)}km`;
  }
  
  // 10-100km - show one decimal place
  if (distance < 100) {
    return `${distance.toFixed(1)}km`;
  }
  
  // Over 100km - show whole numbers
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
