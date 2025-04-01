import * as THREE from "three";

export class DeviceOrientationControls {
  camera: THREE.Camera;
  enabled: boolean;
  deviceOrientation: DeviceOrientationEvent | null;
  screenOrientation: number;
  euler: THREE.Euler;
  quaternion: THREE.Quaternion;
  // Auxiliary quaternions for rotation adjustment.
  quatL: THREE.Quaternion;
  quatR: THREE.Quaternion;

  private _onDeviceOrientationChangeEvent: (
    event: DeviceOrientationEvent,
  ) => void;
  private _onScreenOrientationChangeEvent: () => void;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.enabled = true;
    this.deviceOrientation = null;
    this.screenOrientation = window.orientation
      ? Number(window.orientation)
      : 0;

    this.euler = new THREE.Euler();
    this.quaternion = new THREE.Quaternion();
    this.quatL = new THREE.Quaternion();
    // This rotates the camera by -90 degrees around the X-axis.
    this.quatL.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    this.quatR = new THREE.Quaternion();

    this._onDeviceOrientationChangeEvent = (event: DeviceOrientationEvent) => {
      this.deviceOrientation = event;
    };
    this._onScreenOrientationChangeEvent = () => {
      this.screenOrientation = window.orientation
        ? Number(window.orientation)
        : 0;
    };

    this.connect();
  }

  connect() {
    window.addEventListener(
      "deviceorientation",
      this._onDeviceOrientationChangeEvent,
      false,
    );
    window.addEventListener(
      "orientationchange",
      this._onScreenOrientationChangeEvent,
      false,
    );
    this.enabled = true;
  }

  disconnect() {
    window.removeEventListener(
      "deviceorientation",
      this._onDeviceOrientationChangeEvent,
      false,
    );
    window.removeEventListener(
      "orientationchange",
      this._onScreenOrientationChangeEvent,
      false,
    );
    this.enabled = false;
  }

  update(): boolean {
    if (!this.enabled) return false;
    if (this.deviceOrientation) {
      // Extract degrees from the event, defaulting to 0 if null.
      const alpha = THREE.MathUtils.degToRad(this.deviceOrientation.alpha || 0);
      const beta = THREE.MathUtils.degToRad(this.deviceOrientation.beta || 0);
      const gamma = THREE.MathUtils.degToRad(this.deviceOrientation.gamma || 0);
      const orient = THREE.MathUtils.degToRad(this.screenOrientation);

      // Set Euler angles in YXZ order.
      this.euler.set(beta, alpha, -gamma, "YXZ");

      // Convert Euler to quaternion.
      this.quaternion.setFromEuler(this.euler);
      // Apply the quaternion that rotates the camera -90 degrees around the X-axis.
      this.quaternion.multiply(this.quatL);
      // Adjust for screen orientation.
      this.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          -orient,
        ),
      );

      this.camera.quaternion.copy(this.quaternion);
    }
    return true;
  }

  dispose() {
    this.disconnect();
  }
}
