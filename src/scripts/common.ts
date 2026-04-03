import boing from "../assets/sounds/boing.mp3";
import bubble from "../assets/sounds/bubble.mp3";
import c from "../assets/sounds/c.mp3";




export const DEFAULT_SOUND = c;

export const sounds = {
    BOING: boing,
    BUBBLE: bubble,
    C: c,
};

export type SoundKey = keyof typeof sounds;


export type buttonToggle = {
  id: string | number | null;
  source: "sounds" | "usersounds";
};

export interface SoundProfile {
  src: string
  id: string
  soundLink: string,
}

export interface AudioBufferProfile {
    buffer: AudioBuffer,
    id: string
}

export const buttonProperties = {
    width: "100px",
    height: "100px"
}