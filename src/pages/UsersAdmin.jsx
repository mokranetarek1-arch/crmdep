import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import "./UsersAdmin.css";

const defaultPermissions = {
  dashboard: true,
  statistics: false,
  price: false,
  trips: false,
  drivers: false,
  assurance: false,
  store: false,
  usersAdmin: false,
};

const permissionLabels = {
  dashboard: "CRM",
  statistics: "Statistics",
  price: "Price",
  trips: "Trips",
  drivers: "Drivers",
  assurance: "B2B",
  store: "Store",
  usersAdmin: "Users Admin",
};

function readDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const parsed = readDate(value);
  return parsed ? parsed.toLocaleString("fr-FR") : "-";
}

function normalizePermissions(permissions = {}) {
  return { ...defaultPermissions, ...permissions };
}

export default function UsersAdmin({ currentUser, adminProfile }) {
  const [admins, setAdmins] = useState([]);
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [savingUid, setSavingUid] = useState("");

  useEffect(() => {
    const unsubscribeAdmins = onSnapshot(collection(db, "admin"), (snapshot) => {
      const next = snapshot.docs
        .map((entry) => ({
          uid: entry.id,
          ...entry.data(),
          permissions: normalizePermissions(entry.data().permissions),
        }))
        .sort((a, b) => {
          const first = readDate(a.createdAt)?.getTime() || 0;
          const second = readDate(b.createdAt)?.getTime() || 0;
          return second - first;
        });

      setAdmins(next);
    });

    const unsubscribeRequests = onSnapshot(collection(db, "requests"), (snapshot) => {
      setRequests(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });

    const unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });

    return () => {
      unsubscribeAdmins();
      unsubscribeRequests();
      unsubscribeProducts();
    };
  }, []);

  const userStats = useMemo(() => {
    const statsMap = {};

    admins.forEach((admin) => {
      statsMap[admin.uid] = {
        requestsCreated: 0,
        productsCreated: 0,
      };
    });

    requests.forEach((request) => {
      if (request.createdByUid && statsMap[request.createdByUid]) {
        statsMap[request.createdByUid].requestsCreated += 1;
      }
    });

    products.forEach((product) => {
      if (product.createdByUid && statsMap[product.createdByUid]) {
        statsMap[product.createdByUid].productsCreated += 1;
      }
    });

    return statsMap;
  }, [admins, requests, products]);

  const updateAdminField = async (uid, updates) => {
    setSavingUid(uid);

    try {
      await updateDoc(doc(db, "admin", uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise a jour de l'utilisateur.");
    } finally {
      setSavingUid("");
    }
  };

  const approveAdmin = async (admin) => {
    await updateAdminField(admin.uid, {
      active: true,
      role: admin.role === "pending" ? "agent" : admin.role || "agent",
      approvedAt: serverTimestamp(),
      approvedByUid: currentUser?.uid || "",
      approvedByEmail: currentUser?.email || "",
      permissions: normalizePermissions(admin.permissions),
    });
  };

  const togglePermission = async (admin, permissionKey) => {
    const nextPermissions = {
      ...normalizePermissions(admin.permissions),
      [permissionKey]: !normalizePermissions(admin.permissions)[permissionKey],
    };

    await updateAdminField(admin.uid, { permissions: nextPermissions });
  };

  const pendingUsers = admins.filter((admin) => !admin.active);
  const activeUsers = admins.filter((admin) => admin.active);

  if (adminProfile?.role !== "super_admin" && !adminProfile?.permissions?.usersAdmin) {
    return (
      <div className="users-admin-page">
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h2 className="h4 mb-2">Acces refuse</h2>
            <p className="text-muted mb-0">Cette page est reservee aux comptes autorises a gerer les utilisateurs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="users-admin-page">
      <div className="row g-3 mb-4">
        <StatCard title="En attente" value={pendingUsers.length} note="Inscriptions a valider" />
        <StatCard title="Actifs" value={activeUsers.length} note="Comptes autorises" />
        <StatCard title="Admins total" value={admins.length} note="Collection admin" />
      </div>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <h2 className="h4 mb-1">Inscriptions en attente</h2>
          <p className="text-muted mb-3">Valide les nouveaux comptes puis active les pages autorisees.</p>

          <div className="users-admin-grid">
            {pendingUsers.length === 0 ? (
              <div className="users-admin-empty">Aucune inscription en attente.</div>
            ) : (
              pendingUsers.map((admin) => (
                <article key={admin.uid} className="users-admin-card users-admin-card--pending">
                  <div className="users-admin-card__header">
                    <div>
                      <h3>{admin.displayName || "Sans nom"}</h3>
                      <p>{admin.email || "-"}</p>
                    </div>
                    <span className="badge text-bg-warning">Pending</span>
                  </div>

                  <div className="users-admin-meta">
                    <span>UID: {admin.uid}</span>
                    <span>Inscrit le: {formatDate(admin.createdAt)}</span>
                  </div>

                  <div className="users-admin-actions">
                    <button
                      type="button"
                      className="btn btn-dark"
                      disabled={savingUid === admin.uid}
                      onClick={() => approveAdmin(admin)}
                    >
                      {savingUid === admin.uid ? "Validation..." : "Valider le compte"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h2 className="h4 mb-1">Gestion des acces</h2>
          <p className="text-muted mb-3">Active ou coupe les pages visibles pour chaque utilisateur.</p>

          <div className="users-admin-grid">
            {activeUsers.map((admin) => {
              const stats = userStats[admin.uid] || { requestsCreated: 0, productsCreated: 0 };

              return (
                <article key={admin.uid} className="users-admin-card">
                  <div className="users-admin-card__header">
                    <div>
                      <h3>{admin.displayName || "Sans nom"}</h3>
                      <p>{admin.email || "-"}</p>
                    </div>
                    <span className={`badge ${admin.active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {admin.active ? "Actif" : "Bloque"}
                    </span>
                  </div>

                  <div className="users-admin-meta">
                    <span>Role: {admin.role || "agent"}</span>
                    <span>Cree le: {formatDate(admin.createdAt)}</span>
                    <span>Valide le: {formatDate(admin.approvedAt)}</span>
                  </div>

                  <div className="users-admin-selects">
                    <div>
                      <label className="form-label">Role</label>
                      <select
                        className="form-select"
                        value={admin.role || "agent"}
                        disabled={savingUid === admin.uid}
                        onChange={(event) =>
                          updateAdminField(admin.uid, { role: event.target.value })
                        }
                      >
                        <option value="agent">Agent</option>
                        <option value="dispatcher">Dispatcher</option>
                        <option value="manager">Manager</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Statut</label>
                      <select
                        className="form-select"
                        value={admin.active ? "active" : "blocked"}
                        disabled={savingUid === admin.uid || admin.uid === currentUser?.uid}
                        onChange={(event) =>
                          updateAdminField(admin.uid, {
                            active: event.target.value === "active",
                          })
                        }
                      >
                        <option value="active">Actif</option>
                        <option value="blocked">Bloque</option>
                      </select>
                    </div>
                  </div>

                  <div className="users-admin-permissions">
                    {Object.entries(permissionLabels).map(([permissionKey, label]) => (
                      <label key={permissionKey} className="users-admin-permission">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={normalizePermissions(admin.permissions)[permissionKey]}
                          disabled={savingUid === admin.uid}
                          onChange={() => togglePermission(admin, permissionKey)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="users-admin-stats">
                    <div>
                      <strong>{stats.requestsCreated}</strong>
                      <span>Courses creees</span>
                    </div>
                    <div>
                      <strong>{stats.productsCreated}</strong>
                      <span>Produits ajoutes</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, note }) {
  return (
    <div className="col-md-4">
      <div className="card border-0 shadow-sm h-100 users-admin-stat">
        <div className="card-body">
          <div className="text-muted mb-2">{title}</div>
          <div className="users-admin-stat__value">{value}</div>
          <div className="small text-muted">{note}</div>
        </div>
      </div>
    </div>
  );
}
