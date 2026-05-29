"use client";

import {useAuth} from "@clerk/nextjs";
import Link from "next/link";
import {use, useEffect, useState} from "react";
import {dashboardServiceUrl, serviceUrl} from "@/lib/service-api";

type Detail = {
  checkIn: Record<string, string | number | null> & {document_token: string; signing_token: string};
  documents: Array<Record<string, string>>;
  signatures: Array<Record<string, string>>;
};

type GetToken = () => Promise<string | null>;

function DashboardDetailContent({params, getToken}: {params: Promise<{id: string}>; getToken: GetToken}) {
  const {id} = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getToken().then((authToken) => fetch(serviceUrl(dashboardServiceUrl, `/check-ins/${id}`), {
      headers: authToken ? {Authorization: `Bearer ${authToken}`} : {}
    }))
      .then((response) => response.json().then((data) => ({ok: response.ok, data})))
      .then(({ok, data}) => {
        if (!ok) setError(data.error || "Unable to load check-in.");
        else setDetail(data);
      });
  }, [getToken, id]);

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/dashboard" className="secondary-button">Back to dashboard</Link>
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}
        {detail && (
          <>
            <section className="hero-panel">
              <p className="eyebrow">Check-in detail</p>
              <h1 className="mt-2 text-3xl font-black">Load {detail.checkIn.load_number}</h1>
              <p className="mt-3 text-slate-300">{detail.checkIn.driver_name} • {detail.checkIn.carrier_name}</p>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              {[
                ["Geofence", String(detail.checkIn.geofence_status || "pending").replaceAll("_", " ")],
                ["Move type", String(detail.checkIn.type || "—")],
                ["Documents", `${detail.documents.length} uploaded`],
                ["Signing", detail.signatures.length > 0 ? "signed" : "pending"]
              ].map(([label, value]) => (
                <div key={label} className="soft-panel">
                  <p className="text-xs font-black uppercase tracking-[.22em] text-dock">{label}</p>
                  <p className="mt-2 text-xl font-black capitalize text-asphalt">{value}</p>
                </div>
              ))}
            </section>

            <section className="soft-panel">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[.25em] text-safety">Operational workflow</p>
                  <h2 className="mt-1 text-2xl font-black text-asphalt">Document exchange and signing</h2>
                  <p className="mt-1 text-slate-600">Share these secure links with the driver or use warehouse review mode internally.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Link className="secondary-button" href={`/docs/${detail.checkIn.document_token}`}>Driver upload portal</Link>
                <Link className="secondary-button" href={`/docs/${detail.checkIn.document_token}?view=warehouse`}>Warehouse document review</Link>
                <Link className="primary-button" href={`/sign/${detail.checkIn.signing_token}`}>Signing portal</Link>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {Object.entries(detail.checkIn).map(([key, value]) => (
                <div className="soft-panel" key={key}>
                  <p className="text-xs font-black uppercase tracking-wide text-dock">{key.replaceAll("_", " ")}</p>
                  <p className="mt-1 break-words font-bold">{String(value ?? "—")}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="card">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black">Documents</h2>
                  <Link className="secondary-button" href={`/docs/${detail.checkIn.document_token}?view=warehouse`}>Warehouse view</Link>
                </div>
                <div className="mt-4 space-y-2">
                  {detail.documents.length === 0 && <p className="text-slate-600">No documents uploaded.</p>}
                  {detail.documents.map((document) => (
                    <p key={document.id} className="rounded-2xl bg-slate-50 p-3 font-bold">{document.document_category}: {document.file_name}</p>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-black">Signatures</h2>
                <div className="mt-4 space-y-2">
                  {detail.signatures.length === 0 && <p className="text-slate-600">Signature pending.</p>}
                  {detail.signatures.map((signature) => (
                    <div key={signature.id} className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-black">{signature.signer_name} • {signature.signer_role}</p>
                      <p className="text-sm text-slate-500">Signed {new Date(signature.signed_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ClerkDashboardDetailPage({params}: {params: Promise<{id: string}>}) {
  const {getToken} = useAuth();
  return <DashboardDetailContent params={params} getToken={getToken} />;
}

export default function DashboardDetailPage({params}: {params: Promise<{id: string}>}) {
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    return <DashboardDetailContent params={params} getToken={async () => null} />;
  }

  return <ClerkDashboardDetailPage params={params} />;
}