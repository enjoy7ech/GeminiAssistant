<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { gemini } from "../libs/GeminiService";
import { storage } from "../libs/StorageService";
import TextAssistant from "./TextAssistant.vue";
import ImageAssistant from "./ImageAssistant.vue";
import ImageProcessor from "./ImageProcessor.vue";
import ConfigView from "./ConfigView.vue";
import GeminiModal from "./GeminiModal.vue";
import ExportAssistant from "./ExportAssistant.vue";

interface Preset {
  id: string;
  name: string;
  prompt: string;
  isCustom: boolean;
}

const props = defineProps<{ activeTab: string }>();
const emit = defineEmits(["update:activeTab"]);

// --- Central Shared State ---
const apiKey = ref("");
const textModel = ref("");
const imageModel = ref("");
const apiBaseUrl = ref("");
const isLoading = ref(false);
const statusMessage = ref("");
const availableModels = ref<any[]>([]);

// Text State
const textPrefix = ref("");
const textPresetId = ref("");
const textPrompt = ref("");
const textPresets = ref<Preset[]>([]);
const imagePresets = ref<Preset[]>([]);

interface ChatSession {
  id: string;
  title: string;
  history: { role: string; content: string }[];
  updatedAt: number;
}

const sessions = ref<ChatSession[]>([]);
const activeSessionId = ref<string>("");

interface ImageSession {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  originalImageUrl: string;
  updatedAt: number;
  mattingConfig?: {
    tolerance: number;
    contiguous: boolean;
    smoothing: number;
    targetColor: { r: number; g: number; b: number };
    erosion: number;
    feathering: number;
  };
}
const imageSessions = ref<ImageSession[]>([]);
const activeImageSessionId = ref<string>("");

const isLoaded = ref(false);

const activeSession = computed(() =>
  sessions.value.find((s) => s.id === activeSessionId.value),
);

const chatHistory = computed({
  get: () => (activeSession.value ? activeSession.value.history : []),
  set: (val) => {
    const s = activeSession.value;
    if (s) {
      s.history = val;
      s.updatedAt = Date.now();
    }
  },
});

const activeImageSession = computed(() =>
  imageSessions.value.find((s) => s.id === activeImageSessionId.value),
);

// Image State
const imagePrefix = ref("");
const imagePresetId = ref("");
const imagePrompt = ref("");
const imageUrl = ref("");
const originalImageUrl = ref("");
const useGreenScreen = ref(true);
const webpQuality = ref(0.85);
const chromaTolerance = ref(1.15);
const isMattingContiguous = ref(true);
const chromaSmoothing = ref(0.1);
const chromaTargetColor = ref({ r: 0, g: 255, b: 0 });
const chromaErosion = ref(0);
const chromaFeathering = ref(2.0);

// Manual Matting State (Decoupled from AI generation)
const manualImageUrl = ref("");
const manualOriginalImageUrl = ref("");

// Sync current image state with active session
watch(activeImageSession, (s) => {
  if (s) {
    imageUrl.value = s.imageUrl;
    originalImageUrl.value = s.originalImageUrl;
    imagePrompt.value = s.prompt;
    if (s.mattingConfig) {
      chromaTolerance.value = s.mattingConfig.tolerance;
      isMattingContiguous.value = s.mattingConfig.contiguous;
      chromaSmoothing.value = s.mattingConfig.smoothing;
      chromaTargetColor.value = s.mattingConfig.targetColor;
      chromaErosion.value = s.mattingConfig.erosion;
      chromaFeathering.value = s.mattingConfig.feathering;
    }
  }
});

// Update session config when local matting refs change
const updateSessionConfig = () => {
  if (activeImageSession.value) {
    activeImageSession.value.mattingConfig = {
      tolerance: chromaTolerance.value,
      contiguous: isMattingContiguous.value,
      smoothing: chromaSmoothing.value,
      targetColor: chromaTargetColor.value,
      erosion: chromaErosion.value,
      feathering: chromaFeathering.value,
    };
    activeImageSession.value.updatedAt = Date.now();
    activeImageSession.value.imageUrl = imageUrl.value; // Store processed state
  }
};

