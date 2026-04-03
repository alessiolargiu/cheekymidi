import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface MidiKeyboardProps {
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
}

interface WhiteKeyDef {
  key: string;
  semitone: number;   // offset from C of current octave
  label: string;
}

interface BlackKeyDef {
  key: string;
  semitone: number;
  whiteIndex: number; // positioned after this white key index
}

// ─────────────────────────────────────────────
//  Key layout — two octaves worth of mappings
// ─────────────────────────────────────────────
const WHITE_KEYS: WhiteKeyDef[] = [
  { key: 'a', semitone: 0,  label: 'C'  },
  { key: 's', semitone: 2,  label: 'D'  },
  { key: 'd', semitone: 4,  label: 'E'  },
  { key: 'f', semitone: 5,  label: 'F'  },
  { key: 'g', semitone: 7,  label: 'G'  },
  { key: 'h', semitone: 9,  label: 'A'  },
  { key: 'j', semitone: 11, label: 'B'  },
  { key: 'k', semitone: 12, label: 'C'  },
  { key: 'l', semitone: 14, label: 'D'  },
  { key: ';', semitone: 16, label: 'E'  },
];

const BLACK_KEYS: BlackKeyDef[] = [
  { key: 'w', semitone: 1,  whiteIndex: 0 }, // C#
  { key: 'e', semitone: 3,  whiteIndex: 1 }, // D#
  { key: 't', semitone: 6,  whiteIndex: 3 }, // F#
  { key: 'y', semitone: 8,  whiteIndex: 4 }, // G#
  { key: 'u', semitone: 10, whiteIndex: 5 }, // A#
  { key: 'o', semitone: 13, whiteIndex: 7 }, // C#  (upper octave)
  { key: 'p', semitone: 15, whiteIndex: 8 }, // D#
];

const KEY_WIDTH  = 52;   // px — white key
const KEY_HEIGHT = 180;
const BK_WIDTH   = 34;   // black key
const BK_HEIGHT  = 110;

// Build a flat lookup:  keyboard-key → midi-note-offset-from-C
function buildLookup(): Record<string, number> {
  const map: Record<string, number> = {};
  WHITE_KEYS.forEach(k => { map[k.key] = k.semitone; });
  BLACK_KEYS.forEach(k => { map[k.key] = k.semitone; });
  // octave shift
  map['z'] = -1; // sentinel
  map['x'] = -2;
  return map;
}

