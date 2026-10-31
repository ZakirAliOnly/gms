# Gold's GYM branding

The application name is defined in `src/lib/branding.ts`. Login, the shared
application sidebar, workspace labels, settings and browser titles use that name.
The existing brown theme and branch names are unchanged.

`public/golds-gym-logo.png` is the circular yellow-and-black Gold's Gym logo
matching the image supplied in chat. Since the inline attachment was not exposed
as a downloadable workspace file, a matching 1200px transparent PNG was obtained
from https://github.com/vishalola/goldsgym/blob/main/icon.png and visually checked
against the supplied reference. The same asset is used by the Next.js browser
icon convention in `src/app/icon.png`.

Validation: production Webpack build and ESLint passed. Production-mode Chromium
verified loaded logos and the new name on login/dashboard, browser title/icon,
mobile login/drawer, collapsed sidebar and no document-level horizontal overflow.
