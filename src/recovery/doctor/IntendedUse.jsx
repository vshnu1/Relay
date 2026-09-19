import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

// What this software is for, in the software. FDA's clinical decision support
// guidance asks that a clinician be able to review the basis of anything shown
// to them, and lists the intended use, the required inputs and the validation
// status as things that belong where the clinician is — not only in a document
// they will never open. docs/FDA.md is the long version, including our reading
// that Relay probably does not qualify for that exemption.
export default function IntendedUse() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rx-intended" aria-label="Intended use">
      <button
        type="button"
        className="rx-intended-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Info size={15} aria-hidden="true" />
        <span>
          <strong>Investigational. Not cleared by any regulator.</strong> For
          review by a clinician, alongside the record — never instead of it.
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {open && (
        <div className="rx-intended-body">
          <dl>
            <div>
              <dt>Who it is for</dt>
              <dd>
                A clinician or care-team member following a patient during the
                thirty days after discharge. It is not for the patient to act on
                alone, and not for anyone to use as a sole basis for a decision.
              </dd>
            </div>
            <div>
              <dt>What it reads</dt>
              <dd>
                Wearable and phone readings, compared only with that patient’s
                own earlier readings, plus the answers they give to the
                check-in. The signals counted differ by discharge condition and
                are listed on every patient’s page.
              </dd>
            </div>
            <div>
              <dt>What it does</dt>
              <dd>
                Surfaces patients whose counted signals moved together and
                stayed moved, with the readings and thresholds behind that, so a
                clinician can decide whether it matters. Nothing is escalated
                automatically and no alert is sent.
              </dd>
            </div>
            <div>
              <dt>What it does not do</dt>
              <dd>
                It does not diagnose, predict risk, grade severity, recommend
                treatment, or rule anything out. A quiet result is not
                reassurance: it means nothing crossed a threshold, which is not
                the same as nothing being wrong.
              </dd>
            </div>
            <div>
              <dt>How well it works</dt>
              <dd>
                Thresholds were calibrated on a public cohort of 71 people and
                one team member’s own wearable export. How often it stays quiet
                when it should speak has <strong>not</strong> been measured, and
                no clinical validation study exists. Every patient shown here is
                synthetic.
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
