<template>
  <section class="center-command">
    <header class="hub-header">
      <div class="hub-topline">
        <p class="hub-eyebrow">Center Command</p>
        <slot name="pills" />
      </div>

      <div class="hub-main-row">
        <div class="hub-copy-block">
          <div class="hub-title-row">
            <span
              class="hub-player-mark"
              :style="currentPlayerColor ? { '--player-color': currentPlayerColor } : undefined"
            />
            <div class="hub-title-copy">
              <p class="hub-status">{{ statusLine }}</p>
              <h2>{{ heading }}</h2>
            </div>
          </div>

          <p class="hub-description">{{ description }}</p>
        </div>

        <div class="dice-anchor">
          <div
            class="dice-container"
            :class="{
              'dice-container--anticipating': visualPhase === 'anticipating',
              'dice-container--rolling': visualPhase === 'rolling',
              'dice-container--settling': visualPhase === 'settling',
              'dice-container--result': visualPhase === 'result',
            }"
          >
            <div class="dice-pair">
              <div class="dice-scene">
                <div ref="leftShadow" class="die-shadow die-shadow--left" />
                <div ref="leftDie" class="die die--left" :style="leftStyle">
                  <div v-for="face in faces" :key="`left-${face.value}`" class="die-face" :class="`die-face--${face.name}`">
                    <span
                      v-for="pip in face.pips"
                      :key="`${face.value}-${pip}`"
                      class="pip"
                      :class="`pip--${pip}`"
                    />
                  </div>
                </div>
              </div>

              <div class="dice-scene">
                <div ref="rightShadow" class="die-shadow die-shadow--right" />
                <div ref="rightDie" class="die die--right" :style="rightStyle">
                  <div v-for="face in faces" :key="`right-${face.value}`" class="die-face" :class="`die-face--${face.name}`">
                    <span
                      v-for="pip in face.pips"
                      :key="`${face.value}-${pip}`"
                      class="pip"
                      :class="`pip--${pip}`"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div
      v-if="activeTileName || activeTilePrice !== null"
      class="hub-tile"
    >
      <span v-if="activeTileName" class="hub-tile-name">{{ activeTileName }}</span>
      <span v-if="activeTilePrice !== null" class="hub-tile-price">${{ activeTilePrice }}</span>
    </div>

    <div class="hub-actions">
      <slot name="actions" />
    </div>

    <div v-if="$slots.details" class="hub-details">
      <slot name="details" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;
type DiceResult = [number, number] | null;
type PipPosition = 'tl' | 'tc' | 'tr' | 'cl' | 'cc' | 'cr' | 'bl' | 'bc' | 'br';

interface FaceDefinition {
  value: DiceValue;
  name: 'front' | 'right' | 'top' | 'bottom' | 'left' | 'back';
  pips: PipPosition[];
}

interface RotationState {
  x: number;
  y: number;
  z: number;
}

const props = withDefaults(
  defineProps<{
    heading: string;
    statusLine: string;
    description: string;
    currentPlayerColor?: string | null;
    activeTileName?: string | null;
    activeTileType?: string | null;
    activeTilePrice?: number | null;
    diceResult?: DiceResult;
    diceRollKey?: number;
    rolling?: boolean;
    resolving?: boolean;
  }>(),
  {
    currentPlayerColor: null,
    activeTileName: null,
    activeTileType: null,
    activeTilePrice: null,
    diceResult: null,
    diceRollKey: 0,
    rolling: false,
    resolving: false,
  },
);

const emit = defineEmits<{
  settled: [];
}>();

type DiceVisualPhase = 'idle' | 'anticipating' | 'rolling' | 'settling' | 'result';

const ROLL_DURATION_MS = 1880;
const SETTLING_PHASE_AT_MS = 1320;
const RESULT_WAIT_TIMEOUT_MS = 3000;
const ROLL_WATCHDOG_MARGIN_MS = 700;

const faces: FaceDefinition[] = [
  { value: 1, name: 'front', pips: ['cc'] },
  { value: 2, name: 'right', pips: ['tl', 'br'] },
  { value: 3, name: 'top', pips: ['tl', 'cc', 'br'] },
  { value: 4, name: 'bottom', pips: ['tl', 'tr', 'bl', 'br'] },
  { value: 5, name: 'left', pips: ['tl', 'tr', 'cc', 'bl', 'br'] },
  { value: 6, name: 'back', pips: ['tl', 'tr', 'cl', 'cr', 'bl', 'br'] },
];

