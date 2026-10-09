  # 📐 Structure JSON Specification

Spesifikasi data untuk menyimpan state objek dalam Mini Figma Vector Engine.

## Rectangle Primitive Schema

```json
{
  "id": "rect-106",
  "type": "rectangle",
  "name": "Rectangle 106",
  "visible": true,
  "locked": false,
  "transform": {
    "x": 2940.78,
    "y": -1976.85,
    "width": 120.0,
    "height": 80.0,
    "rotation": -33.94,
    "pivot": { "x": 0.5, "y": 0.5 }
  },
  "geometry": {
    "isCustomPath": false,
    "cornerRadius": [10, 10, 10, 10],
    "nodes": [
      { "id": "p0", "x": 0, "y": 0 },
      { "id": "p1", "x": 120, "y": 0 },
      { "id": "p2", "x": 120, "y": 80 },
      { "id": "p3", "x": 0, "y": 80 }
    ]
  },
  "style": {
    "fill": "#D9D9D9",
    "stroke": "#000000",
    "strokeWidth": 1
  }
}