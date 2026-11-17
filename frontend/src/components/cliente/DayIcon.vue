<script setup>
// Ícono animado según la franja del día: sunrise | noon | moon
defineProps({ tipo: { type: String, default: 'noon' } });

const rayos = (cx, cy, r1, r2, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i * 360) / n) * (Math.PI / 180);
    return {
      x1: cx + r1 * Math.cos(a),
      y1: cy + r1 * Math.sin(a),
      x2: cx + r2 * Math.cos(a),
      y2: cy + r2 * Math.sin(a),
    };
  });

const RAYOS_AMANECER = rayos(32, 36, 16, 24, 8);
const RAYOS_MEDIODIA = rayos(32, 32, 17, 27, 12);
const ESTRELLAS = [
  { x: 42, y: 13, d: '0s' },
  { x: 52, y: 25, d: '0.8s' },
  { x: 47, y: 36, d: '1.5s' },
];
</script>

<template>
  <div class="cl-dayicon">
    <!-- Amanecer -->
    <svg v-if="tipo === 'sunrise'" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id="cl-clip-horizonte"><rect x="0" y="0" width="64" height="46" /></clipPath>
      </defs>
      <g clip-path="url(#cl-clip-horizonte)">
        <g class="cl-a-sunrise">
          <g class="cl-svg-box cl-a-spin-slow" stroke="var(--accent-orange)" stroke-width="3" stroke-linecap="square">
            <line v-for="(r, i) in RAYOS_AMANECER" :key="i" v-bind="r" />
          </g>
          <circle
            class="cl-svg-box cl-a-breathe"
            cx="32"
            cy="36"
            r="10"
            fill="var(--accent-orange)"
            stroke="var(--accent-orange)"
            stroke-width="3"
          />
        </g>
      </g>
      <line x1="6" y1="46" x2="58" y2="46" stroke="var(--accent-orange)" stroke-width="3" stroke-linecap="square" />
      <line x1="16" y1="54" x2="48" y2="54" stroke="var(--accent-orange)" stroke-width="3" stroke-linecap="square" opacity="0.4" />
    </svg>

    <!-- Noche -->
    <svg v-else-if="tipo === 'moon'" viewBox="0 0 64 64" aria-hidden="true">
      <g class="cl-svg-box cl-a-sway">
        <path
          d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          transform="translate(8 8) scale(2)"
          fill="var(--accent-orange)"
          stroke="var(--accent-orange)"
          stroke-width="1.5"
          stroke-linejoin="miter"
        />
      </g>
      <rect
        v-for="s in ESTRELLAS"
        :key="s.x"
        class="cl-svg-box cl-a-twinkle"
        :x="s.x"
        :y="s.y"
        width="4"
        height="4"
        fill="var(--accent-orange)"
        :style="{ animationDelay: s.d }"
      />
    </svg>

    <!-- Mediodía / tarde -->
    <svg v-else viewBox="0 0 64 64" aria-hidden="true">
      <circle class="cl-svg-box cl-a-breathe" cx="32" cy="32" r="22" fill="var(--accent-orange)" opacity="0.22" />
      <g class="cl-svg-box cl-a-spin-med" stroke="var(--accent-orange)" stroke-width="3" stroke-linecap="square">
        <line v-for="(r, i) in RAYOS_MEDIODIA" :key="i" v-bind="r" />
      </g>
      <circle
        class="cl-svg-box cl-a-breathe"
        cx="32"
        cy="32"
        r="11"
        fill="var(--accent-orange)"
        stroke="var(--accent-orange)"
        stroke-width="3"
      />
    </svg>
  </div>
</template>
