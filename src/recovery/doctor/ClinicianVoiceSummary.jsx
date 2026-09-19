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
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  const stop = () => {
    audioRef.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
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
    if (summary && typeof speechSynthesis !== "undefined") {
      const utterance = new SpeechSynthesisUtterance(summary);
      utterance.onend = () => setPlaying(false);
      utterance.onerror = () => setPlaying(false);
      speechSynthesis.speak(utterance);
      setPlaying(true);
    }
  };

  const prepareAndPlay = async () => {
    if (audioRef.current || summary) return playExisting();
    setBusy(true);
    setMessage("Scoring current readings and preparing the briefing…");
    let briefing = "";
    try {
      // The voice summary uses a fresh model result when available. If scoring
      // is disabled, it clearly falls back to the visible recovery-watch data.
      const fresh = await run(patient.answered?.answers || null);
      briefing = buildClinicianSummary(
        patient,
        fresh || patient.analysis,
        !!fresh,
      );
      setSummary(briefing);
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
      setMessage(
        fresh
          ? "Fresh Relay score included."
          : patient.analysis
            ? "Scoring was unavailable; the most recent model result is labeled in the summary."
            : "Scoring was unavailable; this summary uses the recovery watch readings only.",
      );
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setMessage("The summary is ready. Press Listen to play it.");
      }
    } catch (error) {
      // Keep the feature usable when ElevenLabs is not configured, while making
      // the fallback clear to the clinician.
      const text =
        briefing || buildClinicianSummary(patient, patient.analysis, false);
      setSummary(text);
      if (typeof speechSynthesis !== "undefined") {
        setMessage(
          error.message?.includes("text_to_speech")
            ? "The ElevenLabs key needs text_to_speech permission; using this device’s voice for now."
            : "ElevenLabs is unavailable; using this device’s voice for now.",
        );
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setPlaying(false);
        utterance.onerror = () => setPlaying(false);
        speechSynthesis.speak(utterance);
        setPlaying(true);
      } else {
        setMessage(error.message || "Voice summary could not be prepared.");
      }
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
        onClick={audioUrl || summary ? playExisting : prepareAndPlay}
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
        ) : audioUrl || summary ? (
          <>
            <Play size={16} aria-hidden="true" /> Listen again
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
