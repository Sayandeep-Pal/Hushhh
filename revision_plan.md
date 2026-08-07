# Hushhh Revision Plan

## Purpose and release decision

Hushhh has a compelling interface and a useful prototype architecture, but it must **not** be presented or distributed as a secure or privacy-first messenger until the security gates in Phase 0 through Phase 4 are complete and independently reviewed.

The current product encrypts message content locally, but it does not reliably authenticate identities, authorize conversations, protect invite secrets, authenticate ciphertext, or cryptographically enforce the vault lock. The immediate goal is therefore to turn it into a correctly authenticated encrypted-chat product before adding more features.

## Implementation status — 2026-08-08

The following baseline changes are implemented in the current working tree and covered by static/unit checks:

- Device-held high-entropy credentials replace user-ID-only login; access JWTs are issuer/audience-bound, short-lived, and revocable through a session version.
- Refresh sessions are opaque random values stored only in protected client storage; the server stores SHA-256 hashes, rotates them atomically, and supports current-device and global revocation.
- Direct conversations now have explicit membership records; history, read state, sockets, typing, send, and deletion require membership.
- Sockets reject missing/invalid tokens, derive the sender from the session, validate payloads, use private room namespaces, and acknowledge message persistence.
- Invite URLs contain only a short-lived, one-time opaque token; Secret Codes are removed from links and QR payloads.
- New envelopes use per-conversation salts, strengthened PBKDF2 derivation, and encrypt-then-MAC authentication while the project migrates to a reviewed AEAD/protocol solution.
- Plaintext app-passcode storage is removed; vault contents are no longer eagerly loaded before a protected session unlocks; active chat keys are cleared when the app backgrounds.
- Vault contents now use an authenticated encrypted envelope. Its random vault key is wrapped by the app passcode and/or a biometric-protected SecureStore entry; legacy plaintext vault data is migrated only after a successful unlock.
- A dry-run-first legacy MongoDB migration tool revokes old identities, converts valid old rooms to explicit conversations, and reports malformed/orphaned records instead of guessing.
- Server unit tests, client typecheck, web lint/build, and a CI workflow have been added.

The following remain release blockers and require further implementation and/or outside authority: deployment secret rotation, execution of the reviewed legacy MongoDB migration, production CORS/origin configuration, an audited device-key challenge-response protocol, a reviewed AEAD/ratchet protocol, Redis-backed multi-instance state, mobile end-to-end tests, and independent security review. Do not mark the production launch checklist complete until these are finished.

### Non-negotiable release gates

- No account takeover through a user ID, QR code, search result, or deep link.
- No anonymous/invalid socket connection, arbitrary room join, sender spoofing, or unauthorized history/read access.
- No encryption secret in a URL, QR payload, notification, analytics event, or shared message.
- Authenticated encryption and a reviewed key-establishment design.
- Vault secrets require native authentication before they are read; lock/expiry clears decrypted state.
- Every changed security boundary has automated tests, including negative/attacker cases.
- Security and marketing copy matches the implemented threat model exactly.

## Scope and principles

### Product terminology during the rebuild

Until Phase 4 is complete, use the following wording in the app and web site:

- Say **"encrypted prototype"**, not "true E2EE" or "secure messenger".
- Say **"visual obfuscation"**, not "steganography that hides messages from analysis".
- Do not claim "no metadata", "untraceable", "Secure Enclave protection", "self-destructing", or "decentralized discovery" unless the implementation and threat model prove it.

### Design principles

1. The server must treat every client field as untrusted.
2. Identity is proved by a private device key, never by knowledge of an identifier.
3. Conversation membership is checked on every HTTP request and socket event.
4. Encryption must provide confidentiality **and** tamper detection.
5. The native operating system, not a React state flag, protects secrets at rest.
6. Every security-sensitive action has explicit success/failure acknowledgement and telemetry that excludes sensitive content.
7. Prefer well-reviewed protocols and libraries over custom cryptographic design.

