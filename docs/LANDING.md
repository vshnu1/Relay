# Public landing page

The page a hospital points a patient at before they have signed in to
anything: what Relay is, why it exists, how it works, what the patient app
looks like, what it never does, how data is handled, and how to start with a
discharge code. It lives at `public/welcome/index.html` with its script in
`public/welcome/welcome.js`, and nothing else.

## Where it is served

| Server                                            | URL                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Production (`npm run build && npm start`, Render) | `/welcome` (redirects to `/welcome/`)                                                                                                           |
| Vite dev server (`npm run dev`)                   | `/welcome/index.html`: Vite does not resolve a directory index in `public/`, so the bare `/welcome/` falls through to the React app in dev only |

The deployed copy is therefore `https://relay-bayhacks.onrender.com/welcome`.

## Why it is a static file under `public/`

- **It is reachable before the access gate.** On the deployed demo the
  clinician and patient codes are set, and the React root checks them before
  it renders anything, so the in-app landing at `#/welcome` is never shown to
  someone without a code. A file in `public/` is copied into `dist/` as is and
  served by Express before any of that.
- **It loads in one request** on a phone, with no framework bundle.
- **It needs no change in anyone else's area.** `public/` is unowned in
  `AGENTS.md`; `index.html`, `vite.config.js` and `src/**` are untouched.

## Constraints it lives under

- The server's Content Security Policy allows scripts from this origin only,
  never inline. The behaviour (menu, scroll reveal, section highlight, tabs)
  is in `welcome.js` for that reason. Inline styles are allowed.
- The typefaces are the app's own, from `/fonts/fonts.css`; the page makes no
  third-party request, which is a claim the page itself makes.
- Copy passes `analysis/language_guard.py`. Re-run it after editing text:

  ```sh
  python3 - <<'PY'
  import re, sys; sys.path.insert(0, "analysis")
  from language_guard import check
  h = open("public/welcome/index.html", encoding="utf-8").read()
  t = re.sub(r"<[^>]+>", " ", re.sub(r"<(style|script|svg)\b.*?</\1>", " ", h, flags=re.S))
  print(check(t) or "pass")
  PY
  ```

- The scroll reveal only applies once `welcome.js` has added `js` to `<html>`.
  If the script is ever blocked, the page is simply visible.
- The nav links are ordinary fragment links that the script also handles:
  it scrolls the section into view under the sticky header and updates the
  hash. Without the script they still jump natively.
- The page is five numbered bands after the hero, each a different colour and
  layout (statement row, drawn timeline, dark tabbed panel, chip marquee, a
  will and will-not ledger), so a reader always knows a new part began.
  Keep that variety when adding anything.
- No em dashes or en dashes anywhere in the copy. Use a comma, a colon, or a
  new sentence.

## Who it is for

Patients only. Hospitals hand patients the link, so the page speaks to the
person going home: no section addressed to clinicians, and no care-team
sign-in in the header or menu. The single staff link is the last line of the
footer, to `/#/login`. Keep the copy short; the whole page is about 1,400
words, and each section is a heading, a line or two, and a picture.

## Every picture of the app is the app, with one exception

The chart in "What it is" and the five screens in the app tour are
screenshots of the patient app, signed in as the demo patient, stored in
`public/welcome/img/`. The one exception is the phone in the hero: Relay has
no phone screen yet, so that is a hand-built illustration of one, and its
label says so. Do not draw anything else by hand; regenerate the screenshots
whenever the app's screens change:

```sh
npm run build && npm start                 # serves on :3001
npm install --no-save puppeteer-core
node docs/landing-screenshots.mjs          # rewrites public/welcome/img/*.webp
```

The script hides the demo-controls bar and nothing else. After regenerating,
re-read the "Straight from the app" paragraph, which quotes the numbers on the
chart, and the tab panel sentences, so the words still match the pictures.

## Links out of the page

`/#/patient` (patient sign-in, every primary button) and `/#/login` (care
team, footer only). The demo hint at the bottom names Bayfront Health and
`BAY-2741`, which is Maya Okafor, the patient the demo runbook opens.

## Making it the first page at `/`

That is a one-line decision in the React root, which is the frontend owner's
file: either redirect an unsigned visitor at `/` to `/welcome/`, or link to it
from the sign-in screens. The demo runbook currently expects `/` to open the
clinician watchlist, so agree on it before changing it.
