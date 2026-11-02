# My Lab Trends

My Lab Trends is an educational prototype for exploring how a patient-facing SMART on FHIR application could present laboratory trends. It is not a clinical product. The first client-only implementation supports a standalone patient launch to the Epic non-production FHIR R4 sandbox and reads laboratory Observations in the browser. It has no backend or database and must not be pointed at production healthcare environments.

The application uses React, Vite, JavaScript, and the official `fhirclient` SMART JavaScript library. Lab Observation resources are held in memory while the page is open; `fhirclient` keeps SMART authorization state, including token response and patient context needed for the active session, in browser `sessionStorage`. The app does not log access tokens or patient resources.

## Documentation site

The static, public-facing pages are in [`docs/`](docs/):

- [About](docs/index.html)
- [Terms of Use](docs/terms.html)
- [Privacy Policy](docs/privacy.html)

After enabling GitHub Pages for this public repository, configure **Settings → Pages → Deploy from a branch → `main` → `/docs`**. GitHub Pages can then publish the site at:

`https://mbateya.github.io/my-lab-trends/`

The corresponding URLs for an Epic app registration are expected to be:

- About: `https://mbateya.github.io/my-lab-trends/`
- Terms of Use: `https://mbateya.github.io/my-lab-trends/terms.html`
- Privacy Policy: `https://mbateya.github.io/my-lab-trends/privacy.html`

These links will work after Pages finishes publishing. In the Pages settings, enable **Enforce HTTPS** when available. Confirm the published URLs and repository visibility before entering them in any app registration.

## Run the app locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

1. Copy `.env.example` to `.env.local`.
2. Replace `PASTE_YOUR_NON_PRODUCTION_CLIENT_ID_HERE` with your Epic sandbox **public** client ID. Do not add a client secret.
3. Set `VITE_SMART_SCOPE_VERSION` to `v1` or `v2`, matching the **SMART Scope Version** selected in your Epic app registration. V1 is the default.
4. In the Epic registration, select SMART on FHIR, FHIR R4, patient-facing standalone launch, the matching scope version, and the read/search Labs Observation API. Register this redirect URI exactly: `http://localhost:5173/callback`.
5. Install dependencies and start Vite:

   ```sh
   npm ci
   npm run dev
   ```

6. Open `http://localhost:5173`, select **Connect to Epic Sandbox**, and sign in with an Epic sandbox MyChart test account. The app should return to `/callback`, load patient context and laboratory Observations, then display them in the table.

The app requests `launch/patient patient/Observation.rs` with SMART v2, or `launch/patient patient/Observation.read` with SMART v1. [Epic's scope guidance](https://fhir.epic.com/Documentation?docId=patientfacingfhirapps&section=AutomaticClientDistribution) describes v1 `.read` and v2 `.rs` scope formats. The client requires S256 PKCE; it stops before redirecting if Epic's SMART discovery metadata does not advertise S256. No client secret is used.

### Local checks

```sh
npm run build
npm run dev
```

The Epic sign-in round trip additionally requires a real non-production Client ID and sandbox test account. The placeholder in `.env.example` is intentionally not a valid credential. Use sandbox synthetic data only; do not add patient records, access tokens, or credentials to Git.

## Patient data handling

Laboratory Observation resources are kept only in React component memory and are cleared when disconnecting or closing/reloading the page. `fhirclient` keeps OAuth state, token response, and patient context needed for the SMART session in tab-scoped `sessionStorage`, which the app clears on disconnect and on a fresh page load. There is no persistent lab-record storage, server, database, or token logging. These implementation choices do not constitute a security or regulatory certification.

## Local documentation preview

The documentation is plain HTML and CSS. You can preview it locally with any static file server, for example:

```sh
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000/` in a browser.

## License

No license has been selected yet. Unless a license is added, standard copyright applies and reuse is not granted by this repository.
