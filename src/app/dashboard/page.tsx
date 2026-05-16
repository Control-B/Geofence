"use client";

import {useAuth} from "@clerk/nextjs";
import Link from "next/link";
import {useEffect, useState} from "react";
import {dashboardServiceUrl, serviceUrl} from "@/lib/service-api";

type CheckIn = {
  id: string;
  driver_name: string;
  carrier_name: string;
  truck_number: string;
  trailer_number: string;
  load_number: string;
  type: "arrival" | "departure";
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  geofence_status: string;
  created_at: string;
  verified_at: string | null;
  document_count: string;
  signature_count: string;
};

type FreightRecord = {
  id: string;
  warehouseName: string;
  driverName: string;
  carrierName: string;
  truckNumber: string;
  trailerNumber: string;
  loadNumber: string;
  workflowStatus: string;
  workflowLabel: string;
  arrival: null | {id: string; geofenceStatus: string; statusLabel: string; distanceMeters: number | null; createdAt: string; verifiedAt: string | null};
  departure: null | {id: string; geofenceStatus: string; statusLabel: string; distanceMeters: number | null; createdAt: string; verifiedAt: string | null};
  documents: {count: number; status: string; uploadLink: string; warehouseViewLink: string};
  signing: {count: number; status: string; signingLink: string};
  checkoutLink: string | null;
  detailLink: string;
  lastActivityAt: string;
};

const filters = [
  ["all", "All"],
  ["arrival", "Arrived"],
  ["departure", "Departed"],
  ["pending", "Pending"],
  ["outside_zone", "Outside geofence"]
];

