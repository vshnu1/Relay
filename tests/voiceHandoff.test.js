import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceHandoff } from "../src/recovery/patient/voiceHandoff.js";

function setup() {
  const completed = [];
  let timeout;
  const handoff = createVoiceHandoff({
    complete: (draft) => completed.push(draft),
    schedule: (fn) => {
      timeout = fn;
      return 1;
    },
    unschedule: () => {},
  });
  return { handoff, completed, timeout: () => timeout() };
}
test("voice handoff waits for the spoken closing to finish, then completes once", () => {
  const { handoff, completed } = setup();
  handoff.begin({ answers: { medicine: "Yes" } });
  handoff.mode("listening");
  handoff.agentMessage();
  assert.equal(completed.length, 0);
  handoff.mode("speaking");
  assert.equal(completed.length, 0);
  handoff.mode("listening");
  handoff.finish();
  assert.equal(completed.length, 1);
  assert.equal(completed[0].answers.medicine, "Yes");
});
test("disconnect or absent playback events still hand off the saved draft", () => {
  for (const action of ["finish", "timeout"]) {
    const state = setup();
    state.handoff.begin({ answers: { medicine: "No" } });
    if (action === "finish") state.handoff.finish();
    else state.timeout();
    assert.equal(state.completed.length, 1);
  }
});
test("cancelled or unmounted handoff cannot reopen a draft", () => {
  const { handoff, completed, timeout } = setup();
  handoff.begin({ answers: {} });
  handoff.cancel();
  timeout();
  assert.equal(completed.length, 0);
});
