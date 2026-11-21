// Lightweight clean sample data matching the Desktop sample KML files (under 1 KB, zero lag)
window.SAMPLE_REFERENCE_DATA = {
  "type": "FeatureCollection",
  "name": "Reference_Boundary_Green",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Reference Division Boundary (Master)" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [77.40, 10.00], [77.42, 10.03], [77.45, 10.06], [77.48, 10.08],
            [77.52, 10.10], [77.55, 10.12], [77.58, 10.15], [77.62, 10.17],
            [77.65, 10.19], [77.68, 10.20], [77.72, 10.17], [77.75, 10.12],
            [77.74, 10.05], [77.70, 9.98],  [77.65, 9.92],  [77.58, 9.88],
            [77.50, 9.90],  [77.43, 9.95],  [77.40, 10.00]
          ]
        ]
      }
    }
  ]
};

window.SAMPLE_TARGET_DATA = {
  "type": "FeatureCollection",
  "name": "Target_Boundary_Red",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Target District Boundary (To Adjust)" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [77.52, 10.10], [77.54, 10.16], [77.57, 10.21], [77.61, 10.24],
            [77.66, 10.23], [77.68, 10.20], [77.73, 10.18], [77.78, 10.14],
            [77.80, 10.08], [77.76, 10.00], [77.72, 9.94],  [77.64, 9.89],
            [77.55, 9.86],  [77.47, 9.88],  [77.44, 9.94],  [77.48, 10.02],
            [77.52, 10.10]
          ]
        ]
      }
    }
  ]
};
