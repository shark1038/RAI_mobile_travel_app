import { Text, View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GoogleIcon, AppleIcon } from "../../components/AuthIcons";
import { useSSOAuth } from "../../hooks/useSSOAuth";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signInWith, pendingStrategy } = useSSOAuth();
  const busy = pendingStrategy !== null;

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />

      {/* Background image */}
      <Image
        source={require("../../../assets/images/auth-bg.png")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      {/* Dark gradient overlay for legibility */}
      <LinearGradient
        colors={[
          "rgba(8,28,42,0)",
          "rgba(8,28,42,0.35)",
          "rgba(7,22,35,0.85)",
          "rgba(6,18,30,0.97)",
        ]}
        locations={[0, 0.42, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View
        className="flex-1 justify-end px-6"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Headline */}
        <Text style={styles.title}>Your next{"\n"}adventure starts here</Text>

        {/* Google button */}
        <Pressable
          style={[styles.whiteButton, styles.firstButton, busy && styles.buttonDisabled]}
          disabled={busy}
          onPress={() => signInWith("oauth_google")}
        >
          {pendingStrategy === "oauth_google" ? (
            <ActivityIndicator color="#1F2430" />
          ) : (
            <>
              <GoogleIcon size={22} />
              <Text style={styles.whiteButtonText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {/* Apple button */}
        <Pressable
          style={[styles.whiteButton, busy && styles.buttonDisabled]}
          disabled={busy}
          onPress={() => signInWith("oauth_apple")}
        >
          {pendingStrategy === "oauth_apple" ? (
            <ActivityIndicator color="#1F2430" />
          ) : (
            <>
              <AppleIcon size={22} color="#000000" />
              <Text style={styles.whiteButtonText}>Continue with Apple</Text>
            </>
          )}
        </Pressable>

        {/* Footer */}
        <Text style={styles.footer}>
          By continuing, you agree to our{"\n"}
          <Text style={styles.link}>Terms of Service</Text>
          <Text style={styles.footer}> and </Text>
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "#FFFFFF",
    fontSize: 33,
    lineHeight: 40,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.8,
  },
  firstButton: {
    marginTop: 32,
  },
  whiteButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  whiteButtonText: {
    color: "#1F2430",
    fontSize: 17,
    fontWeight: "600",
  },
  footer: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 20,
  },
  link: {
    color: "#4E9BFF",
    fontSize: 14,
    fontWeight: "500",
  },
});
