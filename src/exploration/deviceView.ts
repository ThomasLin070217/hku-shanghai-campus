import {Group, MathUtils, Matrix4, Object3D, PerspectiveCamera, Quaternion, Vector3} from 'three';

/** Camera presentation reads the existing held mesh. Neither the avatar nor its saved view moves. */
export function createDeviceView(camera:PerspectiveCamera, firstPersonArms:Group) {
  const target = new Vector3(), eye = new Vector3(), orientation = new Quaternion(), basis = new Matrix4();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let requested = false, progress = 0;
  let model:Group|null = null, hinge:Object3D|undefined, screen:Object3D|undefined, carryAngle = 0;

  function show(value:boolean) {
    requested = value;
    document.body.classList.toggle('using-campus-device',value);
  }
  function update(dt:number, first:boolean, held:Group|null) {
    if (!requested && !progress) return;
    if (held !== model) {
      if (hinge) hinge.rotation.x = carryAngle;
      model = held;
      hinge = held?.getObjectByName('Lid_Hinge');
      screen = held?.getObjectByName('Screen');
      carryAngle = hinge?.rotation.x ?? 0;
    }
    const targetProgress = requested && screen ? 1 : 0;
    progress = reducedMotion.matches ? targetProgress : MathUtils.damp(progress,targetProgress,10,dt);
    if (Math.abs(progress-targetProgress) < .002) progress = targetProgress;
    if (hinge) hinge.rotation.x = MathUtils.lerp(carryAngle,-1.72,progress);
    firstPersonArms.position.set(0,first ? .13*progress : 0,first ? .13*progress : 0);
    if (!first && screen && progress) {
      screen.updateWorldMatrix(true,false);
      target.setFromMatrixPosition(screen.matrixWorld);
      eye.set(0,-1,0).transformDirection(screen.matrixWorld).multiplyScalar(.43).add(target);
      basis.lookAt(eye,target,camera.up);
      orientation.setFromRotationMatrix(basis);
      camera.position.lerp(eye,progress);
      camera.quaternion.slerp(orientation,progress);
      camera.updateMatrixWorld();
    }
    if (!progress && !requested) {model=null;hinge=undefined;screen=undefined;}
  }
  return {show,update};
}
