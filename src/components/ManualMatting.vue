<script setup lang="ts">
import { ref } from "vue";
import MattingWorkspace from "./MattingWorkspace.vue";

const props = defineProps<{
  imageUrl: string;
  originalImageUrl: string;
  tolerance: number;
  smoothing: number;
  webpQuality: number;
  isContiguous: boolean;
  viewerState: any;
  targetColor: { r: number; g: number; b: number };
  erosion: number;
  feathering: number;
}>();

const emit = defineEmits([
  "update:imageUrl",
  "update:originalImageUrl",
  "update:tolerance",
  "update:smoothing",
  "update:webpQuality",
  "update:isContiguous",
  "update:targetColor",
  "update:erosion",
  "update:feathering",
  "update-matting",
  "reset-viewer",
  "handle-zoom",
  "start-drag",
  "prepare-webp",
  "reprocess",
]);

const fileInput = ref<HTMLInputElement | null>(null);
const triggerUpload = () => fileInput.value?.click();

const handleFile = (file: File) => {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const res = e.target?.result as string;
    emit("update:originalImageUrl", res);
    emit("update-matting");
  };
  reader.readAsDataURL(file);
};

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleFile(file);
};
</script>

<template>
  <div class="manual-matting">
    <div v-if="!originalImageUrl" class="upload-card" @click="triggerUpload">
      <div class="upload-icon-wrapper">📁</div>
      <h3>上传图片开始抠像</h3>
      <p>点击或拖拽文件到此处</p>
      <p class="upload-hint">支持 JPG, PNG, WebP 等通用图像格式</p>
      <input
        type="file"
        ref="fileInput"
        @change="onFileChange"
        accept="image/*"
        hidden
      />
    </div>

    <MattingWorkspace
      v-else
      :imageUrl="imageUrl"
      :originalImageUrl="originalImageUrl"
      :tolerance="tolerance"
      :smoothing="smoothing"
      :isContiguous="isContiguous"
      :targetColor="targetColor"
      :erosion="erosion"
      :feathering="feathering"
      :viewerState="viewerState"
      :showActions="true"
      @update:tolerance="$emit('update:tolerance', $event)"
      @update:targetColor="$emit('update:targetColor', $event)"
      @update:erosion="$emit('update:erosion', $event)"
      @update:feathering="$emit('update:feathering', $event)"
      @update:isContiguous="$emit('update:isContiguous', $event)"
      @update-matting="$emit('update-matting')"
      @reset-viewer="$emit('reset-viewer', $event)"
      @handle-zoom="(type, e) => $emit('handle-zoom', type, e)"
      @start-drag="(type, e) => $emit('start-drag', type, e)"
      @prepare-export="(url, type) => $emit('prepare-webp', url, type)"
    />
  </div>
</template>

<style scoped>
.manual-matting {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: radial-gradient(circle at center, rgba(0, 255, 242, 0.03) 0%, transparent 70%);
}

.upload-card {
  width: 520px;
  padding: 60px 40px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.upload-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 255, 242, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.4s;
}

.upload-card:hover {
  transform: translateY(-8px);
  border-color: rgba(0, 255, 242, 0.4);
  background: rgba(15, 23, 42, 0.8);
  box-shadow: 0 30px 60px rgba(0, 255, 242, 0.1);
}

.upload-card:hover::before {
  opacity: 1;
}

.upload-icon-wrapper {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  margin-bottom: 24px;
  transition: all 0.3s;
  z-index: 1;
}

.upload-card:hover .upload-icon-wrapper {
  transform: scale(1.1) rotate(5deg);
  background: rgba(0, 255, 242, 0.1);
  border-color: #00fff2;
  box-shadow: 0 0 20px rgba(0, 255, 242, 0.2);
}

.upload-card h3 {
  font-size: 1.25rem;
  color: #fff;
  margin: 0 0 8px 0;
  z-index: 1;
}

.upload-card p {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0;
  z-index: 1;
}

.upload-hint {
  margin-top: 32px !important;
  font-size: 0.75rem !important;
  color: rgba(148, 163, 184, 0.4) !important;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  z-index: 1;
}
</style>
