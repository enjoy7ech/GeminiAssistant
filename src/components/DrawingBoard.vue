<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";

const props = defineProps<{
  width?: number;
  height?: number;
  initialImage?: string;
  initialLayers?: any[]; // For persistent multi-layer editing
}>();

const emit = defineEmits(["confirm", "cancel", "update", "update:layers"]);

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  preview: string; // Base64 thumbnail string
}

const layers = ref<Layer[]>([]);
const activeLayerId = ref<string>("");

const activeLayer = computed(() =>
  layers.value.find((l) => l.id === activeLayerId.value),
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const compositionCtx = computed(() => canvasRef.value?.getContext("2d"));

const isDrawing = ref(false);
const brushColor = ref("#000000");
const brushSize = ref(2);
const tool = ref<"brush" | "eraser" | "rect" | "circle" | "select" | "fill">(
  "brush",
);

// History Management
const history = ref<ImageData[]>([]);
const redoStack = ref<ImageData[]>([]);

const canvasWidth = ref(1536);
const canvasHeight = ref(1536);
const viewZoom = ref(0.35);

let startPos = { x: 0, y: 0 };
let transformStart = { x: 0, y: 0, lx: 0, ly: 0, ls: 1 };
let snapshot: ImageData | null = null;

const cursorStyle = computed(() => {
  if (tool.value === "select") return "grab";
  if (tool.value === "fill") return "copy";
  if (!canvasRef.value) return "crosshair";
  const rect = canvasRef.value.getBoundingClientRect();
  const scale = rect.width / canvasRef.value.width;
  const visualSize = Math.max(brushSize.value * scale, 1);
  if (visualSize > 120 || tool.value === "rect" || tool.value === "circle")
    return "crosshair";

  const color = tool.value === "eraser" ? "%23ff5f56" : "%2300fff2";
  const dim = visualSize + 2;
  const center = dim / 2;
  const radius = visualSize / 2;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${dim}' height='${dim}' viewBox='0 0 ${dim} ${dim}'><circle cx='${center}' cy='${center}' r='${radius}' fill='none' stroke='${color}' stroke-width='1'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}") ${center} ${center}, crosshair`;
});

const getToolTitle = (tool: string) => {
  return tool === "select"
    ? "选择工具 (V)"
    : tool === "brush"
      ? "画笔工具 (B)"
      : tool === "fill"
        ? "填色工具 (G)"
        : tool === "eraser"
          ? "橡皮擦 (E)"
          : tool === "rect"
            ? "矩形工具 (R)"
            : tool === "circle"
              ? "圆形工具 (O)"
              : "";
};

const saveState = () => {
  if (!activeLayer.value) return;
  const layer = activeLayer.value;
  history.value.push(
    layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
  );
  if (history.value.length > 50) history.value.shift();
  redoStack.value = [];
};

const undo = () => {
  if (history.value.length === 0 || !activeLayer.value) return;
  const layer = activeLayer.value;
  const current = layer.ctx.getImageData(
    0,
    0,
    layer.canvas.width,
    layer.canvas.height,
  );
  redoStack.value.push(current);
  const prev = history.value.pop()!;
  layer.ctx.putImageData(prev, 0, 0);
  renderComposition();
};

const redo = () => {
  if (redoStack.value.length === 0 || !activeLayer.value) return;
  const layer = activeLayer.value;
  history.value.push(
    layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
  );
  const next = redoStack.value.pop()!;
  layer.ctx.putImageData(next, 0, 0);
  renderComposition();
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  // Only allow scaling the active layer when in select tool mode
  if (tool.value === "select" && activeLayer.value) {
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    updateLayerScale(
      activeLayer.value,
      Math.max(0.1, Math.min(10, activeLayer.value.scale + delta)),
    );
  }
};

const clearLayer = () => {
  if (activeLayer.value && canvasRef.value) {
    activeLayer.value.ctx.clearRect(
      0,
      0,
      activeLayer.value.canvas.width,
      activeLayer.value.canvas.height,
    );
    updatePreview(activeLayer.value);
    renderComposition();
  }
};

const updatePreview = (layer: Layer) => {
  // Create a miniature canvas that matches document aspect ratio
  const tempCanvas = document.createElement("canvas");
  const thumbW = 120;
  const thumbH = (canvasHeight.value / canvasWidth.value) * thumbW;
  tempCanvas.width = thumbW;
  tempCanvas.height = thumbH;

  const tCtx = tempCanvas.getContext("2d")!;
  const ratio = thumbW / canvasWidth.value;

  tCtx.imageSmoothingEnabled = true;
  // Draw with transforms to match the main canvas state
  tCtx.drawImage(
    layer.canvas,
    layer.x * ratio,
    layer.y * ratio,
    layer.canvas.width * layer.scale * ratio,
    layer.canvas.height * layer.scale * ratio,
  );

  layer.preview = tempCanvas.toDataURL("image/webp", 0.5);
};

const createLayer = (name = "新图层", image?: HTMLImageElement) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth.value;
  canvas.height = canvasHeight.value;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (image) {
    // Center the image. If it's smaller than the canvas, keep its natural size to allow edge editing.
    // If it's larger, scale it down to fit while maintaining aspect ratio.
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;
    const ratio = imageWidth / imageHeight;

    let dw = imageWidth;
    let dh = imageHeight;

    // Scale down only if larger than canvas
    if (dw > canvas.width || dh > canvas.height) {
      dw = canvas.width;
      dh = canvas.width / ratio;
      if (dh > canvas.height) {
        dh = canvas.height;
        dw = canvas.height * ratio;
      }
    }

    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;

    ctx.drawImage(image, dx, dy, dw, dh);
  }

  const layer: Layer = {
    id: "layer-" + Date.now() + Math.random(),
    name,
    visible: true,
    canvas,
    ctx,
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    preview: "",
  };

  updatePreview(layer);
  layers.value.push(layer);
  activeLayerId.value = layer.id;
  renderComposition();
  return layer;
};