const currentCacheName = ref("");
const isCaching = ref(false);

let mattingTimeout: any = null;
const isMattingProcessing = ref(false);

const updateMatting = async () => {
  const sourceUrl =
    props.activeTab === "matting"
      ? manualOriginalImageUrl.value
      : originalImageUrl.value;

  if (!sourceUrl || isMattingProcessing.value) return;

  if (mattingTimeout) clearTimeout(mattingTimeout);

  mattingTimeout = setTimeout(async () => {
    isMattingProcessing.value = true;
    try {
      const res = await gemini.chromaKey(sourceUrl, {
        tolerance: chromaTolerance.value,
        contiguous: isMattingContiguous.value,
        smoothing: chromaSmoothing.value,
        targetColor: chromaTargetColor.value,
        erosion: chromaErosion.value,
        feathering: chromaFeathering.value,
      });

      if (props.activeTab === "matting") {
        manualImageUrl.value = res.url;
      } else {
        imageUrl.value = res.url;
      }
    } finally {
      isMattingProcessing.value = false;
      mattingTimeout = null;
    }
  }, 150);
};

watch(
  [
    chromaTolerance,
    isMattingContiguous,
    chromaSmoothing,
    chromaTargetColor,
    chromaErosion,
    chromaFeathering,
    imageUrl,
  ],
  updateSessionConfig,
);

watch(
  [
    chromaTolerance,
    isMattingContiguous,
    chromaSmoothing,
    chromaTargetColor,
    chromaErosion,
    chromaFeathering,
    manualOriginalImageUrl,
    originalImageUrl,
  ],
  updateMatting,
);

watch(apiKey, (v) => storage.save("config", "api_key", v));
watch(textModel, (v) => {
  storage.save("config", "text_model", v);
  gemini.updateTextModel(v);
});
watch(imageModel, (v) => {
  storage.save("config", "image_model", v);
  gemini.updateImageModel(v);
});
watch(apiBaseUrl, (v) => storage.save("config", "api_base_url", v));
watch(textPrefix, (v) => storage.save("config", "text_prefix", v));
watch(textPresetId, (v) => storage.save("config", "text_preset_id", v));
watch(textPrompt, (v) => storage.save("config", "text_prompt", v));
watch(imagePrefix, (v) => storage.save("config", "image_prefix", v));
watch(imagePresetId, (v) => storage.save("config", "image_preset_id", v));
watch(imagePrompt, (v) => storage.save("config", "image_prompt", v));
watch(useGreenScreen, (v) => storage.save("config", "use_green_screen", v));
watch(webpQuality, (v) => storage.save("config", "webp_quality", v));
watch(currentCacheName, (v) => storage.save("config", "chat_cache_name", v));

watch(manualImageUrl, (v) => storage.save("manual_matting", "current_url", v));
watch(manualOriginalImageUrl, (v) =>
  storage.save("manual_matting", "original_url", v),
);

watch(
  sessions,
  (v) => {
    if (isLoaded.value)
      storage.save("text_sessions", "all", JSON.parse(JSON.stringify(v)));
  },
  { deep: true },
);
watch(activeSessionId, (v) => {
  if (isLoaded.value) storage.save("config", "active_sid", v);
});
watch(
  imageSessions,
  (v) => {
    if (isLoaded.value)
      storage.save("image_sessions", "all", JSON.parse(JSON.stringify(v)));
  },
  { deep: true },
);
watch(activeImageSessionId, (v) => {
  if (isLoaded.value) storage.save("config", "active_img_sid", v);
});

watch(
  textPresets,
  (v) => {
    if (isLoaded.value)
      storage.save("presets", "text_presets", JSON.parse(JSON.stringify(v)));
  },
  { deep: true },
);
watch(
  imagePresets,
  (v) => {
    if (isLoaded.value)
      storage.save("presets", "image_presets", JSON.parse(JSON.stringify(v)));
  },
  { deep: true },
);

