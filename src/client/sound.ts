// src/client/sound.ts
let context: AudioContext | undefined;
export async function playSound(kind = "message", volume = "low") {
  context ??= new AudioContext();
  await context.resume();
  const start = context.currentTime;
  for (const [i, f] of (kind === "critical"
    ? [440, 660, 440]
    : kind === "mention"
      ? [660, 880]
      : [620]
  ).entries()) {
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = f;
    gain.gain.setValueAtTime(0, start + i * 0.16);
    gain.gain.linearRampToValueAtTime(
      volume === "low" ? 0.025 : 0.07,
      start + i * 0.16 + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.16 + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + i * 0.16);
    oscillator.stop(start + i * 0.16 + 0.15);
  }
}
