/*import { Box, Button, Typography } from '@mui/material';
import recorded from '../assets/images/recorded.png'
import { buttonProperties, type AudioBufferProfile, type buttonToggle, type SoundProfile } from '../scripts/common';
import { useEffect, useState } from 'react';



type ButtonProps = {


    
    //converti sta schifezza di array audiobuffer in una mappa così hai un id che non fa piangere e puoi implementare una funzione di cancellazione
    soundsList: AudioBuffer[];
    selectAudioBuffer: (audioBuffer: AudioBuffer, isNewAudio: boolean) => Promise<void>
    selected: buttonToggle;
    onSelect: (selectedObj: buttonToggle) => void;

}




const Sounds: React.FC<ButtonProps> = (props) => {

    const selectBufferHandler = (profile: AudioBuffer, index: number) => {
        props.onSelect({ id: index, source: "usersounds" })
        props.selectAudioBuffer(profile, false)
    }



    return (
        <Box sx={{ display: "flex", flexDirection: "row", gap: "30px", flexWrap: "wrap" }}>
            {props.soundsList.map((buffer, index) => (
                <Button key={index} onClick={() => { selectBufferHandler(buffer, index) }} sx={{ backgroundColor: (index === props.selected.id && props.selected.source === "usersounds") ? "#cbe3c8" : "white", display: "flex", flexDirection: "column", color: "black" }}>
                    <img
                        src={recorded}
                        style={{
                            width: buttonProperties.width,
                            height: buttonProperties.height,
                            objectFit: 'contain',
                            padding: "10px",

                        }}
                    />
                    <Typography sx={{ fontFamily: "Indie Flower", fontSize: "30px", fontWeight: 900 }}> Suono {index + 1} </Typography>

                </Button>
            ))}
        </Box>
    )
}

export default Sounds;*/

import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import recorded from '../assets/images/recorded.png'
import { buttonProperties, type buttonToggle } from '../scripts/common';

// ─────────────────────────────────────────────
//  WAV encoder
//  Converts an AudioBuffer to a WAV Blob so it can be downloaded.
// ─────────────────────────────────────────────
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate  = buffer.sampleRate;
  const numSamples  = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign  = numChannels * bytesPerSample;
  const byteRate    = sampleRate * blockAlign;
  const dataSize    = numSamples * blockAlign;
  const totalSize   = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view        = new DataView(arrayBuffer);

  // Helper writers
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  const writeUint32LE = (offset: number, val: number) => view.setUint32(offset, val, true);
  const writeUint16LE = (offset: number, val: number) => view.setUint16(offset, val, true);

  // RIFF header
  writeString(0,  'RIFF');
  writeUint32LE(4, totalSize - 8);
  writeString(8,  'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  writeUint32LE(16, 16);          // chunk size
  writeUint16LE(20, 1);           // PCM = 1
  writeUint16LE(22, numChannels);
  writeUint32LE(24, sampleRate);
  writeUint32LE(28, byteRate);
  writeUint16LE(32, blockAlign);
  writeUint16LE(34, 16);          // bits per sample

  // data chunk
  writeString(36, 'data');
  writeUint32LE(40, dataSize);

  // Interleave channels and write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i];
      // Clamp to [-1, 1] then convert to Int16
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16   = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function downloadBuffer(buffer: AudioBuffer, filename: string) {
  const blob = audioBufferToWav(buffer);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
type ButtonProps = {
  soundsList: AudioBuffer[];
  selectAudioBuffer: (audioBuffer: AudioBuffer, isNewAudio: boolean) => Promise<void>;
  selected: buttonToggle;
  onSelect: (selectedObj: buttonToggle) => void;
};

const UserSounds: React.FC<ButtonProps> = (props) => {

  const selectBufferHandler = (buffer: AudioBuffer, index: number) => {
    props.onSelect({ id: index, source: 'usersounds' });
    props.selectAudioBuffer(buffer, false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {props.soundsList.map((buffer, index) => {
        const isSelected = index === props.selected.id && props.selected.source === 'usersounds';
        return (
          <Box
            key={index}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {/* Main select button */}
            <Button
              onClick={() => selectBufferHandler(buffer, index)}
              sx={{
                backgroundColor: isSelected ? '#cbe3c8' : 'white',
                display: 'flex',
                flexDirection: 'column',
                color: 'black',
                borderRadius: '12px',
                '&:hover': { backgroundColor: isSelected ? '#b8d9b4' : '#f5f5f5' },
              }}
            >
              <img
                src={recorded}
                style={{
                  width: buttonProperties.width,
                  height: buttonProperties.height,
                  objectFit: 'contain',
                  padding: '10px',
                }}
              />
              <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '20px', fontWeight: 900, textTransform: 'none' }}>
                Suono {index + 1}
              </Typography>
            </Button>

            {/* Download button */}
            <Tooltip title={`Scarica Suono ${index + 1}`} placement="bottom">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadBuffer(buffer, `suono-${index + 1}.wav`);
                }}
                sx={{
                  fontSize: '18px',
                  color: '#555',
                  '&:hover': { color: '#1976d2', backgroundColor: 'rgba(25,118,210,0.08)' },
                }}
              >
                ⬇️
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
};

export default UserSounds;