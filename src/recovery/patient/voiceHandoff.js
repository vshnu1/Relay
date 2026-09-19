// Wait for the closing response to finish playing before closing the microphone.
// A disconnect or missing playback event still leaves a reviewable draft.
export function createVoiceHandoff({
  complete,
  schedule = setTimeout,
  unschedule = clearTimeout,
}) {
  let draft = null;
  let timer = null;
  let spoke = false;
  let message = false;
  const cancel = () => {
    if (timer !== null) unschedule(timer);
    timer = null;
    draft = null;
    spoke = false;
    message = false;
  };
  const finish = () => {
    if (!draft) return;
    const saved = draft;
    cancel();
    complete(saved);
  };
  return {
    pending: () => !!draft,
    begin(value) {
      cancel();
      draft = value;
      timer = schedule(finish, 20000);
    },
    agentMessage() {
      if (draft) message = true;
    },
    mode(mode) {
      if (!draft) return;
      if (mode === "speaking") spoke = true;
      if (mode === "listening" && spoke && message) finish();
    },
    finish,
    cancel,
  };
}
