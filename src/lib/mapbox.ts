export function satelliteImageUrl(lat: number, lng: number, zoom = 15, size = 1024): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom},0/${size}x${size}?access_token=${token}`;
}

// Real historical imagery for AI analysis.
//  • 2016+ → Sentinel-2 Cloudless (EOX, 10 m), ~900 m box
//  • 2000–2015 → NASA GIBS MODIS Terra (250 m); needs a wider box to be legible
export function historicalImageUrl(lat: number, lng: number, year: number, size = 1024): string {
  if (year < 2016) {
    // MODIS is coarse — use a larger ~30 km box so features are visible
    const d = 0.15;
    const bbox = `${lat - d},${lng - d},${lat + d},${lng + d}`; // WMS 1.3.0 EPSG:4326 = lat,lng
    return (
      `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap` +
      `&VERSION=1.3.0&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326` +
      `&TIME=${year}-07-15&BBOX=${bbox}&WIDTH=${size}&HEIGHT=${size}&FORMAT=image/jpeg`
    );
  }
  const layer = year === 2016 ? "s2cloudless" : `s2cloudless-${year}`;
  const dLat = 0.004;
  const dLng = 0.006;
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  return `https://tiles.maps.eox.at/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=${size}&HEIGHT=${size}&FORMAT=image/jpeg`;
}
