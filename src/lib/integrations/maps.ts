export interface MapsProvider {
  geocode(address: string): Promise<{ lat: number; lng: number } | null>;
  distanceMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<number>;
}
export const noopMaps: MapsProvider = {
  async geocode() { return null },
  async distanceMinutes() { return 0 },
};
