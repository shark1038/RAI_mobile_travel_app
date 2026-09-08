import { listTrips, type TripSummary } from "@/lib/api";
import { optimizedImage } from "@/lib/image-url";
import { useAuth } from "@clerk/expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INK = "#0F1B2D";
const BLUE = "#2F6BE4";
const MUTED = "#8A94A6";

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
};

const money = (currency: string, amount: number) =>
  `${CURRENCY_SYMBOL[currency] ?? `${currency} `}${Math.round(amount)}`;

// City portion of a destination ("Osaka, Japan" → "Osaka"), used verbatim for the label.
const cityShort = (destination: string) => destination.split(",")[0].trim();

// Title-cased city for the card headline ("cappadocia" → "Cappadocia").
const titleCase = (value: string) =>
  value.replace(/\b\w/g, (c) => c.toUpperCase());

function TripCard({ trip, onPress }: { trip: TripSummary; onPress: () => void }) {
  const city = cityShort(trip.destination);
  const title = `${trip.numDays} ${trip.numDays === 1 ? "Day" : "Days"} in ${titleCase(city)}`;
  const budget = trip.budgetBreakdown;
  const coverUri = optimizedImage(trip.coverImageUrl, 800);

  return (
    <Pressable
      onPress={onPress}
      className="mx-6 mt-5 overflow-hidden rounded-[24px] bg-white"
      style={{
        shadowColor: "#0F1B2D",
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      }}
    >
      <View className="relative h-[210px] bg-[#E7EAF0]">
        {coverUri ? (
          <Image source={coverUri} contentFit="cover" style={{ width: "100%", height: "100%" }} />
        ) : null}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
        />

        {/* Days badge */}
        <View className="absolute right-3 top-3 flex-row items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5">
          <SymbolView name="calendar" size={13} tintColor="#FFFFFF" />
          <Text className="text-[13px] font-semibold text-white">
            {trip.numDays} {trip.numDays === 1 ? "day" : "days"}
          </Text>
        </View>

        {/* Title overlay */}
        <View className="absolute bottom-4 left-4">
          <Text className="text-[26px] font-extrabold tracking-tight text-white">{title}</Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <SymbolView name="mappin" size={14} tintColor="#FFFFFF" />
            <Text className="text-[15px] font-medium text-white/95">{city}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between px-4 py-3.5">
        <View className="flex-row items-center gap-2">
          <SymbolView name="wallet.bifold" size={17} tintColor={MUTED} />
          <Text className="text-[15px] font-medium text-[#8A94A6]">
            {budget ? `Est. ${money(budget.currency, budget.totalPerPerson)} / person` : "Planning…"}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-[15px] font-semibold text-[#2F6BE4]">View</Text>
          <SymbolView name="chevron.right" size={12} tintColor={BLUE} weight="semibold" />
        </View>
      </View>
    </Pressable>
  );
}

export default function Trips() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();

  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listTrips(getToken);
      setTrips(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trips");
    }
  }, [getToken]);

  useEffect(() => {
    let active = true;
    listTrips(getToken)
      .then((data) => active && setTrips(data))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Failed to load trips"));
    return () => {
      active = false;
    };
  }, [getToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const count = trips?.length ?? 0;
  const subtitle =
    trips === null
      ? "Loading your trips…"
      : `${count} ${count === 1 ? "trip" : "trips"} planned`;

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <Text className="px-6 text-4xl font-extrabold tracking-tight text-[#0F1B2D]">Trips</Text>
        <Text className="mt-1 px-6 text-[16px] font-medium text-[#8A94A6]">{subtitle}</Text>

        {trips === null && !error ? (
          <View className="mt-24 items-center">
            <ActivityIndicator color={INK} />
          </View>
        ) : null}

        {error ? (
          <View className="mt-24 items-center px-10">
            <Text className="text-center text-[15px] font-medium text-[#8A94A6]">{error}</Text>
            <Pressable
              onPress={load}
              className="mt-4 rounded-full bg-[#2F6BE4] px-5 py-2.5"
            >
              <Text className="text-[15px] font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {trips && trips.length === 0 && !error ? (
          <View className="mt-24 items-center px-10">
            <SymbolView name="map" size={44} tintColor="#C7CDD8" />
            <Text className="mt-4 text-[18px] font-bold text-[#0F1B2D]">No trips yet</Text>
            <Text className="mt-1 text-center text-[15px] font-medium text-[#8A94A6]">
              Plan your first trip and it&apos;ll show up here.
            </Text>
            <Pressable
              onPress={() => router.push("/generate-trip")}
              className="mt-5 rounded-full bg-[#2F6BE4] px-5 py-3"
            >
              <Text className="text-[15px] font-bold text-white">Plan a trip</Text>
            </Pressable>
          </View>
        ) : null}

        {trips?.map((trip) => (
          <TripCard key={trip.id} trip={trip} onPress={() => router.push(`/trip/${trip.id}`)} />
        ))}
      </ScrollView>
    </View>
  );
}
