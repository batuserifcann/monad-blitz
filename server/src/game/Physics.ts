const TANK_RADIUS = 20;
const BULLET_RADIUS = 5;

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const distSq = dx * dx + dy * dy;
  const r = ar + br;
  return distSq <= r * r;
}

export function bulletHitsTank(
  bulletX: number,
  bulletY: number,
  tankX: number,
  tankY: number
): boolean {
  return circlesOverlap(
    bulletX,
    bulletY,
    BULLET_RADIUS,
    tankX,
    tankY,
    TANK_RADIUS
  );
}

export function inArena(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x <= width && y >= 0 && y <= height;
}

export { TANK_RADIUS, BULLET_RADIUS };
