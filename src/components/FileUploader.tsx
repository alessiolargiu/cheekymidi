import { useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

type FileUploaderProps = {
  ctx: AudioContext;
  selectAudioBuffer: (audioBuffer: AudioBuffer, isNewAudio: boolean, label?: string) => Promise<void>;
};

const ACCEPTED = '.mp3,.wav,.ogg,.flac,.aac,.webm,.m4a';

const FileUploader: React.FC<FileUploaderProps> = ({ ctx, selectAudioBuffer }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const processFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      // Strip extension for the label
      const label = file.name.replace(/\.[^/.]+$/, '');
      await selectAudioBuffer(audioBuffer, true, label);
    } catch {
      setError(`Non riesco a decodificare "${file.name}". Prova un altro formato.`);
    } finally {
      setLoading(false);
      // Reset input so the same file can be re-uploaded
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Process one at a time — iterate if you want multi-upload
    Array.from(files).forEach(processFile);
  };

  // ── Drag & drop ──
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = ()                    => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Drop zone */}
      <Box
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        sx={{
          width: '260px',
          padding: '24px 16px',
          border: `2px dashed ${dragging ? '#4caf50' : '#aaa'}`,
          borderRadius: '14px',
          backgroundColor: dragging ? 'rgba(76,175,80,0.08)' : 'rgba(0,0,0,0.02)',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background-color 0.2s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          '&:hover': {
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76,175,80,0.06)',
          },
        }}
      >
        <Typography sx={{ fontSize: '36px', lineHeight: 1 }}>
          {loading ? '⏳' : '📂'}
        </Typography>
        <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '16px', color: '#555', textAlign: 'center' }}>
          {loading
            ? 'Carico...'
            : dragging
              ? 'Rilascia qui!'
              : 'Trascina un file audio\noppure clicca per sceglierlo'}
        </Typography>
        <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '12px', color: '#999' }}>
          mp3 · wav · ogg · flac · aac · m4a
        </Typography>
      </Box>

      {error && (
        <Typography sx={{ fontFamily: 'Indie Flower', fontSize: '14px', color: '#c62828', maxWidth: '260px', textAlign: 'center' }}>
          ⚠️ {error}
        </Typography>
      )}
    </Box>
  );
};

export default FileUploader;
