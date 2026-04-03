import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
export interface PendingSfxSample {
  buffer: AudioBuffer;
  label: string;
}

export interface SfxModeHandle {
  handleMidiNote: (note: number) => void;
}

interface SfxMapping {
  note: number;       // MIDI note number (0–127)
  noteName: string;   // e.g. "C4", "F#3"
  buffer: AudioBuffer;
  label: string;
  color: string;
}

interface SfxModeProps {
  ctx: AudioContext;
  pendingSample: PendingSfxSample | null;
  onMappingDone: () => void;
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiNoteName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  return NOTE_NAMES[note % 12] + octave;
}

function playSfx(ctx: AudioContext, buffer: AudioBuffer) {
  const gain = ctx.createGain();
  gain.gain.value = 1;
  gain.connect(ctx.destination);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(gain);
  src.start();
}

const BADGE_COLORS = [
  '#e05c2a', '#2a8fe0', '#2aae6e', '#c44fc9',
  '#d4a017', '#3a7ec9', '#c93a6b', '#2ab8b8',
];
function colorFor(index: number) {
  return BADGE_COLORS[index % BADGE_COLORS.length];
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
const SfxMode = forwardRef<SfxModeHandle, SfxModeProps>(
  ({ ctx, pendingSample, onMappingDone }, ref) => {

    const [mappings, setMappings]   = useState<SfxMapping[]>([]);
    const [status, setStatus]       = useState<'idle' | 'awaiting'>('idle');
    const [flashNote, setFlashNote] = useState<number | null>(null);

    const mappingsRef   = useRef<SfxMapping[]>([]);
    const statusRef     = useRef<'idle' | 'awaiting'>('idle');
    const pendingRef    = useRef<PendingSfxSample | null>(null);
    const colorIndexRef = useRef(0);

    mappingsRef.current = mappings;
    statusRef.current   = status;
    pendingRef.current  = pendingSample;

    // Enter awaiting state when parent loads a new sample
    useEffect(() => {
      if (pendingSample) setStatus('awaiting');
    }, [pendingSample]);

    const flash = useCallback((note: number, ms = 300) => {
      setFlashNote(note);
      setTimeout(() => setFlashNote(null), ms);
    }, []);

    // ── Called by CheekyMidi's WebMidi noteon listener ──
    useImperativeHandle(ref, () => ({
      handleMidiNote(note: number) {
        if (statusRef.current === 'awaiting' && pendingRef.current) {
          // Map this MIDI note → pending sound
          const pending = pendingRef.current;
          const color   = colorFor(colorIndexRef.current++);

          setMappings(prev => {
            const filtered = prev.filter(m => m.note !== note); // overwrite if already mapped
            return [...filtered, {
              note,
              noteName: midiNoteName(note),
              buffer: pending.buffer,
              label: pending.label,
              color,
            }];
          });

          setStatus('idle');
          onMappingDone();
          flash(note, 600);

        } else if (statusRef.current === 'idle') {
          // Trigger SFX if this note has a mapping
          const mapping = mappingsRef.current.find(m => m.note === note);
          if (mapping) {
            playSfx(ctx, mapping.buffer);
            flash(note, 200);
          }
        }
      },
    }), [ctx, onMappingDone, flash]);

    const removeMapping = (note: number) =>
      setMappings(prev => prev.filter(m => m.note !== note));

    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        padding: '28px 32px',
        background: 'linear-gradient(160deg, #0f1a12 0%, #1a2e1c 60%, #0f1a12 100%)',
        borderRadius: '16px',
        border: '2px solid #2a5c30',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(80,220,100,0.12)',
        minWidth: '360px',
        position: 'relative'
      }}>

        {/* Subtle grid texture */}
        <Box sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: [
            'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(80,200,80,0.04) 24px, rgba(80,200,80,0.04) 25px)',
            'repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(80,200,80,0.04) 24px, rgba(80,200,80,0.04) 25px)',
          ].join(', '),
        }} />

        <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '26px', color: '#5de86a', fontWeight: 900, zIndex: 1 }}>
          💥 SFX Mode
        </Typography>

        {status === 'awaiting'
          ? <AwaitingPrompt label={pendingSample?.label ?? 'suono'} />
          : mappings.length === 0
            ? <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '16px', color: '#3a6040', textAlign: 'center', maxWidth: '280px', zIndex: 1 }}>
                Seleziona un suono, poi premi un tasto MIDI per mapparlo ↑
              </Typography>
            : null
        }

        {mappings.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', zIndex: 1 }}>
            {mappings.map(m => (
              <MappingBadge
                key={m.note}
                mapping={m}
                isFlashing={flashNote === m.note}
                onRemove={() => removeMapping(m.note)}
              />
            ))}
          </Box>
        )}

        {mappings.length > 0 && (
          <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '12px', color: '#2a5030', zIndex: 1 }}>
            clicca un badge per rimuoverlo
          </Typography>
        )}
      </Box>
    );
  }
);

export default SfxMode;

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function AwaitingPrompt({ label }: { label: string }) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      padding: '20px 28px',
      background: 'rgba(80, 220, 100, 0.07)',
      border: '2px dashed #3a8040',
      borderRadius: '12px',
      zIndex: 1,
      animation: 'sfxPulse 1.2s ease-in-out infinite',
      '@keyframes sfxPulse': {
        '0%, 100%': { borderColor: '#3a8040', boxShadow: '0 0 0 0 rgba(80,220,80,0)' },
        '50%':      { borderColor: '#5de86a', boxShadow: '0 0 16px 4px rgba(80,220,80,0.2)' },
      },
    }}>
      <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '14px', color: '#5de86a', textAlign: 'center' }}>
        suono caricato:
      </Typography>
      <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '19px', color: '#a0f0a8', fontWeight: 900, textAlign: 'center', maxWidth: '220px' }}>
        "{label}"
      </Typography>
      <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '22px', color: '#5de86a', fontWeight: 900 }}>
        🎹 premi un tasto MIDI
      </Typography>
    </Box>
  );
}

function MappingBadge({ mapping, isFlashing, onRemove }: {
  mapping: SfxMapping;
  isFlashing: boolean;
  onRemove: () => void;
}) {
  return (
    <Box
      onClick={onRemove}
      title="clicca per rimuovere"
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        cursor: 'pointer',
        transition: 'transform 0.1s, opacity 0.1s',
        '&:hover': { opacity: 0.7, transform: 'scale(0.95)' },
      }}
    >
      <Box sx={{
        width: '56px', height: '56px', borderRadius: '10px',
        background: isFlashing
          ? `radial-gradient(circle, #fff 0%, ${mapping.color} 60%)`
          : `linear-gradient(160deg, ${mapping.color}cc, ${mapping.color}66)`,
        border: `2px solid ${mapping.color}`,
        boxShadow: isFlashing
          ? `0 0 20px 6px ${mapping.color}88`
          : `0 4px 12px ${mapping.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}>
        <Typography sx={{
          fontFamily: 'Indie Flower', fontSize: '16px', fontWeight: 900,
          color: isFlashing ? mapping.color : '#fff',
          lineHeight: 1, transition: 'color 0.12s',
        }}>
          {mapping.noteName}
        </Typography>
      </Box>
      <Typography sx={{
        fontFamily: 'Indie Flower', fontSize: '10px', color: mapping.color,
        maxWidth: '60px', textAlign: 'center', lineHeight: 1.2,
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {mapping.label}
      </Typography>
    </Box>
  );
}