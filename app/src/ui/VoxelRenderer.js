// @doc-anchor ENGINE-CORE
// VoxelRenderer – Three.js-basierter Voxel-Renderer fuer SeedWorld.
// Ersetzt TileGridRenderer (2D Canvas) durch eine 3D-Voxel-Ansicht.
// Behaelt die gleiche Schnittstelle: render(state, tick) + onTileClick.

import * as THREE from "../../node_modules/three/build/three.module.js";

// ── Farbpalette fuer Terrain-Typen ──────────────────────────────────────────
const TERRAIN_COLORS = {
  water:   0x1a6fa8,
  meadow:  0x4a8c3f,
  forest:  0x2d6e2a,
  scrub:   0x8a7a3d,
  steppe:  0xb8a45a,
  rock:    0x6b6b6b,
  trees:   0x1e5c1a,
  dry:     0xa08840,
  dust:    0xc4a855,
  default: 0x555555
};

const RESOURCE_OVERLAY = {
  ore:  0xc0a060,
  coal: 0x333333
};

const STRUCTURE_COLORS = {
  mine:     0xd4a017,
  smelter:  0xe05a00,
  conveyor: 0x888888
};

// ── Hoehen-Mapping fuer Terrain ─────────────────────────────────────────────
const TERRAIN_HEIGHT = {
  water:   0.3,
  meadow:  1.0,
  forest:  1.0,
  scrub:   0.9,
  steppe:  0.8,
  rock:    1.2,
  trees:   1.0,
  dry:     0.85,
  dust:    0.75,
  default: 1.0
};

const VOXEL_SIZE = 1.0;
const VOXEL_GAP  = 0.05;

function terrainColor(tile) {
  if (tile.resource && tile.resource !== "none" && RESOURCE_OVERLAY[tile.resource]) {
    return RESOURCE_OVERLAY[tile.resource];
  }
  return TERRAIN_COLORS[tile.terrain] || TERRAIN_COLORS[tile.biome] || TERRAIN_COLORS.default;
}

function terrainHeight(tile) {
  return TERRAIN_HEIGHT[tile.terrain] || TERRAIN_HEIGHT[tile.biome] || TERRAIN_HEIGHT.default;
}

export class VoxelRenderer {
  constructor(container, options = {}) {
    if (!container) throw new Error("[VOXEL_RENDERER] Container fehlt.");

    this.container = container;
    this.width  = 0;
    this.height = 0;
    this.tileSize = VOXEL_SIZE;
    this.clickCallback = null;
    this._destroyed = false;
    this._tick = 0;
    this._animFrameId = null;

    // Three.js Szene
    this.scene    = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1210);
    this.scene.fog = new THREE.Fog(0x0a1210, 30, 80);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    container.appendChild(this.renderer.domElement);

    // Kamera – isometrische Perspektive
    const aspect = (container.clientWidth || 800) / (container.clientHeight || 600);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.camera.position.set(8, 18, 20);
    this.camera.lookAt(8, 0, 6);

