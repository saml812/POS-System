import { BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LocaleProvider } from "./context/LocaleContext";
import { appRoutes } from "./routes";

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>{appRoutes}</Routes>
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  );
}
