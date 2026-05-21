import {
  createMemoryThread,
  deleteMemoryThread,
  deleteAccount,
  downloadMarkdownExport,
  getMemoryThread,
  getMe,
  listMemoryThreads,
  postMemoryQuery,
  getOnboardingQuestion,
  getProfile,
  postLogin,
  postLogout,
  postOnboardingAnswer,
  postRegister,
  uploadMarkdownFile,
} from "@/lib/api";

type Credentials = {
  email: string;
  password: string;
};

type RegisterCredentials = Credentials & {
  name: string;
};

export async function loginUser(credentials: Credentials) {
  return postLogin(credentials);
}

export async function registerUser(credentials: RegisterCredentials) {
  return postRegister(credentials);
}

export async function getCurrentUser() {
  try {
    const response = await getMe();
    return response.user;
  } catch {
    return null;
  }
}

export async function logoutUser() {
  return postLogout();
}

export async function getCurrentOnboardingQuestion(questionKey?: string, reviewIncomplete?: boolean) {
  return getOnboardingQuestion(questionKey, reviewIncomplete);
}

export async function saveOnboardingAnswer(payload: {
  question_key: string;
  answer_text?: string;
  skipped?: boolean;
  review_incomplete?: boolean;
}) {
  return postOnboardingAnswer(payload);
}

export async function uploadProfileMarkdown(file: File) {
  return uploadMarkdownFile(file);
}

export async function getCurrentProfile() {
  return getProfile();
}

export async function askMemoryQuestion(query: string) {
  return postMemoryQuery({ query });
}

export async function askThreadMemoryQuestion(query: string, threadId?: number | null) {
  return postMemoryQuery({ query, thread_id: threadId });
}

export async function getMemoryThreads() {
  return listMemoryThreads();
}

export async function getMemoryThreadById(threadId: number) {
  return getMemoryThread(threadId);
}

export async function startMemoryThread(title?: string) {
  return createMemoryThread({ title });
}

export async function removeMemoryThread(threadId: number) {
  return deleteMemoryThread(threadId);
}

export async function exportProfileMarkdown() {
  return downloadMarkdownExport();
}

export async function deleteCurrentAccount() {
  return deleteAccount();
}