const initCanvas = () => {
  layers.value = [];

  // If we have persistent layers, restore them first
  if (props.initialLayers && props.initialLayers.length > 0) {
    canvasWidth.value = props.width || 1536;
    canvasHeight.value = props.height || 1536;

    props.initialLayers.forEach((lData) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth.value;
      canvas.height = canvasHeight.value;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const layer: Layer = {
          ...lData,
          canvas,
          ctx,
        };
        layers.value.push(layer);
        renderComposition();
      };
      img.src = lData.data;
    });
    return;
  }

  if (props.initialImage) {
    const img = new Image();
    img.onload = () => createLayer("背景", img);
    img.src = props.initialImage;
  } else {
    createLayer("背景");
  }
};

const renderComposition = () => {
  if (!canvasRef.value || !compositionCtx.value) return;
  const cCtx = compositionCtx.value;
  cCtx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

  // Note: We don't fill a solid color here so the CSS checkered background is visible.

  layers.value.forEach((layer) => {
    if (!layer.visible) return;
    cCtx.globalAlpha = layer.opacity;
    cCtx.drawImage(
      layer.canvas,
      layer.x,
      layer.y,
      layer.canvas.width * layer.scale,
      layer.canvas.height * layer.scale,
    );
  });
  cCtx.globalAlpha = 1;
};

const getPos = (e: MouseEvent | TouchEvent) => {
  if (!canvasRef.value) return { x: 0, y: 0 };
  const rect = canvasRef.value.getBoundingClientRect();
  const clientX =
    "touches" in e
      ? (e as TouchEvent).touches[0].clientX
      : (e as MouseEvent).clientX;
  const clientY =
    "touches" in e
      ? (e as TouchEvent).touches[0].clientY
      : (e as MouseEvent).clientY;
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  return {
    x: cssX * (canvasRef.value.width / rect.width),
    y: cssY * (canvasRef.value.height / rect.height),
  };
};

