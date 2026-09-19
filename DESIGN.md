---
version: alpha
name: Relay
description: Synthetic post-discharge monitoring for patients and care teams
colors:
  primary: '#24493d'
  background: '#f5f6f3'
  surface: '#ffffff'
  ink: '#1f2f2a'
  muted: '#44534c'
  border: '#e1e6df'
typography:
  sans:
    fontFamily: 'DM Sans, sans-serif'
  serif:
    fontFamily: 'Source Serif 4, serif'
components:
  button: {}
  card: {}
omitted:
  - section: spacing
    reason: Existing recovery.css selectors own responsive spacing.
  - section: rounded
    reason: Existing shared control and card selectors own radii.
---

# Relay design context

Relay uses a quiet clinical workspace: warm paper, pine actions, restrained sage surfaces, serif patient headings, and readable sans-serif controls. The public welcome page introduces the product; the recovery application supports patients and clinicians using synthetic demonstration records. The current interface is English. Preserve this established identity rather than adding new decorative systems.

`src/recovery/recovery.css` is the canonical runtime token and component source. This document records existing intent; it does not generate CSS. Use the shared `rx-p-btn`, auth-card and patient-card styles for new controls. Preserve keyboard focus, readable contrast, mobile wrapping, and visible async feedback.

## Entry and completion behavior

- The public header's **Sign in** action opens a Doctor / Patient workspace choice at `#/signin`.
- Discharge-code actions lead directly to `#/patient`. Patient access does not offer a clinician selector.
- Account authorization remains server-owned; selecting a workspace does not grant a role.
- Completed voice check-ins play their closing response before opening the review draft. Patient review and explicit submission remain separate from the conversation.
- Submission success uses centered feedback and a bordered **Back to home** control. Never claim delivery before the existing synchronization flow confirms it.
