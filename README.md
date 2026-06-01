# (✯‿✯) Hushhh

**Hushhh** is a privacy-first, end-to-end encrypted (E2EE) messaging application designed for absolute stealth. Beyond standard encryption, it employs **Stealth Steganography** to hide encrypted payloads within seemingly innocent emoji icons, making your secure conversations invisible to shoulder-surfers and server-side analysis.

---

## 📸 Screenshots

| Splash & Identity | Chat List | Secure Chat Room |
| :---: | :---: | :---: |
| ![Splash](https://via.placeholder.com/300x600?text=Identity+Creation) | ![Chat List](https://via.placeholder.com/300x600?text=Chat+List) | ![Chat Room](https://via.placeholder.com/300x600?text=Secure+Chat+Room) |

| Handshake Request | Stealth Mode | Settings & Vault |
| :---: | :---: | :---: |
| ![Handshake](https://via.placeholder.com/300x600?text=Handshake+Request) | ![Stealth](https://via.placeholder.com/300x600?text=Stealth+Payload) | ![Settings](https://via.placeholder.com/300x600?text=Security+Vault) |

---

## ✨ Key Features

- **🔐 True E2EE:** Messages are encrypted/decrypted only on your device. The server never sees your "Secret Code".
- **👻 Stealth Steganography:** Encrypted data is converted to zero-width Unicode characters and hidden behind "carrier" emojis (e.g., `(✯‿✯)`).
- **🎭 Anonymous Identities:** No phone numbers or emails. Create a codename and jump into a chat.
- **🤝 Dynamic Handshake:** Change Secret Codes mid-conversation with a real-time acceptance/rejection flow.
- **📱 Deep Linking & QR:** Share your identity via custom `hushhh://` links or QR codes.
- **⚡ Real-time Presence:** See when friends are online or typing.
- **🔔 Push Notifications:** Get notified of new messages even when the app is closed (supported via Expo).
- **🎨 Custom Theme System:** Vibrant, playful UI with full support for system dark/light modes.

---

## (✯‿✯) Security Deep Dive

### 1. Key Derivation (PBKDF2)
When you enter a Secret Code, the client derives a 256-bit AES key using **PBKDF2** with 1,000 iterations and a local salt. This ensures that even weak codes are resistant to basic brute-force attacks.

### 2. AES-256-CBC Encryption
Messages are encrypted using AES-256-CBC. A unique IV (Initialization Vector) is generated for every single message via `expo-crypto` to ensure that identical messages produce different ciphertexts.

### 3. Zero-Width Encoding
This is where the magic happens. The ciphertext is converted into a binary stream, which is then mapped to invisible Unicode characters:
- `0` ➔ `\u200B` (Zero Width Space)
- `1` ➔ `\u200C` (Zero Width Non-Joiner)
- `Separator` ➔ `\u200D` (Zero Width Joiner)

The result is appended to a visible carrier icon. On the screen, you see `(✯‿✯)`, but the app "sees" the hidden payload.

---

## 🛠 Tech Stack

### Frontend (Client)
- **Framework:** React Native (Expo SDK 54)
- **Routing:** Expo Router (File-based)
- **Animation:** Reanimated & Lucide Icons
- **Security:** `crypto-js`, `expo-crypto`, `expo-secure-store`
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
│   ├── app/                # Expo Router Screen Files
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
- [ ] **Code Recovery:** Optional hint system for Secret Codes stored locally in SecureStore.
- [ ] **Message Expiry:** Self-destructing messages with a countdown timer.

---

**(✯‿✯) Keep Hushhh.**
---
***Made with ♡ by Sayandeep Pal***