onMounted(async () => {
  // Load Config
  apiKey.value = (await storage.load("config", "api_key")) || "";
  textModel.value = (await storage.load("config", "text_model")) || "";
  imageModel.value = (await storage.load("config", "image_model")) || "";
  apiBaseUrl.value = (await storage.load("config", "api_base_url")) || "";
  textPrefix.value = (await storage.load("config", "text_prefix")) || "";
  textPresetId.value = (await storage.load("config", "text_preset_id")) || "";
  textPrompt.value = (await storage.load("config", "text_prompt")) || "";
  imagePrefix.value = (await storage.load("config", "image_prefix")) || "";
  imagePresetId.value = (await storage.load("config", "image_preset_id")) || "";
  imagePrompt.value = (await storage.load("config", "image_prompt")) || "";
  useGreenScreen.value =
    (await storage.load("config", "use_green_screen")) !== false;
  webpQuality.value = (await storage.load("config", "webp_quality")) || 0.85;
  currentCacheName.value =
    (await storage.load("config", "chat_cache_name")) || "";

  // Load Matting State
  manualImageUrl.value =
    (await storage.load("manual_matting", "current_url")) || "";
  manualOriginalImageUrl.value =
    (await storage.load("manual_matting", "original_url")) || "";

  // Load text sessions
  const cachedSessions = await storage.load("text_sessions", "all");
  if (cachedSessions && cachedSessions.length > 0) {
    sessions.value = cachedSessions;
    activeSessionId.value =
      (await storage.load("config", "active_sid")) || sessions.value[0].id;
  } else {
    sessions.value = [];
    activeSessionId.value = "";
  }

  // Load image sessions
  const cachedImgSessions = await storage.load("image_sessions", "all");
  if (cachedImgSessions && cachedImgSessions.length > 0) {
    imageSessions.value = cachedImgSessions;
    activeImageSessionId.value =
      (await storage.load("config", "active_img_sid")) ||
      imageSessions.value[0].id;
  } else {
    imageSessions.value = [];
    activeImageSessionId.value = "";
  }

  // Load Presets
  textPresets.value = (await storage.load("presets", "text_presets")) || [];
  imagePresets.value = (await storage.load("presets", "image_presets")) || [];

  isLoaded.value = true;

  // Sync API client
  if (apiKey.value) {
    gemini.initClient(
      apiKey.value,
      textModel.value,
      imageModel.value,
      apiBaseUrl.value,
    );
    gemini.listModels().then((m) => (availableModels.value = m));
  }
});

// UI Utilities
const showStatus = (msg: string) => {
  statusMessage.value = msg;
  setTimeout(() => (statusMessage.value = ""), 3000);
};

// --- Shared Methods ---
const saveConfig = () => {
  if (!apiKey.value) return showAlert("请输入 API Key");
  storage.save("config", "api_key", apiKey.value);
  gemini.initClient(
    apiKey.value,
    textModel.value,
    imageModel.value,
    apiBaseUrl.value,
  );
  gemini
    .listModels()
    .then((models) => {
      availableModels.value = models;
      showStatus("配置已保存并同步");
    })
    .catch((err) => {
      showAlert(err.message);
    });
};

const generateText = async () => {
  if (!textPrompt.value && !textPrefix.value) return;
  isLoading.value = true;

  // Create NEW Session
  const newSid = "s-" + Date.now();
  const fullPrompt = textPrefix.value
    ? `${textPrefix.value}\n\n${textPrompt.value}`
    : textPrompt.value;

  const newSession: ChatSession = {
    id: newSid,
    title: textPrompt.value.slice(0, 12) || "新对话",
    history: [{ role: "user", content: fullPrompt }],
    updatedAt: Date.now(),
  };

  sessions.value.unshift(newSession);
  activeSessionId.value = newSid;

  try {
    const res = await gemini.generateText(fullPrompt);
    if (res && !res.startsWith("生成失败")) {
      chatHistory.value = [
        { role: "user", content: fullPrompt },
        { role: "model", content: res },
      ];
      showStatus("新对话已开始并分析完毕");
    } else {
      // Error is handled via showStatus/showAlert or we can push to history
    }
  } finally {
    isLoading.value = false;
  }
};

