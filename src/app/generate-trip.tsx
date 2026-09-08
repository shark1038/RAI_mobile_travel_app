import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import * as Sentry from "@sentry/react-native";
import { createTrip, type CreateTripInput } from "@/lib/api";

const BLUE = "#3E7BF0";
const INK = "#0F1B2D";
const MUTED = "#8A94A6";
const BORDER = "#E7EAF0";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const BUDGETS = ["Budget", "Comfort", "Luxury"] as const;
const BUDGET_TIER: Record<(typeof BUDGETS)[number], CreateTripInput["budgetTier"]> = {
  Budget: "budget",
  Comfort: "comfort",
  Luxury: "luxury",
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateString = (stamp: number) => {
  const d = new Date(stamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const DAY_MS = 24 * 60 * 60 * 1000;
const INTERESTS = [
  "Adventure",
  "Beaches",
  "Food & drink",
  "Culture",
  "Nature",
  "Nightlife",
  "Shopping",
  "History",
  "Relaxation",
  "Road trips",
];
const PACES = ["Relaxed", "Balanced", "Fast-paced"];

const atMidnight = (year: number, month: number, day: number) =>
  new Date(year, month, day).setHours(0, 0, 0, 0);

export default function GenerateTrip() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const today = new Date();
  const todayStamp = atMidnight(today.getFullYear(), today.getMonth(), today.getDate());

  const [destination, setDestination] = useState("");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [startStamp, setStartStamp] = useState<number | null>(todayStamp);
  const [endStamp, setEndStamp] = useState<number | null>(null);
  const [budget, setBudget] = useState("Comfort");
  const [travelers, setTravelers] = useState(2);
  const [interests, setInterests] = useState<string[]>(["Beaches", "Food & drink"]);
  const [pace, setPace] = useState("Relaxed");

  const firstOffset = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth();

  const goPrev = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else setViewMonth(viewMonth - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else setViewMonth(viewMonth + 1);
  };

  const onPressDay = (day: number) => {
    const stamp = atMidnight(viewYear, viewMonth, day);
    if (stamp < todayStamp) return;
    if (startStamp === null || endStamp !== null) {
      setStartStamp(stamp);
      setEndStamp(null);
    } else if (stamp < startStamp) {
      setStartStamp(stamp);
    } else if (stamp === startStamp) {
      setEndStamp(stamp);
    } else {
      setEndStamp(stamp);
    }
  };

  const toggleInterest = (interest: string) =>
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );

  const canGenerate = destination.trim().length > 0 && startStamp !== null && !submitting;

  const onGenerate = async () => {
    if (destination.trim().length === 0 || startStamp === null || submitting) return;

    const numDays = endStamp ? Math.round((endStamp - startStamp) / DAY_MS) + 1 : 1;

    const input: CreateTripInput = {
      destination: destination.trim(),
      startDate: toDateString(startStamp),
      numDays,
      numTravelers: travelers,
      budgetTier: BUDGET_TIER[budget as (typeof BUDGETS)[number]],
      interests,
      pace,
    };

    setSubmitting(true);
    try {
      // Trace the whole "tap Generate → trip created → navigate" action as one
      // transaction so we can see how long users wait to kick off generation.
      await Sentry.startSpan(
        {
          name: "Generate trip",
          op: "ui.action",
          attributes: {
            destination: input.destination,
            num_days: numDays,
            num_travelers: input.numTravelers,
            budget_tier: input.budgetTier,
            interest_count: input.interests.length,
          },
        },
        async () => {
          const { id } = await createTrip(getToken, input);
          // One wide event capturing the full request context — lets us slice trip
          // generations by destination, length, budget tier, etc. in production.
          Sentry.logger.info("Trip generation started", {
            trip_id: id,
            destination: input.destination,
            num_days: numDays,
            num_travelers: input.numTravelers,
            budget_tier: input.budgetTier,
            interest_count: input.interests.length,
            pace: input.pace ?? "unset",
          });
          // Replace so back doesn't return to the form mid-generation.
          router.replace({
            pathname: "/trip-loading",
            params: { id, destination: input.destination, numDays: String(numDays) },
          });
        },
      );
    } catch (error) {
      setSubmitting(false);
      Alert.alert(
        "Couldn't start your trip",
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 6 }}>
        <View className="h-12 flex-row items-center justify-center">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={10}
            className="absolute left-5 h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F7]"
          >
            <SymbolView name="chevron.left" size={17} tintColor={INK} weight="semibold" />
          </Pressable>
          <Text className="text-[20px] font-bold text-[#0F1B2D]">Plan a trip</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
      >
        {/* AI intro */}
        <View className="flex-row gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-[#3E7BF0]">
            <SymbolView name="sparkles" size={22} tintColor="#FFFFFF" />
          </View>
          <View className="flex-1 rounded-[20px] border p-4" style={{ borderColor: BORDER }}>
            <Text className="text-[18px] font-bold text-[#0F1B2D]">
              Hi! I&apos;m your AI travel assistant.
            </Text>
            <Text className="mt-1 text-[16px] leading-6 text-[#8A94A6]">
              Tell me a few details and I&apos;ll craft a day-by-day itinerary.
            </Text>
          </View>
        </View>

        {/* Where to */}
        <Text className="mt-7 text-[20px] font-bold text-[#0F1B2D]">Where to?</Text>
        <View
          className="mt-3 h-14 flex-row items-center gap-2.5 rounded-2xl border px-4"
          style={{ borderColor: BORDER }}
        >
          <SymbolView name="mappin" size={18} tintColor={MUTED} />
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="e.g. Tokyo, Japan"
            placeholderTextColor={MUTED}
            className="flex-1 text-[17px] text-[#0F1B2D]"
          />
        </View>

        {/* When */}
        <Text className="mt-7 text-[20px] font-bold text-[#0F1B2D]">When?</Text>
        <View className="mt-3 rounded-[20px] border p-4" style={{ borderColor: BORDER }}>
          <View className="flex-row items-center gap-2.5">
            <SymbolView name="calendar" size={18} tintColor={MUTED} />
            <Text className="text-[17px] text-[#8A94A6]">Select your dates</Text>
          </View>

          {/* Month nav */}
          <View className="mt-4 flex-row items-center justify-between">
            <Pressable
              onPress={goPrev}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F7]"
              style={{ opacity: canGoPrev ? 1 : 0.4 }}
            >
              <SymbolView name="chevron.left" size={15} tintColor={INK} weight="semibold" />
            </Pressable>
            <Text className="text-[18px] font-bold text-[#0F1B2D]">
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <Pressable
              onPress={goNext}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F7]"
            >
              <SymbolView name="chevron.right" size={15} tintColor={INK} weight="semibold" />
            </Pressable>
          </View>

          {/* Weekday header */}
          <View className="mt-4 flex-row">
            {WEEKDAYS.map((w, i) => (
              <Text
                key={i}
                className="flex-1 text-center text-[13px] font-medium"
                style={{ color: MUTED }}
              >
                {w}
              </Text>
            ))}
          </View>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <View key={wi} className="mt-1 flex-row">
              {week.map((day, di) => {
                if (day === null) return <View key={di} className="h-11 flex-1" />;
                const stamp = atMidnight(viewYear, viewMonth, day);
                const isPast = stamp < todayStamp;
                const isStart = startStamp !== null && stamp === startStamp;
                const isEnd = endStamp !== null && stamp === endStamp;
                const inRange =
                  startStamp !== null &&
                  endStamp !== null &&
                  stamp > startStamp &&
                  stamp < endStamp;
                const isEndpoint = isStart || isEnd;
                const hasRange = startStamp !== null && endStamp !== null && startStamp !== endStamp;

                return (
                  <Pressable
                    key={di}
                    onPress={() => onPressDay(day)}
                    disabled={isPast}
                    className="h-11 flex-1 items-center justify-center"
                  >
                    {/* range band */}
                    {(inRange || (isEndpoint && hasRange)) && (
                      <View
                        className="absolute top-1.5 bottom-1.5"
                        style={{
                          backgroundColor: "#E8F0FE",
                          left: isStart ? "50%" : 0,
                          right: isEnd ? "50%" : 0,
                        }}
                      />
                    )}
                    {/* endpoint circle */}
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: isEndpoint ? BLUE : "transparent" }}
                    >
                      <Text
                        className="text-[16px]"
                        style={{
                          color: isEndpoint
                            ? "#FFFFFF"
                            : isPast
                              ? "#C7CCD6"
                              : inRange
                                ? BLUE
                                : INK,
                          fontWeight: isEndpoint ? "700" : "500",
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Budget */}
        <Text className="mt-7 text-[20px] font-bold text-[#0F1B2D]">Budget (per person)</Text>
        <View className="mt-3 flex-row gap-3">
          {BUDGETS.map((b) => {
            const active = budget === b;
            return (
              <Pressable
                key={b}
                onPress={() => setBudget(b)}
                className="h-12 flex-1 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: active ? BLUE : "#FFFFFF",
                  borderColor: active ? BLUE : BORDER,
                }}
              >
                <Text
                  className="text-[16px] font-semibold"
                  style={{ color: active ? "#FFFFFF" : MUTED }}
                >
                  {b}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Travelers */}
        <Text className="mt-7 text-[20px] font-bold text-[#0F1B2D]">Travelers</Text>
        <View
          className="mt-3 h-16 flex-row items-center justify-between rounded-2xl border px-4"
          style={{ borderColor: BORDER }}
        >
          <View className="flex-row items-center gap-2.5">
            <SymbolView name="person.2" size={20} tintColor={INK} />
            <Text className="text-[17px] font-semibold text-[#0F1B2D]">
              {travelers} {travelers === 1 ? "traveler" : "travelers"}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setTravelers((t) => Math.max(1, t - 1))}
              hitSlop={6}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F7]"
            >
              <SymbolView name="minus" size={16} tintColor={INK} weight="semibold" />
            </Pressable>
            <Pressable
              onPress={() => setTravelers((t) => t + 1)}
              hitSlop={6}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F7]"
            >
              <SymbolView name="plus" size={16} tintColor={INK} weight="semibold" />
            </Pressable>
          </View>
        </View>

        {/* Interests */}
        <Text className="mt-7 text-[20px] font-bold text-[#0F1B2D]">Interests</Text>
        <View className="mt-3 flex-row flex-wrap gap-3">
          {INTERESTS.map((interest) => {
            const active = interests.includes(interest);
            return (
              <Pressable
                key={interest}
                onPress={() => toggleInterest(interest)}
                className="h-12 items-center justify-center rounded-full border px-5"
                style={{
                  backgroundColor: active ? BLUE : "#FFFFFF",
                  borderColor: active ? BLUE : BORDER,
                }}
              >
                <Text
                  className="text-[16px] font-semibold"
                  style={{ color: active ? "#FFFFFF" : MUTED }}
                >
                  {interest}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Travel pace */}
        <Text className="mt-7 text-[20px] font-bold text-[#0F1B2D]">Travel pace</Text>
        <View className="mt-3 flex-row gap-3">
          {PACES.map((p) => {
            const active = pace === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPace(p)}
                className="h-12 flex-1 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: active ? BLUE : "#FFFFFF",
                  borderColor: active ? BLUE : BORDER,
                }}
              >
                <Text
                  className="text-[16px] font-semibold"
                  style={{ color: active ? "#FFFFFF" : MUTED }}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky generate button */}
      <View
        className="border-t px-5 pt-3"
        style={{ borderColor: BORDER, paddingBottom: insets.bottom + 10 }}
      >
        <Pressable
          onPress={onGenerate}
          disabled={!canGenerate}
          className="h-14 flex-row items-center justify-center gap-2 rounded-full"
          style={{ backgroundColor: canGenerate ? BLUE : "#A9C3F5" }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <SymbolView name="sparkles" size={18} tintColor="#FFFFFF" />
              <Text className="text-[17px] font-bold text-white">Generate My Trip</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
