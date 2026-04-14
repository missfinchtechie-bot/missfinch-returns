// Gmail API client using OAuth2 refresh token
// Env vars needed: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID || '',
      client_secret: process.env.GMAIL_CLIENT_SECRET || '',
      refresh_token: process.env.GMAIL_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Gmail auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function gmailFetch(path: string, token: string, opts?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  snippet: string;
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractBody(payload: { mimeType: string; body?: { data?: string }; parts?: unknown[] }): string {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts as { mimeType: string; body?: { data?: string }; parts?: unknown[] }[]) {
      if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64(part.body.data);
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
    // Fallback to html
    for (const part of payload.parts as { mimeType: string; body?: { data?: string } }[]) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64(part.body.data);
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }
  return '';
}

export async function getUnreadMessages(maxResults = 10): Promise<GmailMessage[]> {
  const token = await getAccessToken();
  
  // Get unread messages from inbox (not sent, not spam)
  const list = await gmailFetch(`messages?q=is:unread+in:inbox+-category:promotions+-category:social&maxResults=${maxResults}`, token);
  
  if (!list.messages?.length) return [];
  
  const messages: GmailMessage[] = [];
  for (const msg of list.messages) {
    const full = await gmailFetch(`messages/${msg.id}?format=full`, token);
    const headers = full.payload?.headers || [];
    
    messages.push({
      id: full.id,
      threadId: full.threadId,
      from: extractHeader(headers, 'From'),
      to: extractHeader(headers, 'To'),
      subject: extractHeader(headers, 'Subject'),
      body: extractBody(full.payload),
      date: extractHeader(headers, 'Date'),
      snippet: full.snippet || '',
    });
  }
  
  return messages;
}

export async function sendReply(threadId: string, to: string, subject: string, body: string): Promise<void> {
  const token = await getAccessToken();
  
  const fromEmail = process.env.GMAIL_FROM_EMAIL || 'info@missfinchnyc.com';
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  
  const rawMessage = [
    `From: Miss Finch NYC <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${threadId}`,
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    body,
  ].join('\r\n');
  
  const encoded = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  await gmailFetch('messages/send', token, {
    method: 'POST',
    body: JSON.stringify({ raw: encoded, threadId }),
  });
}

export async function markAsRead(messageId: string): Promise<void> {
  const token = await getAccessToken();
  await gmailFetch(`messages/${messageId}/modify`, token, {
    method: 'POST',
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

export async function addLabel(messageId: string, labelName: string): Promise<void> {
  const token = await getAccessToken();
  // Get or create label
  const labels = await gmailFetch('labels', token);
  let label = labels.labels?.find((l: { name: string }) => l.name === labelName);
  if (!label) {
    label = await gmailFetch('labels', token, {
      method: 'POST',
      body: JSON.stringify({ name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
    });
  }
  await gmailFetch(`messages/${messageId}/modify`, token, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: [label.id] }),
  });
}
