import { useUser } from "@clerk/expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const worldImage = require("../../../assets/images/world.png");

const POPULAR_DESTINATIONS = [
  {
    id: "santorini",
    name: "Santorini",
    country: "Greece",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80&auto=format&fit=crop",
  },
  {
    id: "kyoto",
    name: "Kyoto",
    country: "Japan",
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80&auto=format&fit=crop",
  },
  {
    id: "bali",
    name: "Bali",
    country: "Indonesia",
    rating: "4.7",
    image:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80&auto=format&fit=crop",
  },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();

  const name = user?.firstName ?? "there";

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
      >
        {/* Greeting */}
        <Text className="px-6 text-4xl font-extrabold tracking-tight text-[#0F1B2D]">
          Hi, {name} 👋
        </Text>

        {/* AI Trip Planner card */}
        <View className="mx-6 mt-6 overflow-hidden rounded-[28px] bg-[#5B8DEF]">
          <Image
            source={worldImage}
            contentFit="contain"
            style={{ position: "absolute", right: -52, top: 0, bottom: 0, width: 224 }}
          />
          <View className="py-6 pl-6" style={{ paddingRight: 150 }}>
            <View className="flex-row items-center gap-1.5">
              <SymbolView name="sparkles" size={16} tintColor="#FFFFFF" />
              <Text className="text-[15px] font-semibold text-white">AI Trip Planner</Text>
            </View>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className="mt-3 text-[26px] font-extrabold tracking-tight text-white"
            >
              Plan your next trip
            </Text>

            <Text className="mt-2 text-[14px] leading-5 text-white/90">
              Tell us where and when — we&apos;ll build the itinerary.
            </Text>

            <Pressable
              onPress={() => router.push("/generate-trip")}
              className="mt-5 flex-row items-center gap-2 self-start rounded-full bg-white px-5 py-3"
            >
              <Text className="text-[15px] font-bold text-[#2F6BE4]">Get started</Text>
              <SymbolView name="arrow.right" size={15} tintColor="#2F6BE4" />
            </Pressable>
          </View>
        </View>

        {/* Your trips */}
        <View className="mt-8 flex-row items-center justify-between px-6">
          <Text className="text-2xl font-extrabold tracking-tight text-[#0F1B2D]">Your trips</Text>
          <Pressable className="flex-row items-center gap-1">
            <Text className="text-[16px] font-semibold text-[#2F6BE4]">See all</Text>
            <SymbolView name="chevron.right" size={13} tintColor="#2F6BE4" weight="semibold" />
          </Pressable>
        </View>

        {/* Trip card */}
        <View
          className="mx-6 mt-4 overflow-hidden rounded-[24px] bg-white"
          style={{
            shadowColor: "#0F1B2D",
            shadowOpacity: 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <View className="relative h-[210px]">
            <Image
              source="https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80&auto=format&fit=crop"
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
            />

            {/* Days badge */}
            <View className="absolute right-3 top-3 flex-row items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5">
              <SymbolView name="calendar" size={13} tintColor="#FFFFFF" />
              <Text className="text-[13px] font-semibold text-white">3 days</Text>
            </View>

            {/* Title overlay */}
            <View className="absolute bottom-4 left-4">
              <Text className="text-[26px] font-extrabold tracking-tight text-white">
                3 Days in Osaka
              </Text>
              <View className="mt-0.5 flex-row items-center gap-1">
                <SymbolView name="mappin" size={14} tintColor="#FFFFFF" />
                <Text className="text-[15px] font-medium text-white/95">Osaka</Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-row items-center gap-2">
              <SymbolView name="wallet.bifold" size={17} tintColor="#8A94A6" />
              <Text className="text-[15px] font-medium text-[#8A94A6]">Est. $540 / person</Text>
            </View>
            <Pressable className="flex-row items-center gap-1">
              <Text className="text-[15px] font-semibold text-[#2F6BE4]">View</Text>
              <SymbolView name="chevron.right" size={12} tintColor="#2F6BE4" weight="semibold" />
            </Pressable>
          </View>
        </View>

        {/* Popular destinations */}
        <Text className="mt-8 px-6 text-2xl font-extrabold tracking-tight text-[#0F1B2D]">
          Popular destinations
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, gap: 14 }}
        >
          {POPULAR_DESTINATIONS.map((dest) => (
            <View key={dest.id} className="h-[230px] w-[168px] overflow-hidden rounded-[24px]">
              <Image
                source={dest.image}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.5)"]}
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
              />

              {/* Rating badge */}
              <View className="absolute right-2.5 top-2.5 flex-row items-center gap-1 rounded-full bg-black/45 px-2.5 py-1">
                <SymbolView name="star.fill" size={12} tintColor="#F5B942" />
                <Text className="text-[13px] font-semibold text-white">{dest.rating}</Text>
              </View>

              {/* Name */}
              <View className="absolute bottom-3 left-3">
                <Text className="text-[19px] font-extrabold tracking-tight text-white">
                  {dest.name}
                </Text>
                <Text className="text-[13px] font-medium text-white/85">{dest.country}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}
