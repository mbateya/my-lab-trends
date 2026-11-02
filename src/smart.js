import { authorize, ready } from "fhirclient/browser";

export const FHIR_BASE_URL =
  "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/";
export const REDIRECT_URI = "http://localhost:5173/callback";
export const SCOPE_VERSION = import.meta.env.VITE_SMART_SCOPE_VERSION || "v2";

const CLIENT_ID = import.meta.env.VITE_EPIC_CLIENT_ID?.trim();
let authorizationReady;

function getScopes() {
  if (!["v1", "v2"].includes(SCOPE_VERSION)) {
    throw new Error('VITE_SMART_SCOPE_VERSION must be either "v1" or "v2".');
  }

  const observationScope =
    SCOPE_VERSION === "v1"
      ? "patient/Observation.read"
      : "patient/Observation.rs";
  // Standalone patient context and read/search access for lab observations.
  return `launch/patient ${observationScope}`;
}

function clientOptions() {
  if (!CLIENT_ID || CLIENT_ID === "PASTE_YOUR_NON_PRODUCTION_CLIENT_ID_HERE") {
    throw new Error(
      "Add your non-production Epic Client ID to .env.local before connecting.",
    );
  }

  return {
    clientId: CLIENT_ID,
    iss: FHIR_BASE_URL,
    redirectUri: REDIRECT_URI,
    scope: getScopes(),
    pkceMode: "required",
  };
}

export async function startEpicAuthorization() {
  // fhirclient discovers Epic's authorize/token endpoints and advertised
  // PKCE methods. `required` makes absence of S256 support an error.
  return authorize(clientOptions());
}

export async function completeEpicAuthorization() {
  // React Strict Mode replays mount effects in development; share one token
  // exchange promise so the callback code is exchanged only once.
  authorizationReady ||= ready();
  return authorizationReady;
}

export function getRequestedScope() {
  return getScopes();
}
