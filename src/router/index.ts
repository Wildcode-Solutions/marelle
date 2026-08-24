import { createRouter, createWebHistory } from "vue-router";

import { auth } from "@/services/auth";
import HomeView from "@/views/HomeView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: "/marelle-du-jour",
      name: "daily-challenge",
      component: () => import("@/views/DailyChallengeView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/progression",
      name: "progress",
      component: () => import("@/views/ProgressView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/profil",
      name: "profile",
      component: () => import("@/views/ProfileView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("@/views/AdminView.vue"),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: "/connexion",
      name: "login",
      component: () => import("@/views/AuthView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/inscription",
      name: "register",
      component: () => import("@/views/AuthView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/ligue",
      name: "league",
      component: () => import("@/views/LeagueView.vue"),
      meta: { requiresAuth: true },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  await auth.initialize();

  if (to.meta.requiresAuth && !auth.user.value) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAdmin && auth.user.value?.role !== "admin") {
    return { name: "home" };
  }

  if (to.meta.guestOnly && auth.user.value) {
    return { name: "home" };
  }

  return true;
});

export default router;
