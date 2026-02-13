'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getHealth } from '@/lib/proving-ground';
import type { CortexTelemetry } from '@/lib/proving-ground';

const VOICE_WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL || 'ws://localhost:11436/ws/drive-thru';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  isCombo?: boolean;
  subItems?: string[];
}

interface ChatMessage {
  role: 'customer' | 'crew';
  text: string;
  timestamp: number;
  behavior?: string;
}

interface DebugMetric {
  behavior: string;
  confidence: number;
  topBehaviors: [string, number][];
  omegaMs: number;
  llamaMs: number;
  totalMs: number;
  timestamp: number;
  cortex?: CortexTelemetry;
}

interface QNodeDef { id: number; x: number; y: number; cluster: number; bridge?: boolean; }

// 54-node clustered neural network: 5 clusters + 6 bridge nodes (Ambition System)
// Real OMEGA architecture:
//   0=TextEncoder(8) 1=CryoLiquidLayer(10) 2=HelixKernel(12) 3=PhaseDecoder(10) 4=LlamaBridge(8)
//   Bridge nodes = AmbitionSystem chemical signaling (dopamine, curiosity, arousal, entropy)
const CLUSTER_LABELS = ['TEXT\nENCODER', 'CRYO\nLIQUID', 'HELIX\nKERNEL', 'PHASE\nDECODER', 'LLAMA\nBRIDGE'];
const CLUSTER_X = [30, 100, 185, 270, 340];
const CLUSTER_COLORS = ['#38bdf8', '#34d399', '#f43f5e', '#fbbf24', '#a78bfa'];

function buildNodes(): QNodeDef[] {
  const nodes: QNodeDef[] = [];
  let id = 0;
  const counts = [8, 10, 12, 10, 8];
  counts.forEach((count, ci) => {
    const cx = CLUSTER_X[ci];
    const startY = 130 - (count * 22) / 2;
    for (let i = 0; i < count; i++) {
      const jitter = ((id * 7 + 3) % 11 - 5) * 1.2;
      nodes.push({ id: id++, x: cx + jitter, y: startY + i * 22 + (i % 2) * 4, cluster: ci });
    }
  });
  // 6 bridge nodes — cross-cluster connectors
  const bridgePositions = [
    { x: 65, y: 30 }, { x: 145, y: 230 }, { x: 185, y: 20 },
    { x: 225, y: 240 }, { x: 305, y: 30 }, { x: 305, y: 230 },
  ];
  bridgePositions.forEach(p => {
    nodes.push({ id: id++, x: p.x, y: p.y, cluster: -1, bridge: true });
  });
  return nodes;
}

function buildEdges(nodes: QNodeDef[]): [number, number][] {
  const edges: [number, number][] = [];
  const clusters: Record<number, QNodeDef[]> = {};
  const bridges: QNodeDef[] = [];
  nodes.forEach(n => {
    if (n.bridge) { bridges.push(n); return; }
    if (!clusters[n.cluster]) clusters[n.cluster] = [];
    clusters[n.cluster].push(n);
  });
  // Intra-cluster: connect adjacent nodes in each cluster
  Object.values(clusters).forEach(cl => {
    for (let i = 0; i < cl.length - 1; i++) {
      edges.push([cl[i].id, cl[i + 1].id]);
      if (i + 2 < cl.length && i % 2 === 0) edges.push([cl[i].id, cl[i + 2].id]);
    }
  });
  // Inter-cluster: sparse connections between adjacent clusters
  for (let ci = 0; ci < 4; ci++) {
    const from = clusters[ci], to = clusters[ci + 1];
    if (!from || !to) continue;
    for (let i = 0; i < from.length; i += 2) {
      for (let j = 0; j < to.length; j += 3) {
        edges.push([from[i].id, to[j].id]);
      }
    }
  }
  // Bridge cross-connections — each bridge connects to 3-4 random nodes in 2 clusters
  bridges.forEach((b, bi) => {
    const c1 = bi % 5, c2 = (bi + 2) % 5;
    [c1, c2].forEach(ci => {
      const cl = clusters[ci];
      if (!cl) return;
      for (let i = bi; i < cl.length; i += 3) edges.push([b.id, cl[i].id]);
    });
    // Bridge-to-bridge
    if (bi + 1 < bridges.length) edges.push([b.id, bridges[(bi + 1) % bridges.length].id]);
  });
  return edges;
}

const Q_NODE_LAYOUT = buildNodes();
const Q_EDGES = buildEdges(Q_NODE_LAYOUT);
const NUM_NODES = Q_NODE_LAYOUT.length;

// Radial layout for impressive visualization
const RAD_CX = 155, RAD_CY = 150, RAD_OUTER = 110, RAD_INNER = 40;
const RADIAL: { x: number; y: number }[] = (() => {
  const pos: { x: number; y: number }[] = [];
  const clusterNodes: Record<number, number[]> = {};
  const bridgeIds: number[] = [];
  Q_NODE_LAYOUT.forEach(n => {
    if (n.bridge) bridgeIds.push(n.id);
    else {
      if (!clusterNodes[n.cluster]) clusterNodes[n.cluster] = [];
      clusterNodes[n.cluster].push(n.id);
    }
  });
  const numClusters = CLUSTER_X.length;
  // Place cluster nodes in arcs
  Q_NODE_LAYOUT.forEach(n => {
    if (n.bridge) {
      const bi = bridgeIds.indexOf(n.id);
      const angle = (bi / bridgeIds.length) * Math.PI * 2 - Math.PI / 2;
      pos[n.id] = { x: RAD_CX + Math.cos(angle) * RAD_INNER, y: RAD_CY + Math.sin(angle) * RAD_INNER };
    } else {
      const cl = clusterNodes[n.cluster];
      const idx = cl.indexOf(n.id);
      const baseAngle = (n.cluster / numClusters) * Math.PI * 2 - Math.PI / 2;
      const arcSpan = (Math.PI * 2 / numClusters) * 0.75;
      const t = cl.length > 1 ? idx / (cl.length - 1) : 0.5;
      const angle = baseAngle + (t - 0.5) * arcSpan;
      const rJitter = ((n.id * 7 + 3) % 11 - 5) * 1.5;
      const radius = RAD_OUTER + rJitter;
      pos[n.id] = { x: RAD_CX + Math.cos(angle) * radius, y: RAD_CY + Math.sin(angle) * radius };
    }
  });
  return pos;
})();

function qColor(a: number, intf: boolean): string {
  if (intf) return '#06b6d4';
  if (a < 0.03) return '#e2e8f0';
  const h = 250 - a * 150; // blue(250) -> warm(100)
  const s = 60 + a * 30;
  const l = 65 - a * 20;
  return `hsl(${h},${s}%,${l}%)`;
}

const CA_TAX_RATE = 0.095;

// Local transparent product images (processed with rembg from McDonald's CDN)
const MI = (name: string) => `/menu-img/${name}.png`;

// Emoji fallback map for items whose local image may not load
const FALLBACK_EMOJI: Record<string, string> = {
  burger: '\ud83c\udf54', chicken: '\ud83d\udc14', nuggets: '\ud83e\uddc6', fish: '\ud83d\udc1f',
  fries: '\ud83c\udf5f', drink: '\ud83e\udd64', coffee: '\u2615', pie: '\ud83e\udd67',
  cookie: '\ud83c\udf6a', mcflurry: '\ud83c\udf66', tea: '\ud83c\udf75', lemon: '\ud83c\udf4b',
  oj: '\ud83c\udf4a', chocolate: '\u2615', happy: '\ud83d\ude0a',
  egg: '\ud83e\udd5a', sausage: '\ud83c\udf73', mcmuffin: '\ud83e\uddc7', hash: '\ud83e\udd5f',
  hotcake: '\ud83e\udd5e', burrito: '\ud83c\udf2f', biscuit: '\ud83e\uddc1', pancake: '\ud83e\udd5e',
  default: '\ud83c\udf54',
};
function emojiFor(name: string): string {
  const n = name.toLowerCase();
  for (const [key, emoji] of Object.entries(FALLBACK_EMOJI)) {
    if (n.includes(key)) return emoji;
  }
  return FALLBACK_EMOJI.default;
}