const startDrawing = (e: MouseEvent | TouchEvent) => {
  const { x, y } = getPos(e);
  startPos = { x, y };

  if (tool.value === "select") {
    if (activeLayer.value) {
      transformStart = {
        x,
        y,
        lx: activeLayer.value.x,
        ly: activeLayer.value.y,
        ls: activeLayer.value.scale,
      };
      isDrawing.value = true;
    }
    return;
  }

  const layer = activeLayer.value;
  if (!layer || !layer.visible) return;

  saveState();
  isDrawing.value = true;

  // Calculate local coordinates relative to the layer's transform
  const lx = (x - layer.x) / layer.scale;
  const ly = (y - layer.y) / layer.scale;

  if (tool.value === "fill") {
    layer.ctx.save();
    // Use clearRect + fillRect to ensure total coverage or use fillRect depending on composite
    layer.ctx.fillStyle = brushColor.value;
    layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
    layer.ctx.restore();
    isDrawing.value = false;
    updatePreview(layer);
    renderComposition();
    emitImage();
    return;
  }

  if (tool.value === "rect" || tool.value === "circle") {
    snapshot = layer.ctx.getImageData(
      0,
      0,
      layer.canvas.width,
      layer.canvas.height,
    );
  }

  layer.ctx.lineWidth = brushSize.value / layer.scale;
  layer.ctx.strokeStyle = tool.value === "eraser" ? "#000" : brushColor.value;
  layer.ctx.fillStyle = tool.value === "eraser" ? "#000" : brushColor.value;
  layer.ctx.globalCompositeOperation =
    tool.value === "eraser" ? "destination-out" : "source-over";

  if (tool.value === "brush" || tool.value === "eraser") {
    layer.ctx.beginPath();
    layer.ctx.moveTo(lx, ly);
  }
};

const draw = (e: MouseEvent | TouchEvent) => {
  if (!isDrawing.value || !activeLayer.value) return;
  e.preventDefault();
  const { x, y } = getPos(e);
  const layer = activeLayer.value;
  if (tool.value === "select") {
    layer.x = transformStart.lx + (x - transformStart.x);
    layer.y = transformStart.ly + (y - transformStart.y);
    renderComposition();
    return;
  }
  const lx = (x - layer.x) / layer.scale;
  const ly = (y - layer.y) / layer.scale;
  const slx = (startPos.x - layer.x) / layer.scale;
  const sly = (startPos.y - layer.y) / layer.scale;
  if (tool.value === "brush" || tool.value === "eraser") {
    layer.ctx.lineTo(lx, ly);
    layer.ctx.stroke();
  } else if (tool.value === "rect" && snapshot) {
    layer.ctx.putImageData(snapshot, 0, 0);
    layer.ctx.strokeRect(slx, sly, lx - slx, ly - sly);
  } else if (tool.value === "circle" && snapshot) {
    layer.ctx.putImageData(snapshot, 0, 0);
    layer.ctx.beginPath();
    layer.ctx.arc(
      slx,
      sly,
      Math.sqrt(Math.pow(lx - slx, 2) + Math.pow(ly - sly, 2)),
      0,
      2 * Math.PI,
    );
    layer.ctx.stroke();
  }
  renderComposition();
};

const stopDrawing = () => {
  if (!isDrawing.value) return;
  isDrawing.value = false;
  if (
    activeLayer.value?.ctx &&
    (tool.value === "brush" || tool.value === "eraser")
  )
    activeLayer.value.ctx.closePath();
  if (activeLayer.value) updatePreview(activeLayer.value);
  snapshot = null;
  renderComposition();
};

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
};

// Layer Drag & Drop Logic
const draggedIdx = ref<number | null>(null);
const dragOverIdx = ref<number | null>(null);
const dropSide = ref<"top" | "bottom" | null>(null);
const activePopoverId = ref<string | null>(null);
const popoverStyle = ref({ top: "0px", left: "0px" });

const togglePopover = (e: MouseEvent, id: string) => {
  if (activePopoverId.value === id) {
    activePopoverId.value = null;
  } else {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    popoverStyle.value = {
      top: `${rect.top - 12}px`,
      left: `${rect.right}px`,
    };
    activePopoverId.value = id;
  }
};