## Phase 0 — Containment and project hygiene

**Priority:** P0  
**Exit condition:** Unsafe distribution and claims are paused; no new sensitive user data is collected under the current design.

### Tasks

- [ ] Remove or disable the public APK download until the security release is ready.
- [ ] Replace web and README security claims with a short prototype notice.
- [ ] Disable production registration and push-token collection, or limit use to a clearly labelled private test environment.
- [ ] Rotate the deployed `JWT_SECRET`; remove the default secret and make missing required configuration fail process startup.
- [ ] Invalidate all existing JWTs by changing signing keys/issuer and force users to create migrated identities after Phase 1.
- [ ] Treat all existing shared Secret Codes as exposed because they may have travelled in deep links and share messages.
- [ ] Create separate `development`, `staging`, and `production` environments with distinct MongoDB databases, push credentials, origins, and signing keys.
- [ ] Add `.env.example` files that list required variables without values.
- [ ] Add `SECURITY.md` with a private vulnerability-reporting path and supported-version policy.
- [ ] Add a top-level `LICENSE`, contribution instructions, and an architecture/threat-model document.

### Deliverables

- Updated landing page and README wording.
- Environment validation module for the server.
- A documented incident/migration note for existing test users.

## Phase 1 — Identity and session redesign

**Priority:** P0  
**Exit condition:** An account cannot be claimed, renamed, or used by someone without the device private key.

### Target design

Use anonymous, device-bound public-key identities:

1. On first launch, generate an Ed25519 signing key pair using an audited native-compatible library.
2. Store the private key in a native protected key store; store only the public key and a random account ID on the server.
3. Registration sends the public key, a requested display name, and an optional avatar seed. The server returns the immutable account ID.
4. Login is a challenge-response flow: request a short-lived nonce, sign it locally, then exchange it for a short-lived access token and rotating refresh token.
5. Profile changes require a signed authenticated request. They never rely on a supplied `userId`.

### Server tasks

- [ ] Replace `POST /api/auth/anonymous` with explicit `register`, `challenge`, `verify`, `refresh`, and `logout/revoke` endpoints.
- [ ] Create an `Identity`/`User` schema with immutable `id`, `publicSigningKey`, normalized unique handle, key version, timestamps, and token-revocation metadata.
- [ ] Verify request signatures, nonce freshness, expiration, audience, and replay protection.
- [ ] Sign access JWTs with `iss`, `aud`, `iat`, `exp`, and `jti`; use a short access-token lifetime and rotating refresh tokens.
- [x] Store refresh tokens hashed; support individual-device and global revocation. (Rotating refresh records are device-scoped; a device sign-out revokes its record and global sign-out revokes all records.)
- [ ] Validate display name, avatar seed, and every request body with a schema validator.
- [ ] Add exact case-insensitive handle uniqueness and safe search normalization.
- [ ] Remove all default credentials and all code paths that mint a token from a user ID.

### Client tasks

- [ ] Introduce an `IdentityService` responsible for key generation, protected storage, signing, registration, refresh, and logout.
- [ ] Replace global Axios defaults with a configured API client that attaches current access tokens, refreshes once on 401, and clears state on failure.
- [ ] Store only session credentials and opaque account ID; never persist password-like material in route state.
- [ ] Add device/session management UI once refresh-token revocation exists.

### Required tests

- [ ] Registration rejects malformed public keys, duplicate normalized handles, and oversized values.
- [ ] A user ID alone cannot obtain a challenge response, token, profile update, or socket session.
- [ ] Replay of a valid signature/nonce fails.
- [ ] Expired, revoked, wrong-audience, and malformed tokens fail.
- [ ] Refresh-token rotation invalidates the old refresh token.

## Phase 2 — Authorization and socket hardening

**Priority:** P0  
**Exit condition:** Only a verified conversation member can access, send to, observe, or modify that conversation.

