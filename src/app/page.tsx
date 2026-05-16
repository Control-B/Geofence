import Link from "next/link";

const steps = [
  "Driver opens the mobile check-in page",
  "Browser GPS verifies the warehouse geofence",
  "Driver sends a prefilled SMS from their phone",
  "Documents and signatures are collected by secure links"
];

const featureSections = [
  ["Driver benefits", "No app download, big mobile buttons, privacy-first GPS use, and fast arrival/departure updates."],
  ["Warehouse benefits", "Reduce gate confusion, confirm location, collect paperwork earlier, and centralize check-ins."],
  ["Geofence verification", "Radius-based GPS verification starts at 150 meters and records timestamp, distance, and status."],
  ["Document upload", "Drivers upload BOL, POD, rate confirmations, lumper receipts, IDs, and other paperwork."],
  ["Self-serve signing", "Typed and optional drawn signatures capture consent, signer role, timestamp, browser, and check-in ID."],
  ["SMS handoff", "The system creates the message, but the driver taps to send it from their own texting app."]
];

const faqs = [
  ["Do drivers install an app?", "No. The flow runs in iPhone Safari and Android Chrome."],
  ["Do you send SMS from the backend?", "No. Drivers use their own phone SMS app with a prefilled message."],
  ["Can warehouses override a check-in?", "Yes. The dashboard supports manual approve and reject actions."],
  ["Is GPS stored forever?", "The MVP stores check-in verification data; retention can be configured by policy."]
];

export default function LandingPage() {
  const devAuthBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

  return (
    <main className="bg-asphalt text-white">
      <section className="relative overflow-hidden bg-asphalt text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(15,118,110,.45),transparent_35%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-5 w-fit rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-orange-100">
              GPS check-in for busy docks
            </span>
            <h1 className="max-w-4xl text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              Verified Truck Check-In Without Another App
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
              Let drivers verify arrival with GPS, send warehouse SMS updates, upload documents, and sign forms from their phone.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/check-in" className="primary-button bg-safety hover:bg-orange-600">
                Get Started
              </Link>
              {devAuthBypass && (
                <Link href="/dashboard" className="secondary-button border-orange-200/20 bg-orange-500/15 text-white hover:bg-orange-500/25">
                  Open Operations
                </Link>
              )}
              <Link href="/sign-in" className="secondary-button border-white/20 bg-white/10 text-white hover:bg-white/15">
                Sign In
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-glow backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-5 text-slate-900 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.25em] text-dock">Live gate board</p>
                  <h2 className="text-2xl font-black">Inbound arrivals</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Verified</span>
              </div>
              {[
                ["Apex Freight", "Truck 482", "BOL uploaded"],
                ["Northline", "Truck 110", "SMS sent"],
                ["Cobalt Carrier", "Truck 932", "Signature pending"]
              ].map((row) => (
                <div key={row[1]} className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{row[0]}</p>
                      <p className="text-sm text-slate-500">{row[1]} • Load #LD-2048</p>
                    </div>
                    <p className="text-right text-sm font-bold text-dock">{row[2]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="how-it-works">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-black uppercase tracking-[.25em] text-safety">How it works</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">From gate arrival to paperwork in minutes</h2>
          </div>
          <p className="max-w-xl text-slate-300">A lightweight workflow for drivers and a clear dashboard for warehouse teams.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="card text-asphalt">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 font-black text-safety">{index + 1}</span>
              <p className="mt-4 font-black">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {featureSections.map(([title, body]) => (
            <article key={title} className="card bg-white/95 text-asphalt">
              <h3 className="text-xl font-black">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="hero-panel">
          <p className="font-black uppercase tracking-[.25em] text-orange-200">Pricing placeholder</p>
          <h2 className="mt-3 text-3xl font-black">Simple per-warehouse pricing</h2>
          <p className="mt-4 text-slate-300">Start with one dock team, then expand across facilities. Pricing tiers can be wired after the MVP validates workflow fit.</p>
          <Link href="/check-in" className="primary-button mt-6 bg-safety hover:bg-orange-600">
            Try the driver flow
          </Link>
        </div>
        <div className="card text-asphalt">
          <p className="font-black uppercase tracking-[.25em] text-dock">FAQ</p>
          <div className="mt-4 space-y-4">
            {faqs.map(([question, answer]) => (
              <div key={question} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-black">{question}</p>
                <p className="mt-1 text-slate-600">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}