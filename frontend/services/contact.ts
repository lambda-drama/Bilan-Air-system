import { apiRequest, methodUrl } from "./apiClient";

export interface SubmitContactMessageData {
  sender_name: string;
  email: string;
  phone?: string;
  message_body: string;
}

export async function submitContactMessage(data: SubmitContactMessageData) {
  return apiRequest<{ name: string; message: string }>(
    methodUrl("contact", "submit_contact_message"),
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}