const FACE_ROTATIONS: Record<DiceValue, RotationState> = {
  1: { x: 0, y: 0, z: 0 },
  2: { x: 0, y: -90, z: 0 },
  3: { x: 90, y: 0, z: 0 },
  4: { x: -90, y: 0, z: 0 },
  5: { x: 0, y: 90, z: 0 },
  6: { x: 0, y: 180, z: 0 },
};

const idleLeft: RotationState = { x: -18, y: 24, z: -6 };
const idleRight: RotationState = { x: -14, y: -28, z: 8 };

const leftRotation = ref<RotationState>({ ...idleLeft });
const rightRotation = ref<RotationState>({ ...idleRight });
const leftDie = ref<HTMLElement | null>(null);
const rightDie = ref<HTMLElement | null>(null);
const leftShadow = ref<HTMLElement | null>(null);
const rightShadow = ref<HTMLElement | null>(null);
const visualPhase = ref<DiceVisualPhase>('idle');
const pendingResult = ref<DiceResult>(null);

let activeRollKey: number | null = null;
let playedResultKey: number | null = null;
let activeAnimations: Animation[] = [];
let phaseTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const toTransform = (rotation: RotationState): string =>
  `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`;

const toAnimatedTransform = (
  rotation: RotationState,
  driftX = 0,
  liftY = 0,
  scale = 1,
): string =>
  `translate3d(${driftX}px, ${liftY}px, 0) ${toTransform(rotation)} scale3d(${scale}, ${scale}, ${scale})`;

const leftStyle = computed(() => ({
  transform: toTransform(leftRotation.value),
}));

const rightStyle = computed(() => ({
  transform: toTransform(rightRotation.value),
}));

const cancelAnimations = (): void => {
  for (const animation of activeAnimations) {
    animation.cancel();
  }
  activeAnimations = [];
};

const clearTimers = (): void => {
  if (phaseTimer) {
    clearTimeout(phaseTimer);
    phaseTimer = null;
  }
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
};

const resetToIdle = (): void => {
  clearTimers();
  cancelAnimations();
  activeRollKey = null;
  playedResultKey = null;
  visualPhase.value = 'idle';
  pendingResult.value = null;
  leftRotation.value = { ...idleLeft };
  rightRotation.value = { ...idleRight };
};

const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

const getSettledRotation = (
  current: RotationState,
  face: number,
  turns: RotationState,
): RotationState => {
  const target = FACE_ROTATIONS[face as DiceValue] ?? FACE_ROTATIONS[1];
  return {
    x: current.x + turns.x * 360 + modulo(target.x - modulo(current.x, 360), 360),
    y: current.y + turns.y * 360 + modulo(target.y - modulo(current.y, 360), 360),
    z: current.z + turns.z * 360 + modulo(target.z - modulo(current.z, 360), 360),
  };
};

const interpolateRotation = (
  start: RotationState,
  target: RotationState,
  progress: number,
  wobble: RotationState = { x: 0, y: 0, z: 0 },
): RotationState => ({
  x: start.x + (target.x - start.x) * progress + wobble.x,
  y: start.y + (target.y - start.y) * progress + wobble.y,
  z: start.z + (target.z - start.z) * progress + wobble.z,
});

