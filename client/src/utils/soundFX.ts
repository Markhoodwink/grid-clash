export type ChaosEvent =
    | 'NONE'
    | 'PAINT'
    | 'CAROUSEL'
    | 'MONOCHROME'
    | 'EARTHQUAKE'
    | 'FLASHLIGHT'
    | 'ICE'
    | 'GHOST'
    | 'SWAP'
    | 'INVERT_X'
    | 'FOG'
    | 'TOTEM'
    | 'XRAY'
    | 'JOKER';

export class SoundFX {
    private ctx: AudioContext | null = null;
    public muted: boolean = false;
    private lastSqueakTime: number = 0;

    private getContext(): AudioContext | null {
        if (this.muted) return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
        return this.ctx;
    }

    playSnap() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // 1. Механический глухой щелчок
        const thudOsc = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thudOsc.type = 'triangle';
        thudOsc.frequency.setValueAtTime(140, now);
        thudOsc.frequency.exponentialRampToValueAtTime(35, now + 0.05);
        thudGain.gain.setValueAtTime(0.42, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        thudOsc.connect(thudGain);
        thudGain.connect(ctx.destination);
        thudOsc.start(now);
        thudOsc.stop(now + 0.055);

        // 2. Звонкая фиксация замка
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'sine';
        clickOsc.frequency.setValueAtTime(380, now);
        clickOsc.frequency.exponentialRampToValueAtTime(720, now + 0.06);
        clickGain.gain.setValueAtTime(0.24, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickOsc.start(now);
        clickOsc.stop(now + 0.065);
    }

    playReturn() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playRotate() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.065);
    }

    playIceCrack() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        [950, 1420].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + i * 0.03);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + i * 0.03 + 0.05);
            gain.gain.setValueAtTime(0.18, now + i * 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.055);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.03);
            osc.stop(now + i * 0.03 + 0.055);
        });
    }

    playEarthquakeDrop() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // 1. Треск срыва детали с доски
        const crack = ctx.createOscillator();
        const crackGain = ctx.createGain();
        crack.type = 'sawtooth';
        crack.frequency.setValueAtTime(420, now);
        crack.frequency.exponentialRampToValueAtTime(110, now + 0.2);
        crackGain.gain.setValueAtTime(0.32, now);
        crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        crack.connect(crackGain);
        crackGain.connect(ctx.destination);
        crack.start(now);
        crack.stop(now + 0.22);

        // 2. Глухой стук падения в лоток
        const thud = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(140, now + 0.16);
        thud.frequency.exponentialRampToValueAtTime(32, now + 0.38);
        thudGain.gain.setValueAtTime(0.42, now + 0.16);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        thud.connect(thudGain);
        thudGain.connect(ctx.destination);
        thud.start(now + 0.16);
        thud.stop(now + 0.4);
    }

    playBuff() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        // Светлый восходящий мажорный аккорд (C - E - G - C)
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);
            gain.gain.setValueAtTime(0.22, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.28);
        });
    }

    playSwapPortal() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.75);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.78);
    }

    playWipeSqueak() {
        const nowMs = Date.now();
        if (nowMs - this.lastSqueakTime < 65) return;
        this.lastSqueakTime = nowMs;

        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const baseFreq = 650 + Math.random() * 250;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.045);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    playCarousel() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.28);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playInvert() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.12);
        osc.frequency.linearRampToValueAtTime(420, now + 0.24);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
    }

    playFog() {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        [180, 220].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            gain.gain.setValueAtTime(0.16, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.32);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.32);
        });
    }

    playReaction(emoji: string) {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (emoji === '🚀') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(260, now);
            osc.frequency.exponentialRampToValueAtTime(1050, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        } else if (emoji === '😱') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(750, now);
            osc.frequency.linearRampToValueAtTime(380, now + 0.22);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        } else if (emoji === '🧊') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(550, now + 0.14);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        } else {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(65, now + 0.25);
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
        }
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playEvent(event: ChaosEvent) {
        if (event === 'CAROUSEL') this.playCarousel();
        else if (event === 'INVERT_X') this.playInvert();
        else if (event === 'FOG') this.playFog();
        else if (event === 'SWAP') this.playSwapPortal();
        else if (event === 'TOTEM' || event === 'XRAY' || event === 'JOKER') this.playBuff();
        else if (event === 'ICE') {
            const ctx = this.getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            [880, 1174.66, 1567.98].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.045);
                gain.gain.setValueAtTime(0.18, now + i * 0.045);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.045);
                osc.stop(now + i * 0.045 + 0.2);
            });
        }
    }

    playRoundEnd(isWinner: boolean) {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = isWinner
            ? [523.25, 659.25, 783.99, 1046.5]
            : [392.0, 349.23, 311.13, 261.63];

        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.09);
            gain.gain.setValueAtTime(0.25, now + idx * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.32);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 0.32);
        });
    }
}

export const sfx = new SoundFX();