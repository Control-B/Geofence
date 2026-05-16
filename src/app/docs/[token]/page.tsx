"use client";

import {FormEvent, use, useEffect, useState} from "react";
import {docsServiceUrl, serviceUrl} from "@/lib/service-api";
import {documentCategories} from "@/lib/validation";

type DocumentRecord = {
  id: string;
  file_name: string;
  file_type: string;
  document_category: string;
  uploaded_at: string;
  private_read_url?: string | null;
};

type TokenContext = {
  checkInId: string;
  driverName: string;
  carrierName: string;
  loadNumber: string;
  expiresAt: string;
  documents: DocumentRecord[];
  warehouseView: boolean;
};

export default function DocumentUploadPage({params}: {params: Promise<{token: string}>}) {
  const {token} = use(params);
  const [context, setContext] = useState<TokenContext | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function loadDocuments() {
    setLoading(true);
    const response = await fetch(serviceUrl(docsServiceUrl, `/documents/${token}${window.location.search}`));
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Document link is unavailable.");
      return;
    }
    setContext(data);
  }

  useEffect(() => {
    loadDocuments();
  }, [token]);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    setUploading(true);
    const response = await fetch(serviceUrl(docsServiceUrl, `/documents/${token}`), {method: "POST", body: formData});
    const data = await response.json();
    setUploading(false);
    if (!response.ok) {
      setError(data.error || "Upload failed.");
      return;
    }
    form.reset();
    setContext(data);
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="hero-panel">
          <p className="eyebrow">Secure document link</p>
          <h1 className="mt-2 text-3xl font-black">Upload warehouse documents</h1>
          <p className="mt-3 text-slate-300">Accepted files: PDF, JPG, PNG. Maximum size: 10MB.</p>
        </section>

        {loading && <div className="card font-bold">Loading document link...</div>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}

        {context && (
          <>
            <section className="soft-panel">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><strong>Driver:</strong> {context.driverName}</p>
                <p><strong>Carrier:</strong> {context.carrierName}</p>
                <p><strong>Load:</strong> {context.loadNumber}</p>
                <p><strong>Expires:</strong> {new Date(context.expiresAt).toLocaleString()}</p>
              </div>
            </section>

            {!context.warehouseView && (
              <form onSubmit={uploadDocument} className="soft-panel space-y-4">
                <h2 className="text-xl font-black">Add a document</h2>
                <label className="block space-y-2">
                  <span className="label">Document type</span>
                  <select className="field" name="category">
                    {documentCategories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="label">File</span>
                  <input className="field" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required />
                </label>
                <button className="primary-button w-full" disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
              </form>
            )}

            <section className="card">
              <h2 className="text-xl font-black">Uploaded files</h2>
              <div className="mt-4 space-y-3">
                {context.documents.length === 0 && <p className="text-slate-600">No documents uploaded yet.</p>}
                {context.documents.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">{document.document_category}: {document.file_name}</p>
                        <p className="text-sm text-slate-500">Uploaded {new Date(document.uploaded_at).toLocaleString()}</p>
                      </div>
                      {context.warehouseView && document.private_read_url && (
                        <a className="secondary-button" href={document.private_read_url} target="_blank" rel="noreferrer">Open</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}