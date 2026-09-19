import { QUESTIONS } from "../model/profiles.js";

// A FHIR-shaped collection built from the same derived view the screen shows.
// Mock only: it has not been validated against a FHIR profile and no EHR is connected.
export function exportHandoff(p) {
  const subject = { reference: `Patient/${p.id}` };
  const bundle = {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: p.id,
          identifier: [{ system: "urn:relay:synthetic", value: p.id }],
        },
      },
      ...p.counted
        .filter((s) => s.today !== null)
        .map((s) => ({
          resource: {
            resourceType: "Observation",
            id: `${p.id}-${s.id}`,
            status: "final",
            code: { text: s.name },
            subject,
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: Number(s.fmt(s.today)), unit: s.unit },
            referenceRange: [
              {
                text: `Own usual before admission: ${s.fmt(s.usual)} ${s.unit}`,
              },
            ],
            note: [
              {
                text: `${s.change} against usual. ${s.rule} Synthetic demo measurement.`,
              },
            ],
          },
        })),
      {
        resource: {
          resourceType: "Communication",
          id: `${p.id}-summary`,
          status: "completed",
          subject,
          payload: [
            p.headline,
            ...p.findings.map((f) => `${f.label}: ${f.text}`),
          ].map((contentString) => ({ contentString })),
        },
      },
      ...(p.answered
        ? [
            {
              resource: {
                resourceType: "QuestionnaireResponse",
                id: `${p.id}-checkin`,
                status: "completed",
                subject,
                authored: new Date(p.answered.answeredAt).toISOString(),
                item: [
                  ...Object.entries(p.answered.answers).map(([q, a]) => ({
                    linkId: q,
                    text: QUESTIONS[q]?.text,
                    answer: [{ valueString: a }],
                  })),
                  ...(p.answered.note
                    ? [
                        {
                          linkId: "note",
                          text: "Anything else",
                          answer: [{ valueString: p.answered.note }],
                        },
                      ]
                    : []),
                ],
              },
            },
          ]
        : []),
      {
        resource: {
          resourceType: "Task",
          id: `${p.id}-review`,
          status: p.acknowledged ? "completed" : "requested",
          intent: "proposal",
          for: subject,
          description:
            "Provider review of a statistical description; no clinical recommendation.",
        },
      },
    ],
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `relay-${p.id}-handoff.json`;
  a.click();
  URL.revokeObjectURL(url);
}
