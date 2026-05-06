import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
        </Stack>
      </SocketProvider>
    </AuthProvider>
  );
}