const updateLayerScale = (layer: any, newScale: number) => {
  const oldScale = layer.scale;
  const centerX = layer.x + (layer.canvas.width * oldScale) / 2;
  const centerY = layer.y + (layer.canvas.height * oldScale) / 2;

  layer.scale = newScale;
  layer.x = centerX - (layer.canvas.width * newScale) / 2;
  layer.y = centerY - (layer.canvas.height * newScale) / 2;

  renderComposition();
};

const onDragStart = (idx: number) => {
  draggedIdx.value = idx;
};

const onDragOver = (e: DragEvent, idx: number) => {
  e.preventDefault();
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const relY = e.clientY - rect.top;
  dropSide.value = relY < rect.height / 2 ? "top" : "bottom";
  dragOverIdx.value = idx;
};

const onDragOverContainer = (e: DragEvent) => {
  e.preventDefault();
  if (draggedIdx.value !== null) {
    // If not hovering over any item, default to placing at the very bottom
    if (e.target === e.currentTarget) {
      dragOverIdx.value = 0;
      dropSide.value = "bottom";
    }
  }
};

const onDragEnd = () => {
  // Use a slight delay to ensure 'drop' has finished
  setTimeout(() => {
    draggedIdx.value = null;
    dragOverIdx.value = null;
    dropSide.value = null;
  }, 50);
};

const performMove = () => {
  if (
    draggedIdx.value === null ||
    dragOverIdx.value === null ||
    dropSide.value === null
  ) {
    onDragEnd();
    return;
  }

  const from = draggedIdx.value;
  const targetIdx = dragOverIdx.value;
  const temp = [...layers.value];
  const movingItem = temp[from];

  temp.splice(from, 1);

  let baseInsertIdx = targetIdx;
  if (from < targetIdx) {
    baseInsertIdx = targetIdx - 1;
  }

  let finalIdx = dropSide.value === "top" ? baseInsertIdx + 1 : baseInsertIdx;

  temp.splice(Math.max(0, Math.min(temp.length, finalIdx)), 0, movingItem);
  layers.value = temp;

  onDragEnd();
  renderComposition();
};

const onDropContainer = () => {
  // In the container, if we have a valid dragOver state, just move it there.
  if (draggedIdx.value !== null && dragOverIdx.value !== null) {
    performMove();
  }
};

const emitImage = (isConfirm = false) => {
  if (!canvasRef.value) return;
  const dataUrl = canvasRef.value.toDataURL("image/png");
  if (isConfirm) {
    // Serialize ALL layers for persistence
    const serializedLayers = layers.value.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      x: l.x,
      y: l.y,
      scale: l.scale,
      opacity: l.opacity,
      preview: l.preview,
      data: l.canvas.toDataURL("image/png"),
    }));
    emit("confirm", dataUrl, serializedLayers);
  } else {
    emit("update", dataUrl);
  }
};

onMounted(() => {
  initCanvas();
  window.addEventListener("mouseup", stopDrawing);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("mousedown", closePopoversOutside);
  if (canvasRef.value)
    new ResizeObserver(() => renderComposition()).observe(canvasRef.value);
});

onUnmounted(() => {
  window.removeEventListener("mouseup", stopDrawing);
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("mousedown", closePopoversOutside);
});

const closePopoversOutside = (e: MouseEvent) => {
  if (activePopoverId.value && !(e.target as HTMLElement).closest(".layer-settings-popover")) {
    activePopoverId.value = null;
  }
};
</script>

