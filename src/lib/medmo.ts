// DC MEDMO — thread persistence helpers (browser side, RLS as the signed-in user).
import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";

export interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// Tables are new and not yet in the generated Supabase types.
const db = supabase as any;

export async function listThreads(): Promise<ChatThread[]> {
  const { data, error } = await db
    .from("chat_threads")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChatThread[];
}

export async function createThread(userId: string, entrepriseId: string | null): Promise<ChatThread> {
  const { data, error } = await db
    .from("chat_threads")
    .insert({ user_id: userId, entreprise_id: entrepriseId })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as ChatThread;
}

export async function deleteThread(threadId: string): Promise<void> {
  const { error } = await db.from("chat_threads").delete().eq("id", threadId);
  if (error) throw error;
}

export async function loadThreadMessages(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await db
    .from("chat_messages")
    .select("message_id, role, parts")
    .eq("thread_id", threadId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.message_id, role: r.role, parts: r.parts }) as UIMessage);
}
