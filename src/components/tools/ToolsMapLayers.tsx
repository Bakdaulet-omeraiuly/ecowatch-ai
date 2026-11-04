"use client";

import { useEffect } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import { useMapToolsStore } from "@/store/useMapToolsStore";

// Құралдардың карта қабаттары: сызылып жатқан полигон, таңдалған нүкте, нәтиже (overlay).
// Overlay қасиеттері: kind = point|line|polygon, color, opacity.
export function ToolsMapLayers({ visible }: { visible: boolean }) {
  const { ring, point, overlay, focus } = useMapToolsStore();
  const { current: map } = useMap();

  useEffect(() => {
    if (!focus || !map) return;
    if (focus.bbox) {
      const [w, s, e, n] = focus.bbox;
      map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 15, duration: 900 });
    } else if (focus.center) map.flyTo({ center: focus.center, zoom: Math.max(map.getZoom(), 13), duration: 900 });
  }, [focus, map]);

  if (!visible) return null;
  const ringGeo = ring.length >= 3
    ? { type: "Polygon" as const, coordinates: [[...ring, ring[0]]] }
    : ring.length === 2 ? { type: "LineString" as const, coordinates: ring } : null;

  return (
    <>
      {overlay && (
        <Source id="tools-overlay" type="geojson" data={overlay}>
          <Layer id="tools-overlay-fill" type="fill" filter={["==", ["geometry-type"], "Polygon"]}
            paint={{ "fill-color": ["coalesce", ["get", "color"], "#0ea5e9"], "fill-opacity": ["coalesce", ["get", "opacity"], 0.25] }} />
          <Layer id="tools-overlay-outline" type="line" filter={["==", ["geometry-type"], "Polygon"]}
            paint={{ "line-color": ["coalesce", ["get", "color"], "#0ea5e9"], "line-width": 1 }} />
          <Layer id="tools-overlay-line" type="line" filter={["==", ["geometry-type"], "LineString"]}
            paint={{ "line-color": ["coalesce", ["get", "color"], "#7c3aed"], "line-width": 3 }} layout={{ "line-cap": "round" }} />
          <Layer id="tools-overlay-point" type="circle" filter={["==", ["geometry-type"], "Point"]}
            paint={{ "circle-radius": 5, "circle-color": ["coalesce", ["get", "color"], "#dc2626"], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 }} />
          <Layer id="tools-overlay-label" type="symbol" filter={["==", ["geometry-type"], "Point"]} minzoom={12}
            layout={{ "text-field": ["coalesce", ["get", "label"], ""], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top" }}
            paint={{ "text-color": "#111", "text-halo-color": "#fff", "text-halo-width": 1.2 }} />
        </Source>
      )}
      {ring.length > 0 && (
        <Source id="tools-ring" type="geojson" data={{
          type: "FeatureCollection",
          features: [
            ...(ringGeo ? [{ type: "Feature" as const, properties: {}, geometry: ringGeo }] : []),
            ...ring.map((p) => ({ type: "Feature" as const, properties: { v: 1 }, geometry: { type: "Point" as const, coordinates: p } })),
          ],
        }}>
          <Layer id="tools-ring-fill" type="fill" filter={["==", ["geometry-type"], "Polygon"]} paint={{ "fill-color": "#0ea5e9", "fill-opacity": 0.15 }} />
          <Layer id="tools-ring-line" type="line" filter={["!=", ["geometry-type"], "Point"]} paint={{ "line-color": "#0284c7", "line-width": 2, "line-dasharray": [2, 1] }} />
          <Layer id="tools-ring-vertex" type="circle" filter={["==", ["geometry-type"], "Point"]} paint={{ "circle-radius": 4, "circle-color": "#0284c7", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 }} />
        </Source>
      )}
      {point && (
        <Source id="tools-point" type="geojson" data={{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: point } }}>
          <Layer id="tools-point-circle" type="circle" paint={{ "circle-radius": 7, "circle-color": "#7c3aed", "circle-stroke-color": "#fff", "circle-stroke-width": 2 }} />
        </Source>
      )}
    </>
  );
}
