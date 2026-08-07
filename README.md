# (✯‿✯) Hushhh
 
> **Prototype notice:** Hushhh is under active security revision and is not ready for sensitive conversations or public security claims. Do not rely on it for safety-critical or confidential communication.

**Hushhh** is an encrypted-chat prototype with a playful zero-width visual-obfuscation transport. The current focus is authenticated identities, conversation authorization, authenticated message envelopes, and native vault protection.

--- 

## 📸 Screenshots

| Splash & Identity | Chat List | Secure Chat Room |
| :---: | :---: | :---: |
| ![Splash](./screenshots/splash&identity.jpg) | ![Chat List](./screenshots/chat%20list.jpg) | ![Chat Room](./screenshots/secure%20chat%20room.jpg) |

| Handshake Request | Stealth Mode | Settings & Vault |
| :---: | :---: | :---: |
| ![Handshake](./screenshots/handshake%20req.jpg) | ![Stealth](./screenshots/stealth%20mode.jpg) | ![Settings](./screenshots/settings%20and%20vault.jpg) |

---

## ✨ Key Features

- **🔐 Local payload encryption:** Message content is encrypted on the device before relay.
- **👻 Visual obfuscation:** Encrypted data can be converted to zero-width Unicode characters behind carrier icons (e.g., `(✯‿✯)`). This is not metadata protection.
- **🗄️ Secret Vault:** Securely store and manage your chat keys locally, protected by biometric or passcode authentication.
- **⚡ Auto-Unlock:** Stay in the flow with configurable auto-unlock timers (5m, 30m, 1h, etc.) for trusted contacts.
- **🎭 Anonymous Identities:** No phone numbers or emails. Create a codename and jump into a chat.
- **🤝 Dynamic Handshake:** Change Secret Codes mid-conversation with a real-time acceptance/rejection flow.
- **📱 One-time invites:** Share a short-lived, opaque connection invite via custom `hushhh://` links or QR codes; invite links never include a Secret Code.
- **⚡ Real-time Presence:** See when friends are online or typing.
- **🔔 Push Notifications:** Get notified of new messages even when the app is closed (supported via Expo).
- **🎨 Custom Theme System:** Vibrant, playful UI with full support for system dark/light modes.

---

## (✯‿✯) Security Deep Dive

### 1. Key Derivation (PBKDF2)
When you enter a Secret Code, the client derives separate encryption and authentication keys using **PBKDF2-SHA256** with 310,000 iterations and a random per-conversation salt. Secret Codes should be high entropy and shared out-of-band.

### 2. Authenticated message envelope
Messages use a unique IV and an encrypt-then-MAC envelope while the project migrates to an audited AEAD protocol. This is transitional work, not a substitute for an independently reviewed messaging protocol.

### 3. Zero-Width Encoding
This is where the magic happens. The ciphertext is converted into a binary stream, which is then mapped to invisible Unicode characters:
- `0` ➔ `\u200B` (Zero Width Space)
- `1` ➔ `\u200C` (Zero Width Non-Joiner)
- `Separator` ➔ `\u200D` (Zero Width Joiner)

The result is appended to a visible carrier icon. This changes presentation only; servers still observe timing, participants, payload size, and other operational metadata.

---

## 🛠 Tech Stack

### Frontend (Client)
- **Framework:** React Native (Expo SDK 54)
- **Routing:** Expo Router (File-based)
- **Animation:** Reanimated & Lucide Icons
- **Security:** `crypto-js`, `expo-crypto`, `expo-secure-store`, `expo-local-authentication`
- **Networking:** Axios & Socket.io-client

### Backend (Server)
- **Architecture:** MVC (Model-View-Controller)
- **Framework:** Node.js (Express 5)
- **Real-time:** Socket.io
- **Database:** MongoDB (via Mongoose)
- **Push:** Expo Server SDK

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- Expo Go app on your mobile device (for testing)

### Backend Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/hushhh
   JWT_SECRET=your_super_secret_key
   ```
4. Start the server:
   ```bash
   pnpm start
   ```

### Frontend Setup
1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Configure your local IP in `.env` (so your phone can connect):
   ```env
   EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000
   ```
4. Start Expo:
   ```bash
   npx expo start
   ```

---

## 📂 Project Structure

```text
/
├── client/                 # React Native / Expo Mobile App
│   ├── app/                # Expo Router Screen Files (Vault, Auto-Unlock, etc.)
│   ├── context/            # Auth, Socket, & Security Contexts
│   ├── utils/              # Crypto & Steganography Logic
│   └── components/         # Reusable UI (Avatars, etc.)
├── server/                 # Express MVC Backend
│   ├── models/             # Mongoose Schemas (User, Message)
│   ├── controllers/        # Business Logic
│   ├── routes/             # API Endpoint Definitions
│   ├── sockets/            # Socket.io Event Handling
│   └── index.js            # Entry Point
└── README.md               # You are here!
```

---

## 🛣 Future Roadmap
- [ ] **Media E2EE:** Hide images and audio within multiple icon "packets".
- [ ] **Local Discovery:** Use Bluetooth/mDNS for truly anonymous nearby chatting.
- [x] **Code Recovery:** Persistent Secret Vault for chat keys (Stored in SecureStore).
- [ ] **Message Expiry:** Self-destructing messages with a countdown timer.

---

**(✯‿✯) Keep Hushhh.**
---
***Made with ♡ by Sayandeep Pal***
