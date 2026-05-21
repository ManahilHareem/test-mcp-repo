export type SessionUser = {
  id: number;
  email: string;
  created_at: string;
  onboarding_complete: boolean;
  role: string;
};

type AuthResponse = {
  user: SessionUser;
};

type AuthPayload = {
  email: string;
  password: string;
};

type RegisterPayload = AuthPayload & {
  name: string;
};

export type ProfileSection = {
  key: string;
  label: string;
  status: string;
  value: string | null;
};

export type UploadedFileSummary = {
  id: number;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  summary_text: string | null;
  created_at: string;
};

export type WheelOfLifeData = {
  category: string;
  score: number;
}[];

export type UserProfile = {
  display_name: string | null;
  summary_text: string;
  completion_percentage: number;
  completed_count: number;
  total_count: number;
  onboarding_complete: boolean;
  ai_summary_text?: string | null;
  ai_wheel_of_life?: WheelOfLifeData | null;
  latest_memory_query: string | null;
  latest_memory_answer: string | null;
  sections: ProfileSection[];
  uploaded_files: UploadedFileSummary[];
};

export type MemorySource = {
  source_type: string;
  source_id: string;
  label: string;
  excerpt: string;
  question_key: string | null;
};

export type MemoryQueryResult = {
  thread_id: number;
  query: string;
  answer: string;
  provider: string;
  sources: MemorySource[];
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  provider: string | null;
  sources: MemorySource[];
  created_at: string;
};

export type ChatThreadSummary = {
  id: number;
  title: string;
  summary_text: string | null;
  last_message_at: string;
  created_at: string;
};

export type ChatThread = ChatThreadSummary & {
  messages: ChatMessage[];
};

export type OnboardingQuestion = {
  key: string;
  label: string;
  prompt: string;
  placeholder: string;
  input_type: "singleline" | "multiline";
  max_length: number | null;
};

export type OnboardingProgress = {
  completed_count: number;
  answered_count: number;
  skipped_count: number;
  total_count: number;
  completion_percentage: number;
  is_complete: boolean;
};

export type OnboardingProfilePreview = {
  summary_text: string;
  completion_percentage: number;
  sections: ProfileSection[];
  uploaded_files_count: number;
};

export type OnboardingQuestionResponse = {
  question: OnboardingQuestion | null;
  current_answer: {
    question_key: string;
    answer_text: string | null;
    skipped: boolean;
  } | null;
  current_index: number;
  total_count: number;
  progress: OnboardingProgress;
  profile_preview: OnboardingProfilePreview;
};

export type OnboardingAnswerResponse = {
  saved_answer: {
    question_key: string;
    answer_text: string | null;
    skipped: boolean;
  };
  next_question: OnboardingQuestion | null;
  next_answer: {
    question_key: string;
    answer_text: string | null;
    skipped: boolean;
  } | null;
  current_index: number;
  total_count: number;
  progress: OnboardingProgress;
  profile_preview: OnboardingProfilePreview;
};

export type UploadedFileResponse = {
  id: number;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  summary_text: string | null;
  storage_key: string;
  profile: UserProfile;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "Request failed.";
  }

  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const message = "msg" in item && typeof item.msg === "string" ? item.msg : null;
        const location =
          "loc" in item && Array.isArray(item.loc)
            ? item.loc
                .filter((part: unknown): part is string | number => typeof part === "string" || typeof part === "number")
                .join(" -> ")
            : null;
        if (message && location) {
          return `${location}: ${message}`;
        }
        return message;
      })
      .filter((message): message is string => Boolean(message));

    if (messages.length) {
      return messages.join(". ");
    }
  }

  return "Request failed.";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as unknown;
    throw new Error(extractErrorMessage(body));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function postLogin(payload: AuthPayload): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function postRegister(payload: RegisterPayload): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/me");
}

export async function postLogout(): Promise<void> {
  await request<void>("/auth/logout", {
    method: "POST",
  });
}

