# Contributing

## Development approach

Work should be split into small, reviewable changes. Prefer one feature or architectural change per pull request.

## Commit convention

Use concise conventional-style messages such as:

- `feat: add candidate profile model`
- `fix: handle expired interview session`
- `docs: update architecture`
- `chore: configure CI`

## Quality bar

Before opening a pull request, run the relevant lint, typecheck, and test commands. Never commit secrets, real candidate data, recordings, or production credentials.

## Privacy

Any feature involving camera, microphone, recordings, resume data, or AI analysis must document consent and retention behavior before implementation.
