# Fun Chat - Project Log

## Core Architecture
- **Client:** React Native (Expo)
- **Server:** Node.js (Express)
- **Real-time:** Socket.io
- **Database:** MongoDB (Mongoose)
- **Auth:** Custom Anonymous Auth (JWT)
- **Security:** 
    - End-to-End Encryption (E2EE) using AES-256-GCM.
    - Key Derivation: PBKDF2 / Argon2 (Client-side).
    - Encoding: Base-Emoji (256 unique emojis mapping to bytes).

## Workflow
1. [x] **Phase 1: Foundation**
    - [x] Project Initialization
    - [x] Server Setup (Express, Socket.io, MongoDB)
    - [x] Client Setup (Dependencies, Basic Routing)
2. [x] **Phase 2: Security Layer**
    - [x] Base-Emoji Encoding Implementation
    - [x] AES-GCM Encryption/Decryption Logic
    - [x] Key Derivation from Secret Code
3. [x] **Phase 3: Real-time Messaging**
    - [x] Socket.io Integration (Client & Server)
    - [x] Message Payload Routing (Emoji Encoded)
4. [x] **Phase 4: Identity & Discovery**
    - [x] Anonymous JWT Auth Implementation
    - [x] MongoDB Profile & Message Persistence
    - [x] QR Code & Deep Link Discovery
5. [x] **Phase 5: UI/UX Polishing**
    - [x] Modern Chat Interface
    - [x] Playful & Vibrant Design

## Technical Decisions
- **MongoDB Migration:** Switched from Supabase to MongoDB for more flexible schema management and local/cloud hosting options.
- **Custom Auth:** Implemented anonymous identity via JWTs to maintain privacy without third-party auth providers.
- **Client-side Encryption:** Server never sees the raw text or the Secret Code.

## How to Run
### 1. Server
```bash
cd server
npm install
# Update MONGO_URI and JWT_SECRET in .env
node index.js
```

### 2. Client
```bash
cd client
npm install
# Update EXPO_PUBLIC_API_URL in .env
npx expo start
```
