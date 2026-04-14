<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay">
        <div class="modal-content glass-card">
          <div class="modal-header">
            <h3>{{ title }}</h3>
            <button class="close-modal-btn" @click="$emit('close')">×</button>
          </div>
          <div class="modal-body">
            <template v-if="!showInput">
              <p v-if="message">{{ message }}</p>
              <slot></slot>
            </template>
            <div v-else class="modal-input-wrapper">
              <input 
                :value="modelValue" 
                @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" 
                @keyup.enter="$emit('confirm')" 
                placeholder="在此输入..." 
                ref="inputRef"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button v-if="cancelText" class="btn btn-ghost" @click="$emit('close')">{{ cancelText }}</button>
            <button v-if="retryText" class="btn btn-accent" @click="$emit('retry')">{{ retryText }}</button>
            <button class="btn btn-primary btn-small" @click="$emit('confirm')">{{ confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  show: boolean
  title: string
  message?: string
  modelValue?: string
  showInput?: boolean
  confirmText?: string
  cancelText?: string
  retryText?: string
}>(), {
  confirmText: '确定',
  cancelText: '取消',
  showInput: false,
  retryText: ''
})

const emit = defineEmits(['close', 'confirm', 'retry', 'update:modelValue'])
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.show, (newVal) => {
  if (newVal && props.showInput) {
    nextTick(() => inputRef.value?.focus())
  }
})
</script>

<style scoped>
/* Modal component styles are now managed globally in src/style.css 
   to ensure system-wide consistency and avoid scoped conflicts. */
</style>
