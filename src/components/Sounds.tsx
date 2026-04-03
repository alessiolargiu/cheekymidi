
import { bottomNavigationActionClasses, Box, Button } from '@mui/material'
import accendi from '../assets/images/accendi.png'
import bau from '../assets/images/bau.png'
import boing from '../assets/images/boing.png'
import bubbles from '../assets/images/bubbles.png'
import dialog from '../assets/images/dialog.png'
import c from '../assets/images/do.png'
import error from '../assets/images/error.png'
import gun from '../assets/images/gun.png'
import honk from '../assets/images/honk.png'
import logo from '../assets/images/logo.png'
import miao from '../assets/images/miao.png'
import clacson from '../assets/images/clacson.png'
import musicmode from '../assets/images/musicmode.png'
import nobutton from '../assets/images/nobutton.png'
import okbutton from '../assets/images/okbutton.png'
import piripiru from '../assets/images/piripiru.png'
import sfxmode from '../assets/images/sfxmode.png'
import toggle from '../assets/images/toggle.png'
import urlo from '../assets/images/urlo.png'
import boingSoundMP3 from "../assets/sounds/boing.mp3";
import bubbleSoundMP3 from "../assets/sounds/bubble.mp3";
import cSoundMP3 from "../assets/sounds/c.mp3";
import errorSoundMP3 from "../assets/sounds/error.mp3";
import gunshotSoundMP3 from "../assets/sounds/gunshot.mp3";
import clacsonSoundMP3 from "../assets/sounds/clacson.mp3";
import duckSoundMP3 from "../assets/sounds/duck.mp3";
import meowSoundMP3 from "../assets/sounds/meow.mp3";
import metalSoundMP3 from "../assets/sounds/metal.mp3";
import screamSoundMP3 from "../assets/sounds/scream.mp3";
import wuffSoundMP3 from "../assets/sounds/wuff.mp3";
import { buttonProperties, type buttonToggle, type SoundProfile } from '../scripts/common'

const buttonsList: SoundProfile [] = [
    { src: c, id: 'Do', soundLink: cSoundMP3 },
    { src: bau, id: 'Bau', soundLink: wuffSoundMP3 },
    { src: boing, id: 'Boing', soundLink: boingSoundMP3 },
    { src: bubbles, id: 'Bubbles', soundLink: bubbleSoundMP3 },
    { src: error, id: 'Error', soundLink: errorSoundMP3 },
    { src: gun, id: 'Gun', soundLink: gunshotSoundMP3 },
    { src: honk, id: 'Honk', soundLink: duckSoundMP3 },
    { src: miao, id: 'Miao', soundLink: meowSoundMP3 },
    { src: piripiru, id: 'Piripiru', soundLink: metalSoundMP3 }, // closest match
    { src: urlo, id: 'Urlo', soundLink: screamSoundMP3 },
    { src: clacson, id: 'Clacson', soundLink: clacsonSoundMP3 }
]


type SoundProps = {
    selectSound: (profile: SoundProfile) => Promise<void>
    selected: buttonToggle;
    onSelect: (selectedObj: buttonToggle) => void;
}




const Sounds: React.FC<SoundProps> = (props) => {

    const selectSoundHandler = (profile: SoundProfile) => {
        props.onSelect({id: profile.id, source: "sounds"})
        props.selectSound(profile)
    } 


    return (
        <Box sx={{display: "flex", flexDirection: "row", gap: "30px", flexWrap: "wrap"}}>
            {buttonsList.map((btn, index) => (
                <Button key={index}>
                    <img
                        onClick={() => {selectSoundHandler(btn)}}
                        src={btn.src}
                        id={btn.id}
                        style={{
                            width: buttonProperties.width,
                            height: buttonProperties.height,
                            objectFit: 'contain',
                            padding: "10px",
                            backgroundColor: (props.selected.id === btn.id && props.selected.source==="sounds") ? "#cbe3c8" : "white"
                        }}
                    />
                </Button>
            ))}
        </Box>
    )
}

export default Sounds;