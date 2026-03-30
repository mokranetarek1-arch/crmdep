import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import Dashboard from "./pages/Dashboard";
import Statistics from "./pages/Statistics";
import Price from "./pages/Price";
import TripsDashboard from "./pages/TripsDashboard";
import Drivers from "./pages/Drivers";
import Assurance from "./pages/Assurance";
import StoreAdmin from "./pages/StoreAdmin";
import UsersAdmin from "./pages/UsersAdmin";
import { auth, db } from "./firebase";
import "./App.css";

const defaultPermissions = {
  dashboard: false,
  statistics: false,
  price: false,
  trips: false,
  drivers: false,
  assurance: false,
  store: false,
  usersAdmin: false,
};

const navItems = [
  { key: "dashboard", label: "CRM", tone: "primary" },
  { key: "statistics", label: "Statistics", tone: "secondary" },
  { key: "price", label: "Price Simulator", tone: "success" },
  { key: "trips", label: "Trips", tone: "info" },
  { key: "drivers", label: "Drivers", tone: "warning" },
  { key: "assurance", label: "B2B", tone: "dark" },
  { key: "store", label: "Store Admin", tone: "danger" },
  { key: "usersAdmin", label: "Users Admin", tone: "slate" },
];

function normalizePermissions(permissions = {}) {
  return { ...defaultPermissions, ...permissions };
}

