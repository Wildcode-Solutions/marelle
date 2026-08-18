import { createRouter, createWebHistory } from "vue-router";

import HomeView from "@/views/HomeView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/matieres",
      name: "subjects",
      component: () => import("@/views/SubjectsView.vue"),
    },
    {
      path: "/progression",
      name: "progress",
      component: () => import("@/views/ProgressView.vue"),
    },
    {
      path: "/profil",
      name: "profile",
      component: () => import("@/views/ProfileView.vue"),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

export default router;