### Data model changes

- [ ] Create a `Conversation` collection instead of treating a concatenated room ID as the authorization model.
- [ ] Store immutable `conversationId`, exactly two `memberIds` for direct chat, `createdAt`, `lastMessageAt`, and key-protocol metadata that contains no plaintext secret.
- [ ] Add indexes for `memberIds`, `lastMessageAt`, message `conversationId + createdAt`, and unread/read queries.
- [ ] Update `Message` to include `conversationId`, server-derived `senderId`, `clientMessageId`, authenticated encrypted envelope, `createdAt`, `deletedAt`, and `deletedBy`.
- [ ] Enforce unique `(senderId, clientMessageId)` to make retries idempotent.

### HTTP API tasks

- [ ] Add `requireAuth` middleware that validates the Phase 1 access token.
- [ ] Add `requireConversationMember(conversationId)` middleware and use it on all history, read, delete, handshake, and conversation APIs.
- [ ] Make all IDs opaque server-generated IDs; do not derive authorization from string parsing.
- [ ] Add cursor pagination to message history and recent chats.
- [ ] Validate request schemas, pagination limits, text/envelope sizes, and content types.
- [ ] Return consistent error codes without leaking whether unrelated users/conversations exist.

### Socket tasks

- [ ] Reject missing, invalid, expired, and revoked socket tokens in Socket.IO middleware using an authorization error.
- [ ] Derive `senderId` solely from `socket.userId`; ignore any client-supplied sender ID.
- [ ] Require an authenticated membership check before `join_conversation`, `send_message`, `typing`, `read`, `delete`, or handshake events.
- [ ] Replace free-form room names with private server-controlled room names, e.g. `conversation:<id>` and `user:<id>`.
- [ ] Validate every event payload with Zod/Joi and explicit maximum payload sizes.
- [ ] Use acknowledgement callbacks for send/read/delete/handshake operations and return typed error codes to the client.
- [ ] Rate limit connection attempts, search, send, typing, handshake, and deletion events per identity/IP as appropriate.
- [ ] Ensure a deleted message belongs to the supplied conversation before broadcasting a deletion event.
- [ ] Replace in-memory handshakes and presence with Redis-backed state plus the Socket.IO Redis adapter before horizontal scaling.
- [ ] Track multiple sockets per user; one device disconnect must not mark another active device offline.

### Required tests

- [ ] Invalid/no token socket connection is refused.
- [ ] A third user cannot join, read, type in, send to, mark read, delete from, or receive events for another conversation.
- [ ] A socket cannot impersonate another sender.
- [ ] Duplicate `clientMessageId` does not produce duplicate messages.
- [ ] Rate limits and payload-size limits produce predictable failures.

## Phase 3 — Invite and discovery redesign

**Priority:** P0  
**Exit condition:** No encryption secret appears in any URL, QR code, share text, or notification payload.

### Target invite flow

1. A user creates a one-time, short-lived invite containing an opaque random token and the inviter's public identity information.
2. The server stores only a hash of the invite token, expiration, intended use, and optional recipient binding.
3. The QR/deep link includes only the opaque invite token, never a Secret Code, symmetric key, JWT, or private identifier beyond what is intentionally public.
4. On acceptance, the two verified identities create a conversation and start the approved key-establishment flow.
5. If a human passphrase remains as a product option, it must be exchanged out-of-band and manually entered on both devices; the UI must clearly warn against sending it through Hushhh or links.

### Tasks

- [ ] Remove `code` from `connect` route parameters, QR payload, share messages, logs, and navigation state.
- [ ] Implement create, inspect, accept, revoke, and expire invite endpoints.
- [ ] Use cryptographically secure random values for invite tokens and store only their hashes.
- [ ] Add universal/app-link domain verification and allow-list routing rather than relying only on a custom URL scheme.
- [ ] Ensure unknown/expired/revoked invite responses do not disclose account details.
- [ ] Add abuse limits for invite creation and acceptance.
- [ ] Replace unrestricted user search with opt-in discoverability, exact-handle lookup, or invite-only discovery, depending on the product privacy decision.

