import { useState } from "react";

export default function PriceSimulator() {
  const [km, setKm] = useState("");
  const [night, setNight] = useState(false);
  const [type, setType] = useState("depannage"); // depannage | remorquage
  const [extra, setExtra] = useState({
    extraction: false,
    attente: false,
    deplacement: false,
    fourgon: false,
  });
  const [price, setPrice] = useState(null);

  const calculatePrice = () => {
    const distance = Number(km);
    if (!distance || distance <= 0) return;

    let total = 0;

    // 🔹 1. Forfait -30km
    if (distance <= 30) {
      if (type === "depannage") total = 1900;
      else total = 2800;
    }

    // 🔹 2. 31 → 150 km
    else if (distance <= 150) {
      total = distance * 82;
    }

    // 🔹 3. 151 → 400 km
    else if (distance <= 400) {
      total = distance * 46;
    }

    // 🔹 4. +400 km
    else {
      total = distance * 36;
    }

    // 🔹 Extras
    if (extra.extraction) total += 1500;
    if (extra.attente) total += 500;
    if (extra.deplacement) total += 1500;
    if (extra.fourgon) total += 1200;

    // 🔹 Night (25%)
    if (night) total *= 1.25;

    setPrice(Math.round(total));
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow">
      <h1 className="text-xl font-bold mb-4 text-center">
        Simulateur basé sur barème
      </h1>

      <input
        type="number"
        placeholder="Distance (km)"
        value={km}
        onChange={(e) => setKm(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
      />

      {/* Type */}
      <select
        onChange={(e) => setType(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
      >
        <option value="depannage">Dépannage</option>
        <option value="remorquage">Remorquage</option>
      </select>

      {/* Extras */}
      <div className="space-y-2 mb-4 text-sm">
        <label>
          <input type="checkbox" onChange={(e) =>
            setExtra({...extra, extraction: e.target.checked})
          } /> Extraction véhicule (+1500)
        </label>

        <label>
          <input type="checkbox" onChange={(e) =>
            setExtra({...extra, attente: e.target.checked})
          } /> Heure d'attente (+500)
        </label>

        <label>
          <input type="checkbox" onChange={(e) =>
            setExtra({...extra, deplacement: e.target.checked})
          } /> Déplacement sans suite (+1500)
        </label>

        <label>
          <input type="checkbox" onChange={(e) =>
            setExtra({...extra, fourgon: e.target.checked})
          } /> Fourgon (+1200)
        </label>

        <label>
          <input type="checkbox" onChange={(e) => setNight(e.target.checked)}
        /> Nuit (+25%)
        </label>
      </div>

      <button
        onClick={calculatePrice}
        className="w-full bg-black text-white py-2 rounded-xl"
      >
        Calculer
      </button>

      {price !== null && (
        <div className="mt-4 text-center">
          <p>Distance: {km} km</p>
          <p className="text-lg font-bold">{price} DA</p>
        </div>
      )}
    </div>
  );
}