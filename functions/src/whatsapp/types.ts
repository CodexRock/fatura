// functions/src/whatsapp/types.ts

// ---------------------------------------------------------
// INCOMING WEBHOOK TYPES
// ---------------------------------------------------------

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: Array<{
      profile: {
        name: string;
      };
      wa_id: string;
    }>;
    messages?: WebhookMessage[];
    statuses?: any[];
  };
  field: string;
}

export interface WebhookMessage {
  from: string; // The waId
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'image' | 'document' | 'audio' | 'button' | 'unknown';
  text?: {
    body: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    payload: string;
    text: string;
  };
}

// ---------------------------------------------------------
// OUTBOUND MESSAGE TYPES
// ---------------------------------------------------------

export interface OutboundMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'interactive' | 'document';
  text?: {
    preview_url: boolean;
    body: string;
  };
  interactive?: {
    type: 'button' | 'list';
    body: {
      text: string;
    };
    action: {
      buttons?: OutboundButton[];
      button?: string; // For list messages
      sections?: OutboundListSection[];
    };
  };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
}

export interface OutboundButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface OutboundListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}
