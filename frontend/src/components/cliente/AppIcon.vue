<script setup>
import { computed } from 'vue';

const props = defineProps({ name: { type: String, required: true } });

const PATHS = {
  swap: ['M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4'],
  plus: ['M12 5v14M5 12h14'],
  check: ['M5 13l4 4L19 7'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  back: ['M19 12H5M11 6l-6 6 6 6'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z', 'M12 9a3 3 0 100 6 3 3 0 000-6z'],
  eyeOff: [
    'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19',
    'M14.12 14.12a3 3 0 11-4.24-4.24',
    'M1 1l22 22',
  ],
};

const paths = computed(() => PATHS[props.name] ?? []);
</script>

<template>
  <svg
    class="cl-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="square"
    stroke-linejoin="miter"
    aria-hidden="true"
  >
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>
