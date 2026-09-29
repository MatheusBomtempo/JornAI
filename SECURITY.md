# Security policy

JornAI handles newsroom sources (some of them police reports with personal data), social-media credentials and user accounts, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (private vulnerability reporting). Include what you found, how to reproduce it, and the impact you see.

You can expect an acknowledgement within a few days. Please give us reasonable time to fix the problem before disclosing it.

## Scope notes

- Secrets (`AUTH_SECRET`, API keys, `IG_ACCESS_TOKEN`, …) belong in environment variables, never in the repository.
- The seed script only creates sample accounts outside production.
- Personal-data redaction is a defense-in-depth layer, not a guarantee — always review generated posts before publishing.
