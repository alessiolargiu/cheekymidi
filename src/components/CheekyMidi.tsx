
import { type buttonToggle, type SoundProfile } from '../scripts/common'
import { useCallback, useEffect, useRef, useState } from 'react';
import { WebMidi } from 'webmidi';
import { loadSample, playSample, releaseSample } from '../scripts/midiManager';
import Sounds from './Sounds';
import { detectPitch } from '../scripts/soundManager';
import { Box, Button, Switch, Typography } from '@mui/material';
import Recorder from './Recorder';
import UserSounds from './UserSounds';
import logo from '../assets/images/logo.png'
import MidiKeyboard from './MidiKeyboard';
import toggle from "../assets/images/toggle.png";
import SfxMode, { type PendingSfxSample, type SfxModeHandle } from './Sfxmode';
import FileUploader from './FileUploader';



function CheekyMidi() {
  //ver 0.60 - 01/4/2026



  /* 
  
  MUSIC MODE: più o meno fatta
  Questa versione ti permette di selezionare, o registrare, un suono  e poterlo suonare.
  Le note corrispondono alle note reali e puoi creare melodie.
  
  SFX MODE:  TODO
  Questa versione ti fa selezionare un suono e ti chiede "a che tasto lo mappo?",
  da quel momento, ogni volta che premi quel tasto si sentirà quel suono, 
  preregistrato o registrato, non importa.


  KEYBOARD OPTION: quasi finita, sarebbe carino stilizzarla a tema
  Ti permette di fare tutte le cose che faresti con la bgftastiera midi con una normale
  tastiera usb. Così se ti manca la tastiera funziona lo stesso.


  META: TODO
  Portare tutto su un server online.-

  */


  const ctx = new AudioContext();
  const currentSound = useRef<SoundProfile | null>(null);
  const currentSample = useRef<AudioBuffer | null>(null);
  const currentKey = useRef<number>(48)
  const activeNotes = useRef<Map<number, { gain: GainNode; source: AudioBufferSourceNode }>>(new Map());
  const [silenceThreshold, setSilenceThreshold] = useState(0.01);
  const [savedAudios, setSavedAudios] = useState<AudioBuffer[]>([])
  const [selected, setSelected] = useState<buttonToggle>({ id: -1, source: "sounds" });
  const [keyboardMode, setKeyboardMode] = useState<boolean>(false);


  const [mode, setMode] = useState<'music' | 'sfx'>('music');
  const [pendingSfxSample, setPendingSfxSample] = useState<PendingSfxSample | null>(null);
  const modeRef = useRef<'music' | 'sfx'>('music');   // ref so callbacks see latest value
  const sfxModeRef = useRef<SfxModeHandle>(null);
  modeRef.current = mode;


  /*
  const selectSound = useCallback(async (soundProfile: SoundProfile) => {
    console.log(soundProfile)
    currentSound.current = soundProfile;
    selectAudioBuffer(await loadSample(ctx, soundProfile.soundLink), false)
  }, [])*/

  const selectSound = useCallback(async (soundProfile: SoundProfile) => {
    console.log(soundProfile);
    currentSound.current = soundProfile;
    const buffer = await loadSample(ctx, soundProfile.soundLink);
    selectAudioBuffer(buffer, false, soundProfile.soundLink); // pass label
  }, []);



  /*
  const selectAudioBuffer = useCallback(async (audioBuffer: AudioBuffer, isNewAudio: boolean) => {
    currentSample.current = audioBuffer;


    if (isNewAudio) {
      setSavedAudios((prev) => [...prev, audioBuffer])
      setSelected({ id: savedAudios.length, source: "usersounds" })
    }

    const foundPitch = detectPitch(audioBuffer)
    if (foundPitch) {
      console.log(foundPitch)
      currentKey.current = foundPitch
    } else currentKey.current = 48
  }, [savedAudios])
  */


  const selectAudioBuffer = useCallback(async (
    audioBuffer: AudioBuffer,
    isNewAudio: boolean,
    label = 'suono registrato',
  ) => {
    currentSample.current = audioBuffer;

    if (isNewAudio) {
      setSavedAudios(prev => [...prev, audioBuffer]);
      setSelected({ id: savedAudios.length, source: 'usersounds' });
    }

    if (modeRef.current === 'sfx') {
      // Hand the sample to SfxMode for key mapping — skip pitch detection
      setPendingSfxSample({ buffer: audioBuffer, label });
      return;
    }

    // Music mode: detect pitch as before
    const foundPitch = detectPitch(audioBuffer);
    currentKey.current = foundPitch ?? 48;
  }, [savedAudios]);

  useEffect(() => {

    WebMidi.enable()
      .then(() => {
        console.log("MIDI enabled");

        const input = WebMidi.inputs[0];

        WebMidi.inputs.forEach(input => {
          console.log(input.name);
        });

        if (input) {
          input.addListener("noteon", e => {
            if (modeRef.current === 'sfx') {
              sfxModeRef.current?.handleMidiNote(e.note.number);
            } else {
              if (!currentSample.current) return;
              playSample(ctx, currentSample.current, e.note.number, currentKey.current, activeNotes.current);
            }
          });

          input.addListener("noteoff", e => {
            releaseSample(ctx, e.note.number, activeNotes.current);
          });
        }

      })
      .catch(err => console.error(err));

  }, []);





  return (
    <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column", gap: "40px", height: "100vh", width: "100vw" }}>
      <Box
        component="img"
        sx={{
          height: "200px",
          margin: "30px"
        }}
        src={logo}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '20px' }}>
          Musica
        </Typography>
        <Button onClick={() => {

          if (mode === "music") {
            setMode("sfx")
            setPendingSfxSample(null); // clear pending if you switch mid-flow
            setKeyboardMode(false)
          } else {
            setMode("music")
            setPendingSfxSample(null); // clear pending if you switch mid-flow
            setKeyboardMode(false)
          }
        }} sx={{ display: "flex", flexDirection: "column", color: "black" }} >
          <img
            src={toggle}
            style={{
              height: "30px",
              objectFit: 'contain',
              padding: "10px",
              transform: mode !== "music" ? "rotate(0deg)" : "rotate(180deg)"
            }}
          />
        </Button>

        {/*<Switch
          checked={mode === 'sfx'}
          onChange={(_, checked) => {
            setMode(checked ? 'sfx' : 'music');
            setPendingSfxSample(null); // clear pending if you switch mid-flow
            setKeyboardMode(false)
          }}
          sx={{
            '& .MuiSwitch-thumb': { background: mode === 'sfx' ? '#5de86a' : '#f0d080' },
            '& .MuiSwitch-track': { background: mode === 'sfx' ? '#2a5030' : '#4a3520' },
          }}
        />*/}



        <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '20px' }}>
          SFX
        </Typography>
      </Box>
      {mode === 'sfx' && (
        <SfxMode
          ctx={ctx}
          ref={sfxModeRef}
          pendingSample={pendingSfxSample}
          onMappingDone={() => setPendingSfxSample(null)}

        />
      )}



      <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
        {mode !== "sfx" &&
          <Button onClick={() => { setKeyboardMode((old) => { return !old }) }} sx={{ display: "flex", flexDirection: "column", color: "black" }} >
            <img
              src={toggle}
              style={{
                height: "30px",
                objectFit: 'contain',
                padding: "10px",
                transform: keyboardMode ? "rotate(0deg)" : "rotate(180deg)"
              }}
            />
            <Typography sx={{ fontFamily: "Indie Flower", fontSize: "20px", fontWeight: 900, textTransform: 'none' }}> Mostra tastiera ({keyboardMode ? "ON" : "OFF"}) </Typography>

          </Button>}
        {keyboardMode && mode !== "sfx" && <MidiKeyboard
          onNoteOn={(note) => {
            if (!currentSample.current) return;
            playSample(ctx, currentSample.current, note, currentKey.current, activeNotes.current);
          }}
          onNoteOff={(note) => {
            releaseSample(ctx, note, activeNotes.current);
          }}
        />}
      </Box>


      <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
        <Typography sx={{ fontFamily: "Indie Flower", fontSize: "30px", fontWeight: 900 }}> Suoni preregistrati </Typography>
        <Sounds selectSound={selectSound} selected={selected} onSelect={setSelected}></Sounds>
      </Box>


      <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
        {savedAudios.length > 0 && <Typography sx={{ fontFamily: "Indie Flower", fontSize: "30px", fontWeight: 900 }}> I tuoi suoni </Typography>}
        <UserSounds soundsList={savedAudios} selectAudioBuffer={selectAudioBuffer} selected={selected} onSelect={setSelected}></UserSounds>
      </Box>



      <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
          <Typography sx={{ fontFamily: "Indie Flower", fontSize: "30px", fontWeight: 900 }}>
            Tasto per registrare i suoni
          </Typography>
          <Recorder ctx={ctx} silenceThreshold={silenceThreshold} selectAudioBuffer={selectAudioBuffer} />

          {/* ↓ NEW */}
          <Typography sx={{ fontFamily: "Indie Flower", fontSize: "30px", fontWeight: 900, mt: 2 }}>
            Oppure carica un file
          </Typography>
          <FileUploader ctx={ctx} selectAudioBuffer={selectAudioBuffer} />
          {/* ↑ NEW */}

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            ...silence threshold slider...
          </label>
        </Box>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Typography sx={{ fontFamily: "Indie Flower", fontSize: "30px", fontWeight: 900 }}> Silence threshold: {silenceThreshold.toFixed(3)} </Typography>
          <input
            type="range"
            min={0.001}
            max={0.1}
            step={0.001}
            value={silenceThreshold}
            onChange={e => setSilenceThreshold(parseFloat(e.target.value))}
          />
        </label>
      </Box>

    </Box>
  )
}

export default CheekyMidi
