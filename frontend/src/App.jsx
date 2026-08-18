import AppRouter from "./routes/AppRouter";
import { IncaMantProvider } from "./data/incamatData";

function App() {
  return <IncaMantProvider><AppRouter /></IncaMantProvider>;
}

export default App;
