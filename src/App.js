import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Dashboard from "./pages/Dashboard";
import Statistics from "./pages/Statistics";
import Price from "./pages/Price";
import TripsDashboard from "./pages/TripsDashboard";
import Drivers from "./pages/Drivers";
import Assurance from "./pages/Assurance";
import StoreAdmin from "./pages/StoreAdmin";
import { db } from "./firebase";
import "./App.css";

const navItems = [
  { key: "dashboard", label: "CRM", tone: "primary" },
  { key: "statistics", label: "Statistics", tone: "secondary" },
  { key: "price", label: "Price Simulator", tone: "success" },
  { key: "trips", label: "Trips", tone: "info" },
  { key: "drivers", label: "Drivers", tone: "warning" },
  { key: "assurance", label: "B2B", tone: "dark" },
  { key: "store", label: "Store Admin", tone: "danger" },
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const data = snapshot.docs.map((doc) => ({ driverId: doc.id, ...doc.data() }));
        setDrivers(data);
      } catch (err) {
        console.error("Erreur lors du chargement des conducteurs:", err);
      }
    };

    fetchDrivers();
  }, []);

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" />
      <main className="app-shell__content">
        <section className="dashboard-hero">
          <div>
            <span className="dashboard-hero__eyebrow">Highdep Control Center</span>
            <h1 className="dashboard-hero__title">Dashboard operations</h1>
            <p className="dashboard-hero__subtitle">
              Gestion CRM, B2B, chauffeurs, reservations et store depuis une seule interface.
            </p>
          </div>
        </section>

        <section className="dashboard-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={`dashboard-nav__button dashboard-nav__button--${item.tone} ${
                page === item.key ? "is-active" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>

        <section className="dashboard-main">
          {page === "dashboard" && <Dashboard drivers={drivers} />}
          {page === "statistics" && <Statistics />}
          {page === "price" && <Price />}
          {page === "trips" && <TripsDashboard />}
          {page === "drivers" && <Drivers />}
          {page === "assurance" && <Assurance />}
          {page === "store" && <StoreAdmin />}
        </section>
      </main>
    </div>
  );
}

export default App;
