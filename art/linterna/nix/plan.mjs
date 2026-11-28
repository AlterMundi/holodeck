export const plan = {
  room: {width: 12, depth: 12, wallHeight: 3.68, floor: 0},
  avatar: {radius: .28, eyes: [1.2, 1.64], height: 1.8},
  anchors: {
    'nix.entry': {at: [0, 0, 5.88], facing: [0, 0, -1], opening: [2.20, 2.60]},
    'nix.return': {at: [0, 0, 5.88], facing: [0, 0, 1]},
    'wanda.mount': {at: [-1.70, 0, -.87], role: 'physical-reference-only'},
    'wanda.eyepiece': {at: [-1.70, 1.49, -.31], facing: [0, 0, 1], ratio: [4, 3], circleDiameter: .82},
    'wanda.full-frame': {at: [-1.70, 1.49, -.31], action: 'inspect_eyepiece'},
    'wanda.controls': {at: [.04, 1.00, -.45], facing: [0, 0, 1], role: 'status-and-inspection'},
    'wanda.gallery.capture': {at: [5.69, 1.68, -2.32], facing: [-1, 0, 0], size: [1.92, 1.44],
      action: 'inspect_poster', asset: 'capture'},
    'wanda.gallery.preview-02': {at: [5.69, 1.68, .34], facing: [-1, 0, 0], size: [1.44, 1.08],
      role: 'fixture-only', asset: 'preview-02'},
    'wanda.gallery.preview-03': {at: [5.69, 1.68, 2.72], facing: [-1, 0, 0], size: [1.44, 1.08],
      role: 'fixture-only', asset: 'preview-03'},
  },
  poses: {
    approach: {eye: [2.0, 1.64, 12.0], target: [0, 2.05, 5.48]},
    entry: {eye: [0, 1.64, 5.10], target: [.13, 1.72, -.84]},
    ocular: {eye: [-1.70, 1.64, 1.27], target: [-1.70, 1.49, -.31]},
    controls: {eye: [.04, 1.64, 1.27], target: [.04, 1.08, -.45]},
    gallery: {eye: [.44, 1.64, .14], target: [5.69, 1.73, .07]},
    photo: {eye: [3.53, 1.64, -2.32], target: [5.69, 1.68, -2.32]},
    return: {eye: [0, 1.64, 2.55], target: [0, 1.28, 6.1]},
  },
  solids: {
    mount: [-2.35, -2.20, -1.05, -.23],
    controls: [-.52, -1.24, .59, -.34],
    bench: [-5.79, -2.94, -4.94, .18],
    northRail: [-4.10, -5.80, 3.95, -5.38],
    galleryWall: [5.47, -5.74, 6.00, 5.74],
  },
  paths: {
    ocular: [[0, 6.8], [0, 3.45], [-1.70, 2.2], [-1.70, 1.27]],
    controls: [[0, 6.8], [0, 3.45], [.04, 1.27]],
    gallery: [[0, 6.8], [0, 3.45], [2.66, 2.7], [3.28, .4], [3.53, -2.32]],
    return: [[3.53, -2.32], [3.28, .4], [2.66, 2.7], [0, 3.45], [0, 6.8]],
  },
};

export function walkable(x, z, radius = plan.avatar.radius) {
  if (z > 13 || z < -5.73 + radius || Math.abs(x) > 5.73 - radius) return false;
  const entryHalf = plan.anchors['nix.entry'].opening[0] / 2;
  if (Math.abs(z - 5.88) <= .31 + radius && Math.abs(x) + radius >= entryHalf) return false;
  if (z > 6.2 && z < 6.90 && Math.abs(x) + radius > 2.01) return false;
  return !Object.values(plan.solids).some(([minX,minZ,maxX,maxZ]) => {
    const dx = x - Math.max(minX, Math.min(x, maxX));
    const dz = z - Math.max(minZ, Math.min(z, maxZ));
    return dx * dx + dz * dz < radius * radius;
  });
}
