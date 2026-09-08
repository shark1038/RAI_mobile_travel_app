import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { getTripStatus } from "@/lib/api";

const BLUE = "#3E86F0";
const INK = "#1B2430";
const MUTED = "#8A94A6";
const TRACK = "#ECEEF2";
const STEP_BG = "#F4F5F7";
const STEP_ICON = "#C4CBD6";

const MAP_IMAGE = require("../../assets/images/trip-loading-map.png");

// Progressive backoff between status polls (ms), capped at the last value.
const POLL_DELAYS = [1500, 2000, 2500, 3000, 4000];

type Step = { icon: SFSymbol; label: string };

const STEPS: Step[] = [
  { icon: "magnifyingglass", label: "Discovering places" },
  { icon: "map", label: "Organizing itinerary" },
  { icon: "sparkles", label: "Finalizing recommendations" },
];

// Rotating status line under the steps.
const MESSAGES = [
  "Scouting the best neighborhoods…",
  "Mapping out your days…",
  "Picking places to eat…",
  "Adding the finishing touches…",
];

export default function TripLoading() {
  const router = useRouter();
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    destination?: string;
    numDays?: string;
  }>();
  const id = params.id;
  const destination = params.destination;
  const numDays = params.numDays ? Number(params.numDays) : undefined;

  // A missing id is a first-render condition, so seed it lazily rather than
  // calling setState inside the effect.
  const [error, setError] = useState<string | null>(() =>
    params.id ? null : "Missing trip. Please try again.",
  );
  const [activeStep, setActiveStep] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Walk through the three stages while we wait.
  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => {
      setActiveStep((i) => Math.min(i + 1, STEPS.length - 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [error]);

  // Rotate the friendly status line.
  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 2600);
    return () => clearInterval(timer);
  }, [error]);

  // Poll the trip status until it's ready or failed.
  useEffect(() => {
    if (!id) return; // error already seeded in state above

    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    let attempt = 0;

    const poll = async () => {
      try {
        const { status, errorMessage } = await getTripStatus(getToken, id);
        if (!active) return;

        if (status === "ready") {
          router.replace({ pathname: "/trip/[id]", params: { id } });
          return;
        }
        if (status === "failed") {
          setError(errorMessage ?? "We couldn't generate your trip.");
          return;
        }
      } catch {
        // Transient error (e.g. network) — keep polling.
        if (!active) return;
      }

      const delay = POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)];
      attempt += 1;
      timeout = setTimeout(poll, delay);
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [id, getToken, router]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <StatusBar style="dark" />
        <View className="h-20 w-20 items-center justify-center rounded-full bg-[#FDECEC]">
          <SymbolView name="exclamationmark.triangle.fill" size={34} tintColor="#E5484D" />
        </View>
        <Text className="mt-6 text-center text-[22px] font-bold text-[#0F1B2D]">
          Something went wrong
        </Text>
        <Text className="mt-2 text-center text-[16px] leading-6 text-[#8A94A6]">{error}</Text>

        <Pressable
          onPress={() => router.replace("/generate-trip")}
          className="mt-8 h-14 w-full flex-row items-center justify-center gap-2 rounded-full"
          style={{ backgroundColor: BLUE }}
        >
          <SymbolView name="arrow.clockwise" size={18} tintColor="#FFFFFF" />
          <Text className="text-[17px] font-bold text-white">Try again</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/")} className="mt-3 h-12 items-center justify-center">
          <Text className="text-[16px] font-semibold text-[#8A94A6]">Back to home</Text>
        </Pressable>
      </View>
    );
  }

  const subtitle = destination
    ? numDays
      ? `${numDays} ${numDays === 1 ? "day" : "days"} in ${destination}`
      : destination
    : "Building your itinerary";

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <StatusBar style="dark" />

      <Image
        source={MAP_IMAGE}
        style={{ width: 240, height: 160 }}
        contentFit="contain"
      />

      <Text className="mt-9 text-center text-[30px] font-bold tracking-tight" style={{ color: INK }}>
        Planning your trip
      </Text>
      <Text className="mt-2.5 text-center text-[18px]" style={{ color: MUTED }}>
        {subtitle}
      </Text>

      {/* Stage indicator */}
      <View className="mt-11 w-full flex-row items-start justify-center">
        {STEPS.map((step, i) => {
          const isActive = i === activeStep;
          return (
            <View key={step.label} className="flex-row items-start">
              {i > 0 && <View className="mt-7 h-px w-8" style={{ backgroundColor: TRACK }} />}
              <View className="w-[96px] items-center">
                <View
                  className="h-14 w-14 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isActive ? BLUE : STEP_BG,
                    borderWidth: isActive ? 0 : 1,
                    borderColor: TRACK,
                  }}
                >
                  <SymbolView
                    name={step.icon}
                    size={24}
                    tintColor={isActive ? "#FFFFFF" : STEP_ICON}
                    weight={isActive ? "semibold" : "regular"}
                  />
                </View>
                <Text
                  className="mt-2.5 text-center text-[13px]"
                  style={{
                    color: isActive ? INK : MUTED,
                    fontWeight: isActive ? "700" : "400",
                  }}
                >
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text className="mt-10 text-center text-[17px] font-semibold" style={{ color: BLUE }}>
        {MESSAGES[messageIndex]}
      </Text>
    </View>
  );
}
