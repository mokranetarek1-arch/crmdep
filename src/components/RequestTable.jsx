import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export default function RequestTable() {
  const [rows, setRows] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState(null);

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDocs(collection(db, "requests"));
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setRows(data);
    };
    fetchData();
  }, []);

  /* ================= HELPERS ================= */
  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  /* ================= FILTER ================= */
  const filteredRows = rows.filter((r) => {
    const matchDate = dateFilter ? r.date === dateFilter : true;

    let matchDay = true;
    if (dayFilter && r.date) {
      const dayName = new Date(r.date).toLocaleDateString("en-US", {
        weekday: "long",
      });
      matchDay = dayName === dayFilter;
    }

    const matchMonth = monthFilter ? isCurrentMonth(r.date) : true;

    return matchDate && matchDay && matchMonth;
  });

  /* ================= DELETE ================= */
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette demande ?")) return;
    await deleteDoc(doc(db, "requests", id));
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  /* ================= EDIT ================= */
  const handleEdit = (row) => {
    setEditRow({ ...row });
    setShowModal(true);
  };

  const handleUpdate = async () => {
    const ref = doc(db, "requests", editRow.id);

    await updateDoc(ref, {
      source: editRow.source,
      motif: editRow.motif,
      depart: editRow.depart,
      destination: editRow.destination,
      kilometrage: editRow.kilometrage,
      wilaya: editRow.wilaya,
      typeClient: editRow.typeClient,
      marqueVehicule: editRow.marqueVehicule,
      quantite: editRow.quantite,
      status: editRow.status,
      prix: editRow.prix,
      panneType: editRow.panneType,
      note: editRow.note,
    });

    setRows((prev) =>
      prev.map((r) => (r.id === editRow.id ? editRow : r))
    );
    setShowModal(false);
  };

  /* ================= RENDER ================= */
  return (
    <div className="container-fluid mt-4">
      {/* ===== FILTRES ===== */}
      <div className="row mb-4 g-3">
        <div className="col-md-3">
          <label>Date</label>
          <input
            type="date"
            className="form-control"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <label>Jour</label>
          <select
            className="form-select"
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="Monday">Lundi</option>
            <option value="Tuesday">Mardi</option>
            <option value="Wednesday">Mercredi</option>
            <option value="Thursday">Jeudi</option>
            <option value="Friday">Vendredi</option>
            <option value="Saturday">Samedi</option>
            <option value="Sunday">Dimanche</option>
          </select>
        </div>

        <div className="col-md-3 d-flex align-items-end">
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              checked={monthFilter}
              onChange={() => setMonthFilter(!monthFilter)}
            />
            <label className="form-check-label">
              Mois courant
            </label>
          </div>
        </div>
      </div>

      {/* ===== TABLE ===== */}
      <div className="table-responsive border rounded">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Source</th>
              <th>ID</th>
              <th>Départ</th>
              <th>Destination</th>
              <th>KM</th>
              <th>Wilaya</th>
              <th>Status</th>
              <th>Chauffeur</th>
              <th>Prix</th>
              <th>Date</th>
              <th>Heure</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="12" className="text-center text-muted">
                  Aucun résultat
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.source}</td>
                  <td>{r.id}</td>
                  <td>{r.depart}</td>
                  <td>{r.destination}</td>
                  <td>{r.kilometrage || "-"}</td>
                  <td>{r.wilaya}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === "Confirmé"
                          ? "bg-success"
                          : r.status === "Annulé"
                          ? "bg-danger"
                          : "bg-warning text-dark"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>{r.driverName || "-"}</td>
                  <td>{r.prix ? `${r.prix} DA` : "-"}</td>
                  <td>{r.date}</td>
                  <td>{r.heure}</td>
                  <td className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => handleEdit(r)}
                    >
                      Modifier
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(r.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== MODAL EDIT ===== */}
      {showModal && editRow && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Modifier la demande</h5>
                <button
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label>Départ</label>
                    <input
                      className="form-control"
                      value={editRow.depart || ""}
                      onChange={(e) =>
                        setEditRow({ ...editRow, depart: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label>Destination</label>
                    <input
                      className="form-control"
                      value={editRow.destination || ""}
                      onChange={(e) =>
                        setEditRow({
                          ...editRow,
                          destination: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label>Status</label>
                    <select
                      className="form-select"
                      value={editRow.status}
                      onChange={(e) =>
                        setEditRow({ ...editRow, status: e.target.value })
                      }
                    >
                      <option value="En attente">En attente</option>
                      <option value="Confirmé">Confirmé</option>
                      <option value="Annulé">Annulé</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label>Prix (DA)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={editRow.prix || ""}
                      onChange={(e) =>
                        setEditRow({ ...editRow, prix: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label>Kilométrage</label>
                    <input
                      className="form-control"
                      value={editRow.kilometrage || ""}
                      onChange={(e) =>
                        setEditRow({
                          ...editRow,
                          kilometrage: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="col-md-12">
                    <label>Note</label>
                    <textarea
                      className="form-control"
                      value={editRow.note || ""}
                      onChange={(e) =>
                        setEditRow({ ...editRow, note: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </button>
                <button className="btn btn-success" onClick={handleUpdate}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