// eslint-disable-next-line @next/next/no-img-element
function MenuImg({ src, alt, className, fbClass }: { src: string; alt: string; className: string; fbClass: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <span className={fbClass}>{emojiFor(alt)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}

const COMBO_MEALS = [
  { num: 1, name: 'Big Mac', desc: 'Med Fries + Med Drink', price: 8.99, img: MI('big-mac') },
  { num: 2, name: 'Quarter Pounder w/ Cheese', desc: 'Med Fries + Med Drink', price: 9.29, img: MI('quarter-pounder') },
  { num: 3, name: 'Double Quarter Pounder', desc: 'Med Fries + Med Drink', price: 10.79, img: MI('double-quarter') },
  { num: 4, name: 'McChicken', desc: 'Med Fries + Med Drink', price: 5.09, img: MI('mcchicken') },
  { num: 5, name: '10pc McNuggets', desc: 'Med Fries + Med Drink', price: 8.49, img: MI('nuggets-10') },
  { num: 6, name: 'Filet-O-Fish', desc: 'Med Fries + Med Drink', price: 7.99, img: MI('filet-o-fish') },
  { num: 7, name: '2 Cheeseburgers', desc: 'Med Fries + Med Drink', price: 5.49, img: MI('cheeseburger') },
  { num: 8, name: 'Crispy Chicken Sandwich', desc: 'Med Fries + Med Drink', price: 8.79, img: MI('mccrispy') },
  { num: 9, name: 'Spicy McCrispy', desc: 'Med Fries + Med Drink', price: 9.09, img: MI('spicy-mccrispy') },
  { num: 10, name: 'Double Cheeseburger', desc: 'Med Fries + Med Drink', price: 6.59, img: MI('double-cheeseburger') },
];

const MENU_SECTIONS = [
  { title: 'Burgers & Sandwiches', items: [
    { name: 'Big Mac', price: 5.69, img: MI('big-mac') },
    { name: 'Quarter Pounder', price: 5.99, img: MI('quarter-pounder') },
    { name: 'McDouble', price: 2.79, img: MI('mcdouble') },
    { name: 'Cheeseburger', price: 2.29, img: MI('cheeseburger') },
    { name: 'McCrispy', price: 5.49, img: MI('mccrispy') },
    { name: 'McChicken', price: 1.89, img: MI('mcchicken') },
  ]},
  { title: 'McNuggets', items: [
    { name: '4pc McNuggets', price: 2.49, img: MI('nuggets-4') },
    { name: '6pc McNuggets', price: 3.69, img: MI('nuggets-6') },
    { name: '10pc McNuggets', price: 5.29, img: MI('nuggets-10') },
    { name: '20pc McNuggets', price: 8.99, img: MI('nuggets-20') },
    { name: '40pc McNuggets', price: 14.99, img: MI('nuggets-40') },
  ]},
  { title: 'Sides & Sweets', items: [
    { name: 'Small Fries', price: 2.19, img: MI('fries-small') },
    { name: 'Medium Fries', price: 3.09, img: MI('fries-medium') },
    { name: 'Large Fries', price: 3.79, img: MI('fries-large') },
    { name: 'Apple Pie', price: 1.69, img: MI('apple-pie') },
    { name: 'McFlurry', price: 4.89, img: MI('mcflurry-oreo') },
    { name: 'Cookies', price: 1.29, img: MI('chocolate-chip-cookie') },
  ]},
  { title: 'Drinks', items: [
    { name: 'Coca-Cola', price: 1.79, img: MI('coca-cola') },
    { name: 'Sprite', price: 1.79, img: MI('sprite') },
    { name: 'Dr Pepper', price: 1.79, img: MI('dr-pepper') },
    { name: 'Sweet Tea', price: 1.79, img: MI('sweet-tea') },
    { name: 'Lemonade', price: 2.29, img: MI('lemonade') },
    { name: 'OJ', price: 2.29, img: MI('orange-juice') },
  ]},
  { title: 'McCaf\u00e9', items: [
    { name: 'Coffee', price: 1.89, img: MI('coffee') },
    { name: 'Iced Coffee', price: 3.29, img: MI('iced-coffee') },
    { name: 'Caramel Frappe', price: 4.79, img: MI('frappe-caramel') },
    { name: 'Mocha Frappe', price: 4.79, img: MI('frappe-mocha') },
    { name: 'Hot Chocolate', price: 2.49, img: MI('hot-chocolate') },
  ]},
  { title: 'Happy Meal', items: [
    { name: '4pc Nuggets HM', price: 5.29, img: MI('happy-meal-nuggets-4') },
    { name: '6pc Nuggets HM', price: 5.79, img: MI('happy-meal-nuggets-6') },
    { name: 'Hamburger HM', price: 4.99, img: MI('happy-meal-hamburger') },
  ]},
];

const BREAKFAST_COMBOS = [
  { num: 1, name: 'Egg McMuffin', desc: 'Hash Brown + Coffee', price: 6.49, img: MI('egg-mcmuffin') },
  { num: 2, name: 'Sausage McMuffin w/ Egg', desc: 'Hash Brown + Coffee', price: 6.79, img: MI('sausage-mcmuffin-egg') },
  { num: 3, name: 'Sausage McMuffin', desc: 'Hash Brown + Coffee', price: 4.99, img: MI('sausage-mcmuffin') },
];

const BREAKFAST_ITEMS = [
  { title: 'Sandwiches', items: [
    { name: 'Egg McMuffin', price: 4.49, img: MI('egg-mcmuffin') },
    { name: 'Sausage McMuffin with Egg', price: 4.79, img: MI('sausage-mcmuffin-egg') },
    { name: 'Sausage McMuffin', price: 2.29, img: MI('sausage-mcmuffin') },
    { name: 'Bacon, Egg & Cheese Biscuit', price: 4.89, img: MI('bacon-egg-biscuit') },
    { name: 'Sausage Burrito', price: 2.49, img: MI('sausage-burrito') },
  ]},
  { title: 'Sides & More', items: [
    { name: 'Hash Browns', price: 1.89, img: MI('hash-browns') },
    { name: 'Hotcakes', price: 3.99, img: MI('hotcakes') },
    { name: 'Hotcakes & Sausage', price: 5.49, img: MI('hotcakes-sausage') },
  ]},
  { title: 'McCafé Breakfast', items: [
    { name: 'Premium Roast Coffee', price: 1.89, img: MI('coffee') },
    { name: 'Iced Coffee', price: 2.79, img: MI('iced-coffee') },
    { name: 'Orange Juice', price: 2.29, img: MI('orange-juice') },
  ]},
];

const COMBO_LOOKUP: Record<string, { comboName: string; comboPrice: number; includes: string[] }> = {};
COMBO_MEALS.forEach(m => {
  COMBO_LOOKUP[m.name.toLowerCase()] = {
    comboName: `${m.name} Combo`,
    comboPrice: m.price,
    includes: ['Med Fries', 'Med Drink'],
  };
});

const ITEM_IMG: Record<string, string> = {};
COMBO_MEALS.forEach(m => { ITEM_IMG[m.name.toLowerCase()] = m.img; ITEM_IMG[`${m.name.toLowerCase()} combo`] = m.img; });
MENU_SECTIONS.forEach(s => s.items.forEach(m => { ITEM_IMG[m.name.toLowerCase()] = m.img; }));
BREAKFAST_COMBOS.forEach(m => { ITEM_IMG[m.name.toLowerCase()] = m.img; });
BREAKFAST_ITEMS.forEach(s => s.items.forEach(m => { ITEM_IMG[m.name.toLowerCase()] = m.img; }));

function getItemImg(name: string): string {
  const k = name.toLowerCase().replace(' combo', '');
  return ITEM_IMG[k] || ITEM_IMG[name.toLowerCase()] || '';
}

function GoldenArches({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 90" width={size} height={size * 0.75}>
      <path
        d="M10,85 Q10,10 30,10 Q50,10 50,55 Q50,10 70,10 Q90,10 90,85"
        fill="none" stroke="#FFC72C" strokeWidth="12" strokeLinecap="round"
      />
    </svg>
  );
}

export function DriveThrough({ onBack }: { onBack?: () => void } = {}) {
  const [mounted, setMounted] = useState(false);
  const [menuTab, setMenuTab] = useState<'breakfast' | 'dayMenu'>('dayMenu');
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [debugOpen, setDebugOpen] = useState(true);
  const [devDetached, setDevDetached] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<DebugMetric[]>([]);
  const [qActivations, setQActivations] = useState<number[]>(Array(NUM_NODES).fill(0));
  const [qInterference, setQInterference] = useState<boolean[]>(Array(NUM_NODES).fill(false));
  const [streamingText, setStreamingText] = useState('');

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const orderIdCounter = useRef(0);
  const orderScrollRef = useRef<HTMLDivElement>(null);
  const processedResultsRef = useRef<Set<number>>(new Set());
  const autoListenRef = useRef(false);
  const startListenRef = useRef<() => void>(() => {});
  const devWindowRef = useRef<Window | null>(null);
  const devMountRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const streamingTextRef = useRef('');
  const currentResponseRef = useRef<{ behavior: string; confidence: number; topBehaviors: [string, number][]; omegaMs: number; cortex?: CortexTelemetry }>({ behavior: '', confidence: 0, topBehaviors: [], omegaMs: 0 });
  // Enhancement 1: Streaming audio via MediaSource
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const pendingAudioRef = useRef<Uint8Array[]>([]);
  const streamingAudioActiveRef = useRef(false);
  // Enhancement 2: AudioWorklet mic capture
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  // Enhancement 3: Reconnection backoff
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    audioCtxRef.current = new AudioContext();
    getHealth().catch(() => {});
  }, []);

  useEffect(() => {
    orderScrollRef.current?.scrollTo({ top: orderScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [order]);

  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => {
      setQActivations(prev => prev.map(v => v * 0.92));
      setQInterference(prev => prev.map(() => false));
    }, 120);
    return () => clearInterval(iv);
  }, [isActive]);

  // Dev pane popup window management
  const handleDetachDev = useCallback(() => {
    if (devWindowRef.current && !devWindowRef.current.closed) {
      devWindowRef.current.focus();
      return;
    }
    const w = window.open('', 'OMEGA_DEV', 'width=440,height=900,menubar=no,toolbar=no,location=no');
    if (!w) return;
    w.document.title = 'OMEGA DEV — Neural Monitor';
    w.document.head.innerHTML = `<meta charset="utf-8"><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #fafbfc; overflow: hidden; font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace; }
      #dev-root { width: 100%; height: 100vh; display: flex; flex-direction: column; }
    </style>`;
    // Copy ALL parent stylesheets (including styled-jsx global) into popup
    Array.from(document.querySelectorAll('style')).forEach(sheet => {
      const s = w.document.createElement('style');
      s.textContent = sheet.textContent || '';
      w.document.head.appendChild(s);
    });
    // Also copy <link> stylesheets
    Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach(link => {
      const l = w.document.createElement('link');
      l.rel = 'stylesheet';
      l.href = (link as HTMLLinkElement).href;
      w.document.head.appendChild(l);
    });
    const mount = w.document.createElement('div');
    mount.id = 'dev-root';
    w.document.body.appendChild(mount);
    devWindowRef.current = w;
    devMountRef.current = mount;
    setDevDetached(true);
    // Keep styles synced — observe new style elements added to parent
    const observer = new MutationObserver((mutations) => {
      if (!w || w.closed) { observer.disconnect(); return; }
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLStyleElement) {
            const s = w.document.createElement('style');
            s.textContent = node.textContent || '';
            w.document.head.appendChild(s);
          }
        }
      }
    });
    observer.observe(document.head, { childList: true });
    w.addEventListener('beforeunload', () => {
      observer.disconnect();
      devWindowRef.current = null;
      devMountRef.current = null;
      setDevDetached(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (devWindowRef.current && !devWindowRef.current.closed) devWindowRef.current.close();
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      // Cleanup mic capture
      if (workletNodeRef.current) { workletNodeRef.current.disconnect(); workletNodeRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
      // Cleanup reconnect timer
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      autoListenRef.current = false;
    };
  }, []);

  const stopTTS = useCallback(() => {
    // Stop AudioBufferSourceNode (fallback path)
    try { sourceNodeRef.current?.stop(); } catch {}
    sourceNodeRef.current = null;
    // Stop Audio element (streaming path)
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.onended = null;
      try { URL.revokeObjectURL(audioElRef.current.src); } catch {}
      audioElRef.current = null;
    }
    if (mediaSourceRef.current?.readyState === 'open') {
      try { mediaSourceRef.current.endOfStream(); } catch {}
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    pendingAudioRef.current = [];
    streamingAudioActiveRef.current = false;
    setIsSpeaking(false);
  }, []);

  // -- Streaming audio helpers (Enhancement 1) --
  const canStreamAudio = typeof window !== 'undefined' && typeof MediaSource !== 'undefined'
    && MediaSource.isTypeSupported('audio/mpeg');

  const flushSourceBuffer = useCallback(() => {
    const sb = sourceBufferRef.current;
    if (!sb || sb.updating || pendingAudioRef.current.length === 0) return;
    const chunk = pendingAudioRef.current.shift()!;
    try { sb.appendBuffer(chunk.buffer as ArrayBuffer); } catch { /* buffer full or closed */ }
  }, []);

  const initStreamingAudio = useCallback(() => {
    if (!canStreamAudio) { streamingAudioActiveRef.current = false; return; }
    streamingAudioActiveRef.current = true;
    pendingAudioRef.current = [];
    const audio = new Audio();
    const ms = new MediaSource();
    audio.src = URL.createObjectURL(ms);
    audioElRef.current = audio;
    mediaSourceRef.current = ms;
    ms.addEventListener('sourceopen', () => {
      try {
        const sb = ms.addSourceBuffer('audio/mpeg');
        sourceBufferRef.current = sb;
        sb.addEventListener('updateend', flushSourceBuffer);
        flushSourceBuffer(); // flush any chunks queued before sourceopen
      } catch (e) {
        console.warn('SourceBuffer creation failed:', e);
        streamingAudioActiveRef.current = false;
      }
    });
    audio.play().catch(() => {}); // autoplay (user gesture already happened via mic click)
  }, [canStreamAudio, flushSourceBuffer]);

  const appendStreamingChunk = useCallback((chunk: Uint8Array) => {
    if (!streamingAudioActiveRef.current) {
      audioChunksRef.current.push(chunk); // fallback: accumulate
      return;
    }
    pendingAudioRef.current.push(chunk);
    flushSourceBuffer();
  }, [flushSourceBuffer]);

  const finalizeStreamingAudio = useCallback((): Promise<void> => {
    if (!streamingAudioActiveRef.current) {
      // Fallback: play accumulated audio
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      if (chunks.length === 0) { setIsSpeaking(false); return Promise.resolve(); }
      const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
      return blob.arrayBuffer().then(async (arrayBuf) => {
        const ctx = audioCtxRef.current;
        if (!ctx) { setIsSpeaking(false); return; }
        if (ctx.state === 'suspended') await ctx.resume();
        try {
          const decoded = await ctx.decodeAudioData(arrayBuf);
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);
          sourceNodeRef.current = source;
          return new Promise<void>(resolve => {
            source.onended = () => {
              sourceNodeRef.current = null;
              setIsSpeaking(false);
              if (autoListenRef.current && recognitionRef.current === null) {
                setTimeout(() => { startListenRef.current(); }, 120);
              }
              resolve();
            };
            source.start();
          });
        } catch { setIsSpeaking(false); }
      });
    }
    // Streaming path: wait for all pending appends, then endOfStream
    return new Promise<void>(resolve => {
      const checkDone = () => {
        const sb = sourceBufferRef.current;
        const ms = mediaSourceRef.current;
        if (pendingAudioRef.current.length > 0 || sb?.updating) {
          setTimeout(checkDone, 30);
          return;
        }
        if (ms?.readyState === 'open') {
          try { ms.endOfStream(); } catch {}
        }
        const audio = audioElRef.current;
        if (audio) {
          audio.onended = () => {
            try { URL.revokeObjectURL(audio.src); } catch {}
            audioElRef.current = null;
            mediaSourceRef.current = null;
            sourceBufferRef.current = null;
            streamingAudioActiveRef.current = false;
            setIsSpeaking(false);
            if (autoListenRef.current && recognitionRef.current === null) {
              setTimeout(() => { startListenRef.current(); }, 120);
            }
            resolve();
          };
          // If audio already ended (very short), trigger immediately
          if (audio.ended) { audio.onended(new Event('ended') as any); }
        } else {
          setIsSpeaking(false);
          resolve();
        }
      };
      checkDone();
    });
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setLiveTranscript('');
  }, []);

  // Enhancement 2: AudioWorklet mic capture — streams raw PCM to voice server for VAD + STT
  const stopAudioCapture = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  const startAudioCapture = useCallback(async () => {
    stopAudioCapture();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    try {
      await ctx.audioWorklet.addModule('/pcm-processor.js');
    } catch { /* already loaded */ }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true } });
      micStreamRef.current = stream;
      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor');
      workletNodeRef.current = worklet;
      worklet.port.onmessage = (e) => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN && e.data?.pcm) {
          const u8 = new Uint8Array(e.data.pcm);
          let binary = '';
          for (let j = 0; j < u8.length; j++) binary += String.fromCharCode(u8[j]);
          const b64 = btoa(binary);
          ws.send(JSON.stringify({ type: 'audio', data: b64 }));
        }
      };
      source.connect(worklet);
      // worklet output not connected — we don't play mic back
    } catch (err) {
      console.warn('Mic capture failed:', err);
    }
  }, [stopAudioCapture]);

  const endConversation = useCallback(async () => {
    autoListenRef.current = false;
    stopListening();
    stopTTS();
    stopAudioCapture();
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    reconnectAttemptsRef.current = 0;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsActive(false);
    setIsListening(false);
    setStreamingText('');
  }, [stopListening, stopTTS, stopAudioCapture]);

  const endConvoRef = useRef(endConversation);
  endConvoRef.current = endConversation;

  const syncOrderFromServer = useCallback((serverOrder: { items: Array<{ item: string; quantity: number; unit_price: number; line_total: number; is_meal: boolean; drink?: string; sauce?: string; customizations?: string[] }>; running_total: number }) => {
    if (!serverOrder?.items) return;
    const newOrder: OrderItem[] = serverOrder.items.map((entry, i) => {
      const subItems: string[] = [];
      if (entry.is_meal) {
        subItems.push('Medium Fries');
        subItems.push(entry.drink || 'Medium Drink');
      }
      if (entry.sauce) subItems.push(`${entry.sauce} sauce`);
      if (entry.customizations?.length) subItems.push(...entry.customizations);
      return {
        id: `srv-${i}`,
        name: entry.is_meal ? `${entry.item} Combo` : entry.item,
        price: entry.unit_price,
        qty: entry.quantity,
        isCombo: entry.is_meal,
        subItems: subItems.length > 0 ? subItems : undefined,
      };
    });
    setOrder(newOrder);
  }, []);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Deterministic neural network activation from OMEGA telemetry
  const updateNeuralViz = useCallback((conf: number, topBeh: [string, number][], omegaMs: number) => {
    const spread = (id: number, base: number, range: number) =>
      base + range * ((((id * 137 + 97) % 100) / 100) * 0.6 + 0.4);
    setQActivations(() => {
      const a = Array(NUM_NODES).fill(0.02);
      const sensoryAct = Math.min(1, omegaMs / 100);
      for (let i = 0; i < 8; i++) a[i] = spread(i, sensoryAct * 0.4, sensoryAct * 0.5);
      topBeh.forEach((pair: [string, number]) => {
        const s = pair[1];
        for (let i = 8; i < 18; i++) a[i] = Math.max(a[i], s * spread(i, 0.3, 0.5));
      });
      for (let i = 18; i < 30; i++) a[i] = spread(i, conf * 0.5, conf * 0.5);
      for (let i = 30; i < 40; i++) a[i] = spread(i, conf * 0.3, conf * 0.4);
      // LlamaBridge: streaming, so estimate latency from omegaMs
      const motorAct = Math.min(1, omegaMs / 200);
      for (let i = 40; i < 48; i++) a[i] = spread(i, motorAct * 0.3, conf * 0.3);
      for (let i = 48; i < NUM_NODES; i++) a[i] = spread(i, conf * 0.4, conf * 0.3);
      return a;
    });
    if (topBeh.length >= 2 && topBeh[0][1] - topBeh[1][1] < 0.15) {
      setQInterference(() => {
        const fl = Array(NUM_NODES).fill(false) as boolean[];
        const gap = topBeh[0][1] - topBeh[1][1];
        for (let i = 18; i < 30; i++) fl[i] = ((i * 137 + 97) % 100) / 100 > gap * 5;
        for (let i = 48; i < NUM_NODES; i++) fl[i] = true;
        return fl;
      });
    }
  }, []);

  // Connect to Voice Pipeline WebSocket
  const connectVoiceWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    const responseStartTime = { current: 0 };
    const ws = new WebSocket(VOICE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0; // Reset backoff on successful connect
      ws.send(JSON.stringify({ type: 'start' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'ready':
            break;

          case 'response_start':
            responseStartTime.current = Date.now();
            setIsProcessing(true);
            setIsSpeaking(true);
            streamingTextRef.current = '';
            setStreamingText('');
            audioChunksRef.current = [];
            currentResponseRef.current = {
              behavior: msg.behavior || '',
              confidence: msg.confidence || 0,
              topBehaviors: msg.top_behaviors || [],
              omegaMs: msg.omega_ms || 0,
            };
            // Init streaming audio (MediaSource if supported, else accumulate)
            initStreamingAudio();
            // Fire neural viz immediately on OMEGA decision
            updateNeuralViz(msg.confidence || 0, msg.top_behaviors || [], msg.omega_ms || 0);
            break;

          case 'response_text':
            streamingTextRef.current += (msg.chunk || '');
            setStreamingText(streamingTextRef.current);
            break;

          case 'audio': {
            const binary = atob(msg.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            appendStreamingChunk(bytes);
            break;
          }

          case 'response_end': {
            setIsProcessing(false);
            setStreamingText('');
            const cr = currentResponseRef.current;
            const totalMs = Date.now() - responseStartTime.current;
            // Add crew message to conversation
            if (streamingTextRef.current) {
              const crewMsg: ChatMessage = {
                role: 'crew', text: streamingTextRef.current,
                timestamp: Date.now(), behavior: cr.behavior,
              };
              setMessages(prev => [...prev, crewMsg]);
            }
            // Update debug metrics
            setDebugMetrics(prev => [...prev.slice(-29), {
              behavior: cr.behavior,
              confidence: cr.confidence,
              topBehaviors: cr.topBehaviors,
              omegaMs: cr.omegaMs,
              llamaMs: totalMs - cr.omegaMs,
              totalMs,
              timestamp: Date.now(),
              cortex: cr.cortex,
            }]);
            // Auto-end detection
            const rLower = (streamingTextRef.current || '').toLowerCase();
            if (cr.behavior === 'close_order' || /drive around|drive.?thru|pickup window|have a great/.test(rLower)) {
              finalizeStreamingAudio().then(() => {
                setTimeout(() => { endConvoRef.current(); }, 2000);
              });
              return;
            }
            // Finalize streaming audio (or play accumulated fallback)
            finalizeStreamingAudio();
            break;
          }

          case 'order_update':
            if (msg.order) syncOrderFromServer(msg.order);
            break;

          case 'cortex': {
            const { type: _t, ...cortexData } = msg;
            currentResponseRef.current.cortex = cortexData as CortexTelemetry;
            break;
          }

          case 'clear_audio':
            // Barge-in: server killed generation, flush local playback
            try { sourceNodeRef.current?.stop(); } catch {}
            sourceNodeRef.current = null;
            if (audioElRef.current) {
              audioElRef.current.pause();
              audioElRef.current.onended = null;
              try { URL.revokeObjectURL(audioElRef.current.src); } catch {}
              audioElRef.current = null;
            }
            if (mediaSourceRef.current?.readyState === 'open') {
              try { mediaSourceRef.current.endOfStream(); } catch {}
            }
            mediaSourceRef.current = null;
            sourceBufferRef.current = null;
            pendingAudioRef.current = [];
            streamingAudioActiveRef.current = false;
            audioChunksRef.current = [];
            setStreamingText('');
            setIsSpeaking(false);
            break;

          case 'listening':
            setIsProcessing(false);
            // Only auto-start STT if no audio is currently playing (either path).
            if (!sourceNodeRef.current && !audioElRef.current && autoListenRef.current && recognitionRef.current === null) {
              setTimeout(() => { startListenRef.current(); }, 120);
            }
            break;

          case 'transcript':
            // Server-side STT result (when using audio streaming path)
            if (msg.text) {
              setMessages(prev => [...prev, { role: 'customer', text: msg.text, timestamp: Date.now() }]);
            }
            break;

          case 'error':
            console.error('Voice pipeline error:', msg.message);
            setIsProcessing(false);
            setIsSpeaking(false);
            setStreamingText('');
            streamingTextRef.current = '';
            break;
        }
      } catch (err) {
        console.warn('WS message parse error:', err);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Enhancement 3: Reconnect with exponential backoff if conversation is still active
      if (autoListenRef.current && reconnectAttemptsRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
        reconnectAttemptsRef.current++;
        console.warn(`Voice WS closed, reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`);
        reconnectTimerRef.current = setTimeout(() => {
          if (autoListenRef.current) connectVoiceWS();
        }, delay);
      }
    };
    ws.onerror = () => {
      console.warn('Voice WS failed — voice server may not be running on', VOICE_WS_URL);
      wsRef.current = null;
      // Fallback: show greeting via text-only and start listening
      const greeting = "Hi, welcome to McDonald's! What can I get for you?";
      setMessages(prev => [...prev, { role: 'crew', text: greeting, timestamp: Date.now(), behavior: 'greet' }]);
      setIsSpeaking(false);
      setIsProcessing(false);
      if (autoListenRef.current) {
        setTimeout(() => { startListenRef.current(); }, 300);
      }
    };
  }, [syncOrderFromServer, updateNeuralViz, initStreamingAudio, appendStreamingChunk, finalizeStreamingAudio]);

  // Send customer text via WebSocket (replaces REST omegaInfer)
  const handleCustomerMessage = useCallback(async (text: string) => {
    stopTTS();
    stopListening();
    setStreamingText('');
    streamingTextRef.current = '';
    setMessages(prev => [...prev, { role: 'customer', text, timestamp: Date.now() }]);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text', text }));
      setIsProcessing(true);
    } else {
      // WS disconnected — reconnect and queue message after session init
      console.warn('Voice WS not connected, attempting reconnect...');
      connectVoiceWS();
      const retryWs = wsRef.current;
      if (retryWs) {
        // connectVoiceWS sends 'start' on open; queue 'text' after server 'ready'
        const origHandler = retryWs.onmessage;
        retryWs.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'ready' || msg.type === 'listening') {
              retryWs.send(JSON.stringify({ type: 'text', text }));
              setIsProcessing(true);
            }
          } catch {}
          // Restore original handler for all subsequent messages
          retryWs.onmessage = origHandler;
          if (origHandler) origHandler.call(retryWs, event);
        };
      } else {
        setMessages(prev => [...prev, { role: 'crew', text: "I'm sorry, I couldn't connect. Please try again.", timestamp: Date.now() }]);
      }
    }
  }, [stopTTS, stopListening, connectVoiceWS]);

  const msgRef = useRef(handleCustomerMessage);
  msgRef.current = handleCustomerMessage;

  const startListening = useCallback(() => {
    if (recognitionRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      const text = prompt('Type your order:');
      if (text) msgRef.current(text);
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.maxAlternatives = 1;

    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const finalText = e.results[i][0].transcript.trim();
          if (finalText && !processedResultsRef.current.has(i)) {
            processedResultsRef.current.add(i);
            setLiveTranscript('');
            msgRef.current(finalText);
          }
        } else {
          interim += e.results[i][0].transcript;
          if (interim.length > 2) {
            stopTTS();
            audioChunksRef.current = [];
            // Notify server to kill Ollama + ElevenLabs generation
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
            }
          }
        }
      }
      if (interim) setLiveTranscript(interim);
    };

    r.onerror = (e: any) => {
      if (e.error === 'no-speech') return;
      console.warn('Speech recognition error:', e.error);
      setIsListening(false);
      setLiveTranscript('');
    };

    r.onend = () => {
      if (recognitionRef.current === r) {
        try { processedResultsRef.current.clear(); r.start(); }
        catch { setIsListening(false); }
      }
    };

    recognitionRef.current = r;
    processedResultsRef.current.clear();
    r.start();
    setIsListening(true);
  }, [stopTTS]);

  startListenRef.current = startListening;

  const toggleConversation = useCallback(async () => {
    if (!isActive) {
      setIsActive(true);
      setOrder([]);
      setMessages([]);
      setDebugMetrics([]);
      setStreamingText('');
      processedResultsRef.current.clear();
      autoListenRef.current = true;
      reconnectAttemptsRef.current = 0;
      // Resume AudioContext (browsers require user gesture)
      if (audioCtxRef.current?.state === 'suspended') {
        try { await audioCtxRef.current.resume(); } catch {}
      }
      // Connect to voice pipeline WS — server handles greeting + TTS
      connectVoiceWS();
      // Start AudioWorklet mic capture for server-side VAD + STT
      startAudioCapture();
    } else {
      autoListenRef.current = false;
      stopTTS();
      stopListening();
      stopAudioCapture();
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end' }));
        wsRef.current.close();
      }
      wsRef.current = null;
      setIsActive(false);
      setIsListening(false);
      setIsSpeaking(false);
      setStreamingText('');
    }
  }, [isActive, connectVoiceWS, startAudioCapture, stopAudioCapture, stopTTS, stopListening]);

  const handleMicPress = useCallback(() => {
    if (!isActive) { toggleConversation(); return; }
    if (isSpeaking) {
      // Barge-in: stop local playback + clear buffer + notify server
      stopTTS();
      audioChunksRef.current = [];
      setStreamingText('');
      streamingTextRef.current = '';
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
      }
      startListening();
      return;
    }
    if (isListening) stopListening();
    else startListening();
  }, [isActive, isListening, isSpeaking, toggleConversation, stopTTS, stopListening, startListening]);

  const subtotal = order.reduce((s, o) => s + o.price * o.qty, 0);
  const tax = subtotal * CA_TAX_RATE;
  const total = subtotal + tax;

  const lastMetric = debugMetrics.length > 0 ? debugMetrics[debugMetrics.length - 1] : null;

  // Compute standard NN metrics from collected data
  const n = debugMetrics.length;
  const sortedMs = n > 0 ? [...debugMetrics].map(m => m.totalMs).sort((a, b) => a - b) : [];
  const confs = n > 0 ? debugMetrics.map(m => m.confidence) : [];
  const confMean = n > 0 ? confs.reduce((a, b) => a + b, 0) / n : 0;
  const confStd = n > 1 ? Math.sqrt(confs.reduce((s, c) => s + (c - confMean) ** 2, 0) / (n - 1)) : 0;
  const confMin = n > 0 ? Math.min(...confs) : 0;
  const confMax = n > 0 ? Math.max(...confs) : 0;
  const p50 = n > 0 ? sortedMs[Math.floor(n * 0.5)] : 0;
  const p95 = n > 0 ? sortedMs[Math.floor(n * 0.95)] : 0;
  const p99 = n > 0 ? sortedMs[Math.min(n - 1, Math.floor(n * 0.99))] : 0;
  const elapsed = n > 1 ? (debugMetrics[n - 1].timestamp - debugMetrics[0].timestamp) / 60000 : 0;
  const throughput = elapsed > 0 ? n / elapsed : 0;
  const topB = lastMetric?.topBehaviors || [];
  const entropy = topB.length > 0
    ? -topB.reduce((s, [, p]) => s + (p > 0 ? p * Math.log2(p) : 0), 0) : 0;
  const ctx = lastMetric?.cortex;  // Real cortex telemetry from OMEGA

  // Dev pane content — used both inline and in popup portal
  const devPaneContent = (
    <div className={`dbg ${devDetached ? 'detached' : ''}`}>
      <div className="dbg-head">
        <span className="dbg-title">OMEGA DEV</span>
        <div className="dbg-btns">
          {devDetached ? (
            <button className="dbg-btn" onClick={() => {
              if (devWindowRef.current) devWindowRef.current.close();
            }}>Reattach</button>
          ) : (<>
            <button className="dbg-btn" onClick={handleDetachDev}>Pop Out</button>
            <button className="dbg-btn close" onClick={() => setDebugOpen(false)}>&times;</button>
          </>)}
        </div>
      </div>
      <div className="dbg-body">
        {/* Neural network — radial visualization */}
        <div className="dbg-sec">
          <div className="dbg-lbl">Q-Node Network <span className="dbg-dim">{NUM_NODES} nodes · {Q_EDGES.length} edges</span></div>
          <svg viewBox="0 0 310 310" className="dbg-svg">
            <defs>
              <filter id="nglow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="nglow2"><feGaussianBlur stdDeviation="6" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <radialGradient id="hub-grad"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.15"/><stop offset="100%" stopColor="#6366f1" stopOpacity="0"/></radialGradient>
              {CLUSTER_COLORS.map((c, i) => (
                <linearGradient key={i} id={`eg${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={c} stopOpacity="0.6"/>
                  <stop offset="100%" stopColor={c} stopOpacity="0.05"/>
                </linearGradient>
              ))}
            </defs>
            {/* Concentric guide rings */}
            <circle cx={RAD_CX} cy={RAD_CY} r={RAD_OUTER} fill="none" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.5"/>
            <circle cx={RAD_CX} cy={RAD_CY} r={RAD_INNER} fill="none" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.4"/>
            <circle cx={RAD_CX} cy={RAD_CY} r={22} fill="url(#hub-grad)"/>
            {/* Cluster label arcs */}
            {CLUSTER_LABELS.map((label, ci) => {
              const angle = (ci / CLUSTER_LABELS.length) * Math.PI * 2 - Math.PI / 2;
              const lx = RAD_CX + Math.cos(angle) * (RAD_OUTER + 24);
              const ly = RAD_CY + Math.sin(angle) * (RAD_OUTER + 24);
              return (
                <text key={ci} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                  fill={CLUSTER_COLORS[ci]} opacity="0.8"
                  style={{ fontSize: '6px', fontWeight: 700, letterSpacing: '0.5px', fontFamily: 'inherit' }}
                >{label.replace('\n', ' ')}</text>
              );
            })}
            {/* Edges — curved paths through center with flow animation */}
            {Q_EDGES.map(([from, to], i) => {
              const a = RADIAL[from], b = RADIAL[to];
              const str = Math.max(qActivations[from], qActivations[to]);
              if (str < 0.02) return null;
              const isBridge = Q_NODE_LAYOUT[from].bridge || Q_NODE_LAYOUT[to].bridge;
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              const dx = mx - RAD_CX, dy = my - RAD_CY;
              const pull = isBridge ? 0.15 : 0.3;
              const cx1 = mx - dx * pull, cy1 = my - dy * pull;
              const clr = Q_NODE_LAYOUT[from].cluster >= 0 ? CLUSTER_COLORS[Q_NODE_LAYOUT[from].cluster] : '#94a3b8';
              return (
                <path key={i}
                  d={`M${a.x},${a.y} Q${cx1},${cy1} ${b.x},${b.y}`}
                  fill="none" stroke={clr}
                  strokeWidth={str > 0.4 ? 1.5 : 0.5}
                  opacity={Math.min(0.8, str * 0.6)}
                  strokeDasharray={str > 0.3 ? '4,3' : 'none'}
                  className={str > 0.3 ? 'dbg-edge-flow' : undefined}
                />
              );
            })}
            {/* Nodes — circles with glow halos */}
            {Q_NODE_LAYOUT.map(node => {
              const p = RADIAL[node.id];
              const act = qActivations[node.id];
              const intf = qInterference[node.id];
              const r = node.bridge ? 3.5 : 5;
              const clr = node.bridge
                ? (intf ? '#06b6d4' : act > 0.2 ? '#818cf8' : '#cbd5e1')
                : qColor(act, intf);
              const cColor = node.cluster >= 0 ? CLUSTER_COLORS[node.cluster] : '#94a3b8';
              return (
                <g key={node.id}>
                  {act > 0.4 && (
                    <circle cx={p.x} cy={p.y} r={r + 8}
                      fill={cColor} opacity={act * 0.12}
                      filter="url(#nglow2)"
                    />
                  )}
                  {act > 0.2 && (
                    <circle cx={p.x} cy={p.y} r={r + 4}
                      fill="none" stroke={cColor}
                      strokeWidth="0.8" opacity={act * 0.3}
                      className={act > 0.5 ? 'dbg-pulse' : undefined}
                    />
                  )}
                  {intf && (
                    <circle cx={p.x} cy={p.y} r={r + 10}
                      fill="none" stroke="#06b6d4" strokeWidth="1.5"
                      opacity="0.7" className="dbg-intf"
                    />
                  )}
                  {node.bridge ? (
                    <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2}
                      fill={clr} rx="1"
                      transform={`rotate(45,${p.x},${p.y})`}
                      stroke="#818cf8" strokeWidth="0.6" opacity={Math.max(0.5, act + 0.3)}
                    />
                  ) : (
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={clr}
                      stroke={cColor} strokeWidth={act > 0.3 ? 1.2 : 0.4}
                      opacity={Math.max(0.5, act + 0.3)}
                      filter={act > 0.6 ? 'url(#nglow)' : undefined}
                    />
                  )}
                </g>
              );
            })}
            {/* Center hub — current behavior */}
            <circle cx={RAD_CX} cy={RAD_CY} r={15} fill="white" stroke="#e2e8f0" strokeWidth="1"/>
            {lastMetric ? (<>
              <text x={RAD_CX} y={RAD_CY - 1} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '6px', fontWeight: 700, fill: '#1e293b', fontFamily: 'inherit' }}
              >{lastMetric.behavior}</text>
              <text x={RAD_CX} y={RAD_CY + 7} textAnchor="middle"
                style={{ fontSize: '5px', fill: '#6366f1', fontWeight: 600, fontFamily: 'inherit' }}
              >{(lastMetric.confidence * 100).toFixed(0)}%</text>
            </>) : (
              <text x={RAD_CX} y={RAD_CY} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '6px', fill: '#94a3b8', fontFamily: 'inherit' }}
              >IDLE</text>
            )}
          </svg>
        </div>

        {/* Last inference */}
        <div className="dbg-sec">
          <div className="dbg-lbl">Last Inference</div>
          {lastMetric ? (
            <div className="dbg-grid2">
              <span className="dbg-k">behavior</span><span className="dbg-v accent">{lastMetric.behavior}</span>
              <span className="dbg-k">confidence</span><span className="dbg-v">{(lastMetric.confidence * 100).toFixed(1)}%</span>
              <span className="dbg-k">omega</span><span className="dbg-v">{lastMetric.omegaMs.toFixed(0)} ms</span>
              <span className="dbg-k">llama</span><span className="dbg-v">{lastMetric.llamaMs.toFixed(0)} ms</span>
              <span className="dbg-k">total</span><span className="dbg-v">{lastMetric.totalMs.toFixed(0)} ms</span>
              <span className="dbg-k">H(decision)</span><span className="dbg-v">{entropy.toFixed(2)} bits</span>
            </div>
          ) : (
            <div className="dbg-idle">Awaiting inference…</div>
          )}
        </div>

        {/* Network statistics */}
        {n > 0 && (
          <div className="dbg-sec">
            <div className="dbg-lbl">Network Statistics <span className="dbg-dim">n={n}</span></div>
            <div className="dbg-grid2">
              <span className="dbg-k">throughput</span><span className="dbg-v">{throughput > 0 ? throughput.toFixed(1) + ' inf/min' : '–'}</span>
              <span className="dbg-k">latency p50</span><span className="dbg-v">{p50.toFixed(0)} ms</span>
              <span className="dbg-k">latency p95</span><span className="dbg-v">{p95.toFixed(0)} ms</span>
              <span className="dbg-k">latency p99</span><span className="dbg-v">{p99.toFixed(0)} ms</span>
              <span className="dbg-k">conf μ</span><span className="dbg-v">{(confMean * 100).toFixed(1)}%</span>
              <span className="dbg-k">conf σ</span><span className="dbg-v">{(confStd * 100).toFixed(1)}%</span>
              <span className="dbg-k">conf range</span><span className="dbg-v">{(confMin * 100).toFixed(0)}–{(confMax * 100).toFixed(0)}%</span>
              <span className="dbg-k">behaviors</span><span className="dbg-v">{new Set(debugMetrics.map(m => m.behavior)).size}</span>
              <span className="dbg-k">entropy</span><span className="dbg-v">{entropy.toFixed(2)} bits</span>
            </div>
          </div>
        )}

        {/* Real cortex telemetry from OMEGA's CryoLiquidLayer */}
        {ctx && (
          <div className="dbg-sec">
            <div className="dbg-lbl">Cortex State <span className="dbg-dim">dim={ctx.hidden_dim}</span></div>
            <div className="dbg-grid2">
              <span className="dbg-k">coherence</span><span className="dbg-v accent">{ctx.coherence.toFixed(4)}</span>
              <span className="dbg-k">‖state‖₁</span><span className="dbg-v">{ctx.state_norm.toFixed(1)}</span>
              <span className="dbg-k">|out| μ</span><span className="dbg-v">{ctx.output_magnitude_mean.toFixed(4)}</span>
              <span className="dbg-k">|out| σ</span><span className="dbg-v">{ctx.output_magnitude_std.toFixed(4)}</span>
              <span className="dbg-k">|out| max</span><span className="dbg-v">{ctx.output_magnitude_max.toFixed(4)}</span>
              <span className="dbg-k">∠out μ</span><span className="dbg-v">{ctx.output_phase_mean.toFixed(4)} rad</span>
              <span className="dbg-k">∠out σ</span><span className="dbg-v">{ctx.output_phase_std.toFixed(4)} rad</span>
              <span className="dbg-k">sparsity</span><span className="dbg-v">{(ctx.output_sparsity * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* Behavior distribution */}
        {topB.length > 0 && (
          <div className="dbg-sec">
            <div className="dbg-lbl">Behavior Distribution</div>
            {topB.map(([b, s], i) => (
              <div key={i} className="dbg-bar-row">
                <span className="dbg-bar-name">{b}</span>
                <div className="dbg-bar-track">
                  <div className="dbg-bar-fill" style={{ width: `${s * 100}%` }} />
                </div>
                <span className="dbg-bar-pct">{(s * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Inference log */}
        <div className="dbg-sec">
          <div className="dbg-lbl">Inference Log</div>
          {n === 0 && <div className="dbg-idle">No inferences yet</div>}
          {debugMetrics.slice(-20).reverse().map((m, i) => (
            <div key={i} className="dbg-log-row">
              <span className="dbg-log-ts">{new Date(m.timestamp).toLocaleTimeString()}</span>
              <span className="dbg-log-beh">{m.behavior}</span>
              <span className="dbg-log-conf">{(m.confidence * 100).toFixed(0)}%</span>
              <span className="dbg-log-ms">{m.totalMs.toFixed(0)}ms</span>
            </div>
          ))}
        </div>
      </div>
      <div className="dbg-foot">
        OMEGA v4.18.0 · {NUM_NODES} nodes · {Q_EDGES.length} edges · ElevenLabs TTS
      </div>
    </div>
  );

  if (!mounted) {
    return <div style={{ position: 'fixed', inset: 0, background: '#27251F' }} />;
  }

  return (
    <div className={`dt-root ${!devDetached && debugOpen ? 'dbg-on' : ''}`}>
      {/* ═══ LEFT 2/3 — Dark Menu Board ═══ */}
      <div className="dt-menu">
        {/* Small logo + name top-left */}
        <div className="dt-logo-bar">
          {onBack && (
            <button onClick={onBack} className="dt-back-btn" title="Back to OMEGA Lab">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <GoldenArches size={32} />
          <span className="dt-logo-text">McDonald&apos;s</span>
        </div>

        {/* ─── Menu Category Tabs ─── */}
        <div className="dt-tabs">
          <button
            className={`dt-tab ${menuTab === 'breakfast' ? 'active' : ''}`}
            onClick={() => setMenuTab('breakfast')}
          >
            <span className="dt-tab-icon">☀️</span>
            <span className="dt-tab-label">Breakfast</span>
          </button>
          <button
            className={`dt-tab ${menuTab === 'dayMenu' ? 'active' : ''}`}
            onClick={() => setMenuTab('dayMenu')}
          >
            <span className="dt-tab-icon">🍔</span>
            <span className="dt-tab-label">Day Menu</span>
          </button>
        </div>

        <div className="dt-menu-scroll">
          {menuTab === 'breakfast' ? (<>
            {/* Breakfast Combos */}
            <div className="dt-sec">
              <h3 className="dt-sec-title">Breakfast Combos</h3>
              <div className="dt-combos">
                {BREAKFAST_COMBOS.map(m => (
                  <div key={m.num} className="dt-combo">
                    <span className="dt-combo-num">{m.num}</span>
                    <div className="dt-combo-img-wrap">
                      <MenuImg src={m.img} alt={m.name} className="dt-combo-img" fbClass="dt-combo-img-fb" />
                    </div>
                    <div className="dt-combo-info">
                      <span className="dt-combo-name">{m.name} Combo</span>
                      <span className="dt-combo-desc">Includes: {m.desc}</span>
                    </div>
                    <span className="dt-combo-price">${m.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Breakfast Grid sections */}
            {BREAKFAST_ITEMS.map(sec => (
              <div key={sec.title} className="dt-sec">
                <h3 className="dt-sec-title">{sec.title}</h3>
                <div className="dt-grid">
                  {sec.items.map(item => (
                    <div key={item.name} className="dt-grid-item">
                      <MenuImg src={item.img} alt={item.name} className="dt-gi-emoji" fbClass="dt-gi-emoji-fb" />
                      <span className="dt-gi-name">{item.name}</span>
                      <span className="dt-gi-price">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>) : (<>
            {/* Combo Meals — larger display */}
            <div className="dt-sec">
              <h3 className="dt-sec-title">Combo Meals</h3>
              <div className="dt-combos">
                {COMBO_MEALS.map(m => (
                  <div key={m.num} className="dt-combo">
                    <span className="dt-combo-num">{m.num}</span>
                    <div className="dt-combo-img-wrap">
                      <MenuImg src={m.img} alt={m.name} className="dt-combo-img" fbClass="dt-combo-img-fb" />
                    </div>
                    <div className="dt-combo-info">
                      <span className="dt-combo-name">{m.name} Combo</span>
                      <span className="dt-combo-desc">Includes: {m.desc}</span>
                    </div>
                    <span className="dt-combo-price">${m.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid sections */}
            {MENU_SECTIONS.map(sec => (
              <div key={sec.title} className="dt-sec">
                <h3 className="dt-sec-title">{sec.title}</h3>
                <div className="dt-grid">
                  {sec.items.map(item => (
                    <div key={item.name} className="dt-grid-item">
                      <MenuImg src={item.img} alt={item.name} className="dt-gi-emoji" fbClass="dt-gi-emoji-fb" />
                      <span className="dt-gi-name">{item.name}</span>
                      <span className="dt-gi-price">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>)}
        </div>
      </div>

      {/* ═══ RIGHT 1/3 — White Order Pane ═══ */}
      <div className="dt-order">
        {/* Mic button — icon-only, state shown via color/animation */}
        <div className="dt-mic-area">
          <button
            className={`dt-mic ${isActive ? 'active' : ''} ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''} ${isProcessing ? 'processing' : ''}`}
            onClick={handleMicPress}
          >
            {isListening ? (
              <div className="dt-waves"><span /><span /><span /><span /><span /></div>
            ) : isSpeaking ? (
              <div className="dt-speak-waves"><span /><span /><span /></div>
            ) : isProcessing ? (
              <div className="dt-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
            {isListening && <><div className="dt-ring r1" /><div className="dt-ring r2" /><div className="dt-ring r3" /></>}
          </button>
        </div>

        {/* Live streaming text indicator (Enhancement 4) */}
        {streamingText && (
          <div className="dt-stream-text">
            <span className="dt-stream-label">🗣️</span>
            <span className="dt-stream-content">{streamingText}<span className="dt-stream-cursor" /></span>
          </div>
        )}
        {liveTranscript && (
          <div className="dt-stream-text dt-stream-customer">
            <span className="dt-stream-label">🎤</span>
            <span className="dt-stream-content">{liveTranscript}</span>
          </div>
        )}

        {/* Order title */}
        <div className="dt-order-head">Order Details</div>

        {/* Order items */}
        <div className="dt-order-items" ref={orderScrollRef}>
          {order.length === 0 && (
            <div className="dt-order-empty">
              {isActive ? 'Waiting for your order...' : 'Your order will appear here'}
            </div>
          )}
          {order.map((item, i) => (
            <div key={item.id} className="dt-item" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="dt-item-body">
                <div className="dt-item-top">
                  <span className="dt-item-name">
                    {item.name}
                    {item.isCombo && <span className="dt-combo-badge">COMBO</span>}
                  </span>
                  <span className="dt-item-price">${(item.price * item.qty).toFixed(2)}</span>
                </div>
                {item.qty > 1 && (
                  <div className="dt-item-qty">{item.qty}x &middot; ${item.price.toFixed(2)} each</div>
                )}
                {item.subItems && item.subItems.length > 0 && (
                  <div className="dt-item-subs">
                    {item.subItems.map((sub, si) => (
                      <div key={si} className="dt-item-sub">{sub}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals pinned to bottom */}
        <div className="dt-totals">
          <div className="dt-totals-line"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="dt-totals-line"><span>CA Tax (9.5%)</span><span>${tax.toFixed(2)}</span></div>
          <div className="dt-totals-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>
      </div>

      {/* ═══ Developer Debug Pane — inline or detached popup ═══ */}
      {devDetached && devMountRef.current
        ? createPortal(devPaneContent, devMountRef.current)
        : debugOpen
          ? devPaneContent
          : (
            <div className="dbg-tab" onClick={() => setDebugOpen(true)}>
              <span>D</span><span>E</span><span>V</span>
            </div>
          )
      }

      <style jsx>{`
        .dt-root {
          position: fixed; top: 0; bottom: 0; left: 0; right: 0;
          display: flex;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          overflow: hidden;
          transition: right 0.3s ease;
        }

        /* ── LEFT: Menu ── */
        .dt-menu {
          flex: 2; min-width: 0;
          background: #27251F;
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .dt-logo-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 24px;
          background: #1a1816;
          border-bottom: 2px solid #FFC72C;
        }
        .dt-back-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,199,44,0.1); border: 1px solid rgba(255,199,44,0.25);
          color: #FFC72C; cursor: pointer; transition: all 0.15s;
          flex-shrink: 0;
        }
        .dt-back-btn:hover {
          background: rgba(255,199,44,0.2); border-color: #FFC72C;
        }
        .dt-logo-text {
          font-size: 26px; font-weight: 800; color: #FFC72C;
          letter-spacing: -0.3px;
        }
        /* ── Menu Tabs ── */
        .dt-tabs {
          display: flex; gap: 0;
          padding: 0;
          background: linear-gradient(180deg, #1a1816 0%, #201e1a 100%);
          border-bottom: 1px solid rgba(255,199,44,0.1);
          flex-shrink: 0;
        }
        .dt-tab {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 16px;
          background: transparent;
          border: none; border-bottom: 3px solid transparent;
          color: rgba(255,255,255,0.4);
          font-family: inherit;
          font-size: 15px; font-weight: 700;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        .dt-tab::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 100%, rgba(255,199,44,0.08) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .dt-tab:hover {
          color: rgba(255,255,255,0.7);
        }
        .dt-tab:hover::before { opacity: 1; }
        .dt-tab.active {
          color: #FFC72C;
          border-bottom-color: #FFC72C;
        }
        .dt-tab.active::before { opacity: 1; }
        .dt-tab.active::after {
          content: '';
          position: absolute; bottom: -1px; left: 50%; transform: translateX(-50%);
          width: 60%; height: 3px;
          background: #FFC72C;
          border-radius: 3px 3px 0 0;
          box-shadow: 0 0 12px rgba(255,199,44,0.5), 0 0 24px rgba(255,199,44,0.2);
        }
        .dt-tab-icon {
          font-size: 18px;
          line-height: 1;
          position: relative;
          z-index: 1;
        }
        .dt-tab-label {
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-size: 13px;
          position: relative;
          z-index: 1;
        }

        .dt-menu-scroll {
          flex: 1; overflow-y: auto;
          padding: 16px 24px 40px;
        }
        .dt-sec { margin-bottom: 20px; }
        .dt-sec-title {
          font-size: 17px; font-weight: 800; color: #FFC72C;
          text-transform: uppercase; letter-spacing: 1.5px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255,199,44,0.15);
          margin-bottom: 10px;
        }

        /* Combos */
        .dt-combos { display: flex; flex-direction: column; gap: 0; }
        .dt-combo {
          display: grid;
          grid-template-columns: 30px 52px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          border-radius: 8px;
          min-height: 52px;
        }
        .dt-combo:hover { background: rgba(255,199,44,0.06); }
        .dt-combo-num {
          width: 30px; height: 30px; border-radius: 50%;
          background: #DA291C; color: white;
          font-size: 14px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          justify-self: center;
        }
        .dt-combo-img-wrap {
          width: 52px; height: 42px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
        }
        .dt-combo-img { max-width: 48px; max-height: 38px; width: auto; height: auto; object-fit: contain; display: block; }
        .dt-combo-img-fb { font-size: 28px; line-height: 42px; width: 52px; height: 42px; text-align: center; flex-shrink: 0; display: block; }
        .dt-combo-info { min-width: 0; }
        .dt-combo-name { display: block; font-size: 16px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dt-combo-desc { display: block; font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 1px; }
        .dt-combo-price { font-size: 17px; font-weight: 700; color: #FFC72C; font-variant-numeric: tabular-nums; text-align: right; }

        /* Grid items */
        .dt-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 6px;
        }
        .dt-grid-item {
          display: flex; flex-direction: column; align-items: center;
          padding: 10px 6px; border-radius: 8px;
          text-align: center;
        }
        .dt-grid-item:hover { background: rgba(255,199,44,0.06); }
        .dt-gi-emoji { width: 56px; height: 56px; object-fit: contain; margin-bottom: 6px; }
        .dt-gi-emoji-fb { font-size: 36px; line-height: 56px; width: 56px; height: 56px; text-align: center; display: block; }
        .dt-gi-name { font-size: 14px; color: rgba(255,255,255,0.9); line-height: 1.3; font-weight: 500; }
        .dt-gi-price { font-size: 16px; font-weight: 700; color: #FFC72C; margin-top: 3px; }

        /* ── RIGHT: Order Pane (white) ── */
        .dt-order {
          flex: 1; min-width: 280px;
          background: #fafafa;
          display: flex; flex-direction: column;
          border: 2px solid #222;
        }

        /* Streaming text indicator (Enhancement 4) */
        .dt-stream-text {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 20px;
          background: linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 100%);
          border-bottom: 1px solid #e0e8f0;
          animation: stream-in 0.2s ease-out;
        }
        .dt-stream-text.dt-stream-customer {
          background: linear-gradient(135deg, #f7f7f0 0%, #f4f2e8 100%);
        }
        @keyframes stream-in {
          from { opacity: 0; max-height: 0; padding: 0 20px; }
          to { opacity: 1; max-height: 100px; padding: 10px 20px; }
        }
        .dt-stream-label {
          font-size: 16px; line-height: 1.4; flex-shrink: 0;
        }
        .dt-stream-content {
          font-size: 13px; color: #334155; line-height: 1.5;
          font-style: italic; word-break: break-word;
        }
        .dt-stream-cursor {
          display: inline-block; width: 2px; height: 14px;
          background: #DA291C; margin-left: 1px;
          vertical-align: text-bottom;
          animation: cursor-blink 0.6s step-end infinite;
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* Mic area */
        .dt-mic-area {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 14px 20px;
          border-bottom: 1px solid #e8e8e8;
          background: #fff;
        }
        .dt-mic {
          width: 52px; height: 52px; border-radius: 50%;
          background: #f0f0f0; border: 2px solid #ddd;
          color: #666; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          position: relative; transition: all 0.2s;
          flex-shrink: 0;
        }
        .dt-mic:hover { background: #e8e8e8; border-color: #ccc; color: #333; }
        .dt-mic:active { transform: scale(0.95); }
        .dt-mic.active { background: #DA291C; border-color: #DA291C; color: white; }
        .dt-mic.listening {
          background: #DA291C; border-color: #FFC72C; color: white;
          animation: mic-pulse 1.5s ease-in-out infinite;
        }
        .dt-mic.speaking {
          background: #FFC72C; border-color: #FFC72C; color: #27251F;
          animation: speak-pulse 2s ease-in-out infinite;
        }
        .dt-mic.processing {
          background: #f0f0f0; border-color: #ddd; color: #999;
        }
        @keyframes mic-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(218,41,28,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(218,41,28,0); }
        }
        @keyframes speak-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,199,44,0.3); }
          50% { box-shadow: 0 0 0 10px rgba(255,199,44,0); }
        }
        .dt-speak-waves { display: flex; gap: 4px; align-items: center; height: 24px; }
        .dt-speak-waves span {
          width: 4px; border-radius: 2px; background: #27251F;
          animation: swave 1.2s ease-in-out infinite;
        }
        .dt-speak-waves span:nth-child(1) { height: 10px; animation-delay: 0s; }
        .dt-speak-waves span:nth-child(2) { height: 18px; animation-delay: 0.2s; }
        .dt-speak-waves span:nth-child(3) { height: 10px; animation-delay: 0.4s; }
        @keyframes swave {
          0%,100% { transform: scaleY(0.6); }
          50% { transform: scaleY(1.2); }
        }
        .dt-spinner {
          width: 20px; height: 20px; border-radius: 50%;
          border: 3px solid #ddd; border-top-color: #DA291C;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* Order head */
        .dt-order-head {
          padding: 12px 20px 12px;
          font-size: 18px; font-weight: 700; color: #222;
        }
        .dt-order-head::after {
          content: '';
          display: block;
          margin-top: 10px;
          margin-right: 0;
          border-bottom: 1.5px solid #222;
        }

        /* Order items */
        .dt-order-items { flex: 1; overflow-y: auto; padding: 8px 0; }
        .dt-order-empty {
          padding: 40px 20px; text-align: center;
          color: #bbb; font-size: 14px;
        }
        .dt-item {
          display: flex; gap: 12px;
          padding: 12px 20px;
          border-bottom: 1px solid #f0f0f0;
          animation: item-in 0.3s ease-out both;
        }
        @keyframes item-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dt-item-emoji { width: 40px; height: 40px; object-fit: contain; flex-shrink: 0; border-radius: 4px; }
        .dt-item-emoji-fb { font-size: 28px; line-height: 40px; width: 40px; height: 40px; text-align: center; flex-shrink: 0; display: block; }
        .dt-item-body { flex: 1; min-width: 0; }
        .dt-item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .dt-item-name { font-size: 15px; font-weight: 600; color: #222; }
        .dt-combo-badge {
          display: inline-block;
          font-size: 9px; font-weight: 800; color: white;
          background: #DA291C; padding: 1px 6px; border-radius: 3px;
          margin-left: 6px; vertical-align: middle;
          letter-spacing: 0.5px;
        }
        .dt-item-price { font-size: 15px; font-weight: 700; color: #222; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .dt-item-qty { font-size: 12px; color: #999; margin-top: 2px; }
        .dt-item-subs { margin-top: 4px; padding-left: 4px; }
        .dt-item-sub {
          font-size: 12px; color: #888; padding: 1px 0 1px 12px;
          position: relative;
        }
        .dt-item-sub::before {
          content: '';
          position: absolute; left: 0; top: 8px;
          width: 4px; height: 4px; border-radius: 50%;
          background: #ccc;
        }

        /* Totals */
        .dt-totals {
          padding: 16px 20px;
          border-top: 2px solid #e0e0e0;
          background: #fff;
        }
        .dt-totals-line {
          display: flex; justify-content: space-between;
          font-size: 14px; color: #888; padding: 3px 0;
          font-variant-numeric: tabular-nums;
        }
        .dt-totals-total {
          display: flex; justify-content: space-between;
          font-size: 22px; font-weight: 800; color: #222;
          padding-top: 10px; margin-top: 8px;
          border-top: 2px solid #222;
          font-variant-numeric: tabular-nums;
        }

        /* Shared: waves, rings */
        .dt-waves { display: flex; gap: 3px; align-items: center; height: 24px; }
        .dt-waves span {
          width: 3px; border-radius: 2px; background: white;
          animation: wbar 0.8s ease-in-out infinite;
        }
        .dt-waves span:nth-child(1) { height: 8px; }
        .dt-waves span:nth-child(2) { height: 14px; animation-delay: 0.1s; }
        .dt-waves span:nth-child(3) { height: 20px; animation-delay: 0.2s; }
        .dt-waves span:nth-child(4) { height: 14px; animation-delay: 0.3s; }
        .dt-waves span:nth-child(5) { height: 8px; animation-delay: 0.4s; }
        @keyframes wbar {
          0%,100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.3); }
        }
        .dt-ring {
          position: absolute; inset: -3px; border-radius: 50%;
          border: 2px solid rgba(218,41,28,0.3);
          animation: ring-out 2s ease-out infinite;
        }
        .dt-ring.r2 { animation-delay: 0.6s; }
        .dt-ring.r3 { animation-delay: 1.2s; }
        @keyframes ring-out {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }

        /* Scrollbars */
        .dt-menu-scroll::-webkit-scrollbar,
        .dt-order-items::-webkit-scrollbar { width: 5px; }
        .dt-menu-scroll::-webkit-scrollbar-track { background: transparent; }
        .dt-menu-scroll::-webkit-scrollbar-thumb { background: rgba(255,199,44,0.15); border-radius: 3px; }
        .dt-order-items::-webkit-scrollbar-track { background: transparent; }
        .dt-order-items::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }

      `}</style>
      <style jsx global>{`
        /* ── Dev Pane: light theme monitoring dashboard ── */
        .dbg {
          width: 400px; flex-shrink: 0;
          background: #fafbfc;
          display: flex; flex-direction: column;
          border-left: 1px solid #e2e8f0;
          font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', Menlo, monospace;
          font-size: 12px;
          color: #334155;
          overflow: hidden;
          transition: width 0.3s ease;
        }
        .dbg.detached { width: 100%; height: 100vh; border-left: none; }

        .dbg-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
        }
        .dbg-title {
          font-size: 12px; font-weight: 800; color: #0f172a;
          letter-spacing: 1.5px; text-transform: uppercase;
        }
        .dbg-btns { display: flex; gap: 4px; }
        .dbg-btn {
          padding: 4px 10px; border-radius: 5px;
          background: #f1f5f9; color: #475569;
          border: 1px solid #e2e8f0; cursor: pointer;
          font-family: inherit; font-size: 10px; font-weight: 500;
          transition: all 0.15s;
        }
        .dbg-btn:hover { background: #e2e8f0; color: #0f172a; }
        .dbg-btn.close { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
        .dbg-btn.close:hover { background: #fee2e2; }

        .dbg-body {
          flex: 1; overflow-y: auto;
          padding: 14px 16px;
        }
        .dbg-body::-webkit-scrollbar { width: 4px; }
        .dbg-body::-webkit-scrollbar-track { background: transparent; }
        .dbg-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }

        .dbg-sec { margin-bottom: 20px; }
        .dbg-sec:last-child { margin-bottom: 0; }
        .dbg-lbl {
          font-size: 11px; font-weight: 700; color: #475569;
          letter-spacing: 0.8px; text-transform: uppercase;
          margin-bottom: 8px;
          display: flex; align-items: baseline; gap: 8px;
        }
        .dbg-dim { font-weight: 400; font-size: 9px; color: #94a3b8; letter-spacing: 0; text-transform: none; }

        /* SVG visualization */
        .dbg-svg { width: 100%; height: auto; border-radius: 8px; background: #fff; border: 1px solid #f1f5f9; }

        /* Animations */
        .dbg-intf { animation: dbg-intf-ring 0.6s ease-out; }
        @keyframes dbg-intf-ring {
          0% { opacity: 0.8; stroke-width: 2; }
          100% { opacity: 0; stroke-width: 0.5; }
        }
        .dbg-pulse { animation: dbg-node-pulse 1.5s ease-in-out infinite; }
        @keyframes dbg-node-pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
        .dbg-edge-flow { animation: dbg-flow 1.2s linear infinite; }
        @keyframes dbg-flow {
          0% { stroke-dashoffset: 14; }
          100% { stroke-dashoffset: 0; }
        }

        /* Metric grid */
        .dbg-grid2 {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0 16px;
          align-items: baseline;
        }
        .dbg-k { font-size: 12px; color: #475569; padding: 3px 0; }
        .dbg-v {
          font-size: 12px; color: #0f172a; font-weight: 700;
          font-variant-numeric: tabular-nums;
          text-align: right; padding: 3px 0;
        }
        .dbg-v.accent { color: #6366f1; }
        .dbg-idle { font-size: 12px; color: #94a3b8; padding: 6px 0; font-style: italic; }

        /* Behavior bars */
        .dbg-bar-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
        .dbg-bar-name {
          width: 100px; font-size: 10px; color: #64748b;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dbg-bar-track { flex: 1; height: 5px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
        .dbg-bar-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, #818cf8, #6366f1);
          transition: width 0.3s ease;
        }
        .dbg-bar-pct {
          width: 32px; text-align: right;
          font-size: 10px; color: #0f172a; font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        /* Inference log */
        .dbg-log-row {
          display: flex; gap: 8px; padding: 4px 0;
          font-size: 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .dbg-log-row:last-child { border-bottom: none; }
        .dbg-log-ts { color: #94a3b8; width: 64px; flex-shrink: 0; }
        .dbg-log-beh { color: #6366f1; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dbg-log-conf { color: #0f172a; width: 30px; text-align: right; font-weight: 700; }
        .dbg-log-ms { color: #64748b; width: 40px; text-align: right; }

        .dbg-foot {
          padding: 8px 16px;
          background: #fff;
          border-top: 1px solid #e2e8f0;
          font-size: 9px; color: #94a3b8;
          letter-spacing: 0.5px;
        }

        .dbg-tab {
          width: 36px; flex-shrink: 0;
          background: #fafbfc;
          border-left: 1px solid #e2e8f0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 4px; cursor: pointer;
          transition: background 0.15s;
          font-family: inherit;
        }
        .dbg-tab:hover { background: #f1f5f9; }
        .dbg-tab span {
          font-size: 11px; font-weight: 700; color: #64748b;
          letter-spacing: 2px;
        }
      `}</style>
    </div>
  );
}
