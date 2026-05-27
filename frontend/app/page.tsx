"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Tab = "analyze" | "knowledge";

interface KnowledgeDoc {
  doc_id: string;
  source: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconBrain = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
);

const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconDatabase = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconSparkle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

// ── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
  </svg>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<Tab>("analyze");

  // Analyze
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [contextUsed, setContextUsed] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Knowledge base
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbMessage, setKbMessage] = useState("");
  const [kbError, setKbError] = useState("");
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [kbDragOver, setKbDragOver] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

  // ── Analyze ────────────────────────────────────────────────────────────────

  const uploadFile = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult("");
    setContextUsed(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${backendUrl}/analyze`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(`Error ${response.status}: ${data.error ?? JSON.stringify(data)}`);
        return;
      }
      setResult(data.analysis);
      setContextUsed(data.context_used ?? 0);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Knowledge Base ─────────────────────────────────────────────────────────

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/knowledge`);
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch { /* silent */ } finally {
      setDocsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => { if (tab === "knowledge") fetchDocs(); }, [tab, fetchDocs]);

  const ingestFile = async () => {
    if (!kbFile) return;
    setKbLoading(true);
    setKbMessage("");
    setKbError("");
    try {
      const formData = new FormData();
      formData.append("file", kbFile);
      const res = await fetch(`${backendUrl}/ingest`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setKbError(`Error: ${data.error ?? JSON.stringify(data)}`); return; }
      setKbMessage(data.message);
      setKbFile(null);
      fetchDocs();
    } catch (err) {
      setKbError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setKbLoading(false);
    }
  };

  const deleteDoc = async (doc_id: string) => {
    try {
      const res = await fetch(`${backendUrl}/knowledge/${doc_id}`, { method: "DELETE" });
      if (res.ok) fetchDocs();
    } catch { /* silent */ }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,10,15,0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", gap: 12, height: 60 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px var(--accent-glow)",
          }}>
            <IconBrain />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
              FailIQ
            </h1>
            <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              AI-POWERED TEST FAILURE ANALYSIS
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            marginLeft: "auto",
            display: "flex",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 3,
            gap: 2,
          }}>
            {(["analyze", "knowledge"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  transition: "all 0.15s",
                  background: tab === t ? "linear-gradient(135deg, #7c6af7, #a78bfa)" : "transparent",
                  color: tab === t ? "#fff" : "var(--text-muted)",
                  boxShadow: tab === t ? "0 0 12px var(--accent-glow)" : "none",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {t === "analyze" ? <><IconFile />{" "}Analyze</> : <><IconDatabase />{" "}Knowledge</>}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Analyze Tab ── */}
        {tab === "analyze" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Hero */}
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em",
                background: "linear-gradient(135deg, #f0f0f8, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Analyze CI Failures
              </h2>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Upload a test log and get an AI-powered root cause analysis in seconds.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) setFile(f);
              }}
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : file ? "var(--success)" : "var(--border)"}`,
                borderRadius: 16,
                padding: "36px 24px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                background: dragOver ? "rgba(124,106,247,0.05)" : file ? "rgba(52,211,153,0.04)" : "var(--surface)",
                boxShadow: dragOver ? "0 0 30px var(--accent-glow)" : "none",
              }}
              onClick={() => document.getElementById("log-input")?.click()}
            >
              <input
                id="log-input"
                type="file"
                accept=".txt,.log,.TXT,.LOG"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
              />
              <div style={{ marginBottom: 12, color: file ? "var(--success)" : "var(--text-muted)" }}>
                <IconUpload />
              </div>
              {file ? (
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--success)" }}>{file.name}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {(file.size / 1024).toFixed(1)} KB — click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-dim)" }}>Drop your log file here</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>or click to browse · .txt, .log</p>
                </div>
              )}
            </div>

            {/* Analyze button */}
            <button
              onClick={uploadFile}
              disabled={!file || loading}
              style={{
                padding: "14px 28px",
                borderRadius: 12,
                border: "none",
                cursor: file && !loading ? "pointer" : "not-allowed",
                fontWeight: 700,
                fontSize: "0.95rem",
                letterSpacing: "-0.01em",
                background: file && !loading
                  ? "linear-gradient(135deg, #7c6af7, #a78bfa)"
                  : "var(--surface-2)",
                color: file && !loading ? "#fff" : "var(--text-muted)",
                boxShadow: file && !loading ? "0 0 24px var(--accent-glow)" : "none",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
              }}
            >
              {loading ? <><Spinner /> Analyzing…</> : <><IconSparkle /> Analyze Logs</>}
            </button>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 12,
                padding: "14px 18px",
                color: "var(--error)",
                fontSize: "0.85rem",
                lineHeight: 1.6,
              }}>
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div>
                {contextUsed !== null && contextUsed > 0 && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(124,106,247,0.12)",
                    border: "1px solid rgba(124,106,247,0.25)",
                    borderRadius: 20, padding: "4px 12px",
                    fontSize: "0.75rem", color: "var(--accent-2)",
                    marginBottom: 12,
                  }}>
                    <IconSparkle />
                    {contextUsed} historical chunk{contextUsed !== 1 ? "s" : ""} used from knowledge base
                  </div>
                )}
                <div style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: "24px 28px",
                  boxShadow: "0 4px 40px rgba(0,0,0,0.4)",
                }}>
                  <div className="rca-output">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Knowledge Base Tab ── */}
        {tab === "knowledge" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Hero */}
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em",
                background: "linear-gradient(135deg, #f0f0f8, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Knowledge Base
              </h2>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Ingest past RCA reports, Jira exports, or custom notes. FailIQ will reference them when analyzing future logs.
              </p>
            </div>

            {/* KB drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setKbDragOver(true); }}
              onDragLeave={() => setKbDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setKbDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) setKbFile(f);
              }}
              style={{
                border: `2px dashed ${kbDragOver ? "var(--accent)" : kbFile ? "var(--success)" : "var(--border)"}`,
                borderRadius: 16,
                padding: "28px 24px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                background: kbDragOver ? "rgba(124,106,247,0.05)" : kbFile ? "rgba(52,211,153,0.04)" : "var(--surface)",
                boxShadow: kbDragOver ? "0 0 30px var(--accent-glow)" : "none",
              }}
              onClick={() => document.getElementById("kb-input")?.click()}
            >
              <input
                id="kb-input"
                type="file"
                accept=".txt,.pdf,.json,.md,.log"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && setKbFile(e.target.files[0])}
              />
              <div style={{ marginBottom: 10, color: kbFile ? "var(--success)" : "var(--text-muted)" }}>
                <IconDatabase />
              </div>
              {kbFile ? (
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--success)" }}>{kbFile.name}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {(kbFile.size / 1024).toFixed(1)} KB — click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-dim)" }}>Drop a document here</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>.txt · .pdf · .json · .md · .log</p>
                </div>
              )}
            </div>

            <button
              onClick={ingestFile}
              disabled={!kbFile || kbLoading}
              style={{
                padding: "13px 24px",
                borderRadius: 12,
                border: "none",
                cursor: kbFile && !kbLoading ? "pointer" : "not-allowed",
                fontWeight: 700,
                fontSize: "0.9rem",
                background: kbFile && !kbLoading
                  ? "linear-gradient(135deg, #7c6af7, #a78bfa)"
                  : "var(--surface-2)",
                color: kbFile && !kbLoading ? "#fff" : "var(--text-muted)",
                boxShadow: kbFile && !kbLoading ? "0 0 20px var(--accent-glow)" : "none",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%",
              }}
            >
              {kbLoading ? <><Spinner /> Ingesting…</> : <><IconDatabase /> Add to Knowledge Base</>}
            </button>

            {kbMessage && (
              <div style={{
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: 10, padding: "12px 16px",
                color: "var(--success)", fontSize: "0.85rem",
              }}>
                ✓ {kbMessage}
              </div>
            )}
            {kbError && (
              <div style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 10, padding: "12px 16px",
                color: "var(--error)", fontSize: "0.85rem",
              }}>
                {kbError}
              </div>
            )}

            {/* Document list */}
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconDatabase />
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Ingested Documents</span>
                  {docs.length > 0 && (
                    <span style={{
                      background: "rgba(124,106,247,0.15)",
                      color: "var(--accent-2)",
                      borderRadius: 20, padding: "2px 8px",
                      fontSize: "0.72rem", fontWeight: 700,
                    }}>
                      {docs.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={fetchDocs}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", fontSize: "0.75rem",
                    padding: "4px 8px", borderRadius: 6,
                  }}
                >
                  Refresh
                </button>
              </div>

              {docsLoading ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Spinner /> Loading…
                </div>
              ) : docs.length === 0 ? (
                <div style={{ padding: "40px 24px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 6px", color: "var(--text-muted)", fontSize: "0.9rem" }}>No documents yet</p>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8rem" }}>Upload a file above to get started</p>
                </div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {docs.map((doc, i) => (
                    <li
                      key={doc.doc_id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 20px",
                        borderBottom: i < docs.length - 1 ? "1px solid var(--border)" : "none",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ color: "var(--accent-2)", opacity: 0.7 }}><IconFile /></div>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{doc.source}</span>
                      </div>
                      <button
                        onClick={() => deleteDoc(doc.doc_id)}
                        style={{
                          background: "none", border: "1px solid transparent",
                          cursor: "pointer", color: "var(--text-muted)",
                          padding: "5px 8px", borderRadius: 6,
                          display: "flex", alignItems: "center", gap: 4,
                          fontSize: "0.75rem", transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--error)";
                          e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
                          e.currentTarget.style.background = "rgba(248,113,113,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-muted)";
                          e.currentTarget.style.borderColor = "transparent";
                          e.currentTarget.style.background = "none";
                        }}
                      >
                        <IconTrash /> Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "16px 24px",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: "0.75rem",
        marginTop: 40,
      }}>
        FailIQ · Powered by Gemini 2.5 Flash · ChromaDB RAG
      </footer>
    </div>
  );
}
