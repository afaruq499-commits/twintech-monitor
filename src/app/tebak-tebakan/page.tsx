"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, RotateCcw, Volume2, VolumeX } from "lucide-react";

interface QuizItem {
  id: number;
  question: string;
  category: string;
  normalAnswer: string;
  sillyAnswer: string;
}

const QUIZ_DATA: QuizItem[] = [
  {
    id: 1,
    category: "Logika Dasar",
    question: "Kucing apa yang paling romantis dan setia seumur hidup?",
    normalAnswer: "Kucing Persia Asli",
    sillyAnswer: "Kucing-ta padamu selamanya",
  },
  {
    id: 2,
    category: "Observasi",
    question: "Kenapa kopi hitam rasanya pahit tanpa gula?",
    normalAnswer: "Kandungan senyawa kafein",
    sillyAnswer: "Karena manisnya ada di senyummu",
  },
  {
    id: 3,
    category: "Masa Depan",
    question: "Tempat tinggal mana yang paling aman dan bikin tenang?",
    normalAnswer: "Apartemen penthouse pusat kota",
    sillyAnswer: "Rumah tangga kita berdua",
  },
  {
    id: 4,
    category: "Pertanyaan Terakhir",
    question: "Siapa sosok misterius yang diam-diam selalu memperhatikanmu?",
    normalAnswer: "Agen rahasia intelijen",
    sillyAnswer: "Buka dan periksa fotonya sekarang",
  },
];

