import type { Trip } from "@/db/schema";
import { deleteTrip, getTrip, updateTripCover } from "@/lib/api";
import { optimizedImage } from "@/lib/image-url";
import type { Place } from "@/lib/itinerary";
import { useAuth } from "@clerk/expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const BLUE = "#2E6FF2";
const INK = "#0F1B2D";
const MUTED = "#8A94A6";
const BORDER = "#E7EAF0";
const BADGE_BG = "#E7F0FE";
const CARD_BLUE = "#EAF1FE";
const GREEN = "#2FA36B";

const aiLogo = require("../../../assets/images/ai-logo.png");

const { width: SCREEN_W } = Dimensions.get("window");
const COVER_ARCH = 30;

const PLACE_ICON: Record<Place["kind"], SymbolViewProps["name"]> = {
  attraction: "camera",
  restaurant: "fork.knife",
  activity: "figure.walk",
};

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

const cityShort = (destination: string) => destination.split(",")[0].trim();

export default function TripDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<Record<number, boolean>>({ 1: true });
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  // Local uri shown immediately while the picked image uploads to ImageKit.
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getTrip(getToken, id)
      .then((data) => active && setTrip(data))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Failed to load trip"));
    return () => {
      active = false;
    };
  }, [id, getToken]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const doDelete = async () => {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      await deleteTrip(getToken, id);
      router.replace("/");
    } catch (e) {
      setDeleting(false);
      Alert.alert("Couldn't delete trip", e instanceof Error ? e.message : "Please try again.");
    }
  };

  // Native confirmation before the destructive delete.
  const confirmDelete = () => {
    Alert.alert(
      "Delete trip?",
      "This permanently removes this trip and its chat. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ],
    );
  };

  // Native iOS action sheet triggered by the ••• button.
  const openMenu = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: trip?.destination,
        options: ["Delete Trip", "Cancel"],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) confirmDelete();
      },
    );
  };

  // Opens the photo library, then uploads the picked image to ImageKit as the new
  // cover. The picker compresses (quality) and ImageKit optimizes on delivery.
  const changeCover = async () => {
    if (!id || uploadingCover) return;

    // Lazy-loaded so the screen still renders if the native module isn't in the
    // current dev build yet (it requires a native rebuild: `npm run ios`).
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = await import("expo-image-picker");
    } catch {
      Alert.alert(
        "Rebuild required",
        "Photo uploads need a fresh native build. Rebuild the app (npm run ios) and try again.",
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to set a custom cover image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert("Couldn't read that image", "Please try a different photo.");
      return;
    }

    setCoverPreview(asset.uri);
    setUploadingCover(true);
    try {
      const { coverImageUrl } = await updateTripCover(getToken, id, asset.base64);
      setTrip((prev) =>
        prev
          ? { ...prev, coverImageUrl, coverPhotographer: null, coverPhotographerUrl: null }
          : prev,
      );
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setUploadingCover(false);
      setCoverPreview(null);
    }
  };

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <StatusBar style="dark" />
        <Text className="text-[18px] font-semibold text-[#0F1B2D]">{error}</Text>
        <Pressable onPress={goBack} className="mt-6 rounded-full bg-[#2E6FF2] px-6 py-3">
          <Text className="text-[16px] font-bold text-white">Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <StatusBar style="dark" />
        <ActivityIndicator color={BLUE} />
      </View>
    );
  }

  const itinerary = trip.itinerary;
  const budget = trip.budgetBreakdown;

  // Flatten every place across days for the map + sequential numbering.
  const numberedPlaces =
    itinerary?.days.flatMap((d) => d.places).map((p, i) => ({ ...p, n: i + 1 })) ?? [];

  const region = regionForPlaces(numberedPlaces);

  const title = `${trip.numDays} ${trip.numDays === 1 ? "Day" : "Days"} in ${cityShort(trip.destination)}`;

  // Local preview while uploading, otherwise the ImageKit-optimized remote cover.
  const coverUri = coverPreview ?? optimizedImage(trip.coverImageUrl, 1200);

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ---- Cover ---- */}
        <View style={{ height: insets.top + 252 }}>
          {coverUri ? (
            <Image
              source={coverUri}
              contentFit="cover"
              transition={200}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <View className="h-full w-full bg-[#5B8DEF]" />
          )}

          {/* Spinner while a newly picked cover uploads */}
          {uploadingCover ? (
            <View className="absolute inset-0 items-center justify-center bg-black/35">
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}

          {/* Bottom scrim so the title/attribution stay legible over bright photos */}
          <LinearGradient
            colors={["transparent", "rgba(11,20,34,0.15)", "rgba(11,20,34,0.72)"]}
            locations={[0, 0.45, 1]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "68%" }}
          />

          {/* Curved bottom arch (white, blends into page) */}
          <Svg
            width={SCREEN_W}
            height={COVER_ARCH}
            style={{ position: "absolute", bottom: -1, left: 0 }}
          >
            <Path
              d={`M0,0 Q${SCREEN_W / 2},${COVER_ARCH * 2} ${SCREEN_W},0 L${SCREEN_W},${COVER_ARCH + 1} L0,${COVER_ARCH + 1} Z`}
              fill="#FFFFFF"
            />
          </Svg>

          {/* Top controls */}
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={{ top: insets.top + 4 }}
            className="absolute left-5 h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <SymbolView name="chevron.left" size={18} tintColor={INK} weight="semibold" />
          </Pressable>
          <Pressable
            onPress={changeCover}
            hitSlop={10}
            style={{ top: insets.top + 4, right: 72 }}
            className="absolute h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <SymbolView name="camera.fill" size={22} tintColor={INK} weight="semibold" />
          </Pressable>
          <Pressable
            onPress={openMenu}
            hitSlop={10}
            style={{ top: insets.top + 4 }}
            className="absolute right-5 h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <SymbolView name="trash" size={20} tintColor="#E5484D" weight="semibold" />
          </Pressable>

          {/* Title block */}
          <View className="absolute left-5 right-5" style={{ bottom: COVER_ARCH + 20 }}>
            <View className="flex-row items-center gap-1.5">
              <SymbolView name="mappin" size={15} tintColor="#FFFFFF" />
              <Text className="text-[16px] font-semibold text-white">
                {cityShort(trip.destination)}
              </Text>
            </View>
            <Text className="mt-0.5 text-[34px] font-extrabold tracking-tight text-white">
              {title}
            </Text>
            {trip.coverPhotographer ? (
              <Pressable
                onPress={() =>
                  trip.coverPhotographerUrl && Linking.openURL(trip.coverPhotographerUrl)
                }
                className="mt-1.5 flex-row justify-end"
              >
                <Text className="text-[13px] text-white/85">
                  Photo by{" "}
                  <Text className="font-semibold text-white">{trip.coverPhotographer}</Text> on{" "}
                  <Text className="font-semibold text-white">Unsplash</Text>
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ---- Stats ---- */}
        <View className="mt-4 flex-row px-4">
          <StatCol
            icon="calendar"
            value={`${trip.numDays} ${trip.numDays === 1 ? "day" : "days"}`}
            label="Duration"
          />
          <StatCol icon="person.2" value={`${trip.numTravelers}`} label="Travelers" />
          <StatCol
            icon="wallet.bifold"
            value={budget ? money(budget.currency, budget.totalPerPerson) : "—"}
            label="Budget"
            sub="/ person"
          />
        </View>

        {/* ---- Map ---- */}
        {numberedPlaces.length > 0 && region ? (
          <>
            <Text className="mt-7 px-5 text-[24px] font-extrabold tracking-tight text-[#0F1B2D]">
              Map
            </Text>
            <View
              className="mx-5 mt-3 overflow-hidden rounded-[20px]"
              style={{
                height: 230,
                shadowColor: "#0F1B2D",
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={region}>
                {numberedPlaces.map((p) => (
                  <Marker
                    key={p.n}
                    coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                    title={p.name}
                    description={p.description}
                  >
                    <Pin n={p.n} color={p.kind === "restaurant" ? GREEN : BLUE} />
                  </Marker>
                ))}
              </MapView>

              {/* Recenter button */}
              <Pressable
                onPress={() => region && mapRef.current?.animateToRegion(region, 400)}
                hitSlop={8}
                className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full bg-white"
                style={{
                  shadowColor: "#0F1B2D",
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <SymbolView name="location.fill" size={18} tintColor={BLUE} />
              </Pressable>
            </View>
          </>
        ) : null}

        {/* ---- Itinerary ---- */}
        {itinerary?.days.length ? (
          <>
            <Text className="mt-8 px-5 text-[24px] font-extrabold tracking-tight text-[#0F1B2D]">
              Itinerary
            </Text>
            <Text className="mt-1 px-5 text-[16px] text-[#8A94A6]">Your day-by-day plan</Text>

            <View className="mt-4 gap-4 px-5">
              {itinerary.days.map((day) => {
                const open = !!openDays[day.day];
                return (
                  <View
                    key={day.day}
                    className="overflow-hidden rounded-[20px]"
                    style={{ backgroundColor: CARD_BLUE }}
                  >
                    <Pressable
                      onPress={() =>
                        setOpenDays((prev) => ({ ...prev, [day.day]: !prev[day.day] }))
                      }
                      className="flex-row items-center gap-3 p-4"
                    >
                      <View
                        className="h-9 w-9 items-center justify-center rounded-full"
                        style={{ backgroundColor: BLUE }}
                      >
                        <Text className="text-[15px] font-bold text-white">{day.day}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-[17px] font-bold text-[#0F1B2D]">{day.title}</Text>
                        {!open ? (
                          <Text numberOfLines={1} className="mt-0.5 text-[14px] text-[#8A94A6]">
                            {day.summary}
                          </Text>
                        ) : null}
                      </View>
                      <SymbolView
                        name={open ? "chevron.up" : "chevron.down"}
                        size={15}
                        tintColor={MUTED}
                        weight="semibold"
                      />
                    </Pressable>

                    {open ? (
                      <View className="px-4 pb-4">
                        <Text className="text-[15px] leading-6 text-[#5A6472]">{day.summary}</Text>
                        <View className="mt-3 gap-3">
                          {day.places.map((place, i) => (
                            <View key={`${day.day}-${i}`} className="flex-row gap-3">
                              <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-white">
                                <SymbolView
                                  name={PLACE_ICON[place.kind]}
                                  size={16}
                                  tintColor={BLUE}
                                />
                              </View>
                              <View className="flex-1">
                                <Text className="text-[15px] font-semibold text-[#0F1B2D]">
                                  {place.name}
                                  <Text className="text-[13px] font-medium text-[#8A94A6]">
                                    {"  "}· {place.timeOfDay}
                                  </Text>
                                </Text>
                                <Text className="mt-0.5 text-[14px] leading-5 text-[#8A94A6]">
                                  {place.description}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* ---- Budget breakdown ---- */}
        {budget ? (
          <>
            <Text className="mt-8 px-5 text-[24px] font-extrabold tracking-tight text-[#0F1B2D]">
              Budget
            </Text>
            <View className="mx-5 mt-3 rounded-[20px] border p-4" style={{ borderColor: BORDER }}>
              <View className="flex-row items-center justify-between pb-3">
                <Text className="text-[16px] font-bold text-[#0F1B2D]">Total per person</Text>
                <Text className="text-[20px] font-extrabold" style={{ color: BLUE }}>
                  {money(budget.currency, budget.totalPerPerson)}
                </Text>
              </View>
              {budget.categories.map((c) => (
                <View
                  key={c.name}
                  className="flex-row items-center justify-between border-t py-3"
                  style={{ borderColor: BORDER }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[15px] font-bold text-[#0F1B2D]">{c.name}</Text>
                    <Text className="text-[13px] text-[#8A94A6]">{c.note}</Text>
                  </View>
                  <Text className="text-[15px] font-semibold text-[#0F1B2D]">
                    {money(budget.currency, c.amountPerPerson)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ---- Hotels ---- */}
        {itinerary?.hotels.length ? (
          <>
            <Text className="mt-8 px-5 text-[24px] font-extrabold tracking-tight text-[#0F1B2D]">
              Where to stay
            </Text>
            <View className="mt-3 gap-3 px-5">
              {itinerary.hotels.map((hotel, i) => (
                <View key={i} className="rounded-[20px] border p-4" style={{ borderColor: BORDER }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 pr-3 text-[16px] font-bold text-[#0F1B2D]">
                      {hotel.name}
                    </Text>
                    <Text className="text-[14px] font-semibold" style={{ color: BLUE }}>
                      {hotel.priceEstimate}
                    </Text>
                  </View>
                  <Text className="mt-1.5 text-[14px] leading-5 text-[#8A94A6]">
                    {hotel.description}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* ---- Floating AI assistant ---- */}
      <Pressable
        style={{ bottom: insets.bottom + 18, right: 18 }}
        className="absolute h-16 w-16 items-center justify-center"
      >
        <Image source={aiLogo} style={{ width: 64, height: 64 }} contentFit="contain" />
      </Pressable>

      {/* Blocking overlay while the delete request is in flight */}
      {deleting ? (
        <View className="absolute inset-0 items-center justify-center bg-black/25">
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-white">
            <ActivityIndicator color={BLUE} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StatCol({
  icon,
  value,
  label,
  sub,
}: {
  icon: SymbolViewProps["name"];
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <View className="flex-1 items-center">
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: BADGE_BG }}
      >
        <SymbolView name={icon} size={24} tintColor={BLUE} />
      </View>
      <Text className="mt-3 text-[20px] font-extrabold text-[#0F1B2D]">{value}</Text>
      {sub ? <Text className="text-[14px] text-[#8A94A6]">{sub}</Text> : null}
      <Text className="text-[15px] text-[#8A94A6]">{label}</Text>
    </View>
  );
}

function Pin({ n, color }: { n: number; color: string }) {
  return (
    <View className="items-center">
      <View
        className="h-8 w-8 items-center justify-center rounded-full border-2 border-white"
        style={{ backgroundColor: color }}
      >
        <Text className="text-[13px] font-bold text-white">{n}</Text>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 5,
          borderRightWidth: 5,
          borderTopWidth: 7,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          marginTop: -1,
        }}
      />
    </View>
  );
}

type NumberedPlace = Place & { n: number };

function regionForPlaces(places: NumberedPlace[]) {
  if (places.length === 0) return null;
  const lats = places.map((p) => p.latitude);
  const lngs = places.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.03),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.03),
  };
}
