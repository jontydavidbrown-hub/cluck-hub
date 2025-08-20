import React, { useState } from "react";
import { useFarms } from "../lib/FarmContext";

const Farms: React.FC = () => {
  const { farms, addFarm } = useFarms();
  const [farmName, setFarmName] = useState("");

  const handleAdd = async () => {
    if (!farmName.trim()) return;
    await addFarm(farmName.trim());
    setFarmName("");
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Farms</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="border p-2 flex-1"
          placeholder="Enter farm name"
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
        />
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={handleAdd}
        >
          Add Farm
        </button>
      </div>

      {farms.length === 0 ? (
        <p className="text-gray-500">No farms added yet.</p>
      ) : (
        <ul className="list-disc pl-6">
          {farms.map((farm) => (
            <li key={farm.id}>{farm.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Farms;
