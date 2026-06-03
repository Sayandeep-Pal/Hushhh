# Hushhh - Project Log

## 🚀 Core Architecture
- **Client:** React Native (Expo SDK 54, React Native 0.81.5)
    - **Routing:** Expo Router v6 (File-based navigation)
    - **State Management:** React Context API (`AuthContext`, `SocketContext`, `SecurityContext`)
    - **Security:** `crypto-js` for AES/PBKDF2, `expo-crypto` for secure IV generation, `expo-local-authentication` for biometrics
    - **Storage:** `expo-secure-store` for JWT, Identity persistence, and Secret Vault
    - **UI:** Custom Theme System (`useTheme`), `react-native-reanimated`, `@expo/vector-icons`
- **Server:** Node.js (Express 5.2.1)
    - **Real-time:** Socket.io 4.8.3
    - **Database:** MongoDB (via Mongoose 9.6.1)
    - **Auth:** Anonymous JWT-based identity system
- **Security Layer (E2EE + Stealth):**
    - **Encryption:** AES-256-CBC (Client-side only)
    - **Key Derivation:** PBKDF2 (1000 iterations, salt: `hushhh_secret_salt`)
    - **Encoding:** Stealth Steganography (Zero-Width characters)
    - **Mechanism:** Ciphertext is converted to binary and mapped to invisible Unicode characters.

## 📁 Project Structure
```text
/
├── client/                 # Expo React Native App
│   ├── app/                # Expo Router pages
│   │   ├── (auth)/         # Login/Identity creation (login.tsx)
│   │   └── (main)/         # Chat list, Conversation, Vault, and Auto-Unlock
│   │       ├── vault.tsx   # Secure storage for chat keys
│   │       └── auto-unlock-settings.tsx # Configuration for automatic decryption
│   ├── context/            # Auth, Socket, and Security providers
│   ├── utils/              # security.ts (E2EE/Stealth), error-handler.ts
│   ├── hooks/              # useTheme.ts, useThemeColor.ts
│   └── components/         # Shared UI components
└── server/                 # Express Backend
    ├── index.js            # Main entry point (API + Sockets + Models)
    ├── package.json        # Dependencies (Express 5, Mongoose 9, Socket.io 4)
    └── .env                # MONGO_URI, JWT_SECRET
```

## (✯‿✯) Security Deep Dive

### E2EE Workflow
1. **Handshake:** User enters a "Secret Code" in the Chat Room.
2. **Key Derivation:** Client derives a 256-bit key using PBKDF2 with 1000 iterations and the hardcoded salt `hushhh_secret_salt`.
3. **Encryption:** 
    - Generate 16-byte random IV via `expo-crypto`.
    - Plaintext + IV + Derived Key -> AES-256-CBC -> Ciphertext.
    - Payload format: `iv_hex : ciphertext_hex`.

### Stealth Steganography (Zero-Width)
- **Mapping:**
    - `0` ➔ `\u200B` (Zero Width Space)
    - `1` ➔ `\u200C` (Zero Width Non-Joiner)
    - `Separator` ➔ `\u200D` (Zero Width Joiner)
- **Carrier:** The invisible payload is appended to a "carrier" unique icon (e.g., `(✯‿✯)-->`, `⸜(*⌒◡⌒*)->`, `(〃‿〃)-->`, etc.).
- **Persistence:** Only the carrier icon with hidden data is sent to the server and stored in MongoDB.

### Key Synchronization
- When a user changes their Secret Code, the client emits a `KEY_CHANGE` event via Socket.io.
- The recipient receives a system alert prompting them to update their code to maintain the secure channel.

### 🛡️ Advanced Security Features

#### Secret Vault
- **Purpose:** Secure local storage of "Secret Codes" (AES keys) for all active conversations.
- **Protection:** Access is gated by Biometric (FaceID/Fingerprint) or App Passcode authentication.
- **Persistence:** Keys are stored using `expo-secure-store`, ensuring they are encrypted at rest by the OS.
- **UI:** A dedicated screen to view, copy, and manage keys for each contact.

#### Auto-Unlock Chat & Timers
- **Mechanism:** Allows the app to remember the Secret Code for specific contacts after the first manual entry.
- **Configurable Timers:** Users can set how long a chat remains "unlocked" before requiring the code again:
    - 5 Minutes / 30 Minutes / 1 Hour / 24 Hours / Always.
- **Hierarchy:** 
    - **Global Toggle:** Master switch to enable/disable the feature for all contacts.
    - **Per-Contact Toggle:** Individual control for sensitive conversations.
- **Privacy:** Even when auto-unlocked, the message payload remains steganographically hidden; it just decrypts automatically upon viewing.

## 📡 API & Socket Contracts

### REST API (Server)
- `POST /api/auth/anonymous`: Creates or retrieves an anonymous identity. Requires `{ username, userId? }`. Returns `{ token, user }`.
- `GET /api/users/search?query=...`: Searches for users by codename (regex, case-insensitive).
- `GET /api/users/:id`: Retrieves a single user's profile.
- `GET /api/messages/:roomId`: Fetches message history for a specific room.

### Socket.io Events
- `join_room(roomId)`: Joins a private chat room.
- `send_message(data)`:
    - Payload: `{ roomId, senderId, payload }` where payload is the steganographic string.
    - Persists to MongoDB `Message` model.
    - Emits `receive_message` to the room.

## 🔗 Discovery & Connectivity
- **Deep Linking:** Supports `hushhh://connect?id=USER_ID&name=USERNAME`.
- **QR Codes:** Each user can generate a QR code containing their deep link for easy "offline-to-online" connection.
- **Room IDs:** Generated by sorting and joining two User IDs: `[ID1, ID2].sort().join('_')`.

## 🛠 Technical Decisions
- **MongoDB:** Selected for schema-less storage of message payloads, allowing future expansion to media sharing.
- **Express 5:** Uses the latest Express features for better error handling in async routes.
- **Stealth Mode:** Message "masking" as unique icons ensures that even if a shoulder-surfer sees the screen, they only see these icons unless the chat is "unlocked".

## 🛣 Future Roadmap
- [x] **Push Notifications:** Notify users of new encrypted payloads.
- [ ] **Media E2EE:** Encrypting and hiding images/audio within multiple "icon packets".
- [ ] **Room Discovery:** Local discovery using Bluetooth/mDNS for truly anonymous nearby chatting.
- [ ] **Code Recovery:** Optional hint system for Secret Codes stored locally in `SecureStore`.
