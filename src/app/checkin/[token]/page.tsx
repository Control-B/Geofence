"use client";

import {use, useEffect, useRef, useState} from "react";

type PublicTrip = {
  driverName: string;
  warehouseName: string;
  warehouseLat: number;
  warehouseLng: number;
  geofenceRadiusMeters: number;
  tripStatus: string;
  scheduledArrivalTime: string;
  mapConfig: {
    publicToken?: string | null;
    pingIntervalSeconds: number;
    maxGpsAccuracyMeters: number;
  };
};

type PingResponse = {
  tripStatus: string;
  distanceToWarehouseMeters: number;
  insideGeofence: boolean;
};

type DriverPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
};

type MapboxMarker = {setLngLat: (lngLat: [number, number]) => MapboxMarker; addTo: (map: unknown) => MapboxMarker};
type MapboxMap = {
  on: (event: string, handler: () => void) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  flyTo: (options: Record<string, unknown>) => void;
  remove: () => void;
};

declare global {
  interface Window {
    mapboxgl?: {
      accessToken: string;
      Map: new (options: Record<string, unknown>) => MapboxMap;
      Marker: new (options?: Record<string, unknown>) => MapboxMarker;
    };
  }
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function metersToCircle(longitude: number, latitude: number, radiusMeters: number) {
  const points = 64;
  const coordinates: number[][] = [];
  const earthRadiusMeters = 6371000;
  const latRadians = latitude * Math.PI / 180;

  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    coordinates.push([
      longitude + (dx / (earthRadiusMeters * Math.cos(latRadians))) * (180 / Math.PI),
      latitude + (dy / earthRadiusMeters) * (180 / Math.PI)
    ]);
  }

  return {
    type: "Feature",
    geometry: {type: "Polygon", coordinates: [coordinates]},
    properties: {}
  };
}

function loadMapbox() {
  if (window.mapboxgl) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-mapbox-gl]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject(new Error("Mapbox failed to load.")));
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js";
    script.async = true;
    script.dataset.mapboxGl = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Mapbox failed to load."));
    document.head.appendChild(script);
  });
}

