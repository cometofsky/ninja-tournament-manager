# Email templates

This folder contains reusable transactional email builders and the shared HTML/text layout used by auth and notification emails.

## Available builders

- `buildPasswordResetEmail`
- `buildEmailVerificationEmail`
- `buildWelcomeEmail`
- `buildTournamentUpdateEmail`

Each builder returns:

- `subject`
- `text`
- `html`

## Local preview

While running the app in development, open one of these URLs:

- `/api/dev/email-preview?type=password-reset`
- `/api/dev/email-preview?type=verify-email`
- `/api/dev/email-preview?type=welcome`
- `/api/dev/email-preview?type=tournament-update`
- Add `&format=text` to inspect the plain-text fallback

The preview route returns `404` in production.

## Security notes

- Dynamic text is HTML-escaped before rendering.
- Action URLs are validated as absolute `http` or `https` URLs.
- Keep secrets out of email content and avoid logging reset/verification links.
