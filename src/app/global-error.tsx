"use client";

/** Last-resort boundary (replaces the root layout), so it carries its own minimal styling. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f1f5f9", color: "#0f172a" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
          <div
            style={{
              maxWidth: 440,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: 20, margin: 0 }}>ApparelFlow is temporarily unavailable</h1>
            <p style={{ color: "#475569", marginTop: 8 }}>An unexpected error occurred. No production data was changed.</p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                background: "#1d4ed8",
                color: "#ffffff",
                border: 0,
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