## Phase 4 — Cryptography and key-management redesign

**Priority:** P0  
**Exit condition:** Encryption is authenticated, key establishment is peer-authenticated, and a specialist has reviewed the design and implementation.

### Immediate cryptographic corrections

- [ ] Remove AES-CBC, the custom fingerprint scheme, and the global static PBKDF2 salt.
- [ ] Use an audited authenticated-encryption primitive: XChaCha20-Poly1305 preferred, or AES-256-GCM with strict nonce handling.
- [ ] Version every encrypted envelope from day one: algorithm, version, nonce, ciphertext, authentication tag, and public key/session metadata.
- [ ] Reject malformed envelopes before attempting decryption; display tampering as a security warning, not a generic decryption failure.
- [ ] Keep zero-width encoding strictly outside the security boundary as optional display transport encoding. It must wrap an already authenticated envelope and must be removable without changing security.

### Key-establishment decision

Choose one route before implementation:

#### Route A — Secure messenger (recommended if privacy claims remain)

- [ ] Use a vetted Signal-style implementation or protocol library with X25519 identity keys, signed prekeys, one-time prekeys, X3DH/PQXDH session setup as appropriate, and Double Ratchet message keys.
- [ ] Add safety-number/QR verification based on authenticated public keys.
- [ ] Support key-change warnings and explicit re-verification, not a mutable unauthenticated "handshake" event.
- [ ] Design secure multi-device support explicitly rather than treating a second device as the same socket identity.
- [ ] Obtain external protocol and implementation review before public release.

#### Route B — Passphrase-encrypted chat (only if claims are narrowed)

- [ ] Describe the feature accurately as "messages encrypted with a shared passphrase," not as a complete secure-messaging protocol.
- [ ] Derive keys with Argon2id (or platform-appropriate scrypt) using a random per-conversation public salt and calibrated memory/time cost.
- [ ] Require a high-entropy passphrase; provide strength guidance and prohibit URL transfer.
- [ ] Explicitly document no forward secrecy, no automated peer authentication, and vulnerability to weak/reused passphrases.

### Cryptography acceptance tests

- [ ] Known-answer tests for envelope encode/decode and tamper detection.
- [ ] Any changed nonce, ciphertext, tag, associated data, or version fails closed.
- [ ] Test vectors for Unicode, long messages, corrupt zero-width transport, replay, and invalid envelope sizes.
- [ ] Key verification is bound to the actual remote identity, not only a symmetric-key-derived value.
- [ ] No key, passphrase, plaintext, or decrypted message is emitted to logs, analytics, errors, URLs, or notifications.

## Phase 5 — Vault, app lock, and local data protection

**Priority:** P0  
**Exit condition:** The OS authentication policy gates secret retrieval and decrypted session data is actively cleared.

### Tasks

- [ ] Stop storing the entire vault JSON and the app passcode in ordinary JavaScript-accessible SecureStore entries.
- [ ] Store each conversation secret/session key separately, encrypted by a randomly generated vault key.
- [ ] Protect that vault key using platform authentication (`requireAuthentication` where supported) and hardware-backed key storage/keystore facilities.
- [ ] Load vault material only after successful native authentication; do not pre-load it before showing the lock screen.
- [ ] Treat the app passcode as a fallback unlock mechanism: store a salted, memory-hard verifier or use it to unwrap an encrypted vault key; never store it in plaintext.
- [ ] Add exponential delay and lockout handling after failed passcode attempts; consider OS/device policy instead of a custom passcode where viable.
- [ ] On background/inactive, clear decrypted messages, passphrases, derived keys, candidate keys, clipboard-sensitive state, and active chat input from memory.
- [ ] Implement a real auto-lock timer that wipes active sessions at expiry; do not merely skip re-entry on future screen mounts.
- [ ] Add an Android/iOS privacy screen to prevent app-switcher previews from exposing conversations.
- [ ] Make clipboard copy opt-in, auto-clear on a short timer where supported, and warn users it leaves the app boundary.
- [ ] Define backup/export behavior explicitly. Do not imply local data is recoverable if it is not.

