import { createRoot } from "react-dom/client";

// Two apps share this entry and never load together, so their global styles cannot
// collide: the recovery watch (default) and the original workspace at #/classic.
const root = createRoot(document.getElementById("root"));
if (location.hash.startsWith("#/classic"))
  Promise.all([import("./App.jsx"), import("./styles/index.css")]).then(
    ([{ default: App }]) => root.render(<App />),
  );
else
  import("./recovery/Root.jsx").then(({ default: Root }) =>
    root.render(<Root />),
  );
