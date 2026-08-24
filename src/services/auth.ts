import { computed, readonly, ref } from "vue";

import { api, ApiError } from "@/services/api";
import type {
  AuthUser,
  LoginInput,
  RegisterInput,
  UpdatePasswordInput,
  UpdateProfileInput,
} from "@/types/domain";

const currentUser = ref<AuthUser | null>(null);
const isInitializing = ref(false);
let initialization: Promise<void> | null = null;

async function initialize(): Promise<void> {
  if (initialization) return initialization;

  isInitializing.value = true;
  initialization = (async () => {
    try {
      currentUser.value = (await api.auth.me()).user;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error("Impossible de restaurer la session Marelle", error);
      }
      currentUser.value = null;
    } finally {
      isInitializing.value = false;
    }
  })();

  return initialization;
}

async function login(input: LoginInput): Promise<void> {
  currentUser.value = (await api.auth.login(input)).user;
}

async function register(input: RegisterInput): Promise<void> {
  currentUser.value = (await api.auth.register(input)).user;
}

async function updateProfile(input: UpdateProfileInput): Promise<void> {
  currentUser.value = (await api.auth.updateProfile(input)).user;
}

async function updatePassword(input: UpdatePasswordInput): Promise<void> {
  await api.auth.updatePassword(input);
}

async function logout(): Promise<void> {
  await api.auth.logout();
  currentUser.value = null;
}

function clear(): void {
  currentUser.value = null;
}

export const auth = {
  clear,
  initialize,
  isAuthenticated: computed(() => currentUser.value !== null),
  isInitializing: readonly(isInitializing),
  login,
  logout,
  register,
  updatePassword,
  updateProfile,
  user: readonly(currentUser),
};
