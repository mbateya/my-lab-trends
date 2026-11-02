import { useEffect, useState } from "react";
import {
  completeEpicAuthorization,
  FHIR_BASE_URL,
  getRequestedScope,
  REDIRECT_URI,
  SCOPE_VERSION,
  startEpicAuthorization,
} from "./smart.js";

const isCallback = window.location.pathname.replace(/\/$/, "") === "/callback";

function clearStoredSmartState() {
  const storedKey = sessionStorage.getItem("SMART_KEY");
  if (storedKey) {
    try {
      sessionStorage.removeItem(JSON.parse(storedKey));
    } catch {
      /* Ignore malformed library state. */
    }
    sessionStorage.removeItem("SMART_KEY");
  }
}

function getSingleResourceDisplay(observation) {
  const coding =
    observation.code?.coding?.find((item) => item.display || item.code) ||
    observation.code?.coding?.[0];
  const quantity = observation.valueQuantity;
  const value = quantity
    ? (quantity.value ?? "—")
    : observation.valueString ||
      observation.valueCodeableConcept?.text ||
      observation.valueBoolean?.toString() ||
      observation.valueInteger?.toString() ||
      observation.valueDateTime ||
      "—";
  const range = observation.referenceRange?.[0];
  let reference = "—";
  if (range?.text) reference = range.text;
  else if (range) {
    const low = range.low?.value;
    const high = range.high?.value;
    const unit = range.low?.unit || range.high?.unit || "";
    if (low !== undefined || high !== undefined) {
      reference = `${low ?? "—"}–${high ?? "—"}${unit ? ` ${unit}` : ""}`;
    }
  }

  return {
    name:
      observation.code?.text || coding?.display || "Unnamed laboratory result",
    loinc:
      observation.code?.coding?.find(
        (item) => item.system === "http://loinc.org",
      )?.code || "—",
    result: value,
    units: quantity?.unit || quantity?.code || "—",
    reference,
    date:
      observation.effectiveDateTime ||
      observation.effectivePeriod?.start ||
      observation.issued ||
      "",
    status: observation.status,
  };
}

function getResourceDisplay(observation) {
  if (!observation.component?.length) {
    return [getSingleResourceDisplay(observation)];
  }

  return observation.component.map((component) =>
    getSingleResourceDisplay({
      ...observation,
      code: component.code || observation.code,
      valueQuantity: component.valueQuantity,
      valueString: component.valueString,
      valueCodeableConcept: component.valueCodeableConcept,
      valueBoolean: component.valueBoolean,
      valueInteger: component.valueInteger,
      valueDateTime: component.valueDateTime,
      referenceRange: component.referenceRange || observation.referenceRange,
    }),
  );
}

function formatDate(date) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  }).format(parsed);
}

async function loadAllLabs(fhir) {
  const observations = [];
  let bundle = await fhir.patient.request(
    "Observation?category=laboratory&_sort=-date&_count=100",
  );
  while (bundle) {
    observations.push(
      ...(bundle.entry || []).map((entry) => entry.resource).filter(Boolean),
    );
    const next = bundle.link?.find((link) => link.relation === "next")?.url;
    if (!next) break;
    const nextUrl = new URL(next, FHIR_BASE_URL);
    const allowedBase = new URL(FHIR_BASE_URL);
    if (
      nextUrl.origin !== allowedBase.origin ||
      !nextUrl.pathname.startsWith(allowedBase.pathname)
    ) {
      throw new Error(
        "Epic returned an unexpected laboratory results page link. The request was stopped.",
      );
    }
    bundle = await fhir.request(nextUrl.href);
  }
  return observations;
}

function getErrorMessage(error) {
  const message = String(
    error?.message || error || "An unexpected error occurred.",
  );
  if (/fetch|network|cors/i.test(message)) {
    return "Could not reach the Epic sandbox. Check your internet connection and confirm the sandbox permits requests from this localhost origin.";
  }
  if (/pkce|challenge/i.test(message)) {
    return "The Epic server did not confirm S256 PKCE support, or the authorization code could not be verified. Check the app registration and sandbox SMART configuration.";
  }
  return message;
}

