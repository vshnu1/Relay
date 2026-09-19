import { ArrowUp } from "lucide-react";
import { PROFILES, QUESTIONS, SIGNALS, ruleText } from "../data/profiles.js";
import { list, numberWord } from "../format.js";

export default function Profiles() {
  return (
    <div className="rx-page">
      <header className="rx-pagehead">
        <div>
          <h1>Watch profiles</h1>
          <p>
            What is counted after each illness, and in which direction.
            Illustrative settings, not clinically validated.
          </p>
        </div>
      </header>
      <div className="rx-profiles">
        {Object.entries(PROFILES).map(([id, profile]) => (
          <section key={id} className="rx-card" aria-label={profile.name}>
            <h2>{profile.name}</h2>
            <p>
              A review is recommended when at least{" "}
              {numberWord(profile.minMoved)} of these stay past their threshold
              for 24 hours, over the same period.
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
            <dl>
              <div>
                <dt>Recorded, not counted</dt>
                <dd>{list(profile.recorded.map((s) => SIGNALS[s].short))}</dd>
              </div>
              <div>
                <dt>Check-in asks about</dt>
                <dd>
                  {list(
                    profile.questions.map((q) =>
                      QUESTIONS[q].short.toLowerCase(),
                    ),
                  )}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
