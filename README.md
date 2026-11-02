# My Lab Trends

My Lab Trends is an educational prototype for exploring how a patient-facing SMART on FHIR application could present laboratory trends. It is not a clinical product and is not ready to connect to an electronic health record. No SMART on FHIR connection, patient-data handling, authentication, authorization, or application security controls have been implemented.

The planned application stack is React, Vite, and JavaScript. This repository currently contains project documentation; the app itself has not been scaffolded.

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

## Development status

This repository does not yet include a React/Vite application or any FHIR integration. Do not add real patient information, access tokens, client secrets, or other credentials to this repository. Future implementation should use synthetic data during development and follow the requirements of the target EHR and SMART on FHIR launch configuration.

## Local documentation preview

The documentation is plain HTML and CSS. You can preview it locally with any static file server, for example:

```sh
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000/` in a browser.

## License

No license has been selected yet. Unless a license is added, standard copyright applies and reuse is not granted by this repository.