const buildRollKeyframes = (
  start: RotationState,
  target: RotationState,
  direction: -1 | 1,
): Keyframe[] => [
  {
    offset: 0,
    transform: toAnimatedTransform(start),
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  {
    offset: 0.1,
    transform: toAnimatedTransform(
      interpolateRotation(start, target, 0.1, { x: 18 * direction, y: -24 * direction, z: 14 }),
      -3 * direction,
      -7,
      1.035,
    ),
    easing: 'linear',
  },
  {
    offset: 0.32,
    transform: toAnimatedTransform(
      interpolateRotation(start, target, 0.34, { x: -26 * direction, y: 34 * direction, z: -18 }),
      4 * direction,
      -11,
      1.05,
    ),
    easing: 'linear',
  },
  {
    offset: 0.58,
    transform: toAnimatedTransform(
      interpolateRotation(start, target, 0.66, { x: 22 * direction, y: -28 * direction, z: 16 }),
      -4 * direction,
      -8,
      1.035,
    ),
    easing: 'linear',
  },
  {
    offset: 0.78,
    transform: toAnimatedTransform(
      interpolateRotation(start, target, 0.88, { x: -10 * direction, y: 14 * direction, z: -7 }),
      2 * direction,
      -4,
      1.015,
    ),
    easing: 'cubic-bezier(0.16, 0.78, 0.22, 1)',
  },
  {
    offset: 0.91,
    transform: toAnimatedTransform(target, 0, 2, 0.965),
    easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
  },
  {
    offset: 0.965,
    transform: toAnimatedTransform(target, 0, -1.2, 1.012),
    easing: 'ease-out',
  },
  {
    offset: 1,
    transform: toAnimatedTransform(target),
  },
];

const buildShadowKeyframes = (direction: -1 | 1): Keyframe[] => [
  { offset: 0, opacity: 0.48, transform: 'translateY(4px) scaleX(0.96)' },
  { offset: 0.12, opacity: 0.22, transform: `translate(${2 * direction}px, 5px) scaleX(0.72)` },
  { offset: 0.42, opacity: 0.16, transform: `translate(${-3 * direction}px, 6px) scaleX(0.62)` },
  { offset: 0.78, opacity: 0.3, transform: `translate(${direction}px, 5px) scaleX(0.82)` },
  { offset: 0.91, opacity: 0.62, transform: 'translateY(2px) scaleX(1.08)' },
  { offset: 1, opacity: 0.48, transform: 'translateY(4px) scaleX(0.96)' },
];

const animateElement = (
  element: HTMLElement | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): void => {
  if (!element?.animate) return;
  activeAnimations.push(element.animate(keyframes, options));
};

const startAnticipation = (key: number): void => {
  clearTimers();
  cancelAnimations();
  activeRollKey = key;
  playedResultKey = null;
  pendingResult.value = null;
  visualPhase.value = 'anticipating';

  if (!prefersReducedMotion) {
    animateElement(
      leftDie.value,
      [
        { transform: toAnimatedTransform(leftRotation.value) },
        { transform: toAnimatedTransform({ ...leftRotation.value, z: leftRotation.value.z - 3 }, -1, -2.5, 1.015) },
      ],
      { duration: 240, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
    );
    animateElement(
      rightDie.value,
      [
        { transform: toAnimatedTransform(rightRotation.value) },
        { transform: toAnimatedTransform({ ...rightRotation.value, z: rightRotation.value.z + 3 }, 1, -2.5, 1.015) },
      ],
      { duration: 260, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
    );
  }

  watchdogTimer = setTimeout(() => {
    if (activeRollKey !== key || pendingResult.value) return;
    resetToIdle();
    emit('settled');
  }, RESULT_WAIT_TIMEOUT_MS);
};

const finishRoll = (
  key: number,
  leftTarget: RotationState,
  rightTarget: RotationState,
): void => {
  if (activeRollKey !== key) return;

  clearTimers();
  leftRotation.value = leftTarget;
  rightRotation.value = rightTarget;
  if (leftDie.value) leftDie.value.style.transform = toTransform(leftTarget);
  if (rightDie.value) rightDie.value.style.transform = toTransform(rightTarget);
  cancelAnimations();
  pendingResult.value = null;
  visualPhase.value = 'result';
  emit('settled');
};

const playResolvedRoll = (key: number, result: [number, number]): void => {
  if (playedResultKey === key) return;
  if (activeRollKey !== key) {
    startAnticipation(key);
  }

  playedResultKey = key;
  pendingResult.value = result;
  clearTimers();
  cancelAnimations();
  visualPhase.value = 'rolling';

  const duration = prefersReducedMotion ? 260 : ROLL_DURATION_MS;
  const settlingAt = prefersReducedMotion ? 150 : SETTLING_PHASE_AT_MS;
  const leftStart = { ...leftRotation.value };
  const rightStart = { ...rightRotation.value };
  const leftTarget = getSettledRotation(leftStart, result[0], { x: 2, y: 3, z: 1 });
  const rightTarget = getSettledRotation(rightStart, result[1], { x: 3, y: 2, z: 2 });

  if (!leftDie.value?.animate || !rightDie.value?.animate) {
    finishRoll(key, leftTarget, rightTarget);
    return;
  }

  const animationOptions: KeyframeAnimationOptions = {
    duration,
    fill: 'forwards',
  };

  animateElement(leftDie.value, buildRollKeyframes(leftStart, leftTarget, -1), animationOptions);
  animateElement(rightDie.value, buildRollKeyframes(rightStart, rightTarget, 1), animationOptions);
  animateElement(leftShadow.value, buildShadowKeyframes(-1), animationOptions);
  animateElement(rightShadow.value, buildShadowKeyframes(1), animationOptions);

  phaseTimer = setTimeout(() => {
    if (activeRollKey === key) visualPhase.value = 'settling';
  }, settlingAt);

  settleTimer = setTimeout(() => {
    finishRoll(key, leftTarget, rightTarget);
  }, duration + 20);

  watchdogTimer = setTimeout(() => {
    finishRoll(key, leftTarget, rightTarget);
  }, duration + ROLL_WATCHDOG_MARGIN_MS);
};

const rollDice = (val1: number, val2: number): void => {
  const key = props.diceRollKey || Date.now();
  if (activeRollKey !== key) startAnticipation(key);
  playResolvedRoll(key, [val1, val2]);
};

defineExpose({ rollDice });

watch(
  [
    () => props.diceRollKey,
    () => props.rolling,
    () => props.resolving,
    () => props.diceResult,
  ] as const,
  ([key, rolling, resolving, result]) => {
    if (key === 0 && !rolling && !result) {
      if (visualPhase.value !== 'idle') resetToIdle();
      return;
    }

    if (rolling && activeRollKey !== key) {
      startAnticipation(key);
    }

    if (result) {
      playResolvedRoll(key, [result[0], result[1]]);
      return;
    }

    if (!rolling && !resolving && visualPhase.value === 'anticipating') {
      resetToIdle();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearTimers();
  cancelAnimations();
});
</script>

<style scoped>
.center-command {
  width: 100%;
  height: 100%;
  max-width: 40rem;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable both-edges;
  padding: 2px 4px 6px;
  box-sizing: border-box;
  display: grid;
  gap: 18px;
  text-align: left;
  color: #1f160f;
  scrollbar-width: thin;
  scrollbar-color: rgba(143, 93, 35, 0.35) transparent;
}

.hub-header {
  display: grid;
  gap: 14px;
}

.hub-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.hub-eyebrow {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8f5d23;
}

.hub-main-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  min-height: 86px;
  min-width: 0;
  overflow: hidden;
  overflow: clip;
}

.hub-copy-block {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 12px;
}

.hub-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hub-player-mark {
  width: 18px;
  height: 48px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--player-color, #d8c1a4), rgba(255, 255, 255, 0.2));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.hub-title-copy {
  min-width: 0;
}

.hub-status {
  margin: 0 0 4px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8f5d23;
}

.hub-title-copy h2 {
  margin: 0;
  font-family: 'Itim', cursive;
  font-size: clamp(1.7rem, 2.4vw, 2.7rem);
  line-height: 1.05;
  color: #25190f;
  font-weight: 400;
}

.hub-description {
  margin: 0;
  max-width: 34rem;
  line-height: 1.65;
  color: #5d4935;
}

.dice-anchor {
  width: 152px;
  height: 88px;
  flex-shrink: 0;
  align-self: flex-start;
  display: flex;
  justify-content: flex-end;
  overflow: visible;
  contain: layout style;
  isolation: isolate;
}

.dice-container {
  --die-size: 52px;
  --die-half: calc(var(--die-size) / 2);
  --pip-size: calc(var(--die-size) * 0.135);
  position: relative;
  width: 146px;
  height: 86px;
  display: grid;
  place-items: center;
  overflow: visible;
  contain: layout style;
  perspective: 920px;
  perspective-origin: center 38%;
}

.dice-container::before,
.dice-container::after {
  content: '';
  position: absolute;
  left: 50%;
  pointer-events: none;
  border-radius: 999px;
  transform: translateX(-50%);
}

.dice-container::before {
  bottom: 2px;
  width: 136px;
  height: 34px;
  background:
    radial-gradient(ellipse at center, rgba(115, 76, 33, 0.12), rgba(115, 76, 33, 0.025) 56%, transparent 74%);
}

.dice-container::after {
  bottom: 6px;
  width: 104px;
  height: 27px;
  background: radial-gradient(ellipse at center, rgba(212, 146, 49, 0.2), transparent 70%);
  opacity: 0;
  transition: opacity 260ms ease-out;
}

.dice-container--anticipating::after {
  opacity: 0.34;
}

.dice-container--settling::after {
  opacity: 0.62;
}

.dice-container--result::after {
  opacity: 0.44;
}

.dice-pair {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.dice-scene {
  position: relative;
  width: var(--die-size);
  height: calc(var(--die-size) + 17px);
  display: grid;
  place-items: center;
}

.die {
  position: relative;
  z-index: 2;
  width: var(--die-size);
  height: var(--die-size);
  transform-style: preserve-3d;
  transform-origin: 50% 54%;
  will-change: transform;
}

.die-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 20%;
  backface-visibility: hidden;
  background:
    radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0) 36%),
    linear-gradient(145deg, #fffdf8 0%, #f7efe3 48%, #ead9c5 100%);
  border: 1px solid rgba(93, 61, 31, 0.16);
  box-shadow:
    inset 2px 2px 5px rgba(255, 255, 255, 0.82),
    inset -4px -5px 9px rgba(116, 77, 39, 0.12),
    0 1px 2px rgba(66, 39, 17, 0.08);
}

.die-face--front { transform: translateZ(var(--die-half)); }
.die-face--back { transform: rotateY(180deg) translateZ(var(--die-half)); }
.die-face--right { transform: rotateY(90deg) translateZ(var(--die-half)); }
.die-face--left { transform: rotateY(-90deg) translateZ(var(--die-half)); }
.die-face--top { transform: rotateX(90deg) translateZ(var(--die-half)); }
.die-face--bottom { transform: rotateX(-90deg) translateZ(var(--die-half)); }

.pip {
  position: absolute;
  width: var(--pip-size);
  height: var(--pip-size);
  border-radius: 999px;
  background: radial-gradient(circle at 34% 30%, #66452e, #3c281b 65%, #21150e 100%);
  box-shadow:
    inset 0 1px 2px rgba(10, 5, 2, 0.48),
    0 1px 0 rgba(255, 255, 255, 0.42);
}

.die-face--front .pip {
  background: radial-gradient(circle at 34% 30%, #c95e4d, #90392f 66%, #57231e 100%);
}

.pip--tl { top: 18%; left: 18%; }
.pip--tc { top: 18%; left: 50%; transform: translateX(-50%); }
.pip--tr { top: 18%; right: 18%; }
.pip--cl { top: 50%; left: 18%; transform: translateY(-50%); }
.pip--cc { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.pip--cr { top: 50%; right: 18%; transform: translateY(-50%); }
.pip--bl { bottom: 18%; left: 18%; }
.pip--bc { bottom: 18%; left: 50%; transform: translateX(-50%); }
.pip--br { bottom: 18%; right: 18%; }

.die-shadow {
  position: absolute;
  z-index: 0;
  bottom: 1px;
  width: 78%;
  height: 12px;
  border-radius: 999px;
  background: radial-gradient(ellipse at center, rgba(73, 43, 18, 0.31), rgba(73, 43, 18, 0.02) 73%);
  filter: blur(3.4px);
  opacity: 0.48;
  transform: translateY(4px) scaleX(0.96);
  will-change: transform, opacity;
}

.hub-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(92, 66, 41, 0.12);
}

.hub-tile-type {
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8f5d23;
  font-family: 'Itim', cursive;
  flex-shrink: 0;
}

.hub-tile-name {
  font-family: 'Itim', cursive;
  font-weight: 400;
  font-size: 1.05rem;
  color: #23170d;
}

.hub-tile-price {
  font-family: 'Itim', cursive;
  font-size: 0.92rem;
  color: #4f3a27;
}

.hub-actions,
.hub-details {
  display: grid;
  gap: 14px;
}

.hub-actions {
  position: static;
  z-index: auto;
  padding: 0;
  margin: 0;
  background: transparent !important;
  border: 0;
  box-shadow: none;
}

@media (max-width: 780px) {
  .center-command {
    gap: 14px;
    text-align: center;
  }

  .hub-topline,
  .hub-title-row,
  .hub-tile {
    justify-content: center;
  }

  .hub-main-row {
    flex-direction: column;
    align-items: center;
  }

  .hub-title-row {
    flex-direction: column;
  }

  .hub-player-mark {
    width: 48px;
    height: 14px;
  }

  .dice-anchor {
    width: 100%;
    height: 88px;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dice-container::after {
    transition-duration: 80ms;
  }
}
</style>
