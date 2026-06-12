export function satelliteImageUrl(lat: number, lng: number, zoom = 15, size = 1024): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom},0/${size}x${size}?access_token=${token}`;
}

// Real historical imagery: Sentinel-2 Cloudless yearly mosaic (EOX / ESA
// Copernicus), fetched via WMS for an ~900m box around the point.
export function historicalImageUrl(lat: number, lng: number, year: number, size = 1024): string {
  const layer = year === 2016 ? "s2cloudless" : `s2cloudless-${year}`;
  const dLat = 0.004;
  const dLng = 0.006;
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  return `https://tiles.maps.eox.at/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=${size}&HEIGHT=${size}&FORMAT=image/jpeg`;
}
