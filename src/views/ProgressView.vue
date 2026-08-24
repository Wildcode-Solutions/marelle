<script setup lang="ts">
import ViewHeader from "@/components/ViewHeader.vue";
</script>

<template>
  <div class="page inner-page">
    <ViewHeader
      eyebrow="Les bons points s’additionnent"
      title="Mon carnet de progrès"
      description="Retrouve bientôt ici tes acquis, tes séries et les notions à revoir."
    />

    <section class="coming-soon-card">
      <span aria-hidden="true">📈</span>
      <h2>Tableau de bord en préparation</h2>
      <p>Les données de progression sont déjà prévues dans la base D1.</p>
    </section>
  </div>
</template>
