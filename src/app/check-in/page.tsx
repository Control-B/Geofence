"use client";

import {FormEvent, Suspense, useEffect, useMemo, useState} from "react";
import {useSearchParams} from "next/navigation";
import {buildSmsLink} from "@/lib/sms";
import {checkInServiceUrl, serviceUrl} from "@/lib/service-api";

type Warehouse = {
  id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
};

type LocationState = {
  status: "idle" | "loading" | "verified" | "outside_zone" | "denied";
  latitude: number | null;
  longitude: number | null;
  distanceMeters?: number;
  message: string;
};

type CheckInResult = {
  id: string;
  geofenceStatus: string;
  distanceMeters: number | null;
  verifiedAt: string | null;
  smsMessage: string;
  smsLink: string;
  documentUploadLink: string;
  signingLink: string;
};

const initialLocation: LocationState = {
  status: "idle",
  latitude: null,
  longitude: null,
  message: "Tap verify when you are at the warehouse."
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number) {
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const startLatitude = toRadians(fromLatitude);
  const endLatitude = toRadians(toLatitude);

  // Haversine formula: converts latitude/longitude differences into great-circle distance.
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function CheckInForm() {
  const searchParams = useSearchParams();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [location, setLocation] = useState<LocationState>(initialLocation);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(serviceUrl(checkInServiceUrl, "/warehouses"))
      .then((response) => response.json())
      .then((data) => setWarehouse(data.warehouses[0]))
      .catch(() => setError("Could not load warehouse settings."));
  }, []);

  const statusCard = useMemo(() => {
    if (location.status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (location.status === "outside_zone") return "border-orange-200 bg-orange-50 text-orange-800";
    if (location.status === "denied") return "border-red-200 bg-red-50 text-red-800";
    return "border-slate-200 bg-white text-slate-700";
  }, [location.status]);

  function verifyLocation() {
    if (!warehouse) return;
    if (!navigator.geolocation) {
      setLocation({...initialLocation, status: "denied", message: "Location permission denied"});
      return;
    }

    setLocation({...location, status: "loading", message: "Requesting GPS permission..."});
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distanceMeters = calculateDistanceMeters(
          position.coords.latitude,
          position.coords.longitude,
          warehouse.latitude,
          warehouse.longitude
        );
        const verified = distanceMeters <= warehouse.radius_meters;
        setLocation({
          status: verified ? "verified" : "outside_zone",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          distanceMeters,
          message: verified ? "Location verified" : "You are outside the check-in zone"
        });
      },
      () => setLocation({...initialLocation, status: "denied", message: "Location permission denied"}),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied(false);

    if (!warehouse) {
      setError("Warehouse settings are still loading.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = {
      warehouseId: warehouse.id,
      warehouseName: String(formData.get("warehouseName")),
      warehousePhone: String(formData.get("warehousePhone")),
      warehouseLatitude: warehouse.latitude,
      warehouseLongitude: warehouse.longitude,
      warehouseRadiusMeters: warehouse.radius_meters,
      driverName: String(formData.get("driverName")),
      driverPhone: String(formData.get("driverPhone")),
      carrierName: String(formData.get("carrierName")),
      truckNumber: String(formData.get("truckNumber")),
      trailerNumber: String(formData.get("trailerNumber")),
      loadNumber: String(formData.get("loadNumber")),
      type: String(formData.get("type")),
      notes: String(formData.get("notes") || ""),
      latitude: location.latitude,
      longitude: location.longitude,
      permissionDenied: location.status === "denied"
    };

    setLoading(true);
    const response = await fetch(serviceUrl(checkInServiceUrl, "/check-ins"), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Unable to create check-in.");
      return;
    }

    setResult({...data, smsLink: buildSmsLink(String(formData.get("warehousePhone")), data.smsMessage)});
  }

  async function copySms() {
    if (!result) return;
    await navigator.clipboard.writeText(result.smsMessage);
    setCopied(true);
  }

  function param(name: string) {
    return searchParams.get(name) || "";
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-3xl">
        <div className="hero-panel mb-6">
          <p className="eyebrow">Driver check-in</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Verify your truck at the warehouse</h1>
          <p className="mt-3 text-slate-300">Your location is used only to verify warehouse arrival or departure.</p>
        </div>

        <form key={`${warehouse?.id || "loading"}-${searchParams.toString()}`} onSubmit={handleSubmit} className="space-y-4">
          <section className="soft-panel space-y-4">
            <h2 className="text-xl font-black">Warehouse</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="label">Warehouse name</span>
                <input className="field" name="warehouseName" defaultValue={param("warehouseName") || warehouse?.name || ""} required />
              </label>
              <label className="space-y-2">
                <span className="label">Warehouse SMS phone number</span>
                <input className="field" name="warehousePhone" defaultValue={param("warehousePhone") || warehouse?.phone || ""} inputMode="tel" required />
              </label>
            </div>
          </section>

          <section className="soft-panel space-y-4">
            <h2 className="text-xl font-black">Driver and load</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["driverName", "Driver name"],
                ["driverPhone", "Driver phone"],
                ["carrierName", "Carrier name"],
                ["truckNumber", "Truck number"],
                ["trailerNumber", "Trailer number"],
                ["loadNumber", "Load / pickup / delivery number"]
              ].map(([name, label]) => (
                <label key={name} className="space-y-2">
                  <span className="label">{label}</span>
                  <input className="field" name={name} defaultValue={param(name)} inputMode={name.includes("Phone") ? "tel" : "text"} required />
                </label>
              ))}
            </div>
            <label className="space-y-2 block">
              <span className="label">Arrival or departure</span>
              <select className="field" name="type" defaultValue={param("type") || "arrival"}>
                <option value="arrival">Arrival</option>
                <option value="departure">Departure</option>
              </select>
            </label>
            <label className="space-y-2 block">
              <span className="label">Optional notes</span>
              <textarea className="field min-h-28" name="notes" defaultValue={param("notes")} placeholder="Gate, appointment, seal, or dock notes" />
            </label>
          </section>

          <section className="soft-panel space-y-4">
            <div className={`rounded-2xl border p-4 ${statusCard}`}>
              <p className="text-lg font-black">{location.message}</p>
              {typeof location.distanceMeters === "number" && (
                <p className="mt-1 text-sm font-bold">Distance: {location.distanceMeters} meters • Allowed: {warehouse?.radius_meters || 150} meters</p>
              )}
            </div>
            <button type="button" onClick={verifyLocation} className="secondary-button w-full" disabled={!warehouse || location.status === "loading"}>
              {location.status === "loading" ? "Checking GPS..." : "Verify GPS Location"}
            </button>
          </section>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}

          <button className="primary-button w-full" disabled={loading || location.status === "idle" || location.status === "loading"}>
            {loading ? "Creating check-in..." : "Create Verified Check-In"}
          </button>
        </form>

        {result && (
          <section className="card mt-6 space-y-4 border-dock/20 bg-teal-50">
            <div>
              <p className="text-2xl font-black text-dock">Check-in created</p>
              <p className="mt-1 text-teal-800">The driver must tap the button to send the SMS from their own phone.</p>
            </div>
            <a className="primary-button w-full" href={result.smsLink}>
              Send Verified SMS to Warehouse
            </a>
            <button className="secondary-button w-full" type="button" onClick={copySms}>
              {copied ? "Copied SMS Message" : "Copy SMS Message"}
            </button>
            <div className="grid gap-3 sm:grid-cols-2">
              <a className="secondary-button" href={result.documentUploadLink}>Upload Documents</a>
              <a className="secondary-button" href={result.signingLink}>Sign Form</a>
            </div>
            <pre className="whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-slate-700">{result.smsMessage}</pre>
          </section>
        )}
      </div>
    </main>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<main className="page-shell"><div className="mx-auto max-w-3xl"><div className="hero-panel">Loading check-in...</div></div></main>}>
      <CheckInForm />
    </Suspense>
  );
}