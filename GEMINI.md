# Fun Chat - Project Log

## Core Architecture
- **Client:** React Native (Expo SDK 54)
    - **Routing:** Expo Router (File-based navigation)
    - **State Management:** Context API (`AuthContext`, `SocketContext`)
    - **Styling:** React Native Stylesheets (Playful & Vibrant)
- **Server:** Node.js (Express 5)
    - **Real-time:** Socket.io (Rooms for private chats)
    - **Database:** MongoDB (via Mongoose)
    - **Auth:** Custom Anonymous JWT-based identity
- **Security Layer (E2EE):**
    - **Encryption:** AES-256-CBC (Client-side only)
    - **Key Derivation:** PBKDF2 (1000 iterations, derived from a user-provided Secret Code)
    - **Encoding:** Stealth Steganography (Zero-Width characters)
    - **Mechanism:** Ciphertext is converted to binary and mapped to invisible Unicode characters (`\u200B`, `\u200C`).
    - **Privacy:** Messages appear as a single "carrier" emoji (e.g., 🔒, 👻) but contain the full hidden payload.

## Project Structure
```text
/
├── client/                 # Expo React Native App
│   ├── app/                # Expo Router pages
│   │   ├── (auth)/         # Login/Identity creation
│   │   └── (main)/         # Chat lists and conversation screens (Stealth Mode)
│   ├── context/            # Auth and Socket providers
│   ├── utils/              # E2EE (security.ts with Zero-Width logic)
│   └── constants/          # UI theme and config
└── server/                 # Express Backend
    ├── index.js            # Main entry point (Stores invisible payloads)
    └── .env                # Environment variables (MONGO_URI, JWT_SECRET)
```

## Security Workflow (E2EE + Stealth)
1. **Key Generation:** User enters a "Secret Code". Client derives a 256-bit key via PBKDF2.
2. **Encryption:** Plaintext message + IV -> AES-256-CBC -> Ciphertext.
3. **Stealth Encoding:**
    - [IV + Ciphertext] is converted to a binary string.
    - Binary `0` ➔ `\u200B`, Binary `1` ➔ `\u200C`.
    - Resulting invisible string is injected into a "carrier" emoji.
4. **Transmission:** The single carrier emoji (containing the hidden data) is sent via Socket.io.
5. **Decryption:** Recipient extracts zero-width characters ➔ Binary ➔ [IV + Ciphertext] ➔ AES-256-CBC ➔ Plaintext.

## Technical Decisions
- **MongoDB:** Chosen for flexible schema and easy persistence of message history.
- **Anonymous Identity:** Users choose a "Codename". Identity is persisted via a JWT stored in `SecureStore` (client) and `User` model (server).
- **Socket.io:** Handles real-time events (`send_message`, `receive_message`, `join_room`).
- **Base-Emoji:** A custom encoding scheme that makes encrypted payloads look like "fun" emoji strings, aligning with the project's playful theme.

## How to Run
### 1. Server
```bash
cd server
npm install
# Configure .env: MONGO_URI, JWT_SECRET
node index.js
```

### 2. Client
```bash
cd client
npm install
# Configure .env: EXPO_PUBLIC_API_URL
npx expo start
```

## Future Roadmap (Phase 6+)
- [ ] Push Notifications for new messages.
- [ ] Media sharing (Images/Audio) with E2EE.
- [ ] Room discovery via QR Code sharing.
- [ ] Improved "Secret Code" management (recovery hints/verification).
