import { useAuth } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import {
  type AssistantMessage,
  clearAssistantMessages,
  getAssistantMessages,
  streamAssistantMessage,
} from "@/lib/api";

// Assistant avatar: a white chat-bubble robot on a blue gradient circle.
function RobotAvatar({ size = 46 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="robotBg" x1="18%" y1="8%" x2="82%" y2="94%">
          <Stop offset="0" stopColor="#6BA5F8" />
          <Stop offset="1" stopColor="#3A6EDA" />
        </LinearGradient>
      </Defs>
      {/* blue circle */}
      <Circle cx={50} cy={50} r={47} fill="url(#robotBg)" />
      {/* sparkles */}
      <Path
        d="M69 25 l1.7 4 4 1.7 -4 1.7 -1.7 4 -1.7 -4 -4 -1.7 4 -1.7 z"
        fill="#FFFFFF"
      />
      <Circle cx={78} cy={35} r={1.8} fill="#FFFFFF" />
      {/* antenna */}
      <Rect x={45.5} y={22} width={5} height={9} rx={2.5} fill="#FFFFFF" />
      <Circle cx={48} cy={21} r={3.1} fill="#FFFFFF" />
      {/* head (chat-bubble) with a small tail bottom-left */}
      <Path
        d="M30 31 h34 a12 12 0 0 1 12 12 v9 a12 12 0 0 1 -12 12 H41 l-9 8 v-8 h-2 a12 12 0 0 1 -12 -12 v-9 a12 12 0 0 1 12 -12 z"
        fill="#FFFFFF"
      />
      {/* screen */}
      <Rect x={31} y={39} width={34} height={20} rx={8} fill="#16233F" />
      {/* eyes */}
      <Circle cx={42} cy={49} r={3.1} fill="#EAF2FF" />
      <Circle cx={54} cy={49} r={3.1} fill="#EAF2FF" />
    </Svg>
  );
}

type ChatMessage = AssistantMessage & { id: string };

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi! I'm your travel companion. Ask me where to go, when to visit, what to pack, or anything else about planning your next trip.",
};

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m${messageCounter}`;
}

// Animated three-dot "typing" indicator shown while the assistant's reply is still
// empty (before the first streamed token arrives).
function TypingDots() {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));

  useEffect(() => {
    const loops = dots.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(value, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 320, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View className="flex-row items-center gap-1 py-1">
      {dots.map((value, i) => (
        <Animated.View
          key={i}
          style={{ opacity: value }}
          className="h-2 w-2 rounded-full bg-[#9AA2AF]"
        />
      ))}
    </View>
  );
}

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = input.trim().length > 0 && !sending;

  // Load the saved transcript once on mount and show it beneath the greeting.
  // `getToken` has an unstable identity, so this effect can re-run; the ref keeps
  // the fetch to a single run and we never discard its result (no cancel flag —
  // that previously threw away the load when the effect re-ran mid-flight).
  const didLoad = useRef(false);
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    (async () => {
      try {
        const stored = await getAssistantMessages(getToken);
        if (stored.length === 0) return;
        const loaded = stored.map((m) => ({ id: m.id, role: m.role, content: m.content }));
        // Don't clobber anything the user sent while the transcript was loading.
        setMessages((prev) => (prev.length <= 1 ? [GREETING, ...loaded] : prev));
      } catch {
        // Keep the greeting-only state if the transcript can't be loaded.
      }
    })();
  }, [getToken]);

  function scrollToEnd() {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    // Reset the field immediately — clear the controlled value and the native text
    // buffer (a multiline TextInput can otherwise re-apply the pending keystroke).
    setInput("");
    inputRef.current?.clear();
    await sendText(text);
  }

  async function sendText(text: string) {
    if (!text || sending) return;

    const userMessage: ChatMessage = { id: nextId(), role: "user", content: text };
    const assistantId = nextId();
    const history = [...messages, userMessage];
    // Append the user's message plus an empty assistant bubble that fills in as
    // tokens stream. The empty bubble renders the typing indicator until then.
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setSending(true);
    scrollToEnd();

    const setAssistant = (update: (content: string) => string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: update(m.content) } : m)),
      );

    try {
      await streamAssistantMessage(
        getToken,
        history.map(({ role, content }) => ({ role, content })),
        (delta) => setAssistant((content) => content + delta),
      );
      // Guard against an empty stream (connection dropped before any token).
      setAssistant((content) =>
        content.length ? content : "Sorry — I didn't get a response. Please try again.",
      );
    } catch {
      setAssistant(() => "Sorry — I couldn't reach the assistant just now. Please try again.");
    } finally {
      setSending(false);
      scrollToEnd();
    }
  }

  function handleClear() {
    // Nothing to clear beyond the static greeting.
    if (messages.length <= 1 || sending) return;

    Alert.alert(
      "Clear conversation?",
      "This permanently deletes all your messages with the assistant. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Optimistically reset; roll back if the delete fails.
            const previous = messages;
            setMessages([GREETING]);
            setInput("");
            try {
              await clearAssistantMessages(getToken);
            } catch {
              setMessages(previous);
              Alert.alert("Couldn't clear the conversation", "Please try again.");
            }
          },
        },
      ],
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="bg-white px-5 pb-4">
        <View className="flex-row items-center">
          <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-[#E7EEFB]">
            <RobotAvatar size={50} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[21px] font-extrabold tracking-tight text-[#0F1B2D]">
              Assistant
            </Text>
            <Text className="mt-0.5 text-[13px] text-[#8A94A6]">Your AI travel companion</Text>
          </View>
          <Pressable
            onPress={handleClear}
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-full bg-[#F2F3F5]"
          >
            <SymbolView name="trash" size={18} tintColor="#3A4252" />
          </Pressable>
        </View>
      </View>

      <View className="h-px bg-[#ECEEF1]" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <View
                key={message.id}
                className={isUser ? "mb-3.5 items-end" : "mb-3.5 items-start"}
              >
                <View
                  className={
                    isUser
                      ? "max-w-[90%] rounded-[22px] bg-[#4388E7] px-4 py-2.5"
                      : "max-w-[90%] rounded-[22px] bg-[#F1F2F4] px-4 py-2.5"
                  }
                >
                  {!isUser && message.content.length === 0 ? (
                    <TypingDots />
                  ) : (
                    <Text
                      className={
                        isUser
                          ? "text-[15px] font-medium leading-[21px] text-white"
                          : "text-[15px] leading-[21px] text-[#1A2436]"
                      }
                    >
                      {message.content}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input bar — lifted above the floating native tab bar */}
        <View
          className="flex-row items-center px-4 pt-2"
          style={{ paddingBottom: insets.bottom + 6 }}
        >
          <View className="flex-1 flex-row items-center rounded-full bg-[#F2F3F5] px-5 py-3.5">
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything about travel..."
              placeholderTextColor="#9AA2AF"
              className="flex-1 text-[17px] text-[#0F1B2D]"
              multiline
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            className="ml-2.5 h-[52px] w-[52px] items-center justify-center rounded-full"
            style={{ backgroundColor: canSend ? "#4388E7" : "#F2F3F5" }}
          >
            <SymbolView name="arrow.up" size={20} tintColor={canSend ? "#FFFFFF" : "#9AA2AF"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
