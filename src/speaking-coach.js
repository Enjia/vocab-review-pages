const DEFAULT_BACKEND_URL = "https://vocab-review-pages.vercel.app/api/realtime-session";
const DEFAULT_LIMIT = 12;
const REALTIME_SDP_URL = "https://api.openai.com/v1/realtime/calls";

export function selectPracticeEntries({ current, entries, limit = DEFAULT_LIMIT }) {
  const selected = [];
  const byKey = new Map();

  for (const entry of [current, ...(entries || [])]) {
    if (!entry?.term) continue;
    const key = entry.id || entry.term;
    const existing = byKey.get(key);
    byKey.set(key, chooseRicherEntry(existing, entry));
  }

  for (const entry of byKey.values()) {
    selected.push(entry);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildPracticePayload({ mode, module, pack, current, entries, level = "intermediate" }) {
  return {
    mode,
    moduleId: module?.title || "",
    packId: pack?.title || "",
    level,
    words: selectPracticeEntries({ current, entries }).map(toPracticeWord),
  };
}

export function getRealtimeClientSecret(response) {
  return response?.clientSecret || response?.client_secret?.value || response?.client_secret || "";
}

export class SpeakingCoachClient {
  constructor({ getPayload, setStatus, renderTranscript, remoteAudio, fetchImpl = fetch, backendUrl = DEFAULT_BACKEND_URL } = {}) {
    this.getPayload = getPayload;
    this.setStatus = setStatus || (() => {});
    this.renderTranscript = renderTranscript || (() => {});
    this.remoteAudio = remoteAudio;
    this.fetchImpl = fetchImpl;
    this.backendUrl = backendUrl;
    this.peer = null;
    this.dataChannel = null;
    this.mediaStream = null;
    this.transcript = [];
  }

  isActive() {
    return Boolean(this.peer);
  }

  async start() {
    if (this.peer) return;
    assertBrowserSupport();

    const payload = this.getPayload();
    if (!payload.words.length) {
      throw new Error("No vocabulary is available for speaking practice.");
    }

    this.setStatus("Preparing vocabulary context...");
    const session = await this.createSession(payload);
    const clientSecret = getRealtimeClientSecret(session);
    if (!clientSecret) throw new Error("The speaking backend did not return a client secret.");

    this.setStatus("Requesting microphone...");
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.peer = new RTCPeerConnection();
    this.peer.ontrack = (event) => {
      if (this.remoteAudio) {
        this.remoteAudio.srcObject = event.streams[0];
        this.remoteAudio.play?.().catch(() => {});
      }
    };

    for (const track of this.mediaStream.getTracks()) {
      this.peer.addTrack(track, this.mediaStream);
    }

    this.dataChannel = this.peer.createDataChannel("oai-events");
    this.dataChannel.addEventListener("message", (event) => this.handleRealtimeEvent(event));

    this.setStatus("Connecting to AI tutor...");
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    const answerSdp = await this.exchangeSdp(clientSecret, offer.sdp);
    await this.peer.setRemoteDescription({ type: "answer", sdp: answerSdp });

    this.setStatus("Live. Speak naturally.");
  }

  stop() {
    this.dataChannel?.close();
    this.peer?.close();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.dataChannel = null;
    this.peer = null;
    this.mediaStream = null;
    this.setStatus("Stopped.");
  }

  async createSession(payload) {
    if (!this.backendUrl) {
      throw new Error("Missing speaking backend URL.");
    }
    const response = await this.fetchImpl(this.backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vocab-Session": getBrowserSessionId(),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await safeError(response);
      throw new Error(error || `Speaking backend failed: ${response.status}`);
    }
    return response.json();
  }

  async exchangeSdp(clientSecret, sdp) {
    const response = await this.fetchImpl(REALTIME_SDP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: sdp,
    });
    if (!response.ok) {
      throw new Error(`Realtime WebRTC connection failed: ${response.status}`);
    }
    return response.text();
  }

  handleRealtimeEvent(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    const item = normalizeTranscriptEvent(payload);
    if (!item) return;
    this.transcript.push(item);
    this.renderTranscript(this.transcript);
  }
}

function toPracticeWord(entry) {
  return {
    term: entry.term,
    definition: entry.definition || "",
    example: entry.examples?.find((example) => example?.en)?.en || "",
  };
}

function chooseRicherEntry(current, candidate) {
  if (!current) return candidate;
  return entryScore(candidate) > entryScore(current) ? candidate : current;
}

function entryScore(entry) {
  return [entry.definition, entry.examples?.find((example) => example?.en)?.en]
    .filter(Boolean)
    .join(" ").length;
}

function normalizeTranscriptEvent(event) {
  const text =
    event.transcript ||
    event.delta ||
    event.response?.output_text ||
    event.item?.content?.find((content) => content.transcript)?.transcript ||
    "";
  if (!text || !["response.audio_transcript.done", "conversation.item.input_audio_transcription.completed", "response.text.done"].includes(event.type)) {
    return null;
  }
  return {
    role: event.type.includes("input_audio") ? "You" : "Coach",
    text,
  };
}

function assertBrowserSupport() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone capture.");
  }
  if (!globalThis.RTCPeerConnection) {
    throw new Error("This browser does not support WebRTC.");
  }
}

function getBrowserSessionId() {
  const key = "vocab-speaking-session";
  try {
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "session-unavailable";
  }
}

async function safeError(response) {
  try {
    const body = await response.json();
    return body.error;
  } catch {
    return "";
  }
}
