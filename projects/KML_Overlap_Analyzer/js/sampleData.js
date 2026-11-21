/**
 * Sample realistic Division KML dataset with Reserve Forest (RF) and Revenue Land (RL) polygons
 * Coordinates are formatted as GeoJSON and KML for instant demonstration and verification.
 */

window.SAMPLE_DIVISION_DATA = [
  {
    id: "rf_comp_01",
    name: "Kothur RF - Compartment 1",
    type: "RF",
    color: "#22c55e", // Green
    fillStyle: "solid", // "solid" | "outline"
    fillOpacity: 0.45,
    strokeWidth: 2,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [78.350, 17.300],
        [78.380, 17.300],
        [78.385, 17.325],
        [78.365, 17.335],
        [78.345, 17.320],
        [78.350, 17.300]
      ]]
    },
    originalAreaHa: 0,
    areaHa: 0
  },
  {
    id: "rf_comp_02",
    name: "Kothur RF - Compartment 2 (Overlapping)",
    type: "RF",
    color: "#06b6d4", // Cyan
    fillStyle: "solid",
    fillOpacity: 0.45,
    strokeWidth: 2,
    // Deliberately overlaps with Kothur RF - Compartment 1 between [78.365-78.385, 17.310-17.335]
    geometry: {
      type: "Polygon",
      coordinates: [[
        [78.370, 17.310],
        [78.405, 17.310],
        [78.410, 17.340],
        [78.375, 17.345],
        [78.365, 17.325],
        [78.370, 17.310]
      ]]
    },
    originalAreaHa: 0,
    areaHa: 0
  },
  {
    id: "rf_north_block",
    name: "Ananthagiri RF - North Range",
    type: "RF",
    color: "#10b981", // Emerald
    fillStyle: "solid",
    fillOpacity: 0.45,
    strokeWidth: 2,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [78.310, 17.330],
        [78.340, 17.330],
        [78.345, 17.360],
        [78.320, 17.370],
        [78.305, 17.350],
        [78.310, 17.330]
      ]]
    },
    originalAreaHa: 0,
    areaHa: 0
  },
  {
    id: "rl_survey_140",
    name: "RL Survey No 140-148 (Revenue Overlap)",
    type: "RL",
    color: "#f59e0b", // Amber
    fillStyle: "solid",
    fillOpacity: 0.45,
    strokeWidth: 2,
    // Overlaps with Ananthagiri RF - North Range on the eastern boundary [78.335-78.345, 17.340-17.360]
    geometry: {
      type: "Polygon",
      coordinates: [[
        [78.335, 17.340],
        [78.360, 17.340],
        [78.365, 17.365],
        [78.340, 17.365],
        [78.335, 17.340]
      ]]
    },
    originalAreaHa: 0,
    areaHa: 0
  },
  {
    id: "rl_survey_210",
    name: "RL Patta Land Sy 210 to 215",
    type: "RL",
    color: "#ec4899", // Pink
    fillStyle: "solid",
    fillOpacity: 0.45,
    strokeWidth: 2,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [78.390, 17.280],
        [78.420, 17.280],
        [78.425, 17.300],
        [78.395, 17.305],
        [78.390, 17.280]
      ]]
    },
    originalAreaHa: 0,
    areaHa: 0
  },
  {
    id: "rf_south_valley",
    name: "Gundala RF - South Extension",
    type: "RF",
    color: "#8b5cf6", // Purple
    fillStyle: "solid",
    fillOpacity: 0.45,
    strokeWidth: 2,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [78.330, 17.270],
        [78.360, 17.265],
        [78.370, 17.290],
        [78.340, 17.295],
        [78.330, 17.270]
      ]]
    },
    originalAreaHa: 0,
    areaHa: 0
  }
];