export async function getOnboardingQuestion(questionKey?: string, reviewIncomplete?: boolean): Promise<OnboardingQuestionResponse> {
  const params = new URLSearchParams();
  if (questionKey) {
    params.set("question_key", questionKey);
  }
  if (reviewIncomplete) {
    params.set("review_incomplete", "true");
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<OnboardingQuestionResponse>(`/onboarding/question${suffix}`);
}

export async function postOnboardingAnswer(payload: {
  question_key: string;
  answer_text?: string;
  skipped?: boolean;
  review_incomplete?: boolean;
}): Promise<OnboardingAnswerResponse> {
  return request<OnboardingAnswerResponse>("/onboarding/answer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadMarkdownFile(file: File): Promise<UploadedFileResponse> {
  const formData = new FormData();
  formData.append("upload", file);
  return request<UploadedFileResponse>("/files/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getProfile(): Promise<UserProfile> {
  return request<UserProfile>("/profile");
}

export async function postMemoryQuery(payload: { query: string; thread_id?: number | null }): Promise<MemoryQueryResult> {
  return request<MemoryQueryResult>("/memory/query", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listMemoryThreads(): Promise<ChatThreadSummary[]> {
  return request<ChatThreadSummary[]>("/memory/threads");
}

export async function createMemoryThread(payload?: { title?: string }): Promise<ChatThread> {
  return request<ChatThread>("/memory/threads", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function getMemoryThread(threadId: number): Promise<ChatThread> {
  return request<ChatThread>(`/memory/threads/${threadId}`);
}

export async function deleteMemoryThread(threadId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/memory/threads/${threadId}`, {
    method: "DELETE",
  });
}

export async function downloadMarkdownExport(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/export/md`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as unknown;
    throw new Error(extractErrorMessage(body));
  }

  return response.text();
}

export async function deleteAccount(): Promise<{ message: string }> {
  return request<{ message: string }>("/user/delete", {
    method: "DELETE",
  });
}

export async function generateInsights(): Promise<UserProfile> {
  return request<UserProfile>("/user/insights", {
    method: "POST",
  });
}

export async function deleteUploadedFile(fileId: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/files/${fileId}`, {
    method: "DELETE",
  });
}


export async function getAdminTrueNorth(): Promise<{ content: string }> {
  return request<{ content: string }>("/admin/truenorth");
}

export async function updateAdminTrueNorth(content: string): Promise<{ content: string }> {
  return request<{ content: string }>("/admin/truenorth", {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}


export type FeedItem = {
  id: number;
  title: string;
  summary: string;
  relevance_reason: string;
  arena: string | null;
  source_url: string | null;
  published_at: string | null;
  created_at: string;
};

export type FeedResponse = {
  run_id: number;
  status: string;
  generated_at: string;
  items: FeedItem[];
};

export type GenerateFeedResponse = {
  message: string;
  run_id: number;
};

export async function generateFeed(): Promise<GenerateFeedResponse> {
  return request<GenerateFeedResponse>("/feed/generate", { method: "POST" });
}

export async function getFeed(): Promise<FeedResponse> {
  return request<FeedResponse>("/feed");
}

export async function getFeedStatus(runId: number): Promise<GenerateFeedResponse> {
  return request<GenerateFeedResponse>(`/feed/status/${runId}`);
}


// Face recognition APIs

export type FaceStatus = {
  enrolled: boolean;
};

export async function getFaceStatus(): Promise<FaceStatus> {
  return request<FaceStatus>("/auth/face/status");
}

export async function faceEnroll(imageBase64: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/face/enroll", {
    method: "POST",
    body: JSON.stringify({ image: imageBase64 }),
  });
}

export async function faceLogin(
  email: string,
  imageBase64: string,
): Promise<{ user: SessionUser }> {
  return request<{ user: SessionUser }>("/auth/face/login", {
    method: "POST",
    body: JSON.stringify({ email, image: imageBase64 }),
  });
}

export async function faceUnenroll(): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/face/unenroll", {
    method: "DELETE",
  });
}

// Passcode APIs

export type PasscodeStatus = {
  has_passcode: boolean;
};

export async function getPasscodeStatus(): Promise<PasscodeStatus> {
  return request<PasscodeStatus>("/auth/passcode/status");
}

export async function setPasscode(pin: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/passcode/set", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export async function passcodeLogin(
  email: string,
  pin: string,
): Promise<{ user: SessionUser }> {
  return request<{ user: SessionUser }>("/auth/passcode/login", {
    method: "POST",
    body: JSON.stringify({ email, pin }),
  });
}

export async function removePasscode(): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/passcode/remove", {
    method: "DELETE",
  });
}
