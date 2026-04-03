
import { Box, Button } from '@mui/material'
import rec from "../assets/images/rec.png";
import pause from "../assets/images/pause.png";
import { useRef, useState } from 'react'
import { buttonProperties } from '../scripts/common';
import { trimSilence } from '../scripts/soundManager';



type RecorderProps = {
    ctx: AudioContext,
    silenceThreshold: number,
    selectAudioBuffer: (audioBuffer: AudioBuffer, isNewAudio: boolean) => Promise<void>
}


const Recorder: React.FC<RecorderProps> = (props) => {

    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const recordedChunks = useRef<Blob[]>([]);


    const startRecording = async () => {
        console.log("here")
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordedChunks.current = [];

        const recorder = new MediaRecorder(stream);
        mediaRecorder.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.current.push(e.data);
        };

        recorder.onstop = async () => {
            // Stop all mic tracks to release the device
            stream.getTracks().forEach(t => t.stop());

            const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            const decoded = await props.ctx.decodeAudioData(arrayBuffer);
            const trimmed = trimSilence(props.ctx, decoded, props.silenceThreshold);
            
            
            
            props.selectAudioBuffer(trimmed, true)
        };

        recorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorder.current?.stop();
        setIsRecording(false);
    };

    return (
        <Box>
            <Button onClick={() => { if(isRecording) {stopRecording()} else startRecording() }}>
                <img
                    src={isRecording ? pause : rec}
                    style={{
                        width: buttonProperties.width,
                        height: buttonProperties.height,
                        objectFit: 'contain',
                        padding: "10px",
                        //backgroundColor: currentButton === btn.id ? "#cbe3c8" : "white"
                    }}
                />
            </Button>
        </Box>
    )
}

export default Recorder;