const sendFollowUp = async (msg: string) => {
  const newHistory = [...chatHistory.value, { role: "user", content: msg }];
  chatHistory.value = newHistory;
  isLoading.value = true;
  try {
    const res = await gemini.sendMessage(
      msg,
      chatHistory.value.slice(0, -1), // 排除最后一条刚刚添加的 user 消息，由 sendMessage 内部添加
      currentCacheName.value,
    );
    chatHistory.value = [...newHistory, { role: "model", content: res }];
  } finally {
    isLoading.value = false;
  }
};
const createConversationCache = async () => {
  if (chatHistory.value.length === 0) return showAlert("没有可缓存的对话内容");
  isCaching.value = true;
  try {
    const contents = chatHistory.value; // Pass raw
    const res = await gemini.createCache(
      `Cache-${Date.now()}`,
      contents,
      textPrefix.value,
    );
    if (res && res.name) {
      currentCacheName.value = res.name;
      showStatus("对话上下文已缓存，后续将大幅降低 Token 消耗");
    }
  } catch (e: any) {
    showAlert("缓存创建失败: " + e.message);
  } finally {
    isCaching.value = false;
  }
};

const deleteCurrentCache = async () => {
  if (!currentCacheName.value) return;
  await gemini.deleteCache(currentCacheName.value);
  currentCacheName.value = "";
  showStatus("缓存已清除");
};

const deleteSession = (id: string) => {
  const idx = sessions.value.findIndex((s) => s.id === id);
  if (idx !== -1) {
    sessions.value.splice(idx, 1);
    if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0]?.id || "";
    }
    showStatus("会话已删除");
  }
};

const createNewSession = () => {
  const newSid = "s-" + Date.now();
  sessions.value.unshift({
    id: newSid,
    title: "新对话",
    history: [],
    updatedAt: Date.now(),
  });
  activeSessionId.value = newSid;
  showStatus("新会话已创建");
};

const clearChat = () => {
  if (activeSessionId.value) {
    deleteSession(activeSessionId.value);
  }
};

const deleteChatMessage = (idx: number) => {
  if (chatHistory.value) {
    const newHistory = [...chatHistory.value];
    newHistory.splice(idx, 1);
    chatHistory.value = newHistory;
    showStatus("消息已删除");
  }
};

const regenerateMessage = async (idx: number) => {
  const h = chatHistory.value;
  if (!h || idx < 0) return;

  // 1. 找到该消息之前最近的一条用户消息
  let userIdx = -1;
  for (let i = idx - 1; i >= 0; i--) {
    if (h[i].role === "user") {
      userIdx = i;
      break;
    }
  }

  if (userIdx !== -1) {
    const prompt = h[userIdx].content;
    // 2. 回滚历史记录：删除从该用户消息开始的所有后续消息
    chatHistory.value = h.slice(0, userIdx);
    // 3. 重新调用发送逻辑
    sendFollowUp(prompt);
  }
};

const renameSession = (id: string, newTitle: string) => {
  const session = sessions.value.find((s) => s.id === id);
  if (session) {
    session.title = newTitle;
    session.updatedAt = Date.now();
  }
};

const deleteImageSession = (id: string) => {
  const idx = imageSessions.value.findIndex((s) => s.id === id);
  if (idx !== -1) {
    imageSessions.value.splice(idx, 1);
    if (activeImageSessionId.value === id) {
      activeImageSessionId.value = imageSessions.value[0]?.id || "";
    }
    showStatus("生图记录已删除");
  }
};

const renameImageSession = (id: string, newTitle: string) => {
  const session = imageSessions.value.find((s) => s.id === id);
  if (session) {
    session.title = newTitle;
    session.updatedAt = Date.now();
  }
};

