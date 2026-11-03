# Taste

## Product & architecture

- Single customer identity: registered and guest customers must both be able to act (e.g. track orders) without ever creating duplicate customer accounts — guest records should be claimed/linked to the existing account instead. Confidence: 0.6

- Cost-conscious at the current business stage: prefers no-cost/free mechanisms (e.g. signed secure links) over solutions that require paying for third-party services (SMS/WhatsApp OTP providers), while keeping the design extensible so the paid/stronger option (OTP) can be layered on later when the business is ready. Confidence: 0.7

- Extend, don't duplicate: inspect the existing project structure/database before changing anything, reuse existing infrastructure, and never create duplicate tables, APIs, or features when equivalent functionality already exists — existing features/records must be preserved and not broken. Confidence: 0.6

- Wants fully functional, end-to-end implementations (real backend, database, migrations, wired APIs) rather than UI-only mockups or partial scaffolds. Confidence: 0.6

## Communication & integrity

- Never fabricate or fake success: do not produce fake/mock results or claim an action (e.g. a notification, delivery, or payment) succeeded when it actually failed — surface real failures and errors honestly. Confidence: 0.6
