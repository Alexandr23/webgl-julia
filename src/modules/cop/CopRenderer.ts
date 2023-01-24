import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory";
import { VRButton } from "three/examples/jsm/webxr/VRButton";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

const TABLE_SIZE = 0.8;
const TABLE_SIZE_HEIGHT = 0.04;

const TABLE_POSITION_X = 0;
const TABLE_POSITION_Y = -TABLE_SIZE;
const TABLE_POSITION_HEIGHT = 1;

const COLOR_DEFAULT = 0x808080;
const COLOR_SELECTION = 0xffff00;
const COLOR_DRAGGING = 0xffff00;
const COLOR_COLLIDING = 0x0000ff;
const COLOR_ATTACHED = 0x0000ff;

const COLOR_RANGE_DEFAULT = 0xffff00;

const TERRAIN_SIZE = 100;
const TERRAIN_SHARPNESS = 1;

type CopRendererOptions = {
  parentElement?: HTMLDivElement;
};

export class CopRenderer {
  private clock: THREE.Clock = new THREE.Clock();

  private camera: any;
  private scene: any;
  private raycaster: any;
  private renderer!: THREE.WebGLRenderer;

  private room: any;

  private controller: any;

  private table: any;
  private textureMap: any;

  private INTERSECTED: any;

  private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();

  private offset = new THREE.Vector3();

  private shift = new THREE.Vector3();

  private container: any;

  constructor(options: CopRendererOptions) {
    this.container = document.createElement("div");
    document.body.appendChild(this.container);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1, 0);
    this.scene.add(this.camera);

