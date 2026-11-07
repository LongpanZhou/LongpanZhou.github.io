// Hand-placed positions from the layout editor, baked in as the default layout.
// Each entry replaces the rule-based pose for that item id. x and z are world units, yawDeg
// is the model's rotation about the vertical axis in degrees, and y is the height above the
// ground. Sizes are not set per entity: every entity of a type is the same size. To add more,
// copy the layout from the editor panel and paste its entries here.
export interface BakedPose {
  x: number
  z: number
  yawDeg: number
  y: number
}

export const BAKED_POSES: Record<string, BakedPose> = {
  'red-tower-3': { x: -159.61, z: 167.55, yawDeg: -223.4, y: 0 },
  'blue-tower-3': { x: -89.6, z: 85.05, yawDeg: 136.6, y: 0 },
}
