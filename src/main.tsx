import '@fontsource-variable/inter';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SplashScreen } from '@capacitor/splash-screen';

createRoot(document.getElementById("root")!).render(<App />);

// Hide splash screen after the animation duration (1400ms) completes
setTimeout(() => {
  SplashScreen.hide({ fadeOutDuration: 200 });
}, 1400);
