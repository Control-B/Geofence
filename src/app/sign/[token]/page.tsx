"use client";

import {FormEvent, use, useEffect, useRef, useState} from "react";
import {serviceUrl, signingServiceUrl} from "@/lib/service-api";

type SignContext = {
  checkInId: string;
  driverName: string;
  carrierName: string;
  loadNumber: string;
  title: string;
  expiresAt: string;
  signed: boolean;
};

export default function SigningPage({params}: {params: Promise<{token: string}>}) {
  const {token} = use(params);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [context, setContext] = useState<SignContext | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    fetch(serviceUrl(signingServiceUrl, `/signatures/${token}`))
      .then((response) => response.json().then((data) => ({ok: response.ok, data})))
      .then(({ok, data}) => {
        setLoading(false);
        if (!ok) setError(data.error || "Signing link is unavailable.");
        else setContext(data);
      });
  }, [token]);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const canvas = canvasRef.current!;
    const context2d = canvas.getContext("2d")!;
    const point = getCanvasPoint(event);
    context2d.beginPath();
    context2d.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const context2d = canvas.getContext("2d")!;
    const point = getCanvasPoint(event);
    context2d.lineWidth = 3;
    context2d.lineCap = "round";
    context2d.strokeStyle = "#111827";
    context2d.lineTo(point.x, point.y);
    context2d.stroke();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function submitSignature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const canvas = canvasRef.current;
    const payload = {
      signerName: String(formData.get("signerName")),
      signerRole: String(formData.get("signerRole")),
      typedSignature: String(formData.get("typedSignature")),
      drawnSignatureDataUrl: canvas?.toDataURL("image/png") || "",
      consentChecked: formData.get("consentChecked") === "on"
    };

    setSubmitting(true);
    const response = await fetch(serviceUrl(signingServiceUrl, `/signatures/${token}`), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(data.error || "Signature failed.");
      return;
    }
    setSigned(true);
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="hero-panel">
          <p className="eyebrow">Electronic signature</p>
          <h1 className="mt-2 text-3xl font-black">Self-serve signing</h1>
          <p className="mt-3 text-slate-300">Sign basic warehouse forms from your phone without a separate DocuSign integration.</p>
        </section>

        {loading && <div className="card font-bold">Loading signing link...</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}
        {(signed || context?.signed) && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xl font-black text-emerald-900">Signed successfully</div>}

        {context && !signed && !context.signed && (
          <form onSubmit={submitSignature} className="soft-panel space-y-4">
            <div>
              <h2 className="text-2xl font-black">{context.title}</h2>
              <p className="mt-1 text-slate-600">Load {context.loadNumber} • {context.carrierName} • Expires {new Date(context.expiresAt).toLocaleString()}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="label">Signer name</span>
                <input className="field" name="signerName" defaultValue={context.driverName} required />
              </label>
              <label className="space-y-2">
                <span className="label">Signer role</span>
                <select className="field" name="signerRole" defaultValue="Driver">
                  <option>Driver</option>
                  <option>Warehouse receiver</option>
                  <option>Dispatcher</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            <label className="block space-y-2">
              <span className="label">Typed signature</span>
              <input className="field text-2xl italic" name="typedSignature" placeholder="Type your full legal name" required />
            </label>
            <div className="space-y-2">
              <span className="label">Optional drawn signature</span>
              <canvas
                ref={canvasRef}
                width={900}
                height={260}
                className="h-44 w-full touch-none rounded-2xl border border-slate-200 bg-white"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={() => (drawing.current = false)}
                onPointerLeave={() => (drawing.current = false)}
              />
              <button type="button" className="secondary-button" onClick={clearCanvas}>Clear drawing</button>
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 font-bold text-slate-700">
              <input className="mt-1 h-5 w-5" type="checkbox" name="consentChecked" required />
              <span>I agree that this electronic signature represents my intent to sign this document.</span>
            </label>
            <button className="primary-button w-full" disabled={submitting}>{submitting ? "Signing..." : "Sign Document"}</button>
          </form>
        )}
      </div>
    </main>
  );
}