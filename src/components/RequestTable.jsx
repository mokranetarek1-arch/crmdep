import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { logAuditAction } from "../utils/audit";

const isConfirmedStatus = (value) => String(value || "").toLowerCase().includes("confirm");
const isCancelledStatus = (value) => String(value || "").toLowerCase().includes("annul");

export default function RequestTable({ onEdit, currentUser, adminProfile }) {
  const [rows, setRows] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [motifFilter, setMotifFilter] = useState("");
  const [numberSearch, setNumberSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("recent");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedTrace, setSelectedTrace] = useState(null);

  const sendWhatsApp = (phone, name, depart, destination, amount) => {
    if (!phone) return alert("Numero manquant");

    const formattedPhone = phone.startsWith("0")
      ? `+213${phone.substring(1)}`
      : phone.startsWith("+213")
      ? phone
      : `+213${phone}`;

    const message = `Depalink Service depannage avec vous

Depart: ${depart || "-"}
Destination: ${destination || "-"}
Montant: ${amount || 0} DA

Si vous etes satisfait par notre service, nous vous invitons a partager votre experience sur nos reseaux sociaux :
Facebook : https://www.facebook.com/share/1DKaHHQwSk/

Aussi, nous evaluer sur Google :
https://www.google.com/search?q=depalink+service+d%C3%A9pannage

Merci pour votre confiance`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "requests"),
      (snapshot) => {
        const data = snapshot.docs.map((entry) => ({
          docId: entry.id,
          ...entry.data(),
        }));
        setRows(data);
      },
      (error) => console.error("Firestore error:", error)
    );

    return () => unsubscribe();
  }, []);

  const getCreationDate = (row) => {
    if (row.createdAt?.toDate) return row.createdAt.toDate();
    if (row.createdAt) return new Date(row.createdAt);
    if (row.timestamp?.toDate) return row.timestamp.toDate();
    if (row.updatedAt?.toDate) return row.updatedAt.toDate();
    return null;
  };

  const formatCreatedAt = (row) => {
    const created = getCreationDate(row);
    return created ? created.toLocaleString("fr-FR") : "-";
  };

  const filteredRows = useMemo(() => {
    const query = numberSearch.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const dateObj = row.date?.toDate ? row.date.toDate() : row.date ? new Date(row.date) : null;
      const dateStr = dateObj ? dateObj.toISOString().slice(0, 10) : "";
      const phone = String(row.phone || "").toLowerCase();
      const requestId = String(row.id || "").toLowerCase();
      const dossier = String(row.numeroDossier || "").toLowerCase();

      const matchDate = dateFilter ? dateStr === dateFilter : true;

      let matchDay = true;
      if (dayFilter && dateObj) {
        const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
        matchDay = dayName === dayFilter;
      }

      let matchMonthYear = true;
      if (monthFilter !== "" && yearFilter !== "" && dateObj) {
        matchMonthYear =
          dateObj.getMonth() === parseInt(monthFilter, 10) &&
          dateObj.getFullYear() === parseInt(yearFilter, 10);
      }

      const matchStatus = statusFilter
        ? statusFilter === "Confirmé"
          ? isConfirmedStatus(row.status)
          : statusFilter === "Annulé"
          ? isCancelledStatus(row.status)
          : row.status === statusFilter
        : true;

      const matchMotif = motifFilter ? row.motif === motifFilter : true;
      const matchNumber = query ? phone.includes(query) || requestId.includes(query) || dossier.includes(query) : true;

      return matchDate && matchDay && matchMonthYear && matchStatus && matchMotif && matchNumber;
    });

    return filtered.sort((first, second) => {
      const firstTime = getCreationDate(first)?.getTime() || 0;
      const secondTime = getCreationDate(second)?.getTime() || 0;
      return sortOrder === "recent" ? secondTime - firstTime : firstTime - secondTime;
    });
  }, [rows, dateFilter, dayFilter, monthFilter, yearFilter, statusFilter, motifFilter, numberSearch, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, dayFilter, monthFilter, yearFilter, statusFilter, motifFilter, numberSearch, sortOrder, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleDelete = async (docId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce trajet ?")) return;

    try {
      const deletedRow = rows.find((row) => row.docId === docId);
      await deleteDoc(doc(db, "requests", docId));
      setRows((prev) => prev.filter((row) => row.docId !== docId));
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "delete",
        entityType: "request",
        entityId: docId,
        description: `Suppression de la course CRM ${deletedRow?.id || docId}`,
        metadata: { motif: deletedRow?.motif || "", driverId: deletedRow?.driverId || "" },
      });
    } catch (err) {
      console.error("Delete error:", err);
      alert("Erreur lors de la suppression");
    }
  };

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4 g-3 align-items-end">
        <div className="col-md-3">
          <label>Recherche numero / ID :</label>
          <input
            type="text"
            className="form-control"
            placeholder="Telephone, ID, dossier..."
            value={numberSearch}
            onChange={(event) => setNumberSearch(event.target.value)}
          />
        </div>

        <div className="col-md-2">
          <label>Date :</label>
          <input type="date" className="form-control" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        <div className="col-md-2">
          <label>Jour :</label>
          <select className="form-select" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
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

        <div className="col-md-2">
          <label>Mois :</label>
          <select className="form-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="0">Janvier</option>
            <option value="1">Fevrier</option>
            <option value="2">Mars</option>
            <option value="3">Avril</option>
            <option value="4">Mai</option>
            <option value="5">Juin</option>
            <option value="6">Juillet</option>
            <option value="7">Aout</option>
            <option value="8">Septembre</option>
            <option value="9">Octobre</option>
            <option value="10">Novembre</option>
            <option value="11">Decembre</option>
          </select>
        </div>

        <div className="col-md-1">
          <label>Annee :</label>
          <input
            type="number"
            className="form-control"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            placeholder={new Date().getFullYear()}
          />
        </div>

        <div className="col-md-1">
          <label>Status :</label>
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="Annulé">Annule</option>
            <option value="Confirmé">Confirme</option>
            <option value="En cours">En cours</option>
          </select>
        </div>

        <div className="col-md-1">
          <label>Motif :</label>
          <select className="form-select" value={motifFilter} onChange={(e) => setMotifFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="course immediate">Course immediate</option>
            <option value="reservation">Reservation</option>
            <option value="demande d'information">Demande d'information</option>
          </select>
        </div>
      </div>

      <div className="row mb-3 g-3 align-items-end">
        <div className="col-md-2">
          <label>Classement :</label>
          <select className="form-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="recent">Plus recent</option>
            <option value="oldest">Plus ancien</option>
          </select>
        </div>
        <div className="col-md-2">
          <label>Liste :</label>
          <select className="form-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="col-md-3">
          <span className="text-muted small">
            {filteredRows.length} course(s) | page {currentPage}/{totalPages}
          </span>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Source</th>
              <th>ID</th>
              <th>Motif</th>
              <th>Telephone</th>
              <th>Depart</th>
              <th>Destination</th>
              <th>Km</th>
              <th>Wilaya</th>
              <th>Vehicule</th>
              <th>Qte</th>
              <th>Status</th>
              <th>Dispatch</th>
              <th>Chauffeur</th>
              <th>Prix</th>
              <th>Panne</th>
              <th>Date</th>
              <th>Heure</th>
              <th>Ajoute le</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan="20" className="text-center text-muted py-3">
                  Aucun trajet trouve
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const dateObj = row.date?.toDate ? row.date.toDate() : row.date ? new Date(row.date) : null;
                return (
                  <tr key={row.docId}>
                    <td>{row.source}</td>
                    <td>{row.id}</td>
                    <td>{row.motif}</td>
                    <td>{row.phone || "-"}</td>
                    <td>{row.depart || "-"}</td>
                    <td>{row.destination || "-"}</td>
                    <td>{row.kilometrage || "-"}</td>
                    <td>{row.wilaya}</td>
                    <td>{row.marqueVehicule || "-"}</td>
                    <td>{row.quantite}</td>
                    <td>
                      <span
                        className={`badge ${
                          isCancelledStatus(row.status)
                            ? "bg-danger"
                            : isConfirmedStatus(row.status)
                            ? "bg-success"
                            : "bg-warning text-dark"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.dispatch || "-"}</td>
                    <td>{row.driverName || "-"}</td>
                    <td>{row.prix ? `${row.prix} DA` : "-"}</td>
                    <td>{row.panneType || "-"}</td>
                    <td>{dateObj ? dateObj.toLocaleDateString() : "-"}</td>
                    <td>{row.heure || "-"}</td>
                    <td>{formatCreatedAt(row)}</td>
                    <td>
                      {row.note ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setSelectedNote({ title: `Note CRM ${row.id || row.docId}`, body: row.note })}
                        >
                          Voir
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-primary me-2" onClick={() => onEdit(row)}>
                        Modifier
                      </button>
                      <button
                        className="btn btn-sm btn-outline-dark me-2"
                        onClick={() =>
                          setSelectedTrace({
                            title: `Trace ${row.id || row.docId}`,
                            createdByName: row.createdByName || "-",
                            createdByEmail: row.createdByEmail || "-",
                            updatedByName: row.updatedByName || "-",
                            updatedByEmail: row.updatedByEmail || "-",
                            createdAt: formatCreatedAt(row),
                            updatedAt: row.updatedAt?.toDate ? row.updatedAt.toDate().toLocaleString("fr-FR") : "-",
                          })
                        }
                      >
                        Trace
                      </button>
                      <button className="btn btn-sm btn-danger me-2" onClick={() => handleDelete(row.docId)}>
                        Supprimer
                      </button>
                      {isConfirmedStatus(row.status) && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => sendWhatsApp(row.phone, row.id, row.depart, row.destination, row.prix)}
                        >
                          WhatsApp
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
        >
          Precedent
        </button>
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
        >
          Suivant
        </button>
      </div>

      {selectedNote ? (
        <div className="note-modal-backdrop" onClick={() => setSelectedNote(null)}>
          <div className="note-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <div className="note-modal-label">DETAIL</div>
                <h5 className="mb-0">{selectedNote.title}</h5>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedNote(null)}>
                Fermer
              </button>
            </div>
            <div className="note-modal-body">{selectedNote.body}</div>
          </div>
        </div>
      ) : null}

      {selectedTrace ? (
        <div className="note-modal-backdrop" onClick={() => setSelectedTrace(null)}>
          <div className="note-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <div className="note-modal-label">TRACE</div>
                <h5 className="mb-0">{selectedTrace.title}</h5>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedTrace(null)}>
                Fermer
              </button>
            </div>
            <div className="note-modal-body">
              <div><strong>Ajoute par:</strong> {selectedTrace.createdByName}</div>
              <div><strong>Email ajout:</strong> {selectedTrace.createdByEmail}</div>
              <div><strong>Ajoute le:</strong> {selectedTrace.createdAt}</div>
              <hr />
              <div><strong>Modifie par:</strong> {selectedTrace.updatedByName}</div>
              <div><strong>Email modification:</strong> {selectedTrace.updatedByEmail}</div>
              <div><strong>Modifie le:</strong> {selectedTrace.updatedAt}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
