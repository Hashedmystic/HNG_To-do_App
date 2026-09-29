# HNG Project Guidelines

- Work in small, reviewable steps. Keep each change focused on one feature or fix.
- Explain each change in beginner-friendly language: what changed, why, and how it was tested.
- Build tasks and notes first, reminders next, and voice input and spoken responses last.
- Treat typed input, voice transcripts, and browser storage data as untrusted. Validate their shape and length, and render user content as text rather than HTML. Never execute user input as code.
- Keep secrets, API keys, credentials, and sensitive data out of the repository and browser storage. Use environment variables for server-side secrets; never expose them in client code.
- Test each feature before moving on, including normal use, invalid input, and relevant failure cases. Report any checks that could not be run.
