<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import type PickerElement from "emoji-picker-element/picker";
import type { EmojiClickEvent } from "emoji-picker-element/shared";

const emit = defineEmits<{
  select: [emoji: string];
}>();

const host = ref<HTMLDivElement | null>(null);
const loadError = ref("");
let picker: PickerElement | null = null;

function selectEmoji(event: EmojiClickEvent): void {
  const emoji = event.detail.unicode;
  if (emoji) emit("select", emoji);
}

onMounted(async () => {
  try {
    const [{ default: Picker }, { default: frenchTranslations }] = await Promise.all([
      import("emoji-picker-element/picker"),
      import("emoji-picker-element/i18n/fr"),
    ]);

    picker = new Picker({
      dataSource: "https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1/fr/emojibase/data.json",
      i18n: frenchTranslations,
      locale: "fr",
    });
    picker.classList.add("light");
    picker.addEventListener("emoji-click", selectEmoji);
    host.value?.append(picker);
  } catch {
    loadError.value = "Impossible de charger le sélecteur d’emojis.";
  }
});

onBeforeUnmount(() => {
  picker?.removeEventListener("emoji-click", selectEmoji);
  picker?.remove();
});
</script>

<template>
  <div ref="host" class="web-emoji-picker">
    <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>
  </div>
</template>
