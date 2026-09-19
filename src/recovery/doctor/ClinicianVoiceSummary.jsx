import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play, Volume2 } from "lucide-react";
import { useAnalysis } from "../patient/useAnalysis.js";
import { buildClinicianSummary } from "./clinicianSummary.js";

function authHeaders() {
  const headers = { "content-type": "application/json" };
  try {
    const code = sessionStorage.getItem("rx-code");
    if (code) headers.authorization = `Bearer ${code}`;
  } catch {
    // The local synthetic demo can run without session storage.
  }
  return headers;
}

export default function ClinicianVoiceSummary({ patient }) {
  const { run, busy: scoring } = useAnalysis(patient);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const playExisting = async () => {
    if (playing) return stop();
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setMessage("Press play again to listen to the prepared audio.");
      }
      return;
    }
    if (summary)
      setMessage(
        "ElevenLabs voice is unavailable right now. The summary text is still available.",
      );
  };

  const prepareAndPlay = async () => {
    if (audioRef.current) return playExisting();
    setBusy(true);
    setMessage("Preparing the summary…");
    let briefing = summary;
    try {
      if (!briefing) {
        // The voice summary uses a fresh model result when available. If scoring
        // is unavailable, the visible recovery-watch data still supports a brief update.
        const fresh = await run(patient.answered?.answers || null);
        briefing = buildClinicianSummary(patient, fresh || patient.analysis);
        setSummary(briefing);
      }
      const response = await fetch("/api/voice/clinician-summary", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text: briefing, demoSynthetic: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "ElevenLabs voice is unavailable.");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      audioUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setMessage("The generated audio could not be played. Try again.");
      };
      audioRef.current = audio;
      setAudioUrl(objectUrl);
      setMessage("Summary ready.");
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setMessage("The summary is ready. Press Listen to play it.");
      }
    } catch (error) {
      const text =
        briefing || buildClinicianSummary(patient, patient.analysis, false);
      setSummary(text);
      setMessage(
        "ElevenLabs voice is unavailable right now. The summary text is still available.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rx-clinician-voice" aria-label="Spoken patient summary">
      <div className="rx-clinician-voice-main">
        <span className="rx-clinician-voice-icon" aria-hidden="true">
          <Volume2 size={18} />
        </span>
        <div>
          <strong>Spoken patient summary</strong>
          <p>
            Hear the recovery-watch status, key readings, and latest model
            result.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="rx-btn primary rx-clinician-voice-button"
        disabled={busy || scoring}
        onClick={audioUrl ? playExisting : prepareAndPlay}
      >
        {busy || scoring ? (
          <>
            <LoaderCircle size={16} className="rx-spin" aria-hidden="true" />{" "}
            Preparing…
          </>
        ) : playing ? (
          <>
            <Pause size={16} aria-hidden="true" /> Stop summary
          </>
        ) : audioUrl ? (
          <>
            <Play size={16} aria-hidden="true" /> Listen again
          </>
        ) : summary ? (
          <>
            <Volume2 size={16} aria-hidden="true" /> Retry voice
          </>
        ) : (
          <>
            <Volume2 size={16} aria-hidden="true" /> Listen to summary
          </>
        )}
      </button>
      {message && (
        <p className="rx-clinician-voice-status" role="status">
          {message}
        </p>
      )}
      {summary && (
        <details className="rx-clinician-voice-transcript">
          <summary>Review spoken summary</summary>
          <p>{summary}</p>
        </details>
      )}
      <small className="rx-clinician-voice-disclaimer">
        Synthetic demo data only. Summary audio text is sent to ElevenLabs; no
        patient name or free-text note is included. This is not a diagnosis or
        treatment recommendation.
      </small>
    </section>
  );
}
