import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

export type DirectMessageStatus = "New" | "In Progress" | "Replied" | "Closed";

export interface DirectMessageRow {
  name: string;
  sender_name: string;
  email: string;
  phone?: string;
  status: DirectMessageStatus;
  source?: string;
  message: string;
  agent_reply?: string;
  replied_by?: string;
  replied_on?: string;
  closed_by?: string;
  closed_on?: string;
  creation?: string;
  modified?: string;
}

export async function listDirectMessages(opts?: {
  limit?: number;
  offset?: number;
  status?: DirectMessageStatus | "";
  search?: string;
}) {
  return apiRequest<PaginatedResponse<DirectMessageRow>>(
    methodUrl("contact", "list_contact_messages"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
        status: opts?.status || null,
        search: opts?.search ?? null,
      }),
    },
  );
}

export async function getDirectMessage(name: string) {
  return apiRequest<DirectMessageRow>(methodUrl("contact", "get_contact_message"), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function setDirectMessageStatus(name: string, status: DirectMessageStatus) {
  return apiRequest<DirectMessageRow>(methodUrl("contact", "set_contact_message_status"), {
    method: "POST",
    body: JSON.stringify({ name, status }),
  });
}

export async function replyToDirectMessage(name: string, reply_body: string, send_email = true) {
  return apiRequest<DirectMessageRow>(methodUrl("contact", "reply_to_contact_message"), {
    method: "POST",
    body: JSON.stringify({ name, reply_body, send_email: send_email ? 1 : 0 }),
  });
}
