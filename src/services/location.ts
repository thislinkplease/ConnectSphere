import * as Location from 'expo-location';
import { formatDistance as formatDistanceUtil } from '../utils/distance';

class LocationService {
  private currentLocation: Location.LocationObject | null = null;

  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  // Check if location permissions are granted
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }

  // Get current location
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return null;
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.currentLocation = location;
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  // Get last known location
  getLastKnownLocation(): Location.LocationObject | null {
    return this.currentLocation;
  }

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  // Convert degrees to radians
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Format distance for display - delegates to utility function to avoid duplication
  formatDistance(distance: number | null | undefined): string {
    return formatDistanceUtil(distance);
  }

  // Get distance to user
  async getDistanceToUser(userLat: number, userLon: number): Promise<number | null> {
    const currentLoc = await this.getCurrentLocation();
    if (!currentLoc) {
      return null;
    }

    return this.calculateDistance(
      currentLoc.coords.latitude,
      currentLoc.coords.longitude,
      userLat,
      userLon
    );
  }

  // Watch position (for real-time updates)
  async watchPosition(
    callback: (location: Location.LocationObject) => void
  ): Promise<Location.LocationSubscription | null> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return null;
        }
      }

      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 100, // Update every 100 meters
        },
        (location) => {
          this.currentLocation = location;
          callback(location);
        }
      );
    } catch (error) {
      console.error('Error watching position:', error);
      return null;
    }
  }

  // Filter items by distance
  filterByDistance<T extends { location?: { latitude: number; longitude: number } }>(
    items: T[],
    maxDistance: number,
    currentLat: number,
    currentLon: number
  ): T[] {
    return items.filter((item) => {
      if (!item.location) return false;
      const distance = this.calculateDistance(
        currentLat,
        currentLon,
        item.location.latitude,
        item.location.longitude
      );
      return distance <= maxDistance;
    });
  }

  // Sort items by distance
  sortByDistance<T extends { location?: { latitude: number; longitude: number } }>(
    items: T[],
    currentLat: number,
    currentLon: number
  ): (T & { distance?: number })[] {
    return items
      .map((item) => {
        if (!item.location) {
          return { ...item, distance: undefined };
        }
        const distance = this.calculateDistance(
          currentLat,
          currentLon,
          item.location.latitude,
          item.location.longitude
        );
        return { ...item, distance };
      })
      .sort((a, b) => {
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });
  }
}

export default new LocationService();