export default function DriverArrivalPage({params}: {params: Promise<{token: string}>}) {
  const {token} = use(params);
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [lastPing, setLastPing] = useState<PingResponse | null>(null);
  const [statusText, setStatusText] = useState("Loading trip...");
  const [error, setError] = useState("");
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const driverMarker = useRef<MapboxMarker | null>(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/trips/public/${token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Trip link is unavailable.");
        setTrip(data);
        setStatusText("Waiting for location permission");
      })
      .catch((requestError) => {
        setError(requestError.message);
        setStatusText("Trip unavailable");
      });
  }, [token]);

  useEffect(() => {
    if (!trip || !mapNode.current || mapRef.current) return;
    const mapboxToken = trip.mapConfig.publicToken || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) return;

    let cancelled = false;
    loadMapbox()
      .then(() => {
        if (cancelled || !window.mapboxgl || !mapNode.current) return;
        window.mapboxgl.accessToken = mapboxToken;
        const map = new window.mapboxgl.Map({
          container: mapNode.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [trip.warehouseLng, trip.warehouseLat],
          zoom: 14
        });
        mapRef.current = map;
        new window.mapboxgl.Marker({color: "#0f766e"}).setLngLat([trip.warehouseLng, trip.warehouseLat]).addTo(map);
        map.on("load", () => {
          map.addSource("geofence", {type: "geojson", data: metersToCircle(trip.warehouseLng, trip.warehouseLat, trip.geofenceRadiusMeters)});
          map.addLayer({id: "geofence-fill", type: "fill", source: "geofence", paint: {"fill-color": "#f97316", "fill-opacity": 0.16}});
          map.addLayer({id: "geofence-outline", type: "line", source: "geofence", paint: {"line-color": "#f97316", "line-width": 3}});
        });
      })
      .catch(() => setError("Mapbox could not load. Location tracking still works."));

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [trip]);

  useEffect(() => {
    if (!trip) return;
    if (!navigator.geolocation) {
      setError("This browser does not support GPS location sharing.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (gps) => {
        const nextPosition = {
          latitude: gps.coords.latitude,
          longitude: gps.coords.longitude,
          accuracy: gps.coords.accuracy,
          speed: gps.coords.speed,
          heading: gps.coords.heading
        };
        setPosition(nextPosition);
        setStatusText(gps.coords.accuracy > trip.mapConfig.maxGpsAccuracyMeters ? "Improve GPS accuracy" : "Tracking active");
        updateDriverMarker(nextPosition);
        void sendPing(nextPosition, false);
      },
      () => {
        setError("Location permission was denied. You can retry from your browser settings.");
        setStatusText("Waiting for location");
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 5000}
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [trip]);

  function updateDriverMarker(nextPosition: DriverPosition) {
    if (!window.mapboxgl || !mapRef.current) return;
    if (!driverMarker.current) driverMarker.current = new window.mapboxgl.Marker({color: "#2563eb"}).addTo(mapRef.current);
    driverMarker.current.setLngLat([nextPosition.longitude, nextPosition.latitude]);
    mapRef.current.flyTo({center: [nextPosition.longitude, nextPosition.latitude], zoom: 15, essential: true});
  }

  async function sendPing(nextPosition: DriverPosition, force: boolean) {
    if (!trip) return;
    const now = Date.now();
    if (!force && now - lastSentAt.current < trip.mapConfig.pingIntervalSeconds * 1000) return;
    lastSentAt.current = now;

    const response = await fetch(`${apiBaseUrl}/api/trips/public/${token}/location`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        latitude: nextPosition.latitude,
        longitude: nextPosition.longitude,
        accuracyMeters: nextPosition.accuracy,
        speed: nextPosition.speed,
        heading: nextPosition.heading,
        timestamp: new Date().toISOString()
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Location ping failed.");
      return;
    }

    setLastPing(data);
    setTrip({...trip, tripStatus: data.tripStatus});
    if (data.tripStatus === "ARRIVED") setStatusText("Arrived");
    else if (data.insideGeofence) setStatusText("Inside geofence, confirming arrival");
    else setStatusText("Approaching warehouse");
  }

  return (
    <main className="page-shell">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-white shadow-glow">
          <div ref={mapNode} className="h-[62vh] min-h-[420px] bg-slate-900">
            {(!trip?.mapConfig.publicToken && !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) && (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <p className="text-2xl font-black">Mapbox token missing</p>
                  <p className="mt-2 text-slate-300">Set NEXT_PUBLIC_MAPBOX_TOKEN to render the live map. GPS pings still run.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="hero-panel">
            <p className="eyebrow">Freight arrival</p>
            <h1 className="mt-2 text-3xl font-black">{trip?.warehouseName || "Loading warehouse"}</h1>
            <p className="mt-3 text-slate-300">{trip ? `Driver: ${trip.driverName}` : "Validating secure trip link"}</p>
          </section>

          <section className="soft-panel space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="label">Trip status</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">{trip?.tripStatus || "LOADING"}</span>
            </div>
            <p className="text-2xl font-black text-asphalt">{statusText}</p>
            {lastPing && <p className="font-bold text-slate-600">Distance: {lastPing.distanceToWarehouseMeters} meters</p>}
            {position && <p className="text-sm font-bold text-slate-500">GPS accuracy: {Math.round(position.accuracy)} meters</p>}
            {trip && <p className="text-sm text-slate-500">Scheduled: {new Date(trip.scheduledArrivalTime).toLocaleString()}</p>}
          </section>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}

          <button className="primary-button w-full" disabled={!position} onClick={() => position && sendPing(position, true)}>
            I'm Here
          </button>
          <a className="secondary-button w-full" href={trip ? `/docs/${token}` : "#"}>
            Upload Documents
          </a>
        </aside>
      </div>
    </main>
  );
}
