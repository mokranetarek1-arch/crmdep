import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function RequestForm({ drivers = [] }) {
  const [form, setForm] = useState({
    source: "Appel",
    id: "client",
    motif: "course immediate",
    depart: "",
    destination: "",
    kilometrage: "",
    wilaya: "Alger",
    typeClient: "Client",
    marqueVehicule: "",
    quantite: 1,
    status: "Annulé",
    dispatch: "Appelé",
    chauffeur: "",      // هنا نخزن driverId
    driverName: "",     // هنا نخزن اسم السائق للعرض
    prix: "",
    panneType: "Panne",
    date: "",
    heure: "",
    note: ""
  });

  const submit = async (e) => {
    e.preventDefault();

    if (!form.chauffeur) {
      alert("Veuillez sélectionner un chauffeur !");
      return;
    }

    try {
      // 🔹 حفظ الطلب مع driverId و driverName
      await addDoc(collection(db, "requests"), {
        ...form,
        driverId: form.chauffeur,
        driverName: form.driverName,
        timestamp: serverTimestamp()
      });

      alert("Demande enregistrée avec succès !");

      // إعادة تهيئة النموذج
      setForm({
        source: "Appel",
        id: "client",
        motif: "course immediate",
        depart: "",
        destination: "",
        kilometrage: "",
        wilaya: "Alger",
        typeClient: "Client",
        marqueVehicule: "",
        quantite: 1,
        status: "Annulé",
        dispatch: "Appelé",
        chauffeur: "",
        driverName: "",
        prix: "",
        panneType: "Panne",
        date: "",
        heure: "",
        note: ""
      });

    } catch (error) {
      console.error("Erreur lors de l'ajout:", error);
      alert("Erreur lors de l'enregistrement, réessayez !");
    }
  };

  return (
    <div className="container mt-3">
      <div className="card shadow-sm">
        <div className="card-header fw-bold">Nouvelle demande</div>
        <div className="card-body">
          <form onSubmit={submit} className="row g-3">

            {/* Source */}
            <div className="col-md-4">
              <label className="form-label">Source</label>
              <select className="form-select"
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value })}
              >
                <option>Appel</option>
                <option>Plateforme</option>
              </select>
            </div>

            {/* ID */}
            <div className="col-md-4">
              <label className="form-label">ID</label>
              <select className="form-select"
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value })}
              >
                <option value="client">Client</option>
                <option value="partenaire">Partenaire</option>
                <option value="société">Société</option>
              </select>
            </div>

            {/* Motif */}
            <div className="col-md-4">
              <label className="form-label">Motif d'appel</label>
              <select className="form-select"
                value={form.motif}
                onChange={e => setForm({ ...form, motif: e.target.value })}
              >
                <option value="course immediate">Course immédiate</option>
                <option value="reservation">Réservation</option>
                <option value="demande d'information">Demande d'information</option>
              </select>
            </div>

            {/* Départ */}
            <div className="col-md-6">
              <label className="form-label">Départ</label>
              <input className="form-control"
                value={form.depart}
                onChange={e => setForm({ ...form, depart: e.target.value })}
              />
            </div>

            {/* Destination */}
            <div className="col-md-6">
              <label className="form-label">Destination</label>
              <input className="form-control"
                value={form.destination}
                onChange={e => setForm({ ...form, destination: e.target.value })}
              />
            </div>

            {/* Kilométrage */}
            <div className="col-md-4">
              <label className="form-label">Kilométrage</label>
              <input type="number" className="form-control"
                value={form.kilometrage}
                onChange={e => setForm({ ...form, kilometrage: e.target.value })}
              />
            </div>

            {/* Wilaya */}
            <div className="col-md-4">
              <label className="form-label">Wilaya</label>
              <input className="form-control"
                value={form.wilaya}
                onChange={e => setForm({ ...form, wilaya: e.target.value })}
              />
            </div>

            {/* Type client */}
            <div className="col-md-4">
              <label className="form-label">Type client</label>
              <select className="form-select"
                value={form.typeClient}
                onChange={e => setForm({ ...form, typeClient: e.target.value })}
              >
                <option>Client</option>
                <option>Depanneur</option>
              </select>
            </div>

            {/* Marque véhicule */}
            <div className="col-md-4">
              <label className="form-label">Marque véhicule</label>
              <input className="form-control"
                value={form.marqueVehicule}
                onChange={e => setForm({ ...form, marqueVehicule: e.target.value })}
              />
            </div>

            {/* Quantité */}
            <div className="col-md-2">
              <label className="form-label">Quantité</label>
              <input type="number" className="form-control"
                value={form.quantite}
                onChange={e => setForm({ ...form, quantite: e.target.value })}
              />
            </div>

            {/* Status */}
            <div className="col-md-4">
              <label className="form-label">Status</label>
              <select className="form-select"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option>Annulé</option>
                <option>En cours</option>
                <option>Confirmé</option>
              </select>
            </div>

            {/* Dispatch */}
            <div className="col-md-4">
              <label className="form-label">Dispatch</label>
              <select className="form-select"
                value={form.dispatch}
                onChange={e => setForm({ ...form, dispatch: e.target.value })}
              >
                <option>Appelé</option>
                <option>Application</option>
                <option>Aucun</option>
              </select>
            </div>

            {/* Chauffeur */}
            <div className="col-md-4">
              <label className="form-label">Chauffeur</label>
              <select className="form-select"
                value={form.chauffeur}
                onChange={e => {
                  const selected = drivers.find(d => d.driverId === e.target.value);
                  setForm({
                    ...form,
                    chauffeur: selected?.driverId || "",
                    driverName: selected ? `${selected.firstName} ${selected.lastName}` : ""
                  });
                }}
              >
                <option value="">-- Choisir un chauffeur --</option>
                {drivers.map(d => (
                  <option key={d.driverId} value={d.driverId}>
                    {d.firstName} {d.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Prix */}
            <div className="col-md-4">
              <label className="form-label">Prix (DA)</label>
              <input type="number" className="form-control"
                value={form.prix}
                onChange={e => setForm({ ...form, prix: e.target.value })}
              />
            </div>

            {/* Type de panne */}
            <div className="col-md-4">
              <label className="form-label">Type de panne</label>
              <select className="form-select"
                value={form.panneType}
                onChange={e => setForm({ ...form, panneType: e.target.value })}
              >
                <option>Panne</option>
                <option>Déplacement</option>
              </select>
            </div>

            {/* Date */}
            <div className="col-md-2">
              <label className="form-label">Date</label>
              <input type="date" className="form-control"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* Heure */}
            <div className="col-md-2">
              <label className="form-label">Heure</label>
              <input type="time" className="form-control"
                value={form.heure}
                onChange={e => setForm({ ...form, heure: e.target.value })}
              />
            </div>

            {/* Note */}
            <div className="col-12">
              <label className="form-label">Note</label>
              <input className="form-control"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div className="col-12 text-end">
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
