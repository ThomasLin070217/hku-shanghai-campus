import * as T from 'three';
import {buildObservedFeatureRoom} from '../model/observedFeatureRooms';
import {OPENING} from './spatialLayout';

/**
 * The HKU flip wall in the B04 ground-floor lobby.
 *
 * Ruling G1 (`docs/plans/2026-11-24-b4-side-entrance-ruling.md`): B04's lobby is a cavity
 * inside the band tower, so the south façade `z = 20.5` is its only exterior plane. The wall
 * is mounted on that wall's **interior** face (`z = 20.37`), east of the main door, facing
 * north into the room. There is no service cavity behind it — behind it is the building's
 * exterior — so it is a puzzle face only. The Building 5 lobby keeps its own ambient wall
 * (`b5FlipWall.ts`) until the route rewire retires it; both coexist on purpose.
 *
 * `B4_FLIP_WALL` is the ruled envelope the gate asserts. The built timber frame stands a few
 * centimetres prouder and sinks a few centimetres into the wall; that is expected for a panel
 * mounted flush on a wall with no recess.
 */
export const B4_FLIP_WALL_NAME = 'B04_flip_wall';
/** The wall part inside the observed-room builder. */
export const B4_FLIP_WALL_PANEL_NAME = 'HKU_flip_wall';

export type B4FlipWallRect = {x0: number; x1: number; y0: number; y1: number; z0: number; z1: number};

/** Ruling G1's mount: panel `x 60.00…67.37`, `y F+0.13…F+3.90`, `z 20.26…20.37`
 * (`z1` is the wall's interior plane, `depth` is how far the face stands proud). */
export const B4_FLIP_WALL = {
  x0: 60.00,
  x1: 67.37,
  y0: OPENING.b4.floor + .13,
  y1: OPENING.b4.floor + 3.90,
  z1: OPENING.b4.z1 - .13,
  depth: .11,
  /** The builder's +Z face must look north (−z) into the room. */
  yaw: Math.PI,
} as const;

const SOURCE = {
  sourceFile: 'src/opening/b4FlipWall.ts',
  source: 'Ruling G1 2026-11-24 + the observed flip-wall builder (src/model/observedFeatureRooms.ts)',
  confidence: 'mount numbers ruled; the panel geometry is the real builder output',
};

export interface B4FlipWallMount {
  root: T.Group;
  mount: T.Group;
  wall: T.Object3D;
  /** World origin of the panel's centre line: x is the panel centre, z the interior wall plane. */
  origin: [number, number, number];
  yaw: number;
  /** The builder's measured panel width (7.374 m), not a copied literal. */
  width: number;
  /** World AABB of the built panel, in metres. */
  measured: B4FlipWallRect;
}

/**
 * Build the observed flip wall alone (`parts: ['wall']`) and mount it on the B04 façade's
 * interior face. The builder parks the panel at (0.30, 0, −1.93) inside its preview corridor;
 * B04 mounts the panel itself, so that offset is dropped and the mount origin becomes the
 * panel centre. Shadows are off: 561 4 cm tiles would flood the shadow pass for no readable
 * gain, and the panel is only ever a puzzle face.
 */
export function createB4FlipWall(): B4FlipWallMount {
  const room = buildObservedFeatureRoom('flipWall', {parts: ['wall']});
  const wall = room.getObjectByName(B4_FLIP_WALL_PANEL_NAME);
  if (!wall) throw new Error(`the observed flip-wall builder has no ${B4_FLIP_WALL_PANEL_NAME} part`);
  wall.removeFromParent();
  wall.position.set(0, 0, 0);
  wall.updateMatrixWorld(true);
  const local = new T.Box3().setFromObject(wall);
  const width = local.max.x - local.min.x;
  const origin: [number, number, number] = [B4_FLIP_WALL.x0 + width / 2, OPENING.b4.floor, B4_FLIP_WALL.z1];

  const mount = new T.Group();
  mount.name = 'B04_flip_wall_mount';
  mount.userData = {...SOURCE, authorKey: 'B04_flip_wall_mount'};
  mount.position.fromArray(origin);
  mount.rotation.y = B4_FLIP_WALL.yaw;
  mount.add(wall);

  const root = new T.Group();
  root.name = B4_FLIP_WALL_NAME;
  // The 561 tiles are a puzzle surface that will turn individually, not static scenery: keep
  // them out of the static scene registry the way the chapter props are.
  root.userData = {...SOURCE, authorKey: B4_FLIP_WALL_NAME, dynamicGameplay: true, sceneLabel: 'HKU flip wall · B04 lobby (puzzle face)'};
  root.add(mount);
  root.updateMatrixWorld(true);

  wall.traverse(o => {
    if (o instanceof T.Mesh) {
      o.castShadow = false;
      o.receiveShadow = true;
    }
  });

  const box = new T.Box3().setFromObject(mount);
  const round = (v: number) => +v.toFixed(4);
  return {
    root,
    mount,
    wall,
    origin,
    yaw: B4_FLIP_WALL.yaw,
    width,
    measured: {
      x0: round(box.min.x), x1: round(box.max.x),
      y0: round(box.min.y), y1: round(box.max.y),
      z0: round(box.min.z), z1: round(box.max.z),
    },
  };
}