export default function App() {
  const [client, setClient] = useState(null);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isCallback) {
      // A page reload starts a fresh in-memory session; remove any earlier
      // SMART token state rather than leaving a tab-scoped token behind.
      clearStoredSmartState();
      return;
    }
    let active = true;

    async function finishLaunch() {
      setLoading(true);
      setError("");
      try {
        const fhir = await completeEpicAuthorization();
        if (!active) return;
        const patientId = fhir.patient?.id;
        if (!patientId)
          throw new Error(
            "Epic authorized the request but did not return a patient context. Check that standalone patient launch context is enabled in the app registration.",
          );

        const observations = await loadAllLabs(fhir);
        if (!active) return;

        setClient(fhir);
        // The FHIR context supplies the patient id. Keep demographics out of
        // the UI and request only the laboratory data this prototype needs.
        setLabs(observations.flatMap(getResourceDisplay));
        // Remove the authorization code and state from the visible address bar.
        window.history.replaceState({}, document.title, "/");
      } catch (launchError) {
        if (active) {
          clearStoredSmartState();
          window.history.replaceState({}, document.title, "/");
          setError(getErrorMessage(launchError));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    finishLaunch();
    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    setError("");
    setLoading(true);
    try {
      await startEpicAuthorization();
    } catch (authError) {
      setError(getErrorMessage(authError));
      setLoading(false);
    }
  }

  function disconnect() {
    // fhirclient owns only its SMART authorization state; no patient records
    // are persisted by this app. Clear in-memory patient/result state as well.
    clearStoredSmartState();
    setClient(null);
    setLabs([]);
    setError("");
    window.history.replaceState({}, document.title, "/");
  }

  const patientName = "Epic sandbox patient";

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="My Lab Trends home">
          <span className="brand-mark" aria-hidden="true">
            +
          </span>{" "}
          my lab trends
        </a>
        <span className="prototype-pill">
          <span className="status-dot" /> Sandbox prototype
        </span>
      </header>

      <main className="content">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">A clearer view of your health story</p>
            <h1 id="page-title">
              Your labs,
              <br />
              <em>over time.</em>
            </h1>
            <p className="hero-description">
              Bring your laboratory results together in one calm, easy-to-read
              view. Connect to the Epic sandbox to explore your test data.
            </p>
            {!client ? (
              <button
                className="connect-button"
                onClick={connect}
                disabled={loading}
              >
                <span className="epic-symbol" aria-hidden="true">
                  E
                </span>
                {loading ? "Connecting…" : "Connect to Epic Sandbox"}
                <span className="button-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ) : (
              <button className="disconnect-button" onClick={disconnect}>
                Disconnect from Epic
              </button>
            )}
            <p className="connection-note">
              <span aria-hidden="true">◈</span> Epic sandbox · Read-only access
            </p>
            {error && (
              <div className="error-message" role="alert">
                <strong>Couldn’t connect</strong>
                <span>{error}</span>
              </div>
            )}
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-card">
              <div className="art-card-top">
                <span>HEALTH SNAPSHOT</span>
                <span className="art-spark">✳</span>
              </div>
              <div className="art-label">A little more clarity</div>
              <svg
                viewBox="0 0 320 150"
                role="presentation"
                className="chart-art"
              >
                <path
                  d="M0 120 C34 109 39 89 69 95 S107 114 134 76 S176 64 194 78 S231 48 254 56 S291 38 320 19"
                  fill="none"
                  stroke="#b8d7c6"
                  strokeWidth="3"
                />
                <path
                  d="M0 120 C34 109 39 89 69 95 S107 114 134 76 S176 64 194 78 S231 48 254 56 S291 38 320 19 L320 150 L0 150Z"
                  fill="url(#wash)"
                />
                <defs>
                  <linearGradient id="wash" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#d8eade" stopOpacity=".72" />
                    <stop offset="1" stopColor="#d8eade" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle
                  cx="254"
                  cy="56"
                  r="5"
                  fill="#276c58"
                  stroke="white"
                  strokeWidth="3"
                />
              </svg>
              <div className="art-card-bottom">
                <span>YOUR RESULTS</span>
                <span>ONE PLACE, OVER TIME</span>
              </div>
            </div>
            <div className="art-stamp">
              <span>✳</span>
              <small>
                YOUR
                <br />
                HEALTH
                <br />
                IN VIEW
              </small>
            </div>
          </div>
        </section>

        <section className="results-section" aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your health, in context</p>
              <h2 id="results-title">Lab results</h2>
            </div>
            {client && (
              <span className="patient-tag">
                <span className="patient-avatar">
                  {patientName.slice(0, 1).toUpperCase()}
                </span>
                {patientName}
              </span>
            )}
          </div>
          {loading && (
            <div className="loading-panel" role="status">
              <span className="spinner" />
              Loading results from the Epic sandbox…
            </div>
          )}
          {!client && !loading && (
            <div className="empty-panel">
              <span className="empty-icon" aria-hidden="true">
                ↗
              </span>
              <div>
                <strong>Your results will appear here</strong>
                <p>
                  Connect to the Epic sandbox to view laboratory observations
                  from your test account.
                </p>
              </div>
            </div>
          )}
          {client && labs.length === 0 && !loading && (
            <div className="empty-panel">
              <span className="empty-icon" aria-hidden="true">
                ○
              </span>
              <div>
                <strong>No lab results found</strong>
                <p>
                  No laboratory observations were returned for this test
                  account.
                </p>
              </div>
            </div>
          )}
          {client && labs.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">TEST</th>
                    <th scope="col">LOINC</th>
                    <th scope="col">RESULT</th>
                    <th scope="col">UNITS</th>
                    <th scope="col">REFERENCE INTERVAL</th>
                    <th scope="col">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {labs.map((lab, index) => (
                    <tr key={`${lab.loinc}-${lab.date}-${index}`}>
                      <td data-label="Test">
                        <span className="lab-name">{lab.name}</span>
                        <span
                          className={`result-status status-${lab.status || "unknown"}`}
                        >
                          {lab.status || "result"}
                        </span>
                      </td>
                      <td data-label="LOINC" className="code-cell">
                        {lab.loinc}
                      </td>
                      <td data-label="Result" className="result-cell">
                        {lab.result}
                      </td>
                      <td data-label="Units">{lab.units}</td>
                      <td data-label="Reference interval">{lab.reference}</td>
                      <td data-label="Date">{formatDate(lab.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="prototype-note">
          <span className="note-icon" aria-hidden="true">
            i
          </span>
          <p>
            <strong>Learning project, not medical advice.</strong> This
            prototype is for educational testing with Epic’s non-production
            sandbox. It is not for real patient care. Always discuss your
            results with a qualified healthcare professional.
          </p>
        </aside>
        <details className="setup-details">
          <summary>Connection details</summary>
          <dl>
            <dt>FHIR version</dt>
            <dd>R4</dd>
            <dt>Scope format</dt>
            <dd>SMART {SCOPE_VERSION.toUpperCase()}</dd>
            <dt>Requested scopes</dt>
            <dd>
              <code>{getRequestedScope()}</code>
            </dd>
            <dt>Redirect URI</dt>
            <dd>
              <code>{REDIRECT_URI}</code>
            </dd>
            <dt>Sandbox endpoint</dt>
            <dd>
              <code>{FHIR_BASE_URL}</code>
            </dd>
            <dt>OAuth flow</dt>
            <dd>Authorization code with required S256 PKCE</dd>
          </dl>
        </details>
      </main>
      <footer className="footer">
        <a href="/docs/">About this project</a>
        <span>Built for learning · Epic non-production sandbox only</span>
        <a href="/docs/privacy.html">Privacy</a>
      </footer>
    </div>
  );
}
