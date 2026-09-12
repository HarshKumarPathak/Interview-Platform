# Security Policy

## Supported versions

Security fixes are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected security vulnerability.

Instead, report the issue privately through GitHub's repository security reporting flow. Include:

- A clear description of the vulnerability
- The affected component or endpoint
- Reproduction steps or a minimal proof of concept
- Potential impact
- Any suggested mitigation, if known

Please avoid including real credentials, private candidate data, resume files, recordings, or other sensitive information in reports.

## Security principles

This project is designed around:

- Server-side handling of provider credentials
- Authenticated ownership checks for candidate resources
- Private object storage for resumes and recordings
- Short-lived signed URLs for recording playback
- Scoped realtime tokens
- Webhook verification for LiveKit lifecycle events
- Input validation and upload limits on resume ingestion
- Durable, failure-aware background evaluation jobs

Production deployments should additionally configure appropriate secret management, HTTPS, recording consent, data retention, backups, database access controls, and provider-specific security settings.
