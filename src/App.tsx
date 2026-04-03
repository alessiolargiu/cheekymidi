
import './App.css'
import CheekyMidi from './components/CheekyMidi';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: '"Roboto Slab", serif',
  },
});





function App() {



  return (
    <ThemeProvider theme={theme}>
      <CheekyMidi></CheekyMidi>
    </ThemeProvider>

  )
}

export default App