const createNewImageSession = () => {
  const newSid = "img-" + Date.now();
  imageSessions.value.unshift({
    id: newSid,
    title: "新图片",
    prompt: "",
    imageUrl: "",
    originalImageUrl: "",
    updatedAt: Date.now(),
  });
  activeImageSessionId.value = newSid;
  showStatus("新画板已创建");
};

const generateImage = async () => {
  isLoading.value = true;
  imageUrl.value = "";
  originalImageUrl.value = "";
  try {
    const res = await gemini.generateImage(
      `${imagePrefix.value} ${imagePrompt.value}`,
      {
        useGreenScreen: useGreenScreen.value,
        chromaOptions: {
          tolerance: chromaTolerance.value,
          contiguous: isMattingContiguous.value,
          smoothing: chromaSmoothing.value,
          targetColor: chromaTargetColor.value,
          erosion: chromaErosion.value,
          feathering: chromaFeathering.value,
        },
      },
    );
    if (res.error) return showAlert(res.error);
    const newSid = "img-" + Date.now();
    const newSession = {
      id: newSid,
      title: imagePrompt.value.slice(0, 10) || "生图结果",
      prompt: imagePrompt.value,
      imageUrl: res.url,
      originalImageUrl: res.originalUrl || res.url,
      updatedAt: Date.now(),
    };
    imageSessions.value.unshift(newSession);
    activeImageSessionId.value = newSid;
    imageUrl.value = res.url;
    originalImageUrl.value = res.originalUrl || res.url;
    showStatus("图片生成成功");
  } finally {
    isLoading.value = false;
  }
};

// Viewer State & Logic
const viewerState = ref({
  original: { x: 0, y: 0, scale: 1 },
  processed: { x: 0, y: 0, scale: 1 },
});

const resetViewer = (type: "original" | "processed") => {
  viewerState.value[type] = { x: 0, y: 0, scale: 1 };
};

const handleZoom = (type: "original" | "processed", e: WheelEvent) => {
  e.preventDefault();
  const state = viewerState.value[type];
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  state.scale = Math.min(Math.max(state.scale * delta, 0.5), 10);
};

let isDragging = false;
let dragType: "original" | "processed" = "original";
let lastPos = { x: 0, y: 0 };

const startDrag = (type: "original" | "processed", e: MouseEvent) => {
  isDragging = true;
  dragType = type;
  lastPos = { x: e.clientX, y: e.clientY };
  window.addEventListener("mousemove", handleDrag);
  window.addEventListener("mouseup", stopDrag);
};

const handleDrag = (e: MouseEvent) => {
  if (!isDragging) return;
  const dx = e.clientX - lastPos.x;
  const dy = e.clientY - lastPos.y;
  const state = viewerState.value[dragType];
  state.x += dx;
  state.y += dy;
  lastPos = { x: e.clientX, y: e.clientY };
};

const stopDrag = () => {
  isDragging = false;
  window.removeEventListener("mousemove", handleDrag);
  window.removeEventListener("mouseup", stopDrag);
};

// Modal System
const modal = ref({
  show: false,
  title: "",
  message: "",
  inputValue: "",
  showInput: false,
  confirmText: "确定",
  cancelText: "取消",
  onConfirm: null as Function | null,
});

const exportTarget = ref<{ url: string; type: string } | null>(null);

const showAlert = (message: string) => {
  modal.value = {
    show: true,
    title: "系统提示",
    message,
    inputValue: "",
    showInput: false,
    confirmText: "我知道了",
    cancelText: "",
    onConfirm: () => (modal.value.show = false),
  };
};

const addTextPreset = () => {
  if (!textPrefix.value) return showAlert("当前预设内容为空");
  modal.value = {
    show: true,
    title: "保存文本预设",
    message: "请输入预设名称：",
    inputValue: "",
    showInput: true,
    confirmText: "保存",
    cancelText: "取消",
    onConfirm: () => {
      if (!modal.value.inputValue) return;
      textPresets.value.push({
        id: Date.now().toString(),
        name: modal.value.inputValue,
        prompt: textPrefix.value,
        isCustom: true,
      });
      modal.value.show = false;
      showStatus("预设已保存");
    },
  };
};

