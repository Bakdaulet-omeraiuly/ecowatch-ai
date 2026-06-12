export function satelliteImageUrl(lat: number, lng: number, zoom = 15, size = 1024): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom},0/${size}x${size}?access_token=${token}`;
}
