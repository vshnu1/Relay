import { test } from "node:test";
import assert from "node:assert/strict";

const { matchOption, matchQuestionOption } = await import("../src/recovery/patient/answerText.js");

const NYS = ["No", "Yes", "Not sure"];
const SCALE = ["No", "A little", "A lot"];

// The case that prompted this file. A patient typed a plain denial with an
// explanation after it, and the check-in recorded the opposite of what they
// said, because "i have" appears inside the sentence and the Yes branch ran
// before the No branch. A clinician would have read "medicines missed: Yes".
test("a denial followed by an explanation is a denial", () => {
  assert.equal(
    matchOption("No, I have taken everything as prescribed.", NYS),
    "No",
  );
  assert.equal(matchOption("No fever that I have noticed.", NYS), "No");
  assert.equal(matchOption("No, I am fine.", NYS), "No");
});

test("whole words only, so nothing is read out of a longer word", () => {
  // "nothing", "know" and "cannot" all contain "no".
  assert.equal(matchOption("Nothing has changed.", NYS), "No");
  assert.equal(matchOption("I do not know.", NYS), "Not sure");
  assert.equal(matchOption("I cannot tell.", NYS), "Not sure");
});

test("a negated comparison is not a severity", () => {
  assert.equal(matchOption("Not worse than yesterday.", SCALE), "No");
  assert.equal(matchOption("No worse at all.", SCALE), "No");
  assert.equal(matchOption("No harder than usual.", SCALE), "No");
});

test("the patient's own qualifier decides the severity", () => {
  assert.equal(matchOption("A little worse.", SCALE), "A little");
  assert.equal(matchOption("Much worse.", SCALE), "A lot");
  assert.equal(matchOption("Breathing is a lot worse today.", SCALE), "A lot");
  assert.equal(matchOption("Just a bit.", SCALE), "A little");
  // No qualifier at all, only the comparison.
  assert.equal(matchOption("It is worse.", SCALE), "A lot");
});

test("affirmatives are read, including the indirect ones", () => {
  assert.equal(matchOption("Yes, I missed two doses.", NYS), "Yes");
  assert.equal(matchOption("I have missed a couple of doses.", NYS), "Yes");
  assert.equal(matchOption("Yeah", NYS), "Yes");
});

test("voice answers can describe a clear discharge-plan change in their own words", () => {
  assert.equal(matchQuestionOption("medicine", "I stopped taking it."), "Yes");
  assert.equal(matchQuestionOption("device", "I didn't use my CPAP twice."), "Yes");
  assert.equal(matchQuestionOption("mealPlan", "I ate outside my discharge instructions."), "Yes");
  assert.equal(matchQuestionOption("medicine", "I did not miss any doses."), "No");
  assert.equal(matchQuestionOption("mealPlan", "Pizza."), null, "food alone does not prove it was outside the plan");
});

test("an exact option is taken as given", () => {
  for (const option of NYS) assert.equal(matchOption(option, NYS), option);
  for (const option of SCALE) assert.equal(matchOption(option, SCALE), option);
});

// The check-in offers the options as buttons when nothing matches, so null
// costs one extra tap. A wrong guess is never seen by anyone again.
test("an answer it cannot read is left unread rather than guessed", () => {
  assert.equal(matchOption("", NYS), null);
  assert.equal(matchOption("   ", NYS), null);
  assert.equal(matchOption("banana", NYS), null);
  assert.equal(matchOption(null, NYS), null);
  assert.equal(matchOption("yes", SCALE), null, "a scale has no plain yes");
});
