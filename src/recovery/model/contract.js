// The seam between the UI and wherever data comes from.
//
// A source is anything with `connect(handlers)`. Today that is simulatedSource.js.
// A hardware or server feed (WebSocket, SSE, polling the API) replaces it by
// delivering the same three things; no view or derive code changes.
//
//   handlers.snapshot(patients)   once, then again whenever the roster changes
//   handlers.readings(batch)      any time, any cadence, in any order
//   handlers.device(patientId, deviceId, patch)
//
// The UI never stores a computed number. Statuses, "usual", deviations, sentences
// and chart geometry are all derived from raw readings in derive.js, so a reading
// that arrives late or out of order simply changes the next render.

/**
 * @typedef {Object} Reading
 * @property {string} patientId
 * @property {string} signal      key of SIGNALS in profiles.js
 * @property {number} t           epoch ms of the measurement
 * @property {number} v           value in the signal's unit
 *
 * @typedef {Object} Device
 * @property {string} name
 * @property {boolean} sharing    patient-controlled; a source must stop sending when false
 * @property {number|null} lastSync
 * @property {boolean} [live]     streams continuously instead of syncing in batches
 *
 * @typedef {Object} Checkin
 * @property {number} requestedAt
 * @property {number|null} answeredAt
 * @property {Object<string,string>} answers   question id -> chosen option
 * @property {string|null} note                free text the patient added afterwards
 *
 * @typedef {Object} Patient
 * @property {string} id
 * @property {string} name
 * @property {number} age
 * @property {string} profile      key of PROFILES: the illness they were discharged with
 * @property {number} admittedAt
 * @property {number} dischargedAt
 * @property {Object<string,Reading[]>} readings   per signal, oldest first
 * @property {Object<string,Device>} devices
 * @property {Checkin[]} checkins  oldest first
 * @property {{t:number}[]} workouts
 * @property {number|null} acknowledgedAt
 *
 * @typedef {Object} Source
 * @property {string} label
 * @property {{voice:boolean}} capabilities
 * @property {(handlers:Object)=>(()=>void)} connect   returns disconnect
 * @property {(event:Object)=>void} [send]             patient and clinician actions, for a real backend
 */
export {};
