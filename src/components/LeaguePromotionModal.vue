<template>
  <Teleport to="body">
    <Transition name="league-modal">
      <div
        v-if="visible"
        class="league-promotion-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-title"
        @click.self="dismiss"
      >
        <div class="league-promotion-modal">
          <!-- Confetti animation -->
          <div class="league-promotion-confetti" aria-hidden="true">
            <span v-for="n in 20" :key="n" class="confetti-particle" :style="confettiStyle(n)" />
          </div>

          <!-- Content -->
          <div class="league-promotion-content">
            <div class="league-promotion-leap">
              <div
                class="league-promotion-badge league-promotion-badge--from"
                :style="{ borderColor: fromLeague?.color ?? '#78909C' }"
              >
                <span>{{ fromLeague?.icon ?? "⚙️" }}</span>
                <small>{{ fromLeague?.name ?? "Fer" }}</small>
              </div>
              <div class="league-promotion-arrow">→</div>
              <div
                class="league-promotion-badge league-promotion-badge--to league-promotion-badge--pulse"
                :style="{ borderColor: toLeague?.color ?? '#A0522D', background: `${toLeague?.color ?? '#A0522D'}18` }"
              >
                <span>{{ toLeague?.icon ?? "🥉" }}</span>
                <small>{{ toLeague?.name ?? "Bronze" }}</small>
              </div>
            </div>

            <h2 id="promo-title" class="league-promotion-title">Grand Saut ! 🎉</h2>
            <p class="league-promotion-body">
              Tu as été promu en <strong>Ligue {{ toLeague?.name }}</strong> la semaine dernière.
              Continue comme ça !
            </p>

            <button
              id="league-promo-dismiss"
              class="btn btn--primary league-promotion-cta"
              @click="goToLeague"
            >
              Voir ma ligue
            </button>
            <button class="league-promotion-skip" @click="dismiss">Plus tard</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { LEAGUES } from "@/config/leagues";
import type { LeagueKey } from "@/types/domain";

const props = defineProps<{
  fromLeagueKey: LeagueKey | null;
  toLeagueKey: LeagueKey | null;
}>();

const emit = defineEmits<{
  (e: "dismiss"): void;
}>();

const router = useRouter();
const visible = ref(false);

const fromLeague = computed(() =>
  props.fromLeagueKey ? LEAGUES.find((l) => l.key === props.fromLeagueKey) : null,
);
const toLeague = computed(() =>
  props.toLeagueKey ? LEAGUES.find((l) => l.key === props.toLeagueKey) : null,
);

onMounted(() => {
  // Délai court pour que l'animation d'entrée soit visible
  setTimeout(() => { visible.value = true; }, 100);
});

function dismiss() {
  visible.value = false;
  setTimeout(() => emit("dismiss"), 300);
}

function goToLeague() {
  dismiss();
  router.push("/ligue");
}

function confettiStyle(n: number): Record<string, string> {
  const colors = ["#F9A825", "#E53935", "#43A047", "#29B6F6", "#AB47BC"];
  return {
    left: `${(n * 17 + 10) % 90}%`,
    animationDelay: `${(n * 0.07).toFixed(2)}s`,
    animationDuration: `${0.8 + (n % 5) * 0.2}s`,
    background: colors[n % colors.length]!,
  };
}
</script>
