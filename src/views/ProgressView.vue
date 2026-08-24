<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import ViewHeader from "@/components/ViewHeader.vue";
import { api, ApiError } from "@/services/api";
import type { ProgressionDay, ProgressionResponse } from "@/types/domain";

type Period = 7 | 30;
type ChartMetric = "xp" | "accuracy" | "questions";

const chartWidth = 640;
const chartHeight = 180;
const chartPaddingX = 18;
const chartPaddingY = 18;

const progression = ref<ProgressionResponse | null>(null);
const isLoading = ref(true);
const loadError = ref("");
const period = ref<Period>(7);
const chartMetric = ref<ChartMetric>("xp");

const metricOptions: Array<{ value: ChartMetric; label: string }> = [
  { value: "xp", label: "XP" },
  { value: "accuracy", label: "Réussite" },
  { value: "questions", label: "Questions" },
];
const weekDayInitials = ["L", "M", "M", "J", "V", "S", "D"];

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});
const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timestampFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function timestampFromDatabase(value: string): Date {
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
}

function formatShortDate(value: string): string {
  return shortDateFormatter.format(dateFromIso(value));
}

function formatLongDate(value: string): string {
  return longDateFormatter.format(dateFromIso(value));
}

function formatTimestamp(value: string): string {
  return timestampFormatter.format(timestampFromDatabase(value));
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Durée non enregistrée";
  if (seconds < 60) return "Moins d’une minute";
  return `${Math.round(seconds / 60)} min`;
}

function historyMonth(value: string): string {
  return shortDateFormatter.format(dateFromIso(value)).replace(/^\d+\s*/, "");
}

function totalFor(
  days: ProgressionDay[],
  key: "earnedXp" | "answeredQuestions" | "correctAnswers",
): number {
  return days.reduce((sum, day) => sum + day[key], 0);
}

function metricValue(day: ProgressionDay): number {
  if (chartMetric.value === "xp") return day.earnedXp;
  if (chartMetric.value === "questions") return day.answeredQuestions;
  return day.answeredQuestions === 0
    ? 0
    : Math.round((day.correctAnswers * 100) / day.answeredQuestions);
}

const selectedDays = computed(() => progression.value?.activity.slice(-period.value) ?? []);
const previousDays = computed(() => {
  const activity = progression.value?.activity ?? [];
  return activity.slice(-(period.value * 2), -period.value);
});
const calendarDays = computed(() => progression.value?.activity.slice(-30) ?? []);

const summary = computed(() => {
  const answered = totalFor(selectedDays.value, "answeredQuestions");
  const correct = totalFor(selectedDays.value, "correctAnswers");
  return {
    xp: totalFor(selectedDays.value, "earnedXp"),
    answered,
    accuracy: answered === 0 ? 0 : Math.round((correct * 100) / answered),
  };
});

const xpDifference = computed(
  () => summary.value.xp - totalFor(previousDays.value, "earnedXp"),
);

const chartMaximum = computed(() => {
  if (chartMetric.value === "accuracy") return 100;
  return Math.max(1, ...selectedDays.value.map(metricValue));
});

const chartPoints = computed(() => {
  const days = selectedDays.value;
  const drawableWidth = chartWidth - chartPaddingX * 2;
  const drawableHeight = chartHeight - chartPaddingY * 2;
  return days.map((day, index) => {
    const denominator = Math.max(days.length - 1, 1);
    const value = metricValue(day);
    return {
      date: day.date,
      value,
      x: chartPaddingX + (index / denominator) * drawableWidth,
      y: chartHeight - chartPaddingY - (value / chartMaximum.value) * drawableHeight,
    };
  });
});

const chartPolyline = computed(() =>
  chartPoints.value.map((point) => `${point.x},${point.y}`).join(" "),
);

const chartArea = computed(() => {
  if (chartPoints.value.length === 0) return "";
  const bottom = chartHeight - chartPaddingY;
  const first = chartPoints.value[0];
  const last = chartPoints.value.at(-1);
  return `${first?.x},${bottom} ${chartPolyline.value} ${last?.x},${bottom}`;
});

const chartLabels = computed(() => {
  const days = selectedDays.value;
  if (days.length === 0) return [];
  const indexes = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  return indexes.map((index) => ({
    index,
    label: formatShortDate(days[index]?.date ?? ""),
  }));
});

const chartUnit = computed(() => {
  if (chartMetric.value === "accuracy") return "%";
  if (chartMetric.value === "questions") return " questions";
  return " XP";
});

const calendarCells = computed<Array<ProgressionDay | null>>(() => {
  const days = calendarDays.value;
  if (days.length === 0) return [];
  const firstDay = dateFromIso(days[0]?.date ?? "").getDay();
  const mondayOffset = (firstDay + 6) % 7;
  return [...Array.from({ length: mondayOffset }, () => null), ...days];
});

const calendarRange = computed(() => {
  const days = calendarDays.value;
  if (days.length === 0) return "30 derniers jours";
  return `${formatShortDate(days[0]?.date ?? "")} — ${formatShortDate(days.at(-1)?.date ?? "")}`;
});

