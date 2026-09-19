import { ArrowUp } from "lucide-react";
import {
  PROFILES,
  PROGRAM_PREVIEWS,
  QUESTIONS,
  SIGNALS,
  ruleText,
} from "../model/profiles.js";
import { list, numberWord } from "../format.js";

// These read as a list inside a sentence, so each label is lowercased. An
// acronym is not a word, though: it turned "Nights without the CPAP machine"
// into "nights without the cpap machine". Splitting on the acronyms keeps them
// whole, because a capturing split puts each match at an odd index.
const ACRONYM = /\b(CPAP|COPD|HRV|SpO2|BP|ECG)\b/;
const lower = (text) =>
  String(text)
    .split(new RegExp(ACRONYM.source, "g"))
    .map((part, i) => (i % 2 ? part : part.toLowerCase()))
    .join("");

export default function Profiles() {
  return (
    <div className="rx-page">
      <header className="rx-pagehead">
        <div>
          <span className="rx-home-kicker">Monitoring setup</span>
          <h1>Watch profiles</h1>
          <p>
            Choose a recovery pathway to explore its signals and check-in
            topics. Demo settings are illustrative, not clinically validated.
          </p>
        </div>
      </header>
      <div className="rx-profiles">
        {Object.entries(PROFILES).map(([id, profile]) => (
          <section key={id} className="rx-card" aria-label={profile.name}>
            <h2>{profile.name}</h2>
            <div className="rx-profile-signals" aria-label="Watched signals">
              {profile.counted.map((c) => (
                <span key={c.signal}>{SIGNALS[c.signal].short}</span>
              ))}
            </div>
            <details className="rx-profile-rules">
              <summary>View review criteria</summary>
              <p>
                At least {numberWord(profile.minMoved)} signals past their
                thresholds for 24 hours over the same period.
              </p>
              <ul>
                {profile.counted.map((c) => (
                  <li key={c.signal}>
                    <span className="rx-dir" aria-hidden="true">
                      <ArrowUp
                        size={14}
                        strokeWidth={2.6}
                        style={{
                          transform: c.dir < 0 ? "rotate(180deg)" : undefined,
                        }}
                      />
                    </span>
                    <div>
                      <strong>{SIGNALS[c.signal].name}</strong>
                      <small>{ruleText(c, SIGNALS[c.signal].unit)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
            <dl>
              <div>
                <dt>Recorded, not counted</dt>
                <dd>{list(profile.recorded.map((s) => SIGNALS[s].short))}</dd>
              </div>
              <div>
                <dt>Check-in asks about</dt>
                <dd>
                  {list(
                    profile.questions.map((q) => lower(QUESTIONS[q].short)),
                  )}
                </dd>
              </div>
            </dl>
            {profile.caution && (
              <p className="rx-profile-caution">{profile.caution}</p>
            )}
          </section>
        ))}
      </div>
      {/* Every program that was listed here has since been enabled, so the
          section hides itself rather than showing an empty promise. */}
      {PROGRAM_PREVIEWS.length > 0 && (
        <section
          className="rx-profile-roadmap"
          aria-label="Additional recovery programs"
        >
          <div className="rx-profile-roadmap-head">
            <span className="rx-home-kicker">Program development</span>
            <h2>More recovery pathways</h2>
            <p>
              Additional programs need connected signals and condition-specific
              validation before they can be enabled here.
            </p>
          </div>
          <div className="rx-profile-preview-grid">
            {PROGRAM_PREVIEWS.map((program) => (
              <article className="rx-card rx-profile-preview" key={program.id}>
                <span className="rx-profile-preview-status">
                  {program.status}
                </span>
                <h3>{program.name}</h3>
                <p className="rx-profile-preview-summary">{program.summary}</p>
                <dl>
                  <div>
                    <dt>Potential signals</dt>
                    <dd>{list(program.measures)}</dd>
                  </div>
                  <div>
                    <dt>Check-in context</dt>
                    <dd>{list(program.context)}</dd>
                  </div>
                </dl>
                <p className="rx-profile-coverage">{program.coverage}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