export default function TebakTebakanPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isJumpscare, setIsJumpscare] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Status kabur & posisi
  const [runOffset, setRunOffset] = useState({ x: 0, y: 0 });
  const [isPanicking, setIsPanicking] = useState(false);

  const runBtnRef = useRef<HTMLButtonElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const panicIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastChaseTimeRef = useRef<number>(0);
  const pointerPosRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });

  const currentQuiz = QUIZ_DATA[currentIndex];

  // Inisialisasi Audio Context
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Suara whoosh halus saat kabur
  const playWhoosh = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Ignored
    }
  }, [audioEnabled]);

  // Suara Jumpscare
  const playJumpscareSound = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(3600, now);
      filter.Q.setValueAtTime(3, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 1.8);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.linearRampToValueAtTime(3200, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(350, now + 1.4);

      oscGain.gain.setValueAtTime(0.85, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.4);

      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = "square";
      bass.frequency.setValueAtTime(140, now);
      bass.frequency.exponentialRampToValueAtTime(30, now + 1.2);

      bassGain.gain.setValueAtTime(0.9, now);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

      bass.connect(bassGain);
      bassGain.connect(ctx.destination);
      bass.start(now);
      bass.stop(now + 1.2);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 100, 300, 100, 500]);
      }
    } catch {
      // Ignored
    }
  };

  // Fungsi untuk melompatkan tombol ke posisi acak baru di layar
  const jumpRandomly = useCallback(() => {
    const btn = runBtnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const btnW = rect.width || 340;
    const btnH = rect.height || 50;
    const pad = 24;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Posisi target acak baru di layar
    const targetX = Math.floor(Math.random() * (screenW - btnW - pad * 2)) + pad;
    const targetY = Math.floor(Math.random() * (screenH - btnH - pad * 2)) + pad;

    // Hitung offset relatif dari posisi tombol asal (ketika transform = 0,0)
    // rect.left - runOffset.x adalah posisi origin tombol
    const originX = rect.left - runOffset.x;
    const originY = rect.top - runOffset.y;

    const newOffsetX = targetX - originX;
    const newOffsetY = targetY - originY;

    playWhoosh();
    setRunOffset({ x: newOffsetX, y: newOffsetY });
  }, [playWhoosh, runOffset]);

  // Hentikan kepanikan dan kembalikan tombol ke tempat asal
  const returnToOrigin = useCallback(() => {
    if (panicIntervalRef.current) {
      clearInterval(panicIntervalRef.current);
      panicIntervalRef.current = null;
    }
    setIsPanicking(false);
    setRunOffset({ x: 0, y: 0 }); // Kembali mulus ke sarangnya!
  }, []);

  // Periksa apakah kursor sedang mengejar tombol
  const checkChaseStatus = useCallback(
    (pointerX: number, pointerY: number) => {
      const btn = runBtnRef.current;
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const btnCenterX = rect.left + rect.width / 2;
      const btnCenterY = rect.top + rect.height / 2;

      const distance = Math.hypot(btnCenterX - pointerX, btnCenterY - pointerY);
      const panicRadius = 150; // Radius ancaman kursor mendekat

      if (distance < panicRadius) {
        lastChaseTimeRef.current = Date.now();

        // Jika belum panik, aktifkan mode panik lari terus tanpa henti!
        if (!isPanicking) {
          setIsPanicking(true);
          jumpRandomly();

          // Loop kabur terus berpindah-pindah random setiap 240ms selagi dikejar!
          if (!panicIntervalRef.current) {
            panicIntervalRef.current = setInterval(() => {
              const timeSinceLastChase = Date.now() - lastChaseTimeRef.current;

              // Jika kursor sudah menjauh atau tidak mengejar lagi selama > 650ms, tombol pulang
              if (timeSinceLastChase > 650) {
                returnToOrigin();
              } else {
                jumpRandomly();
              }
            }, 240);
          }
        }
      } else {
        // Jika kursor berada jauh (> 250px) dan tombol sedang panik
        const safeDistance = 250;
        if (distance > safeDistance && isPanicking) {
          const timeSinceLastChase = Date.now() - lastChaseTimeRef.current;
          if (timeSinceLastChase > 500) {
            returnToOrigin();
          }
        }
      }
    },
    [isPanicking, jumpRandomly, returnToOrigin]
  );

  // Global mouse tracker
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isJumpscare || isFinished) return;
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
      checkChaseStatus(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (panicIntervalRef.current) clearInterval(panicIntervalRef.current);
    };
  }, [checkChaseStatus, isJumpscare, isFinished]);

  // Touch listener untuk HP
  const handleTouchChase = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      pointerPosRef.current = { x: touch.clientX, y: touch.clientY };
      checkChaseStatus(touch.clientX, touch.clientY);
    }
  };

  // Pilih jawaban nyeleneh
  const handleSelectSilly = () => {
    returnToOrigin();

    if (currentIndex === QUIZ_DATA.length - 1) {
      setIsJumpscare(true);
      playJumpscareSound();

      setTimeout(() => {
        setIsJumpscare(false);
        setIsFinished(true);
      }, 2200);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleRestart = () => {
    setIsFinished(false);
    setIsJumpscare(false);
    setCurrentIndex(0);
    returnToOrigin();
  };

  return (
    <div className="relative min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 selection:bg-neutral-800 selection:text-white select-none overflow-hidden font-sans">
      {/* Background Subtle Ambient Glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-neutral-800/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-neutral-800/30 blur-3xl" />

      {/* Audio Controller */}
      <button
        onClick={() => setAudioEnabled(!audioEnabled)}
        className="fixed top-5 right-5 z-40 flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 px-3.5 py-1.5 text-xs text-neutral-400 backdrop-blur hover:border-neutral-700 hover:text-white transition"
      >
        {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        <span>{audioEnabled ? "Audio On" : "Muted"}</span>
      </button>

      {/* JUMPSCARE VIEW */}
      {isJumpscare && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden animate-jumpscare-shake">
          <div className="absolute inset-0 bg-red-600/30 mix-blend-color-dodge animate-pulse pointer-events-none" />
          <div className="relative z-10 scale-125 md:scale-150 animate-jumpscare-zoom">
            <svg
              width="320"
              height="360"
              viewBox="0 0 200 240"
              className="drop-shadow-[0_0_50px_rgba(255,0,0,0.9)] filter contrast-200"
            >
              <path
                d="M 30,110 C 20,40 180,40 170,110 C 165,160 145,210 100,210 C 55,210 35,160 30,110 Z"
                fill="#d8d5ce"
                stroke="#000"
                strokeWidth="4"
              />
              <ellipse cx="65" cy="95" rx="26" ry="32" fill="#000" />
              <ellipse cx="135" cy="95" rx="26" ry="32" fill="#000" />
              <circle cx="65" cy="95" r="9" fill="#ff0000" />
              <circle cx="135" cy="95" r="9" fill="#ff0000" />
              <circle cx="65" cy="95" r="4" fill="#ffffff" />
              <circle cx="135" cy="95" r="4" fill="#ffffff" />
              <polygon points="95,128 92,142 98,142" fill="#000" />
              <polygon points="105,128 102,142 108,142" fill="#000" />
              <path
                d="M 50,155 Q 100,138 150,155 Q 155,202 100,208 Q 45,202 50,155 Z"
                fill="#000"
                stroke="#600"
                strokeWidth="2"
              />
              <polygon points="56,155 64,172 72,155" fill="#fff" />
              <polygon points="74,154 83,174 92,154" fill="#fff" />
              <polygon points="94,153 100,175 106,153" fill="#fff" />
              <polygon points="108,154 117,174 126,154" fill="#fff" />
              <polygon points="128,155 136,172 144,155" fill="#fff" />
              <polygon points="60,195 68,178 76,195" fill="#fff" />
              <polygon points="78,198 87,176 96,198" fill="#fff" />
              <polygon points="104,198 113,176 122,198" fill="#fff" />
              <polygon points="124,195 132,178 140,195" fill="#fff" />
            </svg>
          </div>
          <div className="mt-8 z-10 text-center font-black tracking-widest text-red-600 text-3xl md:text-5xl uppercase drop-shadow-[0_0_20px_#ff0000]">
            KAGET KAN?! 💀
          </div>
        </div>
      )}

      {/* ENDING SCREEN */}
      {isFinished && (
        <div className="relative z-20 w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/95 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 text-2xl">
            ✌️
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-2">
            Hehehe, kaget ya?
          </h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Tombol jawaban normalnya emang dibuat kabur terus dan gamau disentuh biar kamu milih jawaban yang nyeleneh.
            Jangan marah ya, cuma mau bikin senyum hari ini.
          </p>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 mb-6 text-left">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Catatan Khusus
            </span>
            <p className="mt-1 text-sm text-neutral-200 italic">
              &ldquo;Meskipun jumpscare-nya ngagetin, rasa sayangku tetap aman dan gak bakal bikin panik kok. Love you.&rdquo;
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                "Jahil banget ya kirim web tebak-tebakan jumpscare barusan wkwk bikin kaget! 😂❤️"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition"
            >
              <span>Balas ke WhatsApp</span>
              <ArrowRight size={16} />
            </a>

            <button
              onClick={handleRestart}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-400 hover:text-white hover:border-neutral-700 transition"
            >
              <RotateCcw size={15} />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      )}

      {/* QUIZ MAIN CARD */}
      {!isFinished && !isJumpscare && (
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Top metadata */}
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4 mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {currentQuiz.category}
            </span>
            <span className="text-xs font-mono text-neutral-500">
              {currentIndex + 1} / {QUIZ_DATA.length}
            </span>
          </div>

          {/* Question title */}
          <h1 className="text-lg sm:text-xl font-medium tracking-tight text-neutral-100 mb-8 leading-snug">
            {currentQuiz.question}
          </h1>

          {/* Options Section */}
          <div className="relative flex flex-col gap-3 min-h-[170px] justify-center">
            {/* Tombol Benar / Normal (KABUR NON-STOP SAAT DIKEJAR & BALIK LAGI SAAT AMAN) */}
            <div className="relative">
              <button
                ref={runBtnRef}
                type="button"
                onTouchStart={handleTouchChase}
                style={{
                  transform: `translate3d(${runOffset.x}px, ${runOffset.y}px, 0)`,
                  // Transisi cepat saat kabur (0.16s), dan transisi smooth spring (0.55s) saat kembali pulang
                  transition: isPanicking
                    ? "transform 0.16s ease-out"
                    : "transform 0.55s cubic-bezier(0.34, 1.45, 0.64, 1)",
                }}
                className={`w-full relative z-30 flex items-center justify-between rounded-xl border px-4 py-3.5 text-sm font-medium shadow-sm cursor-default select-none ${
                  isPanicking
                    ? "border-red-500/50 bg-neutral-900 text-neutral-200 shadow-xl shadow-red-950/20"
                    : "border-neutral-800 bg-neutral-900/90 text-neutral-300 hover:border-neutral-700"
                }`}
              >
                <span>A. {currentQuiz.normalAnswer}</span>
                <span className="text-xs text-neutral-600 font-mono">
                  {isPanicking ? "Kabur! 💨" : "Pilihan 1"}
                </span>
              </button>
            </div>

            {/* Tombol Nyeleneh (SATU-SATUNYA YANG BISA DIKLIK) */}
            <button
              type="button"
              onClick={handleSelectSilly}
              className="w-full flex items-center justify-between rounded-xl border border-neutral-700/80 bg-neutral-800 hover:bg-neutral-700/90 px-4 py-3.5 text-sm font-medium text-white shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <span>B. {currentQuiz.sillyAnswer}</span>
              <span className="text-xs text-neutral-400 font-mono">Pilih</span>
            </button>
          </div>

          <div className="mt-8 pt-4 border-t border-neutral-800/60 text-center">
            <span className="text-xs text-neutral-500">
              Pilih jawaban yang menurutmu paling tepat untuk melanjutkan
            </span>
          </div>
        </div>
      )}

      {/* Global Style Animations */}
      <style jsx global>{`
        @keyframes jumpscareShake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-14px, -12px) rotate(-3deg); }
          20% { transform: translate(14px, 12px) rotate(3deg); }
          30% { transform: translate(-16px, 10px) rotate(-2deg); }
          40% { transform: translate(16px, -14px) rotate(2deg); }
          50% { transform: translate(-12px, -12px) rotate(-4deg); }
          60% { transform: translate(14px, 14px) rotate(3deg); }
          70% { transform: translate(-14px, 8px) rotate(-2deg); }
          80% { transform: translate(12px, -10px) rotate(2deg); }
          90% { transform: translate(-8px, -8px) rotate(-1deg); }
        }
        @keyframes jumpscareZoom {
          0% { transform: scale(0.6); opacity: 0; }
          15% { transform: scale(1.6); opacity: 1; }
          40% { transform: scale(1.3); }
          70% { transform: scale(1.5); }
          100% { transform: scale(1.4); }
        }
        .animate-jumpscare-shake {
          animation: jumpscareShake 0.1s infinite;
        }
        .animate-jumpscare-zoom {
          animation: jumpscareZoom 0.25s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
