import { useClerk, useUser } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_SHADOW = {
  shadowColor: "#0F1B2D",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const STATS = [
  { icon: "airplane", value: "12", label: "Trips" },
  { icon: "globe", value: "8", label: "Countries" },
  { icon: "calendar", value: "47", label: "Days away" },
] as const;

const ACCOUNT_ROWS = [
  { icon: "slider.horizontal.3", label: "Travel preferences" },
  { icon: "bell", label: "Notifications" },
  { icon: "creditcard", label: "Payment methods" },
] as const;

const PREFERENCE_ROWS = [
  { icon: "gearshape", label: "Settings" },
  { icon: "moon", label: "Appearance" },
  { icon: "character.bubble", label: "Language" },
] as const;

const SUPPORT_ROWS = [
  { icon: "questionmark.circle", label: "Help & support", chevron: false },
  { icon: "checkmark.shield", label: "Privacy policy", chevron: false },
  { icon: "doc.text", label: "Terms of service", chevron: false },
  { icon: "star", label: "Rate Triply", chevron: false },
  { icon: "gift", label: "Invite friends", chevron: true },
] as const;

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="mb-2 mt-7 px-6 text-[15px] font-semibold text-[#8A94A6]">{title}</Text>
  );
}

function Row({
  icon,
  label,
  chevron = true,
  isFirst = false,
}: {
  icon: SymbolViewProps["name"];
  label: string;
  chevron?: boolean;
  isFirst?: boolean;
}) {
  return (
    <Pressable
      className={`flex-row items-center px-4 py-4 ${isFirst ? "" : "border-t border-[#F0F2F5]"}`}
    >
      <SymbolView name={icon} size={22} tintColor="#4B5563" />
      <Text className="ml-3.5 flex-1 text-[17px] font-medium text-[#111827]">{label}</Text>
      {chevron ? <SymbolView name="chevron.right" size={15} tintColor="#C7CDD6" /> : null}
    </Pressable>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="mx-6 overflow-hidden rounded-[20px] border border-[#EDEFF3] bg-white"
      style={CARD_SHADOW}
    >
      {children}
    </View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [isDeleting, setIsDeleting] = useState(false);

  const fullName = user?.fullName ?? "Traveler";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initial = (user?.firstName ?? fullName ?? "T").charAt(0).toUpperCase();

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all your data — trips, itineraries, and chats. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            setIsDeleting(true);
            try {
              // Deletes the Clerk user. Clerk then fires a `user.deleted` webhook,
              // which our Inngest `syncUserDeleted` function consumes to remove the
              // user row from Neon — cascades clear their trips, chats, and usage.
              await user.delete();
              // Clear the local session/token cache so the layout redirects to sign-in.
              await signOut();
            } catch (error) {
              console.error("[profile] account deletion failed:", error);
              setIsDeleting(false);
              Alert.alert(
                "Couldn't delete account",
                "Something went wrong. Please try again in a moment.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
      >
        {/* Title */}
        <Text className="px-6 text-4xl font-extrabold tracking-tight text-[#0F1B2D]">
          Profile
        </Text>

        {/* User card */}
        <View className="mt-6">
          <Card>
            <View className="flex-row items-center px-4 py-4">
              <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-[#22488F]">
                <Text className="text-[30px] font-bold text-white">{initial}</Text>
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-[22px] font-bold tracking-tight text-[#0F1B2D]">
                  {fullName}
                </Text>
                {email ? (
                  <Text className="mt-0.5 text-[15px] text-[#8A94A6]">{email}</Text>
                ) : null}
              </View>
            </View>
          </Card>
        </View>

        {/* Stats card */}
        <View className="mt-4">
          <Card>
            <View className="flex-row items-center py-5">
              {STATS.map((stat, i) => (
                <View
                  key={stat.label}
                  className={`flex-1 items-center ${i > 0 ? "border-l border-[#F0F2F5]" : ""}`}
                >
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-[#EAF1FE]">
                    <SymbolView name={stat.icon} size={20} tintColor="#3A6EDA" />
                  </View>
                  <Text className="mt-2 text-[22px] font-extrabold tracking-tight text-[#0F1B2D]">
                    {stat.value}
                  </Text>
                  <Text className="mt-0.5 text-[15px] text-[#8A94A6]">{stat.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <Card>
          {ACCOUNT_ROWS.map((row, i) => (
            <Row key={row.label} icon={row.icon} label={row.label} isFirst={i === 0} />
          ))}
        </Card>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <Card>
          {PREFERENCE_ROWS.map((row, i) => (
            <Row key={row.label} icon={row.icon} label={row.label} isFirst={i === 0} />
          ))}
        </Card>

        {/* Support */}
        <SectionHeader title="Support" />
        <Card>
          {SUPPORT_ROWS.map((row, i) => (
            <Row
              key={row.label}
              icon={row.icon}
              label={row.label}
              chevron={row.chevron}
              isFirst={i === 0}
            />
          ))}
        </Card>

        {/* Log out */}
        <Pressable
          onPress={() => signOut()}
          className="mx-6 mt-6 flex-row items-center justify-center gap-2 rounded-[20px] border border-[#EDEFF3] bg-white py-4"
          style={CARD_SHADOW}
        >
          <SymbolView name="rectangle.portrait.and.arrow.right" size={20} tintColor="#111827" />
          <Text className="text-[17px] font-semibold text-[#111827]">Log out</Text>
        </Pressable>

        {/* Delete account */}
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={isDeleting}
          className="mx-6 mt-4 flex-row items-center justify-center gap-2 rounded-[20px] border border-[#EDEFF3] bg-white py-4"
          style={[CARD_SHADOW, isDeleting && { opacity: 0.6 }]}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <SymbolView name="trash" size={20} tintColor="#EF4444" />
              <Text className="text-[17px] font-semibold text-[#EF4444]">Delete account</Text>
            </>
          )}
        </Pressable>

        {/* Version */}
        <Text className="mt-6 text-center text-[14px] text-[#B0B7C3]">Triply v1.0.0</Text>
      </ScrollView>
    </View>
  );
}
