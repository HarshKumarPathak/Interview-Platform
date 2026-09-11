"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function DeviceCheckPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState("checking");
  const [mic, setMic] = useState("checking");
  const [error, setError] = useState("");

  useEffect(() => { let stream: MediaStream | undefined; (async () => { try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); if (videoRef.current) videoRef.current.srcObject = stream; setCamera("ready"); setMic("ready"); } catch { setCamera("blocked"); setMic("blocked"); setError("Camera or microphone access was not granted. You can still continue with the text fallback in the MVP."); } })(); return () => stream?.getTracks().forEach((track) => track.stop()); }, []);

  const status = (value: string) => value === "ready" ? "Ready" : value === "blocked" ? "Needs attention" : "Checking…";
  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><Link href="/interview/new" className="text-link">← Setup</Link></nav><section className="check container"><div className="setup-intro"><div className="eyebrow"><span /> Before you begin</div><h1>Check your camera and microphone.</h1><p>We use your camera and microphone only for the interview experience you choose. Your permissions remain under your browser controls.</p></div><div className="check-layout"><div className="camera-card"><video ref={videoRef} autoPlay muted playsInline /><div className="camera-overlay"><span className={camera === "ready" ? "live-dot" : ""} /> Camera preview</div></div><div className="check-panel"><div className="device-row"><div><strong>Camera</strong><span>Webcam input</span></div><b className={camera === "ready" ? "ok" : "warn"}>{status(camera)}</b></div><div className="device-row"><div><strong>Microphone</strong><span>Browser audio input</span></div><b className={mic === "ready" ? "ok" : "warn"}>{status(mic)}</b></div>{error && <div className="notice">{error}</div>}<div className="check-consent"><input type="checkbox" defaultChecked id="consent" /><label htmlFor="consent">I understand this is an AI-simulated interview and I consent to the session being processed for interview feedback.</label></div><Link href="/interview/room" className="button button-primary button-large full-width">Enter interview room <span>→</span></Link><p className="fine-print">You can leave the interview at any time.</p></div></div></section></main>;
}