<template>
  <div class="flex flex-col gap-3 w-full h-full text-slate-300">
    <!-- Top Compact Toolbar -->
    <div
      class="flex items-center justify-between p-1.5 bg-white/5 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl"
    >
      <div class="flex items-center gap-1">
        <div
          class="flex bg-white/5 rounded-lg p-0.5 gap-0.5 border border-white/10"
        >
          <button
            @click="undo"
            :disabled="history.length === 0"
            title="撤销 (Ctrl+Z)"
            class="p-2 rounded-md transition-all hover:bg-white/10 disabled:opacity-10 text-white/70 hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
              />
            </svg>
          </button>
          <button
            @click="redo"
            :disabled="redoStack.length === 0"
            title="重做 (Ctrl+Shift+Z)"
            class="p-2 rounded-md transition-all hover:bg-white/10 disabled:opacity-10 text-white/70 hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
              />
            </svg>
          </button>
        </div>

        <div
          class="flex bg-white/5 rounded-lg p-0.5 gap-0.5 border border-white/10"
        >
          <button
            v-for="t in ['select', 'brush', 'fill', 'eraser', 'rect', 'circle']"
            :key="t"
            @click="tool = t as any"
            :title="getToolTitle(t)"
            :class="[
              'p-2 rounded-md transition-all',
              tool === t
                ? 'bg-primary-cyan text-black shadow-lg shadow-primary-cyan/40 scale-105'
                : 'hover:bg-white/10 text-white/60 hover:text-white',
            ]"
          >
            <template v-if="t === 'select'"
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M11 13H5.875l1.1 1.075q.3.3.3.725t-.3.725t-.725.3t-.725-.3L2.7 12.7q-.15-.15-.213-.325T2.426 12t.063-.375t.212-.325l2.825-2.825q.3-.3.713-.3t.712.3t.3.713t-.3.712L5.85 11H11V5.85L9.875 6.975q-.3.3-.7.288t-.7-.313t-.3-.712t.3-.713L11.3 2.7q.15-.15.325-.213T12 2.425t.375.062t.325.213l2.85 2.85q.3.3.3.7t-.3.7t-.713.3t-.712-.3L13 5.85V11h5.125l-1.1-1.075q-.3-.3-.3-.725t.3-.725t.725-.3t.725.3L21.3 11.3q.15.15.213.325t.062.375t-.062.375t-.213.325l-2.85 2.85q-.3.3-.7.288t-.7-.313t-.3-.712t.3-.713l1.1-1.1H13v5.125l1.075-1.1q.3-.3.725-.3t.725.3t.3.725t-.3.725L12.7 21.3q-.15.15-.325.213t-.375.062t-.375-.062t-.325-.213l-2.85-2.85q-.3-.3-.287-.712t.312-.713t.713-.3t.712.3L11 18.15z"
                /></svg
            ></template>
            <template v-if="t === 'brush'"
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="1.5"
                  d="m14.36 4.079l.927-.927a3.932 3.932 0 0 1 5.561 5.561l-.927.927m-5.56-5.561s.115 1.97 1.853 3.707C17.952 9.524 19.92 9.64 19.92 9.64m-5.56-5.561L12 6.439m7.921 3.2l-5.26 5.262L11.56 18l-.16.161c-.578.577-.867.866-1.185 1.114a6.6 6.6 0 0 1-1.211.749c-.364.173-.751.302-1.526.56l-3.281 1.094m0 0l-.802.268a1.06 1.06 0 0 1-1.342-1.342l.268-.802m1.876 1.876l-1.876-1.876m0 0l1.094-3.281c.258-.775.387-1.162.56-1.526q.309-.647.749-1.211c.248-.318.537-.607 1.114-1.184L8.5 9.939"
                /></svg
            ></template>
            <template v-if="t === 'fill'"
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <g
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                >
                  <path
                    d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"
                  />
                  <path
                    d="M19 6h1a2 2 0 0 1 2 2a5 5 0 0 1-5 5h-5v2m-2 1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"
                  />
                </g></svg
            ></template>
            <template v-if="t === 'eraser'"
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="-1.5 -2.5 24 24"
              >
                <path
                  fill="currentColor"
                  d="M12.728 12.728L8.485 8.485l-5.657 5.657l2.122 2.121a3 3 0 0 0 4.242 0zM11.284 17H14a1 1 0 0 1 0 2H3a1 1 0 0 1-.133-1.991l-1.453-1.453a2 2 0 0 1 0-2.828L12.728 1.414a2 2 0 0 1 2.828 0L19.8 5.657a2 2 0 0 1 0 2.828z"
                /></svg
            ></template>
            <template v-if="t === 'rect'"
              ><svg viewBox="0 0 24 24" width="18" height="18">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="1.5"
                  ry="1.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                /></svg
            ></template>
            <template v-if="t === 'circle'"
              ><svg viewBox="0 0 24 24" width="18" height="18">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                /></svg
            ></template>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 shrink-0 shadow-lg"
        >
          <div
            class="w-5 h-5 rounded-md border border-white/20 relative cursor-pointer shadow-inner overflow-hidden shrink-0"
            :style="{ background: brushColor }"
          >
            <input
              type="color"
              v-model="brushColor"
              class="absolute -inset-1 w-[150%] h-[150%] opacity-0 cursor-pointer pointer-events-auto"
            />
          </div>
          <div class="flex items-center gap-2">
            <input
              type="range"
              v-model.number="brushSize"
              min="1"
              max="100"
              class="w-20 h-1 accent-primary-cyan appearance-none bg-white/10 rounded-full outline-none"
            />
            <span
              class="text-[10px] w-8 text-white/70 font-mono tracking-tighter"
              >{{ brushSize }}px</span
            >
          </div>
        </div>
        <button
          @click="createLayer()"
          class="px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-[10px] flex items-center gap-1 transition-colors text-white/80"
        >
          📄<span class="text-white/60 text-[10px]">新建图层</span>
        </button>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex gap-4 h-[550px]">
      <!-- Canvas Area -->
      <div
        class="flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center p-4 relative shadow-inner"
      >
        <div
          class="canvas-container relative shadow-2xl overflow-visible rounded-lg canvas-checkered flex items-center justify-center translate-z-0"
          :style="{
            width: canvasWidth + 'px',
            height: canvasHeight + 'px',
            transform: `scale(${viewZoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out',
          }"
          @wheel="handleWheel"
        >
          <canvas
            ref="canvasRef"
            :width="canvasWidth"
            :height="canvasHeight"
            class="block"
            :style="{ cursor: cursorStyle }"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @touchstart="startDrawing"
            @touchmove="draw"
            @touchend="stopDrawing"
          />
        </div>
      </div>

      <!-- Compact Layer List -->
      <div
        class="w-60 flex flex-col bg-slate-900/30 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden"
      >
        <div
          class="p-3 border-bottom border-white/5 text-[10px] uppercase tracking-widest font-bold opacity-30 text-center"
        >
          图层管理器
        </div>
        <div
          class="flex-1 overflow-y-auto p-2 flex flex-col gap-2"
          @dragover="onDragOverContainer"
          @dragend="onDragEnd"
          @drop.prevent="onDropContainer"
        >
          <div
            v-for="(l, i) in layers.slice().reverse()"
            :key="l.id"
            draggable="true"
            @dragstart="onDragStart(layers.length - 1 - i)"
            @dragover="onDragOver($event, layers.length - 1 - i)"
            @click="activeLayerId = l.id"
            :class="[
              'flex flex-col gap-2 p-2 rounded-xl transition-all border outline-none cursor-move relative group',
              draggedIdx === layers.length - 1 - i
                ? 'opacity-20 scale-95 blur-[1px]'
                : '',
              dragOverIdx === layers.length - 1 - i &&
              draggedIdx !== layers.length - 1 - i
                ? 'border-primary-cyan/50 shadow-[0_0_15px_rgba(0,255,242,0.1)]'
                : 'border-transparent',
              activeLayerId === l.id && draggedIdx === null
                ? 'bg-primary-cyan/10 border-primary-cyan/30 shadow-inner'
                : 'bg-white/[0.02] hover:bg-white/[0.05]',
            ]"
          >
            <!-- Professional Insertion Tip -->
            <div
              v-if="
                dragOverIdx === layers.length - 1 - i &&
                draggedIdx !== layers.length - 1 - i
              "
              class="absolute left-0 right-0 h-1 bg-primary-cyan shadow-[0_0_12px_rgba(0,255,242,1)] z-20 pointer-events-none transition-all"
              :class="dropSide === 'top' ? '-top-1' : '-bottom-1'"
            >
              <div
                class="absolute -left-1 -top-[3px] w-2.5 h-2.5 bg-primary-cyan rounded-full shadow-[0_0_8px_rgba(0,255,242,1)]"
              ></div>
            </div>

            <div class="flex items-center gap-2 relative z-10">
              <button
                @click.stop="
                  l.visible = !l.visible;
                  renderComposition();
                "
                class="opacity-50 hover:opacity-100 transition-opacity"
              >
                {{ l.visible ? "👁️" : "🕶️" }}
              </button>
              <div
                class="w-8 h-8 rounded border border-white/10 bg-black/40 overflow-hidden shrink-0 flex items-center justify-center relative"
                style="
                  background-image: repeating-conic-gradient(
                    #333 0% 25%,
                    #222 0% 50%
                  );
                  background-size: 8px 8px;
                "
              >
                <img
                  :src="l.preview"
                  class="w-full h-full object-contain pointer-events-none shadow-sm"
                />
              </div>
              <span class="flex-1 text-[11px] truncate font-medium">{{
                l.name
              }}</span>
              
              <div class="relative layer-settings-popover">
                <button
                  @click.stop="togglePopover($event, l.id)"
                  class="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                  :class="{ 'text-primary-cyan opacity-100': activePopoverId === l.id }"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>

                <!-- Floating Settings Popover (Teleported to avoid overflow-hidden clipping) -->
                <teleport to="body">
                  <div
                    v-if="activePopoverId === l.id"
                    class="fixed w-48 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl p-3 z-[10001] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 layer-settings-popover"
                    :style="{
                      top: popoverStyle.top,
                      left: popoverStyle.left,
                      transform: 'translate(-100%, -100%)',
                    }"
                    @click.stop
                    @mousedown.stop
                    @touchstart.stop
                    @dragstart.stop
                  >
                    <div class="flex flex-col gap-1.5">
                      <div class="flex justify-between text-[10px] uppercase font-bold text-white/40">
                        <span>不透明度</span>
                        <span class="text-primary-cyan">{{ Math.round(l.opacity * 100) }}%</span>
                      </div>
                      <input
                        type="range"
                        v-model.number="l.opacity"
                        min="0"
                        max="1"
                        step="0.05"
                        @input="renderComposition"
                        @mousedown.stop
                        @touchstart.stop
                        @dragstart.stop
                        class="w-full accent-primary-cyan h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <div class="flex justify-between text-[10px] uppercase font-bold text-white/40">
                        <span>缩放比例</span>
                        <span class="text-primary-cyan">{{ (l.scale * 100).toFixed(0) }}%</span>
                      </div>
                      <input
                        type="range"
                        :value="l.scale"
                        min="0.1"
                        max="5"
                        step="0.05"
                        @input="updateLayerScale(l, Number(($event.target as HTMLInputElement).value))"
                        @mousedown.stop
                        @touchstart.stop
                        @dragstart.stop
                        class="w-full accent-primary-cyan h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                      <button
                        @click="
                          l.x = (canvasWidth - l.canvas.width * l.scale) / 2;
                          l.y = (canvasHeight - l.canvas.height * l.scale) / 2;
                          renderComposition();
                        "
                        class="mt-1 text-[9px] bg-white/5 py-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                      >
                        居中对齐
                      </button>
                    </div>

                    <div class="h-px bg-white/5 my-0.5"></div>

                    <button
                      @click="clearLayer"
                      class="w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] rounded-lg transition-all border border-red-500/10"
                    >
                      清空图层
                    </button>
                  </div>
                </teleport>
              </div>

              <button
                @click.stop="
                  layers = layers.filter((x) => x.id !== l.id);
                  renderComposition();
                "
                class="text-xs text-red-400/50 hover:text-red-400"
              >
                ×
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end pt-2 border-t border-white/5">
      <div class="flex gap-2">
        <button
          @click="$emit('cancel')"
          class="px-6 py-2 bg-white/5 hover:bg-white/10 text-xs rounded-xl transition-all border border-white/10"
        >
          取消
        </button>
        <button
          @click="emitImage(true)"
          class="px-8 py-2 bg-primary-cyan text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-primary-cyan/20 hover:scale-105 active:scale-95"
        >
          确认插入
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-checkered {
  background-image:
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: #ffffff;
}

/* Range Slider Custom Styling */
input[type="range"] {
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.05);
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 8px;
  width: 8px;
  border-radius: 50%;
  background: currentColor;
  cursor: pointer;
}
</style>
