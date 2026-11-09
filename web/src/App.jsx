import PublicRegister from "./PublicRegister.jsx";
import Admin from "./Admin.jsx";

// Two pages only: "/" is the public QR form, "/admin" is the dashboard.
export default function App() {
  return window.location.pathname.startsWith("/admin") ? <Admin /> : <PublicRegister />;
}