## Phase 6 — Message lifecycle, UX, and reliability

**Priority:** P1  
**Exit condition:** Core chat behavior is durable, understandable, and consistent across reconnects and devices.

### Tasks

- [ ] Implement `deletedAt`/`deletedBy` in the schema and filter deleted records from normal history queries.
- [ ] Explain "delete for everyone" limitations: recipients may already have read, copied, or captured a message.
- [ ] Add optional server-side expiry with TTL/indexed cleanup and client rendering of expiry status; document that expiry cannot erase remote copies.
- [ ] Replace timestamp-based optimistic IDs with a generated UUID `clientMessageId` and reconcile with server acknowledgement.
- [ ] Add queued/retrying/sent/failed delivery states and idempotent reconnect handling.
- [ ] De-duplicate history and socket deliveries by server message ID/client message ID.
- [ ] Paginate history with cursor-based loading; decrypt/render incrementally to avoid freezing large chats.
- [ ] Split `chat/[id].tsx` into focused hooks/components: conversation data, transport, encryption session, handshake/key state, composer, list, and action menu.
- [ ] Replace broad `any` usage with shared API/event types generated or maintained in a common package.
- [ ] Stop swallowing errors. Provide user-safe messages, structured diagnostics without secret content, and retry actions.
- [ ] Make typing indicators ephemeral, membership-authorized, rate-limited, and automatically expired server-side.
- [ ] Decide retention defaults for messages, push tokens, presence, read receipts, and last-seen data; expose those choices in settings.

## Phase 7 — Backend production readiness

**Priority:** P1  
**Exit condition:** The service can be operated, monitored, scaled, and safely shut down.

### Tasks

- [ ] Add a health endpoint and a readiness endpoint that reflects MongoDB/Redis availability.
- [ ] Await database initialization before accepting traffic and add retry/backoff policy for transient outages.
- [ ] Add graceful shutdown for HTTP, Socket.IO, MongoDB, Redis, and push queues.
- [ ] Use Helmet, strict CORS allow-lists, HTTPS-only deployment, secure proxy configuration, request IDs, and safe structured logs.
- [ ] Remove `usesCleartextTraffic: true` from production Android builds and enforce HTTPS/WSS endpoints.
- [ ] Add MongoDB indexes based on production query plans; avoid unbounded regex search and unbounded aggregation/history results.
- [ ] Add worker/queue handling for Expo push notifications, retries, invalid-token cleanup, and observability.
- [ ] Do not include conversation IDs, key material, payloads, message text, or raw device tokens in routine logs.
- [ ] Add backup, restore, migration, retention, and incident-response runbooks.
- [ ] Use Redis adapter/presence storage before multiple server replicas; test reconnect and failover behavior.

## Phase 8 — Quality system and CI/CD

**Priority:** P1  
**Exit condition:** Every pull request has reliable automated feedback and a release is reproducible.

### Repository and tooling tasks

- [ ] Add a root workspace (`pnpm-workspace.yaml`) or clearly documented multi-project scripts for client/server/web.
- [ ] Align Node, pnpm, TypeScript, ESLint, React, and React type versions where sharing tooling is beneficial.
- [ ] Fix all existing client TypeScript errors and lint errors; configure the missing web ESLint React plugin/rules correctly.
- [ ] Add format checking (Prettier or an equivalent), import ordering, strict TypeScript settings, and no-explicit-any enforcement with justified exceptions only.
- [ ] Add a shared `packages/contracts` module for request, response, socket-event, and encrypted-envelope schemas/types.

### Test strategy

