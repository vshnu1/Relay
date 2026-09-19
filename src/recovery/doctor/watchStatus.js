// One name per watch state, for every clinician surface.
//
// These four states had nine names between them: the doctor's home called the
// same group "Waiting on patient" in its summary card and "Check-in pending" in
// the badge eleven lines below, and "Not enough data" in one and "Data gap" in
// the other. A clinician moving between the ward list, a patient page and the
// watchlist has to be able to tell that they are looking at the same state.
//
// The prose beneath a heading can say whatever reads best. The label naming the
// state comes from here.

export const STATUS = {
  review: "Review recommended",
  context: "Context needed",
  monitoring: "Monitoring",
  nodata: "Not enough data",
};

// What each state means, one line, for a card or a section introduction.
export const DETAIL = {
  review: "Persistent changes for clinician review",
  context: "Check-in sent; response not yet received",
  monitoring: "No new persistent pattern to review",
  nodata: "Too few readings to compare with their usual",
};

// What the model's four states are called on the clinician side. The patient side words
// them differently on purpose (patient/ModelSummary.jsx).
export const MODEL_STATE = {
  monitoring: "Nothing unusual",
  context_needed: "Unusual, context needed",
  review_recommended: "Unusual, ready for review",
  insufficient_data: "Cannot see enough",
};