const addImagePreset = () => {
  if (!imagePrefix.value) return showAlert("当前风格预设为空");
  modal.value = {
    show: true,
    title: "保存画风预设",
    message: "请输入预设名称：",
    inputValue: "",
    showInput: true,
    confirmText: "保存",
    cancelText: "取消",
    onConfirm: () => {
      if (!modal.value.inputValue) return;
      imagePresets.value.push({
        id: Date.now().toString(),
        name: modal.value.inputValue,
        prompt: imagePrefix.value,
        isCustom: true,
      });
      modal.value.show = false;
      showStatus("画风预设已保存");
    },
  };
};

const removePreset = (type: "text" | "image", id: string) => {
  if (type === "text") {
    textPresets.value = textPresets.value.filter((p) => p.id !== id);
  } else {
    imagePresets.value = imagePresets.value.filter((p) => p.id !== id);
  }
  showStatus("预设已移除");
};

const isExportModal = ref(false);

const prepareExport = (url: string, type: string) => {
  exportTarget.value = { url, type };
  isExportModal.value = true;
};
</script>

<template>
  <div class="gemini-dashboard">
    <main class="content-wrapper">
      <!-- Text Assistant: Multi-Instance per Session -->
      <template v-if="activeTab === 'text'">
        <TextAssistant
          v-for="s in sessions"
          :key="s.id"
          v-show="s.id === activeSessionId"
          v-model:prefix="textPrefix"
          v-model:prompt="textPrompt"
          v-model:currentModel="textModel"
          v-model:activePresetId="textPresetId"
          :allModels="availableModels"
          :is-loading="isLoading"
          :chat-history="s.history"
          :sessions="sessions"
          :active-session-id="activeSessionId"
          :presets="textPresets"
          :current-cache-name="currentCacheName"
          :is-caching="isCaching"
          @generate="generateText"
          @follow-up="sendFollowUp"
          @create-cache="createConversationCache"
          @clear-cache="deleteCurrentCache"
          @clear-chat="clearChat"
          @delete-message="deleteChatMessage"
          @regenerate-message="regenerateMessage"
          @delete-session="deleteSession"
          @rename-session="renameSession"
          @new-session="createNewSession"
          @select-session="(id) => (activeSessionId = id)"
          @add-preset="addTextPreset"
          @remove-preset="(id) => removePreset('text', id)"
        />
        <!-- Text Empty State -->
        <TextAssistant
          v-if="sessions.length === 0"
          v-model:prefix="textPrefix"
          v-model:prompt="textPrompt"
          v-model:currentModel="textModel"
          v-model:activePresetId="textPresetId"
          :allModels="availableModels"
          :is-loading="isLoading"
          :chat-history="[]"
          :sessions="[]"
          active-session-id=""
          :presets="textPresets"
          @generate="generateText"
          @add-preset="addTextPreset"
          @remove-preset="(id) => removePreset('text', id)"
        />
      </template>

      <!-- Image Assistant: Multi-Instance per Session -->
      <template v-if="activeTab === 'image'">
        <ImageAssistant
          v-for="s in imageSessions"
          :key="s.id"
          v-show="s.id === activeImageSessionId"
          v-model:prefix="imagePrefix"
          v-model:prompt="imagePrompt"
          v-model:useGreenScreen="useGreenScreen"
          v-model:currentModel="imageModel"
          v-model:activePresetId="imagePresetId"
          v-model:tolerance="chromaTolerance"
          v-model:smoothing="chromaSmoothing"
          v-model:webpQuality="webpQuality"
          v-model:isContiguous="isMattingContiguous"
          v-model:targetColor="chromaTargetColor"
          v-model:erosion="chromaErosion"
          v-model:feathering="chromaFeathering"
          :allModels="availableModels"
          :presets="imagePresets"
          :is-loading="isLoading"
          :image-url="s.imageUrl"
          :original-image-url="s.originalImageUrl"
          :sessions="imageSessions"
          :active-session-id="activeImageSessionId"
          :viewer-state="viewerState"
          @generate="generateImage"
          @delete-session="deleteImageSession"
          @rename-session="renameImageSession"
          @select-session="(id) => (activeImageSessionId = id)"
          @new-session="createNewImageSession"
          @reset-viewer="resetViewer"
          @handle-zoom="handleZoom"
          @start-drag="startDrag"
          @add-preset="addImagePreset"
          @remove-preset="(id) => removePreset('image', id)"
          @prepare-webp="prepareExport"
          @update-matting="updateMatting"
        />
        <!-- Image Empty State -->
        <ImageAssistant
          v-if="imageSessions.length === 0"
          v-model:prefix="imagePrefix"
          v-model:prompt="imagePrompt"
          v-model:useGreenScreen="useGreenScreen"
          v-model:currentModel="imageModel"
          v-model:activePresetId="imagePresetId"
          v-model:tolerance="chromaTolerance"
          v-model:smoothing="chromaSmoothing"
          v-model:webpQuality="webpQuality"
          v-model:isContiguous="isMattingContiguous"
          v-model:targetColor="chromaTargetColor"
          v-model:erosion="chromaErosion"
          v-model:feathering="chromaFeathering"
          :allModels="availableModels"
          :presets="imagePresets"
          :is-loading="isLoading"
          image-url=""
          original-image-url=""
          :sessions="[]"
          active-session-id=""
          :viewer-state="viewerState"
          @generate="generateImage"
          @add-preset="addImagePreset"
          @remove-preset="(id) => removePreset('image', id)"
          @update-matting="updateMatting"
        />
      </template>

      <ImageProcessor
        v-if="activeTab === 'matting'"
        v-model:imageUrl="manualImageUrl"
        v-model:originalImageUrl="manualOriginalImageUrl"
        v-model:tolerance="chromaTolerance"
        v-model:smoothing="chromaSmoothing"
        v-model:webpQuality="webpQuality"
        v-model:isContiguous="isMattingContiguous"
        v-model:targetColor="chromaTargetColor"
        v-model:erosion="chromaErosion"
        v-model:feathering="chromaFeathering"
        :viewer-state="viewerState"
        @update-matting="updateMatting"
        @reset-viewer="resetViewer"
        @handle-zoom="handleZoom"
        @start-drag="startDrag"
        @prepare-webp="prepareExport"
        @reprocess="updateMatting"
      />

      <ConfigView
        v-if="activeTab === 'config'"
        v-model:apiKey="apiKey"
        v-model:apiBaseUrl="apiBaseUrl"
        :text-model="textModel"
        :image-model="imageModel"
        :models="availableModels"
        @save="saveConfig"
      />
    </main>

    <!-- Floating Neon Toast Notification -->
    <transition name="toast">
      <div v-if="statusMessage" class="status-toast">
        <div class="toast-content">
          <span class="status-pulse"></span>
          {{ statusMessage }}
        </div>
      </div>
    </transition>

    <GeminiModal
      :show="modal.show"
      :title="modal.title"
      :message="modal.message"
      v-model:modelValue="modal.inputValue"
      :show-input="modal.showInput"
      :confirm-text="modal.confirmText"
      :cancel-text="modal.cancelText"
      @close="modal.show = false"
      @confirm="modal.onConfirm?.()"
    />

    <ExportAssistant
      :show="isExportModal"
      :src="exportTarget?.url || ''"
      :type="exportTarget?.type || ''"
      :initial-quality="webpQuality"
      @close="isExportModal = false"
      @success="showStatus('导出成功')"
    />
  </div>
</template>

<style scoped>
.gemini-dashboard {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #fff;
  overflow: hidden;
}

.content-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.status-toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.4s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}
</style>
