<template>
  <div class="custom-dropdown-container">
    <div class="custom-dropdown-header" @click="toggle">
      <span>{{ selectedLabel }}</span>
      <i :class="{ rotate: isOpen }">▼</i>
    </div>
    
    <Transition name="dropdown">
      <div v-if="isOpen" class="custom-dropdown-list">
        <div 
          v-for="m in options" 
          :key="m.name" 
          class="dropdown-item" 
          :class="{ active: modelValue === m.name }"
          @click="select(m.name)"
        >
          {{ m.displayName }}
        </div>
        <div v-if="options.length === 0" class="dropdown-item disabled">暂无可用模型</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: string
  options: any[]
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)

const selectedLabel = computed(() => {
  if (!props.modelValue) return '请选择模型';
  const selected = props.options.find((m) => m.name === props.modelValue);
  if (selected) return selected.displayName;
  // 如果没找到（比如默认值尚未同步列表），则清洗掉 models/ 前缀
  return props.modelValue.replace('models/', '');
});

const toggle = () => {
  isOpen.value = !isOpen.value
}

const select = (val: string) => {
  emit('update:modelValue', val)
  isOpen.value = false
}

// Close on outside click
const closeDropdown = (e: MouseEvent) => {
  if (!(e.target as HTMLElement).closest('.custom-dropdown-container')) {
    isOpen.value = false
  }
}

onMounted(() => window.addEventListener('click', closeDropdown))
onUnmounted(() => window.removeEventListener('click', closeDropdown))
</script>

<style scoped>
.custom-dropdown-container {
  position: relative;
  width: 100%;
  z-index: 50;
}

.custom-dropdown-header {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  padding: 12px 16px;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.custom-dropdown-header:hover {
  border-color: rgba(0, 255, 242, 0.4);
  background: rgba(0, 0, 0, 0.3);
}

.custom-dropdown-header i {
  font-size: 0.7rem;
  transition: transform 0.3s;
  color: rgba(255, 255, 255, 0.4);
  font-style: normal;
}

.custom-dropdown-header i.rotate {
  transform: rotate(180deg);
}

.custom-dropdown-list {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #0d0d14;
  border: 1px solid rgba(0, 255, 242, 0.2);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  max-height: 280px;
  overflow-y: auto;
  z-index: 100;
}

.dropdown-item {
  padding: 12px 16px;
  color: #94a3b8;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.dropdown-item:hover {
  background: rgba(0, 255, 242, 0.1);
  color: #00fff2;
}

.dropdown-item.active {
  background: rgba(0, 255, 242, 0.15);
  color: #00fff2;
  font-weight: 600;
}

.dropdown-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Animation */
.dropdown-enter-active, .dropdown-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
