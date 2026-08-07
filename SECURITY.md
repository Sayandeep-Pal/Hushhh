# Security Policy

## Supported state

Hushhh is an encrypted-chat prototype under active security revision. It is not approved for sensitive communications. Do not rely on the current build for personal safety, legal privilege, medical, financial, or other high-risk confidentiality needs.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Contact the project maintainer privately with:

- a clear reproduction path;
- affected version/build;
- impact assessment; and
- proof-of-concept material that excludes real users and data.

The maintainer should acknowledge reports within seven days, provide status updates, and coordinate disclosure only after users have had an opportunity to update.

## Current threat-model boundaries

- Invite links are short-lived opaque tokens and must not contain Secret Codes.
- The service retains operational metadata necessary to deliver messages; it does not claim metadata anonymity.
- The custom encrypted envelope is transitional. A reviewed secure-messaging protocol remains a release requirement.