- [ ] Unit tests: validation, authorization helpers, invite tokens, crypto envelope wrappers, vault timing logic, message state reducers.
- [ ] API integration tests: registration, challenge-response auth, token refresh/revoke, conversation membership, pagination, deletion, and abuse limits.
- [ ] Socket integration tests: authentication, membership, spoofing prevention, acknowledgements, reconnect/idempotency, and multi-device presence.
- [ ] Client component tests: locked/unlocked states, navigation, failed send/retry, expiry, invite acceptance, and error handling.
- [ ] End-to-end tests on Android/iOS test builds for onboarding, invite flow, protected vault, notifications, background lock, and deep links.
- [ ] Add dependency scanning, secret scanning, static analysis, and mobile dependency/license review.
- [ ] Run a threat-model review and external penetration/cryptography review before production launch.

### CI gates

- [ ] `lint` passes for server, client, and web.
- [ ] Typechecking passes for all TypeScript projects.
- [ ] Unit, integration, and end-to-end suites pass.
- [ ] Dependency and secret scans have no unreviewed high/critical findings.
- [ ] Build artifacts are reproducible and signed.

## Phase 9 — Web site, release distribution, and accessibility

**Priority:** P2 (after security gates)  
**Exit condition:** The public site accurately represents the product and distributes verifiable releases.

### Tasks

- [ ] Rewrite all security copy to the approved threat model; include what Hushhh protects, what it does not, and known metadata exposure.
- [ ] Remove claims that are unsupported by the implementation.
- [ ] Add a security page, privacy policy, data-retention policy, version/changelog, and release notes.
- [ ] Do not host a mutable APK directly from the repository. Use a versioned release channel or app store distribution.
- [ ] Publish SHA-256 checksums, signing certificate fingerprints, version code, build date, and installation/update instructions for downloadable artifacts.
- [ ] Automate signed Android/iOS releases through EAS/CI with protected credentials and provenance.
- [ ] Code-split or defer the Three.js background; respect `prefers-reduced-motion`, reduce GPU load on mobile, and keep the landing page usable on low-end devices.
- [ ] Add accessibility checks: keyboard navigation, visible focus, color contrast, meaningful labels, reduced motion, and image alt text review.
- [ ] Fix dead or misleading calls to action and route-specific anchor behavior.

## Recommended delivery order

### Milestone A — Make it safe to test privately

Phases 0, 1, and the authorization portion of Phase 2. No public download or security marketing. This removes account takeover, unauthorized access, spoofing, and secret-in-link behavior.

### Milestone B — Make encryption claims defensible

Phases 3, 4, and 5, followed by a specialist review. Decide between a real ratcheting secure-messenger protocol and deliberately narrower passphrase-encrypted chat. Do not mix the two narratives.

### Milestone C — Make the product dependable

Phases 6, 7, and 8. Add durable lifecycle behavior, observability, limits, tests, CI, and scale-safe presence/handshake state.

### Milestone D — Public launch readiness

Phase 9 plus an external security review, a documented threat model, privacy/legal review, operational runbooks, monitored staging soak test, and signed reproducible release artifacts.

## Definition of done for production launch

Production launch is approved only when all of the following are true:

- [ ] P0/P1 tasks are complete and tested.
- [ ] All current lint and TypeScript failures are resolved.
- [ ] No hard-coded fallback secrets or plaintext passcodes remain.
- [ ] Invalid/unauthorized access attempts are rejected and tested end-to-end.
- [ ] Invite links contain no shared secret or session credential.
- [ ] Encryption is authenticated and the chosen key protocol has independent review.
- [ ] Native authentication gates vault-key access; background/expiry clears sensitive in-memory state.
- [ ] Deletion, retention, and metadata behavior are accurate in product copy.
- [ ] A CI pipeline validates code, tests, dependencies, secrets, builds, and release signing.
- [ ] Public documentation matches the approved threat model, without absolute privacy claims.
