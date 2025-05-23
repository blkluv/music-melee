declare module "three/examples/jsm/controls/DeviceOrientationControls.js" {
  import { Camera } from "three";

  export class DeviceOrientationControls {
    constructor(camera: Camera);
    connect(): void;
    disconnect(): void;
    update(): boolean;
    dispose(): void;
  }
}
