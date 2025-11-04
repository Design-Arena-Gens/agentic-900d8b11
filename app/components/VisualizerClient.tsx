"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type SampleTrack = {
  label: string;
  url: string;
  bpm?: number;
};

const SAMPLE_TRACKS: SampleTrack[] = [
  {
    label: "Lofi Drift (90 BPM)",
    url: "https://cdn.pixabay.com/download/audio/2022/10/02/audio_121e26805d.mp3?filename=lofi-study-112191.mp3",
    bpm: 90
  },
  {
    label: "Synthwave Pulse (104 BPM)",
    url: "https://cdn.pixabay.com/download/audio/2023/02/27/audio_2d375d75a5.mp3?filename=synthwave-inspired-music-142242.mp3",
    bpm: 104
  },
  {
    label: "Deep Focus (75 BPM)",
    url: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0b0672c14c.mp3?filename=ambient-sci-fi-10816.mp3",
    bpm: 75
  }
];

const CANVAS_BACKGROUND = "rgba(4, 1, 20, 0.16)";

const TRAIL_ALPHA = 0.08;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function VisualizerClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [segments, setSegments] = useState(12);
  const [rotationSpeed, setRotationSpeed] = useState(0.32);
  const [colorShift, setColorShift] = useState(210);
  const [distortion, setDistortion] = useState(0.55);
  const [kaleidoBlend, setKaleidoBlend] = useState(0.72);
  const [waveformTrail, setWaveformTrail] = useState(0.15);
  const [detail, setDetail] = useState(11);
  const [smoothing, setSmoothing] = useState(0.78);
  const [energyBoost, setEnergyBoost] = useState(1.4);
  const [autoSpin, setAutoSpin] = useState(true);
  const [selectedSample, setSelectedSample] = useState<SampleTrack>(SAMPLE_TRACKS[0]);
  const [isVisualizerReady, setVisualizerReady] = useState(false);

  const controlsRef = useRef({
    segments,
    rotationSpeed,
    colorShift,
    distortion,
    kaleidoBlend,
    waveformTrail,
    energyBoost,
    autoSpin
  });

  const beatTapHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    controlsRef.current = {
      segments,
      rotationSpeed,
      colorShift,
      distortion,
      kaleidoBlend,
      waveformTrail,
      energyBoost,
      autoSpin
    };
  }, [segments, rotationSpeed, colorShift, distortion, kaleidoBlend, waveformTrail, energyBoost, autoSpin]);

  const setCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    if (typeof context.resetTransform === "function") {
      context.resetTransform();
    } else {
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    context.scale(dpr, dpr);
    canvasCtxRef.current = context;
  }, []);

  useEffect(() => {
    setCanvasDimensions();
    window.addEventListener("resize", setCanvasDimensions);
    return () => window.removeEventListener("resize", setCanvasDimensions);
  }, [setCanvasDimensions]);

  const updateAnalyserDetail = useCallback(
    (targetDetail: number) => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      const fftSize = 2 ** clamp(targetDetail, 8, 14);
      analyser.fftSize = fftSize;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    },
    []
  );

  useEffect(() => {
    updateAnalyserDetail(detail);
  }, [detail, updateAnalyserDetail]);

  useEffect(() => {
    if (audioRef.current && !audioRef.current.src) {
      audioRef.current.src = selectedSample.url;
    }
  }, [selectedSample]);

  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.smoothingTimeConstant = clamp(smoothing, 0, 0.99);
    }
  }, [smoothing]);

  const connectAudio = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!audioRef.current) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }

    const audioContext = audioContextRef.current;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (!analyserRef.current) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2 ** detail;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = clamp(smoothing, 0, 0.99);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    if (!mediaSourceRef.current) {
      mediaSourceRef.current = audioContext.createMediaElementSource(audioRef.current);
      mediaSourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);
    }

    if (!animationRef.current) {
      animate();
    }

    setVisualizerReady(true);
  }, [detail, smoothing]);

  const cleanupAudio = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (mediaSourceRef.current) {
      mediaSourceRef.current.disconnect();
      mediaSourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    dataArrayRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
        fileUrlRef.current = null;
      }
    };
  }, [cleanupAudio]);

  const sampleEnergy = (data: Uint8Array, range: [number, number]) => {
    const [start, end] = range;
    const slice = data.slice(start, end);
    const total = slice.reduce((sum, value) => sum + value, 0);
    return slice.length === 0 ? 0 : total / slice.length / 255;
  };

  const drawVisuals = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const ctx = canvasCtxRef.current;
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      if (!canvas || !ctx || !analyser || !dataArray) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const { segments, rotationSpeed, colorShift, distortion, kaleidoBlend, waveformTrail, energyBoost, autoSpin } = controlsRef.current;

      analyser.getByteFrequencyData(dataArray);

      const bass = sampleEnergy(dataArray, [0, 40]);
      const mids = sampleEnergy(dataArray, [40, 160]);
      const highs = sampleEnergy(dataArray, [160, dataArray.length]);
      const spectralFlux = (bass + mids + highs) / 3;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(5, 0, 25, ${clamp(1 - waveformTrail, TRAIL_ALPHA, 0.6)})`;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) * 0.55;
      const segmentAngle = (Math.PI * 2) / Math.max(3, segments);

      const baseHue = (colorShift + time * (autoSpin ? 4 : 0)) % 360;
      const rotation = time * rotationSpeed * (autoSpin ? 1 : 0) + bass * 0.6;
      const distortionAmount = 0.54 + distortion * 0.8;
      const twist = highs * 0.8 + mids * 0.3;

      ctx.save();
      ctx.translate(centerX, centerY);

      for (let i = 0; i < segments; i++) {
        const angle = segmentAngle * i + rotation;
        ctx.save();
        ctx.rotate(angle);

        const radiusMultiplier = clamp(spectralFlux * energyBoost * (1 + Math.sin(time * 1.3 + i) * 0.2), 0.2, 1.4);
        const radius = maxRadius * radiusMultiplier;
        const innerRadius = radius * 0.08;

        const gradient = ctx.createLinearGradient(0, 0, radius, radius * distortionAmount);
        gradient.addColorStop(0, `hsla(${(baseHue + i * kaleidoBlend * 50) % 360}, 86%, 60%, ${0.4 + highs * 0.6})`);
        gradient.addColorStop(0.5, `hsla(${(baseHue + 120 + mids * 150) % 360}, 90%, 65%, ${0.5 + mids * 0.4})`);
        gradient.addColorStop(1, `hsla(${(baseHue + 240 + bass * 90) % 360}, 100%, 70%, ${0.35 + bass * 0.5})`);

        ctx.beginPath();
        ctx.moveTo(0, -innerRadius);

        const segmentsInSlice = 6;
        for (let j = 0; j <= segmentsInSlice; j++) {
          const t = j / segmentsInSlice;
          const wave = Math.sin(t * Math.PI * distortionAmount + time * 1.8 + i * 0.4) * twist * radius * 0.1;
          const r = innerRadius + (radius - innerRadius) * t;
          const offset = Math.sin(time * 0.5 + j * 0.7 + bass * 5) * radius * 0.03;
          ctx.lineTo(wave + offset, -r);
        }

        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.scale(1, -1);
        ctx.beginPath();
        ctx.moveTo(0, innerRadius);
        for (let j = 0; j <= segmentsInSlice; j++) {
          const t = j / segmentsInSlice;
          const wave = Math.sin(t * Math.PI * distortionAmount + time * 1.3 + i * 0.6) * twist * radius * 0.08;
          const r = innerRadius + (radius - innerRadius) * t;
          const offset = Math.cos(time * 0.6 + j * 0.5 + highs * 6) * radius * 0.04;
          ctx.lineTo(wave + offset, r);
        }
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = "lighter";
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        ctx.restore();
      }

      ctx.restore();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * 0.6);
      const ringRadius = maxRadius * clamp(0.2 + spectralFlux * 0.6, 0.2, 0.75);
      const thickness = 12 + mids * 18;
      const ringGradient = ctx.createRadialGradient(0, 0, ringRadius * 0.55, 0, 0, ringRadius);
      ringGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      ringGradient.addColorStop(1, `hsla(${(baseHue + 60) % 360}, 100%, 70%, ${0.4 + spectralFlux * 0.45})`);
      ctx.strokeStyle = ringGradient;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.globalCompositeOperation = "lighter";
      const sparkCount = 64;
      for (let i = 0; i < sparkCount; i++) {
        const t = i / sparkCount;
        const sparkleRadius = ringRadius * (1 + Math.sin(time * 0.9 + t * Math.PI * 4 + bass * 8) * 0.3);
        const hue = (baseHue + t * 360 + highs * 240) % 360;
        ctx.fillStyle = `hsla(${hue}, 100%, ${65 + spectralFlux * 20}%, ${0.15 + highs * 0.4})`;
        const angle = t * Math.PI * 2 + time * 0.6;
        const x = Math.cos(angle) * sparkleRadius;
        const y = Math.sin(angle) * sparkleRadius;
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + highs * 7, 3 + mids * 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    []
  );

  const animate = useCallback(() => {
    const render = (timestamp: number) => {
      drawVisuals(timestamp * 0.001);
      animationRef.current = requestAnimationFrame(render);
    };
    animationRef.current = requestAnimationFrame(render);
  }, [drawVisuals]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !audioRef.current) {
      return;
    }
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
    }
    const url = URL.createObjectURL(files[0]);
    fileUrlRef.current = url;
    audioRef.current.src = url;
    audioRef.current.play().catch(() => undefined);
  }, []);

  const handleSampleSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSample = SAMPLE_TRACKS.find((sample) => sample.url === event.target.value);
    if (!nextSample || !audioRef.current) return;
    setSelectedSample(nextSample);
    audioRef.current.src = nextSample.url;
    audioRef.current.play().catch(() => undefined);
  }, []);

  const handleBeatTap = useCallback(() => {
    const now = performance.now();
    const tapHistoryRef = beatTapHistoryRef.current;
    tapHistoryRef.push(now);
    while (tapHistoryRef.length > 8) {
      tapHistoryRef.shift();
    }
    if (tapHistoryRef.length >= 2) {
      const intervals = tapHistoryRef
        .slice(1)
        .map((stamp, index) => stamp - tapHistoryRef[index]);
      const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      const bpm = 60000 / average;
      setRotationSpeed(clamp(bpm / 140, 0.02, 2));
      setSegments(Math.round(clamp(bpm / 8, 6, 24)));
    }
  }, []);

  return (
    <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, background: CANVAS_BACKGROUND, zIndex: 0 }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          padding: "2rem",
          maxWidth: "960px",
          margin: "0 auto",
          color: "#fcfdff"
        }}
      >
        <header style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", marginBottom: "0.4rem", fontWeight: 700 }}>
            KaleidoSonic Visualizer
          </h1>
          <p style={{ margin: 0, color: "rgba(230, 240, 255, 0.75)", fontSize: "1.05rem" }}>
            Drop a track, tap the beat, and sculpt the kaleidoscope to match your vibe.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.5rem",
            background: "rgba(8, 6, 32, 0.65)",
            border: "1px solid rgba(120, 140, 255, 0.2)",
            boxShadow: "0 18px 45px rgba(2, 0, 30, 0.35)",
            backdropFilter: "blur(12px)",
            padding: "1.6rem",
            borderRadius: "1.25rem"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <label style={{ fontWeight: 600, letterSpacing: "0.02em" }}>Audio Source</label>
            <select
              value={selectedSample.url}
              onChange={handleSampleSelect}
              style={{
                background: "rgba(16, 12, 50, 0.85)",
                border: "1px solid rgba(110, 120, 220, 0.4)",
                borderRadius: "0.6rem",
                padding: "0.75rem 0.9rem",
                color: "inherit"
              }}
            >
              {SAMPLE_TRACKS.map((sample) => (
                <option key={sample.url} value={sample.url}>
                  {sample.label}
                </option>
              ))}
            </select>

            <label
              htmlFor="audio-file-input"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.7rem 0.9rem",
                borderRadius: "0.6rem",
                border: "1px dashed rgba(150, 160, 255, 0.6)",
                background: "rgba(15, 10, 60, 0.8)",
                cursor: "pointer",
                transition: "transform 120ms ease"
              }}
            >
              Upload Track
              <input
                id="audio-file-input"
                type="file"
                accept="audio/*"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
            </label>

            <button
              type="button"
              onClick={connectAudio}
              style={{
                padding: "0.8rem 1rem",
                borderRadius: "0.6rem",
                background: isVisualizerReady
                  ? "linear-gradient(135deg, rgba(80, 255, 210, 0.16), rgba(120, 200, 255, 0.24))"
                  : "linear-gradient(135deg, rgba(110, 90, 255, 0.5), rgba(170, 120, 255, 0.65))",
                border: "1px solid rgba(110, 120, 220, 0.5)",
                color: "inherit",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {isVisualizerReady ? "Visualizer Armed" : "Activate Visualizer"}
            </button>

            <audio
              ref={audioRef}
              controls
              style={{ width: "100%", borderRadius: "0.6rem", background: "rgba(15, 12, 40, 0.8)" }}
              onPlay={connectAudio}
            />

            <button
              type="button"
              onClick={handleBeatTap}
              style={{
                padding: "0.7rem 1rem",
                borderRadius: "0.6rem",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(140, 150, 255, 0.4)",
                color: "inherit",
                cursor: "pointer"
              }}
            >
              Tap Tempo
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <FieldLabel label="Segments" value={segments}>
              <input
                type="range"
                min={4}
                max={48}
                value={segments}
                onChange={(event) => setSegments(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Spin" value={rotationSpeed.toFixed(2)}>
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={rotationSpeed}
                onChange={(event) => setRotationSpeed(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Hue Center" value={`${Math.floor(colorShift)}°`}>
              <input
                type="range"
                min={0}
                max={360}
                value={colorShift}
                onChange={(event) => setColorShift(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Distortion" value={distortion.toFixed(2)}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={distortion}
                onChange={(event) => setDistortion(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Color Warp" value={kaleidoBlend.toFixed(2)}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={kaleidoBlend}
                onChange={(event) => setKaleidoBlend(Number(event.target.value))}
              />
            </FieldLabel>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <FieldLabel label="Trail" value={waveformTrail.toFixed(2)}>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.01}
                value={waveformTrail}
                onChange={(event) => setWaveformTrail(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Detail" value={`2^${detail}`}> 
              <input
                type="range"
                min={8}
                max={14}
                value={detail}
                onChange={(event) => setDetail(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Smoothing" value={smoothing.toFixed(2)}>
              <input
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={smoothing}
                onChange={(event) => setSmoothing(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Energy" value={energyBoost.toFixed(2)}>
              <input
                type="range"
                min={0.6}
                max={2.5}
                step={0.01}
                value={energyBoost}
                onChange={(event) => setEnergyBoost(Number(event.target.value))}
              />
            </FieldLabel>

            <FieldLabel label="Auto Spin" value={autoSpin ? "On" : "Off"}>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setAutoSpin(true)}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.8rem",
                    borderRadius: "0.5rem",
                    border: autoSpin ? "1px solid rgba(120, 220, 255, 0.8)" : "1px solid rgba(120, 130, 210, 0.3)",
                    background: autoSpin ? "rgba(120, 200, 255, 0.1)" : "rgba(30, 25, 80, 0.6)",
                    color: "inherit",
                    cursor: "pointer"
                  }}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => setAutoSpin(false)}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.8rem",
                    borderRadius: "0.5rem",
                    border: !autoSpin ? "1px solid rgba(255, 180, 120, 0.8)" : "1px solid rgba(120, 130, 210, 0.3)",
                    background: !autoSpin ? "rgba(255, 170, 140, 0.1)" : "rgba(30, 25, 80, 0.6)",
                    color: "inherit",
                    cursor: "pointer"
                  }}
                >
                  Off
                </button>
              </div>
            </FieldLabel>
          </div>
        </section>

        <footer style={{ textAlign: "center", color: "rgba(210, 220, 255, 0.6)", fontSize: "0.9rem" }}>
          Best experienced fullscreen with dark surroundings. Adjust parameters live to sculpt evolving fractal symmetries.
        </footer>
      </div>
    </main>
  );
}

type FieldLabelProps = {
  label: string;
  value: string | number;
  children: ReactNode;
};

function FieldLabel({ label, value, children }: FieldLabelProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
        <span>{label}</span>
        <span style={{ color: "rgba(220, 230, 255, 0.7)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div
        style={{
          background: "rgba(20, 18, 50, 0.75)",
          border: "1px solid rgba(100, 110, 220, 0.3)",
          padding: "0.6rem 0.75rem",
          borderRadius: "0.8rem"
        }}
      >
        {children}
      </div>
    </label>
  );
}
