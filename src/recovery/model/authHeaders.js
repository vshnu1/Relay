// The one place that knows how this browser proves itself to the API.
//   json       send a JSON content type (every write; off for plain reads)
//   discharge  also send the discharge code, which tells the server which single record
//              a patient is entitled to. The role code alone names a role, not a person.
export function authHeaders({ json = true, discharge = false } = {}) {
  const headers = json ? { "content-type": "application/json" } : {};
  try {
    const code = sessionStorage.getItem("rx-code");
    if (code) headers.authorization = `Bearer ${code}`;
    const proof = discharge && sessionStorage.getItem("rx-patient-proof");
    if (proof) headers["x-relay-discharge"] = proof;
  } catch {
    // No session storage: the local demo runs without codes.
  }
  return headers;
}