const KEY_LOOKUP = buildLookup();

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function MidiKeyboard({ onNoteOn, onNoteOff }: MidiKeyboardProps) {
  const [octave, setOctave]         = useState(4); // C4 = MIDI 60
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const activeRef  = useRef<Set<string>>(new Set());
  const octaveRef  = useRef(4);

  octaveRef.current = octave;

  const midiNote = useCallback((semitone: number) => {
    return (octaveRef.current + 1) * 12 + semitone;
  }, []);

  const pressKey = useCallback((key: string) => {
    if (activeRef.current.has(key)) return; // already held

    if (key === 'z') { setOctave(o => Math.max(0, o - 1)); return; }
    if (key === 'x') { setOctave(o => Math.min(8, o + 1)); return; }

    const semitone = KEY_LOOKUP[key];
    if (semitone === undefined) return;

    activeRef.current.add(key);
    setActiveKeys(new Set(activeRef.current));
    onNoteOn(midiNote(semitone));
  }, [onNoteOn, midiNote]);

  const releaseKey = useCallback((key: string) => {
    if (!activeRef.current.has(key)) return;

    const semitone = KEY_LOOKUP[key];
    if (semitone === undefined) return;

    activeRef.current.delete(key);
    setActiveKeys(new Set(activeRef.current));
    onNoteOff(midiNote(semitone));
  }, [onNoteOff, midiNote]);

  // ── Keyboard listeners ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      pressKey(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => {
      releaseKey(e.key.toLowerCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup',   up);
    };
  }, [pressKey, releaseKey]);

  // ── Mouse / touch handlers for on-screen keys ──
  const handleWhiteMouseDown  = (key: string) => pressKey(key);
  const handleWhiteMouseUp    = (key: string) => releaseKey(key);
  const handleWhiteMouseLeave = (key: string) => { if (activeRef.current.has(key)) releaseKey(key); };

  const totalWidth = WHITE_KEYS.length * KEY_WIDTH;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '24px 32px 28px',
        //backgroundColor: "#000000",
        //background: 'linear-gradient(160deg, #1a1208 0%, #2c1f0e 60%, #1a1208 100%)',
        //borderRadius: '16px',
        //boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,220,120,0.15)',
        //border: '2px solid #4a3520',
        userSelect: 'none',
      }}
    >
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%', justifyContent: 'space-between' }}>
        <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '22px', color: "#000000 !important", fontWeight: 900 }}>
          Questa è una tastiera (rubata)
        </Typography>

        {/* Octave shifter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '14px', color: "#000000 !important" }}>
            ottava
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '8px',
              padding: '4px 10px',
              border: '1px solid #4a3520',
            }}
          >
            <Box
              component="button"
              onClick={() => setOctave(o => Math.max(0, o - 1))}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#f0d080', fontSize: '18px', lineHeight: 1,
                fontFamily: 'Indie Flower',
                '&:hover': { color: '#fff' },
              }}
            >
              ◀
            </Box>
            <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '20px', color: "#000000 !important", minWidth: '28px', textAlign: 'center', fontWeight: 900 }}>
              {octave}
            </Typography>
            <Box
              component="button"
              onClick={() => setOctave(o => Math.min(8, o + 1))}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: "#000000 !important", fontSize: '18px', lineHeight: 1,
                fontFamily: 'Indie Flower',
                '&:hover': { color: '#fff' },
              }}
            >
              ▶
            </Box>
          </Box>
          <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '13px', color: "#000000 !important" }}>
            [Z / X]
          </Typography>
        </Box>
      </Box>

      {/* ── Piano ── */}
      <Box
        sx={{
          position: 'relative',
          width: `${totalWidth}px`,
          height: `${KEY_HEIGHT}px`,
          borderRadius: '0 0 6px 6px',
          overflow: 'visible',
        }}
      >
        {/* White keys */}
        {WHITE_KEYS.map((wk, i) => {
          const isActive = activeKeys.has(wk.key);
          return (
            <Box
              key={wk.key}
              onMouseDown={() => handleWhiteMouseDown(wk.key)}
              onMouseUp={() => handleWhiteMouseUp(wk.key)}
              onMouseLeave={() => handleWhiteMouseLeave(wk.key)}
              sx={{
                position: 'absolute',
                left:   `${i * KEY_WIDTH}px`,
                top:    0,
                width:  `${KEY_WIDTH - 2}px`,
                height: `${KEY_HEIGHT}px`,
                background: isActive
                  ? 'linear-gradient(180deg, #ffe8a0 0%, #ffd060 100%)'
                  : 'linear-gradient(180deg, #fefdf5 0%, #e8e0c8 100%)',
                border: '1px solid #b8a888',
                borderTop: '1px solid #d0c8a8',
                borderRadius: '0 0 6px 6px',
                cursor: 'pointer',
                boxShadow: isActive
                  ? 'inset 0 -2px 6px rgba(200,140,0,0.4), 0 2px 8px rgba(255,200,0,0.3)'
                  : 'inset 0 -4px 8px rgba(0,0,0,0.08), 2px 4px 8px rgba(0,0,0,0.3)',
                transition: 'background 0.06s, box-shadow 0.06s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: '8px',
                gap: '2px',
                zIndex: 1,
              }}
            >
              <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '11px', color: '#706050', fontWeight: 700 }}>
                {wk.label}
              </Typography>
              <Box
                sx={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: isActive ? '#d4a000' : 'rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.06s',
                }}
              >
                <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '11px', color: isActive ? '#fff' : '#887860', fontWeight: 900, lineHeight: 1 }}>
                  {wk.key.toUpperCase()}
                </Typography>
              </Box>
            </Box>
          );
        })}

        {/* Black keys */}
        {BLACK_KEYS.map((bk) => {
          const isActive = activeKeys.has(bk.key);
          const leftPos  = bk.whiteIndex * KEY_WIDTH + KEY_WIDTH - BK_WIDTH / 2;
          return (
            <Box
              key={bk.key}
              onMouseDown={(e) => { e.stopPropagation(); pressKey(bk.key); }}
              onMouseUp={(e) => { e.stopPropagation(); releaseKey(bk.key); }}
              onMouseLeave={() => { if (activeRef.current.has(bk.key)) releaseKey(bk.key); }}
              sx={{
                position: 'absolute',
                left:   `${leftPos}px`,
                top:    0,
                width:  `${BK_WIDTH}px`,
                height: `${BK_HEIGHT}px`,
                background: isActive
                  ? 'linear-gradient(180deg, #6b4f00 0%, #3d2d00 100%)'
                  : 'linear-gradient(180deg, #2a2015 0%, #0d0a05 100%)',
                borderRadius: '0 0 5px 5px',
                cursor: 'pointer',
                boxShadow: isActive
                  ? 'inset 0 2px 6px rgba(255,180,0,0.3), 0 2px 6px rgba(0,0,0,0.6)'
                  : 'inset 0 -2px 4px rgba(255,255,255,0.05), 3px 6px 12px rgba(0,0,0,0.7)',
                border: '1px solid #000',
                borderTop: '2px solid #3a2e1a',
                transition: 'background 0.06s, box-shadow 0.06s',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: '6px',
                color: "white"
              }}
            >
              <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '10px', color: isActive ? '#ffd060' : '#605040', fontWeight: 900 }}>
                {bk.key.toUpperCase()}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* ── Legend ── */}
      <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '13px', color: "#000000 !important", textAlign: 'center' }}>
        tasti bianchi: A S D F G H J K L &nbsp;|&nbsp; tasti neri: W E T Y U O P &nbsp;|&nbsp; ottava: Z ◀ X ▶
      </Typography>
    </Box>
  );
}