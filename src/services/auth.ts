import { computed, readonly, ref } from "vue";

import { api, ApiError } from "@/services/api";
import type {
  AuthUser,
  DeleteAccountInput,
  LoginInput,
  RegisterInput,
  UpdateEmailInput,
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

async function updateEmail(input: UpdateEmailInput): Promise<void> {
  currentUser.value = (await api.auth.updateEmail(input)).user;
}

async function updatePassword(input: UpdatePasswordInput): Promise<void> {
  await api.auth.updatePassword(input);
}

async function deleteAccount(input: DeleteAccountInput): Promise<void> {
  await api.auth.deleteAccount(input);
  currentUser.value = null;
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
  deleteAccount,
  initialize,
  isAuthenticated: computed(() => currentUser.value !== null),
  isInitializing: readonly(isInitializing),
  login,
  logout,
  register,
  updateEmail,
  updatePassword,
  updateProfile,
  user: readonly(currentUser),
};