    // Beleuchtung
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far  = 100;
    sun.shadow.camera.left   = -20;
    sun.shadow.camera.right  =  20;
    sun.shadow.camera.top    =  20;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);
    this.sun = sun;

    // Orbit-Steuerung (manuell, ohne OrbitControls-Import)
    this._setupOrbitControls();

    // Raycaster fuer Klick-Events
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this._setupClickHandler();

    // Meshes
    this._terrainMeshes = new Map();  // key: "x,y" -> Mesh
    this._structureMeshes = new Map();
    this._conveyorMeshes  = new Map();
    this._particleSystems = [];

    // Resize-Handler
    this._onResize = () => this._handleResize();
    window.addEventListener("resize", this._onResize);

    // Render-Loop
    this._startRenderLoop();
  }

  // ── Oeffentliche API (gleiche Schnittstelle wie TileGridRenderer) ──────────

  set onTileClick(cb) {
    this.clickCallback = typeof cb === "function" ? cb : null;
  }

  render(gameState, tick) {
    if (this._destroyed) return;
    this._tick = typeof tick === "number" ? tick : 0;

    const tiles = gameState?.world?.tiles;
    if (!Array.isArray(tiles) || tiles.length === 0) return;

    const structures = gameState?.structures || {};
    this._syncTerrain(tiles, gameState?.world?.size);
    this._syncStructures(structures, tiles);
    this._updateAnimations(tick);
  }

  onViewportChange(viewport) {
    if (!viewport || this._destroyed) return;
    const w = viewport.width  || this.container.clientWidth  || 800;
    const h = viewport.height || this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  destroy() {
    this._destroyed = true;
    if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
    window.removeEventListener("resize", this._onResize);
    this.renderer.domElement.removeEventListener("click", this._clickHandler);
    this.renderer.domElement.removeEventListener("mousedown", this._mousedownHandler);
    this.renderer.domElement.removeEventListener("mousemove", this._mousemoveHandler);
    this.renderer.domElement.removeEventListener("mouseup", this._mouseupHandler);
    this.renderer.domElement.removeEventListener("wheel", this._wheelHandler);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ── Terrain-Synchronisation ────────────────────────────────────────────────

  _syncTerrain(tiles, size) {
    const newKeys = new Set();

    for (const tile of tiles) {
      const key = `${tile.x},${tile.y}`;
      newKeys.add(key);

      if (!this._terrainMeshes.has(key)) {
        const mesh = this._createVoxelMesh(tile);
        this._terrainMeshes.set(key, mesh);
        this.scene.add(mesh);
      } else {
        // Farbe aktualisieren falls noetig
        const mesh = this._terrainMeshes.get(key);
        const color = terrainColor(tile);
        mesh.material.color.setHex(color);
      }
    }

    // Entfernte Tiles loeschen
    for (const [key, mesh] of this._terrainMeshes) {
      if (!newKeys.has(key)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this._terrainMeshes.delete(key);
      }
    }

    // Kamera auf Welt-Mitte ausrichten
    if (size && size.width && size.height) {
      const cx = size.width  / 2;
      const cz = size.height / 2;
      this.camera.position.set(cx, 18, cz + 14);
      this.camera.lookAt(cx, 0, cz);
      if (this.sun) {
        this.sun.position.set(cx + 10, 20, cz + 10);
        this.sun.target.position.set(cx, 0, cz);
        this.scene.add(this.sun.target);
      }
      this._worldCenter = new THREE.Vector3(cx, 0, cz);
    }
  }

  _createVoxelMesh(tile) {
    const h = terrainHeight(tile);
    const geo = new THREE.BoxGeometry(
      VOXEL_SIZE - VOXEL_GAP,
      h,
      VOXEL_SIZE - VOXEL_GAP
    );
    const color = terrainColor(tile);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(tile.x + 0.5, h / 2, tile.y + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { tileX: tile.x, tileY: tile.y, type: "terrain" };
    return mesh;
  }

  // ── Strukturen-Synchronisation ─────────────────────────────────────────────

  _syncStructures(structures, tiles) {
    const tileMap = new Map(tiles.map(t => [`${t.x},${t.y}`, t]));
    const newKeys = new Set(Object.keys(structures));

    for (const [key, structure] of Object.entries(structures)) {
      if (!this._structureMeshes.has(key)) {
        const [x, y] = key.split(",").map(Number);
        const tile = tileMap.get(key);
        const baseH = tile ? terrainHeight(tile) : 1.0;
        const mesh = this._createStructureMesh(structure.id, x, y, baseH);
        if (mesh) {
          this._structureMeshes.set(key, mesh);
          this.scene.add(mesh);
        }
      }
    }

    // Entfernte Strukturen loeschen
    for (const [key, mesh] of this._structureMeshes) {
      if (!newKeys.has(key)) {
        this.scene.remove(mesh);
        if (Array.isArray(mesh)) {
          mesh.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
        } else {
          mesh.geometry.dispose();
          mesh.material.dispose();
        }
        this._structureMeshes.delete(key);
      }
    }
  }

  _createStructureMesh(structureId, x, y, baseH) {
    const group = new THREE.Group();
    group.userData = { tileX: x, tileY: y, type: "structure", structureId };

    if (structureId === "mine") {
      // Basis-Block
      const baseGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
      const baseMat = new THREE.MeshLambertMaterial({ color: STRUCTURE_COLORS.mine });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.3, 0);
      base.castShadow = true;
      group.add(base);

      // Turm
      const towerGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
      const towerMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(0, 1.0, 0);
      tower.castShadow = true;
      group.add(tower);

      // Spitze
      const topGeo = new THREE.ConeGeometry(0.2, 0.3, 4);
      const topMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.set(0, 1.55, 0);
      top.rotation.y = Math.PI / 4;
      group.add(top);

    } else if (structureId === "smelter") {
      // Haupt-Koerper
      const bodyGeo = new THREE.BoxGeometry(0.8, 0.9, 0.8);
      const bodyMat = new THREE.MeshLambertMaterial({ color: STRUCTURE_COLORS.smelter });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(0, 0.45, 0);
      body.castShadow = true;
      group.add(body);

      // Schornstein
      const chimneyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6);
      const chimneyMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
      chimney.position.set(0.2, 1.2, 0.2);
      chimney.castShadow = true;
      group.add(chimney);

      // Gluehen (Emission)
      const glowGeo = new THREE.BoxGeometry(0.3, 0.3, 0.05);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(0, 0.4, 0.41);
      group.add(glow);

    } else if (structureId === "conveyor") {
      const beltGeo = new THREE.BoxGeometry(0.9, 0.15, 0.9);
      const beltMat = new THREE.MeshLambertMaterial({ color: STRUCTURE_COLORS.conveyor });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.set(0, 0.075, 0);
      belt.castShadow = true;
      group.add(belt);

      // Streifen
      for (let i = -1; i <= 1; i++) {
        const stripeGeo = new THREE.BoxGeometry(0.85, 0.16, 0.1);
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(0, 0.075, i * 0.28);
        group.add(stripe);
      }
    }

    group.position.set(x + 0.5, baseH, y + 0.5);
    return group;
  }

  // ── Animationen ────────────────────────────────────────────────────────────

  _updateAnimations(tick) {
    const t = tick * 0.05;

    // Minen pulsieren leicht
    for (const [, mesh] of this._structureMeshes) {
      if (mesh.userData?.structureId === "mine") {
        const tower = mesh.children[1];
        if (tower) {
          tower.rotation.y = t;
        }
      }
      // Smelter Glow pulsiert
      if (mesh.userData?.structureId === "smelter") {
        const glow = mesh.children[2];
        if (glow) {
          const intensity = 0.6 + 0.4 * Math.sin(t * 3);
          glow.material.color.setRGB(1.0, 0.4 * intensity, 0);
        }
      }
    }
  }

  // ── Orbit-Steuerung (einfach, ohne externe Bibliothek) ─────────────────────

  _setupOrbitControls() {
    this._orbitState = {
      isDown: false,
      lastX: 0,
      lastY: 0,
      theta: -0.5,
      phi: 1.1,
      radius: 25,
      target: new THREE.Vector3(8, 0, 6)
    };

    const el = this.renderer.domElement;

    this._mousedownHandler = (e) => {
      if (e.button === 2 || e.button === 1) {
        this._orbitState.isDown = true;
        this._orbitState.lastX = e.clientX;
        this._orbitState.lastY = e.clientY;
        e.preventDefault();
      }
    };

    this._mousemoveHandler = (e) => {
      if (!this._orbitState.isDown) return;
      const dx = e.clientX - this._orbitState.lastX;
      const dy = e.clientY - this._orbitState.lastY;
      this._orbitState.lastX = e.clientX;
      this._orbitState.lastY = e.clientY;
      this._orbitState.theta -= dx * 0.005;
      this._orbitState.phi = Math.max(0.2, Math.min(1.4, this._orbitState.phi - dy * 0.005));
      this._updateCameraFromOrbit();
    };

    this._mouseupHandler = () => {
      this._orbitState.isDown = false;
    };

    this._wheelHandler = (e) => {
      this._orbitState.radius = Math.max(8, Math.min(50, this._orbitState.radius + e.deltaY * 0.05));
      this._updateCameraFromOrbit();
      e.preventDefault();
    };

    el.addEventListener("mousedown", this._mousedownHandler);
    el.addEventListener("mousemove", this._mousemoveHandler);
    el.addEventListener("mouseup",   this._mouseupHandler);
    el.addEventListener("wheel",     this._wheelHandler, { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _updateCameraFromOrbit() {
    const { theta, phi, radius, target } = this._orbitState;
    const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(target);
  }

  // ── Klick-Handler (Raycasting) ─────────────────────────────────────────────

  _setupClickHandler() {
    this._clickHandler = (e) => {
      if (!this.clickCallback) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const allMeshes = [];
      for (const [, mesh] of this._terrainMeshes) allMeshes.push(mesh);

      const intersects = this.raycaster.intersectObjects(allMeshes, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const { tileX, tileY } = hit.userData;
        this.clickCallback({ x: tileX, y: tileY, tile: hit.userData });
      }
    };
    this.renderer.domElement.addEventListener("click", this._clickHandler);
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  _handleResize() {
    const w = this.container.clientWidth  || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── Render-Loop ────────────────────────────────────────────────────────────

  _startRenderLoop() {
    const loop = () => {
      if (this._destroyed) return;
      this._animFrameId = requestAnimationFrame(loop);
      this.renderer.render(this.scene, this.camera);
    };
    this._animFrameId = requestAnimationFrame(loop);
  }
}