const workflowStyles: Record<string, string> = {
  awaiting_check_in: "border-slate-200 bg-slate-50 text-slate-700",
  geofence_review: "border-orange-200 bg-orange-50 text-orange-800",
  awaiting_documents: "border-orange-200 bg-orange-50 text-orange-800",
  awaiting_signature: "border-teal-200 bg-teal-50 text-teal-800",
  ready_for_checkout: "border-dock/20 bg-teal-50 text-dock",
  checked_out: "border-emerald-200 bg-emerald-50 text-emerald-800",
  attention_required: "border-red-200 bg-red-50 text-red-800"
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default function DashboardPage() {
  const {getToken} = useAuth();
  const [freight, setFreight] = useState<FreightRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCheckIns(nextFilter = filter) {
    setLoading(true);
    const token = await getToken();
    const response = await fetch(serviceUrl(dashboardServiceUrl, `/check-ins?status=${nextFilter}`), {
      headers: token ? {Authorization: `Bearer ${token}`} : {}
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Unable to load dashboard.");
      return;
    }
    setCheckIns(data.checkIns);
  }

  async function loadFreight() {
    const token = await getToken();
    const response = await fetch(serviceUrl(dashboardServiceUrl, "/freight"), {
      headers: token ? {Authorization: `Bearer ${token}`} : {}
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Unable to load freight operations.");
      return;
    }
    setFreight(data.freight);
  }

  useEffect(() => {
    loadFreight();
    loadCheckIns("all");
  }, []);

  async function override(id: string, action: "manual_approved" | "rejected") {
    const token = await getToken();
    await fetch(serviceUrl(dashboardServiceUrl, `/check-ins/${id}`), {
      method: "PATCH",
      headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})},
      body: JSON.stringify({action})
    });
    await loadCheckIns(filter);
    await loadFreight();
  }

  const summary = {
    active: freight.filter((record) => record.workflowStatus !== "checked_out").length,
    awaitingDocuments: freight.filter((record) => record.documents.count === 0).length,
    awaitingSignature: freight.filter((record) => record.signing.count === 0).length,
    readyForCheckout: freight.filter((record) => record.workflowStatus === "ready_for_checkout").length
  };

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="hero-panel">
          <p className="eyebrow">Warehouse dashboard</p>
          <h1 className="mt-2 text-3xl font-black">Check-ins and gate status</h1>
          <p className="mt-3 text-slate-300">Operate the full freight lifecycle: geofence check-in, document exchange, signing, and geofence check-out.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Active freight", summary.active],
            ["Need documents", summary.awaitingDocuments],
            ["Need signatures", summary.awaitingSignature],
            ["Ready checkout", summary.readyForCheckout]
          ].map(([label, value]) => (
            <div key={label} className="soft-panel">
              <p className="text-xs font-black uppercase tracking-[.22em] text-dock">{label}</p>
              <p className="mt-2 text-3xl font-black text-asphalt">{value}</p>
            </div>
          ))}
        </section>

        <section className="soft-panel space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[.25em] text-safety">Freight operations</p>
              <h2 className="mt-1 text-2xl font-black text-asphalt">Check-in → docs → signing → check-out</h2>
            </div>
            <Link href="/check-in" className="primary-button">New geofence check-in</Link>
          </div>

          <div className="grid gap-4">
            {freight.map((record) => (
              <article key={record.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className={`mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${workflowStyles[record.workflowStatus] || workflowStyles.awaiting_check_in}`}>
                      {record.workflowLabel}
                    </div>
                    <h3 className="text-2xl font-black text-asphalt">Load {record.loadNumber}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-600">{record.carrierName} • Truck {record.truckNumber} • Trailer {record.trailerNumber}</p>
                    <p className="mt-1 text-sm text-slate-500">Driver: {record.driverName} • {record.warehouseName}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[28rem]">
                    <a className="secondary-button min-h-10 px-3 py-2" href={record.documents.uploadLink} target="_blank" rel="noreferrer">Driver docs</a>
                    <a className="secondary-button min-h-10 px-3 py-2" href={record.documents.warehouseViewLink} target="_blank" rel="noreferrer">Review docs ({record.documents.count})</a>
                    <a className="secondary-button min-h-10 px-3 py-2" href={record.signing.signingLink} target="_blank" rel="noreferrer">Signing ({record.signing.status})</a>
                    {record.checkoutLink ? (
                      <a className="primary-button min-h-10 px-3 py-2" href={record.checkoutLink}>Geofence check-out</a>
                    ) : (
                      <span className="secondary-button min-h-10 px-3 py-2 opacity-70">Checked out</span>
                    )}
                    <Link className="secondary-button min-h-10 px-3 py-2 sm:col-span-2" href={record.detailLink}>Operational details</Link>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Geofence check-in</p>
                    <p className="mt-1 font-black capitalize text-asphalt">{record.arrival?.statusLabel || "Pending"}</p>
                    <p className="text-sm text-slate-500">{record.arrival ? new Date(record.arrival.createdAt).toLocaleString() : "No arrival yet"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Documents</p>
                    <p className="mt-1 font-black capitalize text-asphalt">{record.documents.status}</p>
                    <p className="text-sm text-slate-500">{record.documents.count} file(s)</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Signing</p>
                    <p className="mt-1 font-black capitalize text-asphalt">{record.signing.status}</p>
                    <p className="text-sm text-slate-500">{record.signing.count} signature(s)</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Geofence check-out</p>
                    <p className="mt-1 font-black capitalize text-asphalt">{record.departure?.statusLabel || "Pending"}</p>
                    <p className="text-sm text-slate-500">{record.departure ? new Date(record.departure.createdAt).toLocaleString() : "Not checked out"}</p>
                  </div>
                </div>
              </article>
            ))}
            {!loading && freight.length === 0 && <p className="rounded-2xl bg-white p-5 text-center font-bold text-slate-500">No freight records yet.</p>}
          </div>
        </section>

        <section className="soft-panel">
          <div className="flex flex-wrap gap-2">
            {filters.map(([value, label]) => (
              <button
                key={value}
                className={value === filter ? "primary-button" : "secondary-button"}
                onClick={() => {
                  setFilter(value);
                  loadCheckIns(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {loading && <div className="card font-bold">Loading check-ins...</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}

        <section className="overflow-hidden rounded-3xl border border-dock/10 bg-white/95 shadow-sm shadow-teal-900/5">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-teal-50 text-xs font-black uppercase tracking-wide text-dock">
                <tr>
                  {[
                    "Status",
                    "Driver",
                    "Carrier",
                    "Truck",
                    "Trailer",
                    "Load number",
                    "Arrival/departure",
                    "Verified location",
                    "Timestamp",
                    "Documents",
                    "Signature status",
                    "Actions"
                  ].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checkIns.map((checkIn) => (
                  <tr key={checkIn.id} className="align-top">
                    <td className="px-4 py-4 font-black capitalize">{statusLabel(checkIn.geofence_status)}</td>
                    <td className="px-4 py-4">{checkIn.driver_name}</td>
                    <td className="px-4 py-4">{checkIn.carrier_name}</td>
                    <td className="px-4 py-4">{checkIn.truck_number}</td>
                    <td className="px-4 py-4">{checkIn.trailer_number}</td>
                    <td className="px-4 py-4">{checkIn.load_number}</td>
                    <td className="px-4 py-4 capitalize">{checkIn.type}</td>
                    <td className="px-4 py-4">{checkIn.distance_meters === null ? "Not captured" : `${checkIn.distance_meters}m`}</td>
                    <td className="px-4 py-4">{new Date(checkIn.created_at).toLocaleString()}</td>
                    <td className="px-4 py-4">{checkIn.document_count}</td>
                    <td className="px-4 py-4">{Number(checkIn.signature_count) > 0 ? "Signed" : "Pending"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <Link className="secondary-button min-h-10 px-3 py-2" href={`/dashboard/${checkIn.id}`}>Details</Link>
                        <button className="secondary-button min-h-10 px-3 py-2" onClick={() => override(checkIn.id, "manual_approved")}>Approve manually</button>
                        <button className="secondary-button min-h-10 px-3 py-2" onClick={() => override(checkIn.id, "rejected")}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && checkIns.length === 0 && (
                  <tr><td className="px-4 py-8 text-center font-bold text-slate-500" colSpan={12}>No check-ins found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}