function activityLevel(day: ProgressionDay): number {
  if (day.goalReached) return 4;
  if (day.earnedXp >= 15) return 3;
  if (day.earnedXp >= 5) return 2;
  if (day.earnedXp > 0) return 1;
  return 0;
}

function activityLabel(day: ProgressionDay): string {
  if (day.earnedXp === 0) return `${formatLongDate(day.date)} : aucune activité`;
  return `${formatLongDate(day.date)} : ${day.earnedXp} XP et ${day.answeredQuestions} questions`;
}

function chartPointLabel(point: { date: string; value: number }): string {
  return `${formatLongDate(point.date)} : ${point.value}${chartUnit.value}`;
}

async function loadProgression(): Promise<void> {
  loadError.value = "";
  isLoading.value = true;
  try {
    progression.value = await api.progression();
  } catch (error) {
    loadError.value = error instanceof ApiError
      ? error.message
      : "Impossible de charger ton carnet de progrès pour le moment.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadProgression);
</script>

<template>
  <div class="page inner-page progress-page">
    <ViewHeader
      eyebrow="Les bons points s’additionnent"
      title="Mon carnet de progrès"
      description="Observe ton rythme, mesure tes progrès et retrouve ce qui mérite encore un petit coup de crayon."
    />

    <div v-if="isLoading" class="progress-loading" aria-live="polite">
      <span class="sr-only">Chargement de la progression…</span>
      <div class="skeleton progress-skeleton progress-skeleton--wide"></div>
      <div class="skeleton progress-skeleton"></div>
      <div class="skeleton progress-skeleton"></div>
    </div>

    <section v-else-if="loadError" class="coming-soon-card error-state" role="alert">
      <span class="error-state__icon" aria-hidden="true">🧭</span>
      <h2>Le carnet ne s’ouvre pas</h2>
      <p>{{ loadError }}</p>
      <button class="primary-button" type="button" @click="loadProgression">Réessayer</button>
    </section>

    <div v-else-if="progression" class="progress-content">
      <section class="progress-section progress-section--calendar" aria-labelledby="activity-title">
        <header class="progress-section__heading">
          <div>
            <p class="eyebrow">Mon rythme</p>
            <h2 id="activity-title">Calendrier d’activité</h2>
          </div>
          <span>{{ calendarRange }}</span>
        </header>

        <div class="activity-calendar" role="grid" aria-label="Activité des 30 derniers jours">
          <span
            v-for="(dayName, index) in weekDayInitials"
            :key="`${dayName}-${index}`"
            class="activity-calendar__weekday"
            aria-hidden="true"
          >{{ dayName }}</span>
          <template v-for="(day, index) in calendarCells" :key="day?.date ?? `blank-${index}`">
            <span v-if="!day" class="activity-calendar__blank" aria-hidden="true"></span>
            <span
              v-else
              class="activity-calendar__day"
              :class="`activity-calendar__day--${activityLevel(day)}`"
              role="gridcell"
              :aria-label="activityLabel(day)"
              :title="activityLabel(day)"
            >{{ dateFromIso(day.date).getDate() }}</span>
          </template>
        </div>
        <div class="activity-legend" aria-hidden="true">
          <span>Calme</span>
          <i
            v-for="level in [0, 1, 2, 3, 4]"
            :key="level"
            :class="`activity-calendar__day--${level}`"
          ></i>
          <span>Objectif atteint</span>
        </div>
        <p class="progress-calendar-note">
          <strong>{{ calendarDays.filter((day) => day.earnedXp > 0).length }}</strong>
          jours actifs sur les 30 derniers jours.
        </p>
      </section>

      <section class="progress-section progress-section--chart" aria-labelledby="chart-title">
        <header class="progress-section__heading progress-section__heading--controls">
          <div>
            <p class="eyebrow">Ma courbe</p>
            <h2 id="chart-title">Progression</h2>
          </div>
          <div class="progress-segmented" aria-label="Période de la courbe">
            <button
              v-for="days in ([7, 30] as Period[])"
              :key="days"
              type="button"
              :class="{ 'progress-segmented__button--active': period === days }"
              :aria-pressed="period === days"
              @click="period = days"
            >{{ days }} jours</button>
          </div>
        </header>

        <div class="progress-summary-grid">
          <article>
            <span aria-hidden="true">⭐</span>
            <strong>{{ summary.xp }}</strong>
            <small>XP gagnés</small>
          </article>
          <article>
            <span aria-hidden="true">🎯</span>
            <strong>{{ summary.accuracy }} %</strong>
            <small>de réussite</small>
          </article>
          <article>
            <span aria-hidden="true">✏️</span>
            <strong>{{ summary.answered }}</strong>
            <small>questions</small>
          </article>
        </div>

        <p class="progress-comparison" :class="{ 'progress-comparison--down': xpDifference < 0 }">
          <span aria-hidden="true">{{ xpDifference >= 0 ? '↗' : '↘' }}</span>
          <strong>{{ xpDifference >= 0 ? '+' : '' }}{{ xpDifference }} XP</strong>
          par rapport aux {{ period }} jours précédents
        </p>

        <div class="progress-metric-picker" aria-label="Valeur représentée sur la courbe">
          <button
            v-for="metric in metricOptions"
            :key="metric.value"
            type="button"
            :class="{ 'progress-metric-picker__button--active': chartMetric === metric.value }"
            :aria-pressed="chartMetric === metric.value"
            @click="chartMetric = metric.value"
          >{{ metric.label }}</button>
        </div>

        <div class="progress-chart">
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            role="img"
            :aria-label="`Courbe ${chartMetric} sur ${period} jours`"
          >
            <line
              v-for="ratio in [0, 0.5, 1]"
              :key="ratio"
              class="progress-chart__grid"
              :x1="chartPaddingX"
              :x2="chartWidth - chartPaddingX"
              :y1="chartPaddingY + ratio * (chartHeight - chartPaddingY * 2)"
              :y2="chartPaddingY + ratio * (chartHeight - chartPaddingY * 2)"
            />
            <polygon v-if="chartArea" class="progress-chart__area" :points="chartArea" />
            <polyline class="progress-chart__line" :points="chartPolyline" />
            <circle
              v-for="point in chartPoints"
              :key="point.date"
              class="progress-chart__point"
              :cx="point.x"
              :cy="point.y"
              r="4"
            >
              <title>{{ chartPointLabel(point) }}</title>
            </circle>
          </svg>
          <div class="progress-chart__labels" aria-hidden="true">
            <span v-for="label in chartLabels" :key="label.index">{{ label.label }}</span>
          </div>
        </div>
      </section>

      <section class="progress-section" aria-labelledby="mistakes-title">
        <header class="progress-section__heading">
          <div>
            <p class="eyebrow">À reprendre tranquillement</p>
            <h2 id="mistakes-title">Mes erreurs à revoir</h2>
          </div>
          <span class="progress-count">{{ progression.mistakes.length }}</span>
        </header>

        <div v-if="progression.mistakes.length" class="mistake-list">
          <article
            v-for="mistake in progression.mistakes"
            :key="mistake.questionId"
            class="mistake-card"
            :style="{ '--subject-color': mistake.subject.color }"
          >
            <div class="mistake-card__meta">
              <span aria-hidden="true">{{ mistake.subject.icon }}</span>
              <strong>{{ mistake.subject.name }}</strong>
              <small>{{ mistake.chapterTitle }}</small>
            </div>
            <h3>{{ mistake.prompt }}</h3>
            <p class="mistake-card__attempts">
              {{ mistake.correctAnswers }} bonne{{ mistake.correctAnswers > 1 ? 's' : '' }} réponse{{ mistake.correctAnswers > 1 ? 's' : '' }} sur {{ mistake.attempts }} essai{{ mistake.attempts > 1 ? 's' : '' }} · revue le {{ formatTimestamp(mistake.lastAnsweredAt) }}
            </p>
            <details>
              <summary>Voir la correction</summary>
              <p v-if="mistake.correctAnswer"><strong>Bonne réponse :</strong> {{ mistake.correctAnswer }}</p>
              <p>{{ mistake.explanation }}</p>
            </details>
          </article>
        </div>
        <div v-else class="progress-empty-state">
          <span aria-hidden="true">🌟</span>
          <div>
            <h3>Aucune erreur en attente</h3>
            <p>Les prochaines notions à revoir apparaîtront ici.</p>
          </div>
        </div>
      </section>

      <section class="progress-section" aria-labelledby="history-title">
        <header class="progress-section__heading">
          <div>
            <p class="eyebrow">Mes dernières parties</p>
            <h2 id="history-title">Historique des Marelles</h2>
          </div>
          <span class="progress-count">{{ progression.history.length }}</span>
        </header>

        <ol v-if="progression.history.length" class="challenge-history-list">
          <li v-for="attempt in progression.history" :key="attempt.id">
            <span class="challenge-history-list__date">
              <strong>{{ dateFromIso(attempt.date).getDate() }}</strong>
              {{ historyMonth(attempt.date) }}
            </span>
            <div>
              <h3>{{ attempt.title }}</h3>
              <p>{{ attempt.score }}/{{ attempt.totalQuestions }} bonnes réponses · {{ formatDuration(attempt.durationSeconds) }}</p>
            </div>
            <strong
              class="challenge-history-list__score"
              :class="{ 'challenge-history-list__score--great': attempt.percentage >= 80 }"
            >{{ attempt.percentage }} %</strong>
          </li>
        </ol>
        <div v-else class="progress-empty-state">
          <span aria-hidden="true">🪜</span>
          <div>
            <h3>Ta première Marelle t’attend</h3>
            <p>Une fois terminée, son score apparaîtra ici.</p>
          </div>
          <RouterLink class="compact-button" :to="{ name: 'daily-challenge' }">Commencer</RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