function hasPageAccess(adminProfile, pageKey) {
  if (!adminProfile?.active) return false;
  if (adminProfile.role === "super_admin") return true;
  if (pageKey === "dashboard") return true;
  return Boolean(normalizePermissions(adminProfile.permissions)[pageKey]);
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [driverProfileId, setDriverProfileId] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAdminProfile(null);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setAdminProfile(null);
      setProfileLoading(false);
      return undefined;
    }

    setProfileLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, "admin", currentUser.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setAdminProfile({
            uid: snapshot.id,
            ...snapshot.data(),
            permissions: normalizePermissions(snapshot.data().permissions),
          });
        } else {
          setAdminProfile(null);
        }
        setProfileLoading(false);
      },
      (error) => {
        console.error(error);
        setAdminProfile(null);
        setProfileLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !adminProfile?.active) {
      setDrivers([]);
      return undefined;
    }

    const fetchDrivers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const data = snapshot.docs.map((entry) => ({ driverId: entry.id, ...entry.data() }));
        setDrivers(data);
      } catch (error) {
        console.error("Erreur lors du chargement des conducteurs:", error);
      }
    };

    fetchDrivers();
    return undefined;
  }, [currentUser, adminProfile]);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => hasPageAccess(adminProfile, item.key)),
    [adminProfile]
  );

  useEffect(() => {
    if (visibleNavItems.length === 0) return;
    if (page === "driverProfile") return;
    if (!visibleNavItems.some((item) => item.key === page)) {
      setPage(visibleNavItems[0].key);
    }
  }, [page, visibleNavItems]);

  const handleAuthChange = ({ target: { name, value } }) => {
    setAuthForm((current) => ({ ...current, [name]: value }));
  };

  const resetAuthForm = () => {
    setAuthForm({ displayName: "", email: "", password: "" });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");

    try {
      await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
      resetAuthForm();
    } catch (error) {
      console.error(error);
      setAuthError("Connexion impossible. Verifie email et mot de passe.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        authForm.email.trim(),
        authForm.password
      );

      const safeDisplayName = authForm.displayName.trim() || authForm.email.trim().split("@")[0];
      await updateProfile(credential.user, { displayName: safeDisplayName });
      await setDoc(doc(db, "admin", credential.user.uid), {
        uid: credential.user.uid,
        email: authForm.email.trim(),
        displayName: safeDisplayName,
        role: "pending",
        active: false,
        permissions: defaultPermissions,
        createdAt: serverTimestamp(),
        approvedAt: null,
        approvedByUid: "",
        approvedByEmail: "",
      });

      resetAuthForm();
      setAuthMode("login");
    } catch (error) {
      console.error(error);
      setAuthError("Inscription impossible. Verifie l'email ou choisis un autre mot de passe.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPage("dashboard");
    } catch (error) {
      console.error(error);
    }
  };

  const renderPage = () => {
    switch (page) {
      case "statistics":
        return <Statistics />;
      case "price":
        return <Price />;
      case "trips":
        return <TripsDashboard />;
      case "drivers":
        return (
          <Drivers
            currentUser={currentUser}
            adminProfile={adminProfile}
            onOpenProfile={(id) => {
              setDriverProfileId(id);
              setPage("driverProfile");
            }}
          />
        );
      case "driverProfile":
        return (
          <Drivers
            currentUser={currentUser}
            adminProfile={adminProfile}
            profileMode
            driverProfileId={driverProfileId}
            onBackToList={() => {
              setDriverProfileId("");
              setPage("drivers");
            }}
          />
        );
      case "assurance":
        return <Assurance currentUser={currentUser} adminProfile={adminProfile} />;
      case "store":
        return <StoreAdmin currentUser={currentUser} adminProfile={adminProfile} />;
      case "usersAdmin":
        return <UsersAdmin currentUser={currentUser} adminProfile={adminProfile} />;
      case "dashboard":
      default:
        return <Dashboard drivers={drivers} currentUser={currentUser} adminProfile={adminProfile} />;
    }
  };

  if (authLoading || (currentUser && profileLoading)) {
    return (
      <div className="app-shell">
        <div className="app-shell__backdrop" />
        <main className="app-shell__content">
          <section className="auth-card auth-card--loading">
            <div className="spinner-border text-primary mb-3" role="status" />
            <h1 className="auth-card__title">Chargement du dashboard</h1>
            <p className="auth-card__subtitle">Verification du compte et des permissions en cours.</p>
          </section>
        </main>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-shell">
        <div className="app-shell__backdrop" />
        <main className="app-shell__content">
          <section className="auth-layout">
            <div className="auth-card auth-card--brand">
              <span className="dashboard-hero__eyebrow">Highdep Control Center</span>
              <h1 className="auth-card__title">Acces securise au dashboard</h1>
              <p className="auth-card__subtitle">
                Connecte-toi pour gerer le CRM, le B2B, les chauffeurs, les courses et le store.
              </p>
              <ul className="auth-feature-list">
                <li>Connexion email et mot de passe</li>
                <li>Inscription publique avec validation admin</li>
                <li>Pages visibles selon les permissions du compte</li>
              </ul>
            </div>

            <section className="auth-card auth-card--form">
              <div className="auth-switch">
                <button
                  type="button"
                  className={`auth-switch__button ${authMode === "login" ? "is-active" : ""}`}
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`auth-switch__button ${authMode === "signup" ? "is-active" : ""}`}
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                  }}
                >
                  Sign up
                </button>
              </div>

              <h2 className="h4 mb-3">{authMode === "login" ? "Connexion" : "Inscription"}</h2>

              <form onSubmit={authMode === "login" ? handleLogin : handleSignup} className="auth-form">
                {authMode === "signup" ? (
                  <div>
                    <label className="form-label">Nom affiche</label>
                    <input
                      className="form-control"
                      name="displayName"
                      value={authForm.displayName}
                      onChange={handleAuthChange}
                      placeholder="Ex: Agent CRM"
                      required
                    />
                  </div>
                ) : null}

                <div>
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    type="email"
                    name="email"
                    value={authForm.email}
                    onChange={handleAuthChange}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Mot de passe</label>
                  <input
                    className="form-control"
                    type="password"
                    name="password"
                    value={authForm.password}
                    onChange={handleAuthChange}
                    minLength={6}
                    required
                  />
                </div>

                {authError ? <div className="alert alert-danger mb-0">{authError}</div> : null}

                <button type="submit" className="btn btn-primary auth-submit" disabled={authBusy}>
                  {authBusy
                    ? "Veuillez patienter..."
                    : authMode === "login"
                    ? "Se connecter"
                    : "Creer le compte"}
                </button>

                {authMode === "signup" ? (
                  <div className="auth-note">
                    Le compte sera cree en attente. Un super admin devra ensuite l'activer et definir ses acces.
                  </div>
                ) : null}
              </form>
            </section>
          </section>
        </main>
      </div>
    );
  }

  if (!adminProfile) {
    return (
      <div className="app-shell">
        <div className="app-shell__backdrop" />
        <main className="app-shell__content">
          <section className="auth-card">
            <h1 className="auth-card__title">Profil admin introuvable</h1>
            <p className="auth-card__subtitle">
              Le compte est connecte, mais aucun document n&apos;a ete trouve dans la collection admin.
            </p>
            <button type="button" className="btn btn-outline-dark mt-3" onClick={handleLogout}>
              Se deconnecter
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!adminProfile.active) {
    return (
      <div className="app-shell">
        <div className="app-shell__backdrop" />
        <main className="app-shell__content">
          <section className="auth-card">
            <span className="dashboard-hero__eyebrow">Compte en attente</span>
            <h1 className="auth-card__title">Inscription recue</h1>
            <p className="auth-card__subtitle">
              Ton compte est cree, mais il doit etre valide par un super admin avant d&apos;acceder au dashboard.
            </p>
            <div className="auth-pending-grid">
              <div>
                <span className="auth-pending-label">Nom</span>
                <strong>{adminProfile.displayName || currentUser.displayName || "-"}</strong>
              </div>
              <div>
                <span className="auth-pending-label">Email</span>
                <strong>{adminProfile.email || currentUser.email || "-"}</strong>
              </div>
              <div>
                <span className="auth-pending-label">Statut</span>
                <strong>{adminProfile.role || "pending"}</strong>
              </div>
            </div>
            <button type="button" className="btn btn-outline-dark mt-4" onClick={handleLogout}>
              Se deconnecter
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" />
      <main className="app-shell__content">
        <section className="dashboard-hero dashboard-hero--split">
          <div>
            <span className="dashboard-hero__eyebrow">Highdep Control Center</span>
            <h1 className="dashboard-hero__title">Dashboard operations</h1>
            <p className="dashboard-hero__subtitle">
              Gestion CRM, B2B, chauffeurs, reservations et store depuis une seule interface.
            </p>
          </div>

          <div className="dashboard-account">
            <div className="dashboard-account__label">Connecte en tant que</div>
            <div className="dashboard-account__name">
              {adminProfile.displayName || currentUser.displayName || currentUser.email}
            </div>
            <div className="dashboard-account__meta">
              {adminProfile.role || "agent"} | {currentUser.email}
            </div>
            <button type="button" className="btn btn-light btn-sm mt-3" onClick={handleLogout}>
              Se deconnecter
            </button>
          </div>
        </section>

        <section className="dashboard-nav">
          {visibleNavItems.map((item) => (
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

        <section className="dashboard-main">{renderPage()}</section>
      </main>
    </div>
  );
}

export default App;
