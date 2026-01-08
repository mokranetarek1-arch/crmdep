import { useState } from "react";

export default function PriceSimulator() {
  const [km, setKm] = useState("");
  const [accident, setAccident] = useState(false);
  const [night, setNight] = useState(false);
  const [specialVehicle, setSpecialVehicle] = useState(false);
  const [price, setPrice] = useState(null);

  const calculateBasePrice = (distance) => {
    if (distance >= 1 && distance <= 5) return 2500;
    if (distance > 5 && distance <= 20) return 4000;
    if (distance > 20 && distance <= 30) return 5000;
    if (distance > 30 && distance <= 50) return 6000;
    if (distance > 50 && distance <= 70) return 8000;
    if (distance > 70 && distance <= 100) return 10000;
    if (distance > 100) return 12000;
    return 0;
  };

  const calculatePrice = () => {
    const distance = Number(km);
    if (!distance || distance <= 0) return;

    let total = calculateBasePrice(distance);

    if (accident) total += 2000;
    if (specialVehicle) total += 1500;
    if (night) total = total * 1.25;

    setPrice(Math.round(total));
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow">
      <h1 className="text-xl font-bold mb-4 text-center">
        Simulateur de prix – Alger
      </h1>

      <input
        type="number"
        placeholder="Distance (km)"
        value={km}
        onChange={(e) => setKm(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
      />

      <div className="space-y-2 mb-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" onChange={(e) => setAccident(e.target.checked)} />
          Accident
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" onChange={(e) => setSpecialVehicle(e.target.checked)} />
          Véhicule spécial
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" onChange={(e) => setNight(e.target.checked)} />
          Intervention de nuit (+25%)
        </label>
      </div>

      <button
        onClick={calculatePrice}
        className="w-full bg-black text-white py-2 rounded-xl"
      >
        Calculer le prix
      </button>

      {price !== null && (
        <div className="mt-4 text-center">
          <p className="text-sm">
            Distance : <strong>{km} km</strong>
          </p>
          <p className="text-lg font-bold">
            Prix estimé : {price} DA
          </p>
        </div>
      )}
    </div>
  );
}
