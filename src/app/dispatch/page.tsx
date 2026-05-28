"use client";

import {FormEvent, useState} from "react";

type TripSummary = {
  id: string;
  publicTripToken: string;
  tripReference: string;
  driverName: string;
  warehouseName: string;
  status: string;
  scheduledArrivalTime: string;
  checkInUrl: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export default function DispatchTripPage() {
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTrip(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      tripReference: String(form.get("tripReference")),
      driverName: String(form.get("driverName")),
      driverPhone: String(form.get("driverPhone")),
      warehouseName: String(form.get("warehouseName")),
      warehouseLat: Number(form.get("warehouseLat")),
      warehouseLng: Number(form.get("warehouseLng")),
      geofenceRadiusMeters: Number(form.get("geofenceRadiusMeters")),
      scheduledArrivalTime: new Date(String(form.get("scheduledArrivalTime"))).toISOString()
    };

    setLoading(true);
    const response = await fetch(`${apiBaseUrl}/api/trips`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Trip could not be created.");
      return;
    }
    setTrip(data);
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="hero-panel">
          <p className="eyebrow">Dispatcher console</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Create a freight arrival trip</h1>
          <p className="mt-3 text-slate-300">This creates the secure driver link through the ASP.NET Core backend.</p>
        </section>

        <form onSubmit={createTrip} className="soft-panel space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="label">Trip reference</span>
              <input className="field" name="tripReference" defaultValue="LOAD-10029" required />
            </label>
            <label className="space-y-2">
              <span className="label">Scheduled arrival</span>
              <input className="field" name="scheduledArrivalTime" type="datetime-local" defaultValue="2026-05-28T15:00" required />
            </label>
            <label className="space-y-2">
              <span className="label">Driver name</span>
              <input className="field" name="driverName" defaultValue="John Smith" required />
            </label>
            <label className="space-y-2">
              <span className="label">Driver phone</span>
              <input className="field" name="driverPhone" defaultValue="+15555550123" required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="label">Warehouse name</span>
              <input className="field" name="warehouseName" defaultValue="Tampa Distribution Center" required />
            </label>
            <label className="space-y-2">
              <span className="label">Warehouse latitude</span>
              <input className="field" name="warehouseLat" type="number" step="0.000001" defaultValue="27.9506" required />
            </label>
            <label className="space-y-2">
              <span className="label">Warehouse longitude</span>
              <input className="field" name="warehouseLng" type="number" step="0.000001" defaultValue="-82.4572" required />
            </label>
            <label className="space-y-2">
              <span className="label">Geofence radius meters</span>
              <input className="field" name="geofenceRadiusMeters" type="number" min="25" max="5000" defaultValue="250" required />
            </label>
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}
          <button className="primary-button w-full" disabled={loading}>{loading ? "Creating trip..." : "Create Trip and SMS Link"}</button>
        </form>

        {trip && (
          <section className="card space-y-4 border-dock/20 bg-teal-50">
            <div>
              <p className="text-2xl font-black text-dock">Trip created</p>
              <p className="mt-1 font-bold text-teal-800">{trip.tripReference} · {trip.status}</p>
            </div>
            <a className="primary-button w-full" href={trip.checkInUrl}>Open Driver Check-In</a>
            <pre className="whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-slate-700">{JSON.stringify(trip, null, 2)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