    this.room = new THREE.Group();
    this.scene.add(this.room);

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
      "./textures/cube-background/forest/x-pos.png",
      "./textures/cube-background/forest/x-neg.png",
      "./textures/cube-background/forest/y-pos.png",
      "./textures/cube-background/forest/y-neg.png",
      "./textures/cube-background/forest/z-neg.png",
      "./textures/cube-background/forest/z-pos.png",
    ]);
    this.scene.background = texture;

    this.addRoom();
    this.addImages();
    // this.addTree();
    // this.addSnowman();
    this.addMusic();
    this.addDog();

    this.scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

    const light = new THREE.PointLight(0xffffff, 0.5);
    light.position.set(1, 2, 1); //.normalize();
    light.castShadow = true;
    // light.target = this.table;
    // light.shadow.mapSize.width = 1024;
    // light.shadow.mapSize.height = 1024;
    light.shadow.bias = -0.0001;
    this.scene.add(light);

    this.raycaster = new THREE.Raycaster();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add canvas to a parent element
    this.container.appendChild(this.renderer.domElement);

    this.controller = this.renderer.xr.getController(0);
    this.controller.addEventListener("selectstart", this.onSelectStart);
    this.controller.addEventListener("selectend", this.onSelectEnd);
    this.controller.addEventListener("connected", (event: any) => {
      this.controller.add(this.buildController(event.data));
    });
    this.controller.addEventListener("disconnected", () => {
      //   this.controller.remove(this.children[0]);
    });
    this.scene.add(this.controller);

    const controls = new OrbitControls(this.camera, this.renderer.domElement);

    controls.enablePan = false;
    controls.enableZoom = false;
    controls.target.set(0, 1, 0);
    controls.update();

    window.addEventListener("resize", this.onWindowResize);

    document.body.appendChild(VRButton.createButton(this.renderer));

    this.animate();
  }

  addMusic = () => {
    // create an AudioListener and add it to the camera
    const listener = new THREE.AudioListener();
    this.camera.add(listener);

    // create the PositionalAudio object (passing in the listener)
    const sound = new THREE.PositionalAudio(listener);

    // load a sound and set it as the PositionalAudio object's buffer
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load("./finale.mp3", function (buffer) {
      sound.setBuffer(buffer);
      // sound.setRefDistance(20);
      sound.setRefDistance(5);
      sound.setRolloffFactor(2);
      // sound.setDistanceModel("exponential");
      sound.loop = true;
      sound.play();
    });

    // create an object for the sound to play from
    const sphere = new THREE.SphereGeometry(0.05, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0xff2200 });
    const mesh = new THREE.Mesh(sphere, material);

    mesh.position.set(3.8, 0.3, 5.4);

    this.room.add(mesh);

    // finally add the sound to the mesh
    mesh.add(sound);
  };

  public destroy = () => {
    console.log("CopRenderer.destroy is not implemented");
  };

  onSelectStart = () => {
    if (this.INTERSECTED && !this.controller.userData.selected) {
      this.controller.userData.selected = this.INTERSECTED;
      this.controller.userData.isSelecting = true;

      this.removeImageHightlighting(this.INTERSECTED);

      this.vibrate();
    }
  };

  onSelectEnd = () => {
    const selected = this.controller.userData.selected;

    this.controller.userData.selected = undefined;
    this.controller.userData.isSelecting = false;

    if (!selected) return;

    // RESET
    selected.position.copy(selected.userData.initialPosition);
    const baseScale = selected.userData.baseScale ?? 1;
    selected.scale.copy(new THREE.Vector3(baseScale, baseScale, baseScale));
    selected.rotation.setFromVector3(selected.userData.initialRotation);

    // TODO: remove hack
    // selected.material.color.setHex(COLOR_DEFAULT);
    // selected.currentHex = COLOR_DEFAULT;
  };

  addRoom = () => {
    const loader = new GLTFLoader();
    loader.load("./models/new-room.glb", (gltf) => {
      gltf.scene.position.x = 0;
      gltf.scene.position.y = 0;
      gltf.scene.position.z = 2;

      gltf.scene.rotateY(Math.PI / 2);

      gltf.scene.scale.setScalar(5);

      this.room.add(gltf.scene);
    });
  };

  addSnowmanOlaf = () => {
    const loader = new GLTFLoader();
    loader.load("./models/olaf.glb", (gltf) => {
      gltf.scene.position.x = 0;
      gltf.scene.position.y = 0.5;
      gltf.scene.position.z = -2;

      console.log(gltf);

      // gltf.scene.rotateY(Math.PI / 2);

      //Eyebrows
      (gltf.scene.children[0] as any).material = new THREE.MeshStandardMaterial(
        {
          color: 0x000000,
          roughness: 1,
          metalness: 0.0,
        }
      );
      (gltf.scene.children[1] as any).material = new THREE.MeshStandardMaterial(
        {
          color: 0x000000,
          roughness: 1,
          metalness: 0.0,
        }
      );
      (gltf.scene.children[2] as any).material = new THREE.MeshStandardMaterial(
        {
          color: 0x000000,
          roughness: 1,
          metalness: 0.0,
        }
      );

      (gltf.scene.children[5] as any).children.forEach((mesh: any) => {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 1,
          metalness: 0.0,
        });
      });

      gltf.scene.scale.setScalar(0.3);

      this.room.add(gltf.scene);
    });
  };

  addSnowman = () => {
    const loader = new FBXLoader();
    loader.load("./models/snowman.fbx", (fbx) => {
      fbx.position.x = 0;
      fbx.position.y = 0.2;
      fbx.position.z = -4;

      fbx.rotateY(-Math.PI / 2);

      fbx.scale.setScalar(0.01);

      this.room.add(fbx);
    });
  };

  addTree = () => {
    const loader = new FBXLoader();
    loader.load("./models/tree.fbx", (fbx) => {
      fbx.position.x = 3;
      fbx.position.y = 0.2;
      fbx.position.z = 7;

      fbx.scale.setScalar(0.005);

      this.room.add(fbx);
    });
  };

  addDog = () => {
    const loader = new FBXLoader();
    loader.load("./models/dog.fbx", (fbx) => {
      fbx.position.x = 4;
      fbx.position.y = 0.25;
      fbx.position.z = 5;

      fbx.rotateY(-Math.PI / 2);

      fbx.scale.setScalar(0.0005);

      this.room.add(fbx);
    });
  };

  getTableMaterial = () => {
    const textureLoader = new THREE.TextureLoader();
    // this.textureMap = textureLoader.load("./textures/map-2-2.png");
    this.textureMap = textureLoader.load("./textures/yacht-2022.jpeg");

    return new THREE.MeshBasicMaterial({
      map: this.textureMap,
    });
  };

  renderTable = () => {
    const geometry = new THREE.BoxGeometry(
      TABLE_SIZE,
      TABLE_SIZE_HEIGHT,
      TABLE_SIZE
    );

    this.table = new THREE.Mesh(geometry, [
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      this.getTableMaterial(),
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
    ]);

    this.table.position.x = TABLE_POSITION_X;
    this.table.position.y = TABLE_POSITION_HEIGHT - TABLE_SIZE_HEIGHT / 2;
    this.table.position.z = TABLE_POSITION_Y;

    const bb = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
    bb.setFromObject(this.table);
    this.table.userData.bb = bb;

    this.room.add(this.table);
  };

  addImages = () => {
    // LEFT WALL
    this.addImage(
      "jv1",
      new THREE.Vector3(-4.49, 1.5, -4),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02],
      "./content/j/j24.jpeg"
    );

    this.addImage(
      "./content/j/j7.jpeg",
      new THREE.Vector3(-4.49, 1.5, -2.5),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j1.jpeg",
      new THREE.Vector3(-4.49, 1.5, -1),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j2.jpeg",
      new THREE.Vector3(-4.49, 1.5, 0.5),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j3.jpeg",
      new THREE.Vector3(-4.49, 1.5, 2),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j4.jpeg",
      new THREE.Vector3(-4.49, 1.5, 3.5),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j9.jpeg",
      new THREE.Vector3(-4.49, 1.5, 5),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j10.jpeg",
      new THREE.Vector3(-4.49, 1.5, 6.5),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [1, 1, 0.02],
      "./textures/monkey.jpeg"
    );

    // LEFT BIG
    this.addImage(
      "jv2",
      new THREE.Vector3(-4.49, 3.75, -3.25),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [2.5, 2.5, 0.02]
    );

    this.addImage(
      "./content/j/j6.jpeg",
      new THREE.Vector3(-4.49, 3.75, -0.25),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [2.5, 2.5, 0.02]
    );

    this.addImage(
      "./content/j/j23.jpeg",
      new THREE.Vector3(-4.49, 3.75, 2.75),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [2.5, 2.5, 0.02],
      "./content/j/j13.jpeg"
    );

    this.addImage(
      "./content/j/j8.jpeg",
      new THREE.Vector3(-4.49, 3.75, 5.75),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [2.5, 2.5, 0.02]
    );

    // RIGHT WALL
    this.addImage(
      "./content/j/j11.jpeg",
      new THREE.Vector3(4.49, 1.5, -4),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j12.jpeg",
      new THREE.Vector3(4.49, 1.5, -2.5),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "jv3",
      new THREE.Vector3(4.49, 1.5, -1),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j5.jpeg",
      new THREE.Vector3(4.49, 1.5, 0.5),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02],
      "./content/j/j16.jpeg"
    );

    this.addImage(
      "jv4",
      new THREE.Vector3(4.49, 1.5, 2),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    this.addImage(
      "./content/j/j15.jpeg",
      new THREE.Vector3(4.49, 1.5, 3.5),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02],
      "./content/j/viktor.jpeg"
    );

    this.addImage(
      "jv5",
      new THREE.Vector3(4.49, 1.5, 5),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02],
      "./textures/7.jpeg"
    );

    this.addImage(
      "./content/j/j17.jpeg",
      new THREE.Vector3(4.49, 1.5, 6.5),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [1, 1, 0.02]
    );

    // RIGHT BIG
    this.addImage(
      "./content/j/j18.jpeg",
      new THREE.Vector3(4.49, 3.75, -3.25),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [2.5, 2.5, 0.02]
    );

    this.addImage(
      "./content/j/j19.jpeg",
      new THREE.Vector3(4.49, 3.75, -0.25),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [2.5, 2.5, 0.02]
    );

    this.addImage(
      "./content/j/j14.jpeg",
      new THREE.Vector3(4.49, 3.75, 2.75),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [2.5, 2.5, 0.02]
    );

    this.addImage(
      "./content/j/j20.jpeg",
      new THREE.Vector3(4.49, 3.75, 5.75),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [2.5, 2.5, 0.02]
    );

    // HIDDEN
    this.addImage(
      "./content/j/j21.jpeg",
      new THREE.Vector3(-5.05, 3.75, 5.75),
      new THREE.Vector3(0, -Math.PI / 2, 0),
      [5, 5, 0.02]
    );

    this.addImage(
      "./content/j/j22.jpeg",
      new THREE.Vector3(5.05, 3.75, 5.75),
      new THREE.Vector3(0, Math.PI / 2, 0),
      [5, 5, 0.02]
    );
  };

  getImageMaterial = (fileUrl: string) => {
    if (fileUrl.includes(".")) {
      const textureLoader = new THREE.TextureLoader();
      this.textureMap = textureLoader.load(fileUrl);

      return new THREE.MeshLambertMaterial({
        map: this.textureMap,
      });
    } else {
      const video = document.getElementById(fileUrl) as HTMLVideoElement;

      if (video) {
        const texture = new THREE.VideoTexture(video);

        return new THREE.MeshLambertMaterial({
          map: texture,
        });
      }

      return new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT });
    }
  };

  addImage = (
    fileUrl: string,
    position: THREE.Vector3,
    rotation: THREE.Vector3,
    size: [number, number, number],
    easterEgg?: string
  ) => {
    const geometry = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, [
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
      this.getImageMaterial(fileUrl),
      easterEgg
        ? this.getImageMaterial(easterEgg)
        : new THREE.MeshLambertMaterial({ color: COLOR_DEFAULT }),
    ]);

    mesh.position.copy(position);

    mesh.rotation.setFromVector3(rotation);

    const bb = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
    bb.setFromObject(mesh);
    mesh.userData.bb = bb;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData.isDraggable = true;
    mesh.userData.initialPosition = position;
    mesh.userData.initialRotation = rotation;
    mesh.userData.size = size;
    mesh.userData.grabScale = 0.5 / size[0];

    this.room.add(mesh);
  };

  getObjectColor = (object: any) => {
    if (object.userData.isAttached) {
      return COLOR_ATTACHED;
    }

    if (object.userData.isColliding) {
      return COLOR_COLLIDING;
    }

    return COLOR_DEFAULT;
  };

  buildController = (data: any) => {
    let geometry, material;

    switch (data.targetRayMode) {
      case "tracked-pointer":
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)
        );
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
        );

        material = new THREE.LineBasicMaterial({
          vertexColors: true,
          blending: THREE.AdditiveBlending,
        });

        return new THREE.Line(geometry, material);

      case "gaze":
        geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
        material = new THREE.MeshBasicMaterial({
          opacity: 0.5,
          transparent: true,
        });
        return new THREE.Mesh(geometry, material);
    }
  };

  onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  animate = () => {
    this.renderer.setAnimationLoop(this.render);
  };

  between = (value: number, min: number, max: number) => {
    return Math.max(Math.min(value, max), min);
  };

  getGamepad = () => {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    const sourceXR = session.inputSources[0];
    if (!sourceXR || !sourceXR.gamepad) return;
    return sourceXR.gamepad;
  };

  vibrate = () => {
    const gamepad = this.getGamepad();
    if (!gamepad) return;
    // @ts-ignore
    gamepad.hapticActuators[0].pulse(0.5, 100);
  };

  updateControllerState = () => {
    const gamepad = this.getGamepad();

    if (!gamepad) return;

    const axes = gamepad.axes;

    if (axes[2] !== 0 || axes[3] !== 0) {
      this.shift.set(axes[2] / 15, 0, axes[3] / 15);

      this.offset.add(this.shift.applyEuler(this.controller.rotation).negate());

      this.room.position.copy(this.offset);
    }
  };

  render = () => {
    this.updateControllerState();

    const delta = this.clock.getDelta();

    // Play animations
    // for (let i = 0; i < this.mixers.length; i++) {
    //   this.mixers[i].update(delta);
    // }

    // MAP ZOOM & OFFSET
    // this.textureMap.repeat.set(this.mapZoom, this.mapZoom);
    // this.textureMap.offset.set(this.mapOffsetX, this.mapOffsetY);

    // Update Bounding Box
    this.room.children.forEach((child: any) => {
      if (!child.userData.bb) {
        return;
      }

      child.userData.bb
        .copy(child.geometry.boundingBox)
        .applyMatrix4(child.matrixWorld);
    });

    // Position selected object
    if (this.controller.userData.isSelecting === true) {
      const selected = this.controller.userData.selected;

      this.room.remove(selected);

      selected.position.copy(this.controller.position.clone().sub(this.offset));
      selected.rotation.copy(this.controller.rotation);

      const scale = selected.userData.grabScale ?? 0.25;
      selected.scale.set(scale, scale, scale);

      this.room.add(selected);
    }

    const selected = this.controller.userData.selected;

    // if (selected && this.table) {
    //   const isColliding = selected.userData.bb.intersectsBox(
    //     this.table.userData.bb
    //   );

    //   selected.userData.isColliding = isColliding;

    //   if (isColliding) {
    //     selected.material.color.setHex(COLOR_COLLIDING);
    //   } else {
    //     selected.material.color.setHex(COLOR_DRAGGING);
    //   }
    // }

    // find intersections
    this.tempMatrix.identity().extractRotation(this.controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(
      this.controller.matrixWorld
    );
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    // this.room.children.forEach((mesh: any) => {
    //   console.log(mesh);
    // });

    if (!selected) {
      const intersects = this.raycaster.intersectObjects(
        this.room.children.filter((child: any) => child.userData.isDraggable),
        false
      );

      if (intersects.length > 0) {
        if (this.INTERSECTED != intersects[0].object) {
          if (this.INTERSECTED) {
            this.removeImageHightlighting(this.INTERSECTED);
          }

          this.INTERSECTED = intersects[0].object;
          this.addImageHightlighting(this.INTERSECTED);
        }
      } else {
        if (this.INTERSECTED) {
          this.removeImageHightlighting(this.INTERSECTED);
          this.INTERSECTED = undefined;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  addImageHightlighting = (
    mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial[]>
  ) => {
    mesh.material.forEach((m) => {
      m.emissive?.setHex(0x0000ff);
    });
  };

  removeImageHightlighting = (
    mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial[]>
  ) => {
    mesh.material.forEach((m) => {
      m.emissive?.setHex(0x000000);
    });
  };
}
