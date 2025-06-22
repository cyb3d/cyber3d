
"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import type { SceneObject, ActiveTool } from '@/app/page';

const FONT_PATH = 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';

interface ThreeSceneProps {
  sceneObjects: SceneObject[];
  setSceneObjects: React.Dispatch<React.SetStateAction<SceneObject[]>>;
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  activeTool: ActiveTool;
  skyTime: number;
}

export interface ThreeSceneRef {
  exportScene: (format: string) => void;
  playAudio: (id: string) => void;
}

const ThreeScene = forwardRef<ThreeSceneRef, ThreeSceneProps>(({
  sceneObjects,
  setSceneObjects,
  selectedObjectId,
  setSelectedObjectId,
  activeTool,
  skyTime,
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [font, setFont] = useState<THREE.Font | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const groundPlaneRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const threeObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const particleSystemsRef = useRef<Map<string, { system: THREE.Object3D, update: (elapsedTime: number) => void }>>(new Map());

  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const pointerRef = useRef<THREE.Vector2 | null>(null);
  
  const { dotTexture, sparkTexture, smokeTexture, speakerTexture } = useMemo(() => {
    if (typeof window === 'undefined') {
        return { dotTexture: null, sparkTexture: null, smokeTexture: null, speakerTexture: null };
    }
    
    const createParticleTexture = (type: 'dot' | 'spark' | 'smoke') => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2d context from canvas');

        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

        if (type === 'dot') {
            context.beginPath();
            context.arc(64, 64, 60, 0, Math.PI * 2);
            context.fillStyle = '#4A90E2';
            context.fill();
        } else if (type === 'spark') {
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.2, 'rgba(255,255,0,1)');
            gradient.addColorStop(0.4, 'rgba(255,165,0,0.5)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 128, 128);
        } else if (type === 'smoke') {
            gradient.addColorStop(0.3, 'rgba(128,128,128,0.6)');
            gradient.addColorStop(1, 'rgba(128,128,128,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 128, 128);
        }
        
        return new THREE.CanvasTexture(canvas);
    };

    const createSpeakerTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2d context');

        ctx.fillStyle = 'rgba(220, 220, 220, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(12, 22);
        ctx.lineTo(24, 22);
        ctx.lineTo(36, 12);
        ctx.lineTo(36, 52);
        ctx.lineTo(24, 42);
        ctx.lineTo(12, 42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(40, 32, 6, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(40, 32, 12, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.stroke();

        return new THREE.CanvasTexture(canvas);
    };

    return { 
        dotTexture: createParticleTexture('dot'), 
        sparkTexture: createParticleTexture('spark'),
        smokeTexture: createParticleTexture('smoke'),
        speakerTexture: createSpeakerTexture(),
    };
  }, []);

  const createParticleSystem = useCallback((objData: SceneObject) => {
    let system: THREE.Object3D;
    let update: (elapsedTime: number) => void = () => {};

    const geometry = new THREE.BufferGeometry();
    const color = new THREE.Color();
    
    switch(objData.particleType) {
        case 'Fire': {
            const particleCount = 500;
            const positions = new Float32Array(particleCount * 3);
            const lifespans = new Float32Array(particleCount);
            const velocities = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);

            const material = new THREE.PointsMaterial({
                size: 0.8,
                map: sparkTexture,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                vertexColors: true
            });

            for (let i = 0; i < particleCount; i++) {
                lifespans[i] = Math.random() * 2 + 1; // 1 to 3 seconds
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 2.0;
                positions[i3 + 1] = Math.random() * 1.0;
                positions[i3 + 2] = (Math.random() - 0.5) * 2.0;
                velocities[i3] = (Math.random() - 0.5) * 0.1;
                velocities[i3 + 1] = Math.random() * 1.5 + 0.5;
                velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            system = new THREE.Points(geometry, material);
            
            update = (elapsedTime) => {
                const pointsSystem = system as THREE.Points;
                const pos = pointsSystem.geometry.attributes.position.array as Float32Array;
                const col = pointsSystem.geometry.attributes.color.array as Float32Array;
                
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    lifespans[i] -= 0.016; 
                    
                    if (lifespans[i] <= 0) {
                        lifespans[i] = Math.random() * 2 + 1;
                        pos[i3] = (Math.random() - 0.5) * 2.0;
                        pos[i3 + 1] = Math.random() * 1.0;
                        pos[i3 + 2] = (Math.random() - 0.5) * 2.0;
                    }
                    
                    pos[i3 + 1] += velocities[i3 + 1] * 0.016;
                    
                    const lifeRatio = lifespans[i] / (Math.random() * 2 + 1);
                    color.setHSL(0.1, 1.0, lifeRatio * 0.6 + 0.1);
                    col[i3] = color.r;
                    col[i3 + 1] = color.g;
                    col[i3 + 2] = color.b;
                }
                pointsSystem.geometry.attributes.position.needsUpdate = true;
                pointsSystem.geometry.attributes.color.needsUpdate = true;
                (pointsSystem.material as THREE.PointsMaterial).opacity = Math.random() * 0.5 + 0.5;
            };
            break;
        }
        case 'Rain': case 'Snow': {
            const isSnow = objData.particleType === 'Snow';
            const particleCount = isSnow ? 10000 : 5000;
            const positions = new Float32Array(particleCount * 3);
            const velocities = new Float32Array(particleCount * 3);
            const material = new THREE.PointsMaterial({
                size: isSnow ? 0.08 : 0.05,
                map: dotTexture,
                blending: THREE.NormalBlending,
                depthWrite: false,
                transparent: true,
                opacity: isSnow ? 1.0 : 0.7,
                color: isSnow ? '#FFFFFF' : '#4A90E2'
            });
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 20;
                positions[i3 + 1] = Math.random() * 15;
                positions[i3 + 2] = (Math.random() - 0.5) * 20;

                velocities[i3] = isSnow ? (Math.random() - 0.5) * 0.02 : 0;
                velocities[i3 + 1] = isSnow ? -Math.random() * 0.05 - 0.05 : -Math.random() * 0.2 - 0.1;
                velocities[i3 + 2] = isSnow ? (Math.random() - 0.5) * 0.02 : 0;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            system = new THREE.Points(geometry, material);

            update = () => {
                const pointsSystem = system as THREE.Points;
                const pos = pointsSystem.geometry.attributes.position.array as Float32Array;
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    pos[i3] += velocities[i3];
                    pos[i3 + 1] += velocities[i3 + 1];
                    pos[i3 + 2] += velocities[i3 + 2];
                    
                    if (pos[i3+1] < 0) {
                       pos[i3+1] = 15;
                    }
                }
                pointsSystem.geometry.attributes.position.needsUpdate = true;
            };
            break;
        }
        case 'Steam': {
            const particleCount = 300;
            const positions = new Float32Array(particleCount * 3);
            const lifespans = new Float32Array(particleCount);

            const material = new THREE.PointsMaterial({
                size: 0.8,
                map: smokeTexture,
                blending: THREE.NormalBlending,
                depthWrite: false,
                transparent: true,
                vertexColors: true,
                opacity: 0.5
            });
            const colors = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                lifespans[i] = Math.random() * 4 + 1;
                positions[i3] = (Math.random() - 0.5) * 1.0;
                positions[i3 + 1] = Math.random() * 1;
                positions[i3 + 2] = (Math.random() - 0.5) * 1.0;
                color.setScalar(0.6); // Grey color for steam
                colors[i3] = color.r;
                colors[i3 + 1] = color.g;
                colors[i3 + 2] = color.b;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            system = new THREE.Points(geometry, material);

            update = (elapsedTime) => {
                const pointsSystem = system as THREE.Points;
                const pos = pointsSystem.geometry.attributes.position.array as Float32Array;
                const col = pointsSystem.geometry.attributes.color.array as Float32Array;
                for(let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    lifespans[i] -= 0.016;
                    if(lifespans[i] <= 0) {
                        lifespans[i] = Math.random() * 4 + 1;
                        pos[i3] = (Math.random() - 0.5) * 1.0;
                        pos[i3+1] = Math.random() * 1;
                        pos[i3+2] = (Math.random() - 0.5) * 1.0;
                    }
                    pos[i3+1] += 0.05; // Faster rise for steam
                    const lifeRatio = lifespans[i] / 4;
                    const greyValue = lifeRatio * 0.6;
                    col[i3] = greyValue;
                    col[i3+1] = greyValue;
                    col[i3+2] = greyValue;
                }
                pointsSystem.rotation.y = elapsedTime * 0.1;
                pointsSystem.geometry.attributes.position.needsUpdate = true;
                pointsSystem.geometry.attributes.color.needsUpdate = true;
            };
            break;
        }
        case 'Fog': {
            const particleCount = 200;
            const positions = new Float32Array(particleCount * 3);
            const material = new THREE.PointsMaterial({
                size: 20,
                map: smokeTexture,
                blending: THREE.NormalBlending,
                depthWrite: false,
                transparent: true,
                color: 0xaaaaaa,
                opacity: 0.15
            });

            for (let i = 0; i < particleCount; i++) {
                positions[i*3] = (Math.random() - 0.5) * 40;
                positions[i*3+1] = (Math.random() - 0.5) * 10;
                positions[i*3+2] = (Math.random() - 0.5) * 40;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            system = new THREE.Points(geometry, material);
            
            update = (elapsedTime) => {
                system.rotation.y = elapsedTime * 0.02;
            }
            break;
        }
        case 'Magic': {
            const particleCount = 1000;
            const positions = new Float32Array(particleCount * 3);
            const velocities = new Float32Array(particleCount * 3);

            const material = new THREE.PointsMaterial({
                size: 0.3,
                map: sparkTexture,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                color: '#FFFFFF'
            });

            for(let i=0; i<particleCount; i++) {
                const i3 = i * 3;
                positions[i3] = 0;
                positions[i3+1] = 0;
                positions[i3+2] = 0;
                
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                velocities[i3] = Math.sin(phi) * Math.cos(theta) * (Math.random() * 2 + 1);
                velocities[i3+1] = Math.sin(phi) * Math.sin(theta) * (Math.random() * 2 + 1);
                velocities[i3+2] = Math.cos(phi) * (Math.random() * 2 + 1);
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            system = new THREE.Points(geometry, material);
            
            update = (elapsedTime) => {
                const pointsSystem = system as THREE.Points;
                const pos = pointsSystem.geometry.attributes.position.array as Float32Array;
                for(let i=0; i<particleCount; i++) {
                    const i3 = i*3;
                    pos[i3] += velocities[i3] * 0.01;
                    pos[i3+1] += velocities[i3+1] * 0.01;
                    pos[i3+2] += velocities[i3+2] * 0.01;

                    if (pos[i3]**2 + pos[i3+1]**2 + pos[i3+2]**2 > 100) {
                        pos[i3] = pos[i3+1] = pos[i3+2] = 0;
                    }
                }
                pointsSystem.geometry.attributes.position.needsUpdate = true;
            }
            break;
        }
        case 'Water': {
            const waterGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
            const waterMaterial = new THREE.MeshStandardMaterial({
                color: '#006994',
                metalness: 0.4,
                roughness: 0.2,
                transparent: true,
                opacity: 0.85
            });
            system = new THREE.Mesh(waterGeometry, waterMaterial);
            system.rotation.x = -Math.PI / 2;
            system.receiveShadow = true;

            const originalPositions = (system as THREE.Mesh).geometry.attributes.position.clone();

            update = (elapsedTime) => {
                const waterMesh = system as THREE.Mesh;
                const pos = waterMesh.geometry.attributes.position.array as Float32Array;
                const origPos = originalPositions.array as Float32Array;
                for(let i=0; i < pos.length; i+=3) {
                    const x = origPos[i];
                    const y = origPos[i+1];
                    const z1 = Math.sin(x * 0.1 + elapsedTime * 0.5) * 0.4;
                    const z2 = Math.cos(y * 0.05 + elapsedTime * 0.8) * 0.3;
                    const z3 = Math.sin((x + y) * 0.02 + elapsedTime * 0.3) * 0.5;
                    pos[i+2] = (z1 + z2 + z3);
                }
                waterMesh.geometry.attributes.position.needsUpdate = true;
                waterMesh.geometry.computeVertexNormals();
            };
            break;
        }
        default:
            system = new THREE.Points(); // Empty system for unimplemented effects
            break;
    }

    system.userData = { id: objData.id, type: objData.type };
    return { system, update };
  }, [dotTexture, sparkTexture, smokeTexture]);

  useEffect(() => {
    setIsClient(true);
    const fontLoader = new FontLoader();
    fontLoader.load(FONT_PATH, (loadedFont) => {
      setFont(loadedFont);
    }, undefined, (error) => {
      console.error('FontLoader: Could not load font.', error);
    });
  }, []);

  const updateSceneObjectFromTransform = useCallback((transformedObject: THREE.Object3D) => {
    if (!transformedObject.userData.id) return;

    const objectId = transformedObject.userData.id;
    setSceneObjects(prevObjects =>
      prevObjects.map(obj => {
        if (obj.id === objectId) {
          const newPosition = transformedObject.position.toArray() as [number, number, number];
          const newRotation = [transformedObject.rotation.x, transformedObject.rotation.y, transformedObject.rotation.z] as [number, number, number];
          const newScale = transformedObject.scale.toArray() as [number, number, number];
          return { ...obj, position: newPosition, rotation: newRotation, scale: newScale };
        }
        return obj;
      })
    );
  }, [setSceneObjects]);
  
  useImperativeHandle(ref, () => ({
    exportScene(format: string) {
        if (!sceneRef.current) return;
        const exportGroup = new THREE.Group();
        
        threeObjectsRef.current.forEach((obj, id) => {
            const sceneObjectData = sceneObjects.find(s => s.id === id);
            if (sceneObjectData && (sceneObjectData.visible ?? true)) {
                 exportGroup.add(obj.clone(true));
            }
        });

        if (format === 'gltf') {
            const exporter = new GLTFExporter();
            const options = {
                binary: true,
            };
            exporter.parse(
                exportGroup,
                (result) => {
                    if (result instanceof ArrayBuffer) {
                        const blob = new Blob([result], { type: 'model/gltf-binary' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `scene.glb`;
                        link.click();
                    }
                },
                (error: any) => {
                    console.error('An error happened during GLTF export', error);
                },
                options
            );
        } else if (format === 'obj') {
            const exporter = new OBJExporter();
            const result = exporter.parse(exportGroup);
            const blob = new Blob([result], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `scene.obj`;
            link.click();
        }
    },
    playAudio(id: string) {
        const audio = audioElementsRef.current.get(id);
        if (audio) {
            if (audio.paused) {
                audio.play().catch(e => console.error("Audio play failed:", e));
            } else {
                audio.pause();
                audio.currentTime = 0;
            }
        }
    }
  }));

  useEffect(() => {
    if (!isClient || !mountRef.current) return;
    const currentMount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    const editorBgColor = getComputedStyle(currentMount).getPropertyValue('background-color') || 'hsl(var(--background))';
    sceneRef.current.background = new THREE.Color(editorBgColor);
    sceneRef.current.userData.skybox = false;

    clockRef.current = new THREE.Clock();

    cameraRef.current = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    cameraRef.current.position.set(5, 5, 15);
    cameraRef.current.lookAt(0,0,0);

    rendererRef.current = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    rendererRef.current.shadowMap.enabled = true;
    currentMount.appendChild(rendererRef.current.domElement);

    orbitControlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    orbitControlsRef.current.enableDamping = true;
    orbitControlsRef.current.dampingFactor = 0.05;

    transformControlsRef.current = new TransformControls(cameraRef.current, rendererRef.current.domElement);
    sceneRef.current.add(transformControlsRef.current);

    transformControlsRef.current.addEventListener('dragging-changed', (event) => {
        if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = !event.value;
        }
    });
    transformControlsRef.current.addEventListener('objectChange', () => {
        if (transformControlsRef.current?.object) {
            updateSceneObjectFromTransform(transformControlsRef.current.object);
        }
    });

    raycasterRef.current = new THREE.Raycaster();
    pointerRef.current = new THREE.Vector2();

    gridHelperRef.current = new THREE.GridHelper(1000, 100, 0xffffff, 0xffffff);
    (gridHelperRef.current.material as THREE.Material).opacity = 0.15; 
    (gridHelperRef.current.material as THREE.Material).transparent = true;
    sceneRef.current.add(gridHelperRef.current);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    sceneRef.current.add(ambientLight);

    directionalLightRef.current = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLightRef.current.position.set(8, 15, 10);
    directionalLightRef.current.castShadow = true;
    directionalLightRef.current.shadow.mapSize.width = 1024;
    directionalLightRef.current.shadow.mapSize.height = 1024;
    directionalLightRef.current.shadow.camera.near = 0.5;
    directionalLightRef.current.shadow.camera.far = 50;
    sceneRef.current.add(directionalLightRef.current);

    groundPlaneRef.current = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.ShadowMaterial({ color: 0x080808, opacity: 0.3 }) 
    );
    groundPlaneRef.current.rotation.x = -Math.PI / 2;
    groundPlaneRef.current.position.y = -0.01;
    groundPlaneRef.current.receiveShadow = true;
    sceneRef.current.add(groundPlaneRef.current);

    const animate = () => {
      requestAnimationFrame(animate);
      orbitControlsRef.current?.update();
      const elapsedTime = clockRef.current?.getElapsedTime() || 0;

      particleSystemsRef.current.forEach(particleSystem => {
        particleSystem.update(elapsedTime);
      });

      if (sceneRef.current && cameraRef.current && rendererRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (rendererRef.current && cameraRef.current && mountRef.current) {
        const { clientWidth, clientHeight } = mountRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
            rendererRef.current.setSize(clientWidth, clientHeight);
            cameraRef.current.aspect = clientWidth / clientHeight;
            cameraRef.current.updateProjectionMatrix();
        }
        if (!sceneRef.current?.userData.skybox) {
          const newEditorBgColor = getComputedStyle(mountRef.current).getPropertyValue('background-color') || 'hsl(var(--background))';
          if (sceneRef.current) {
            sceneRef.current.background = new THREE.Color(newEditorBgColor);
          }
        }
      }
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    if(mountRef.current) {
        resizeObserver.observe(mountRef.current);
    }
    
    const themeObserver = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mountRef.current && sceneRef.current && !sceneRef.current.userData.skybox) {
           const newEditorBgColor = getComputedStyle(mountRef.current).getPropertyValue('background-color') || 'hsl(var(--background))';
           sceneRef.current.background = new THREE.Color(newEditorBgColor);
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true }); 

    handleResize(); 

    const onPointerDown = ( event: PointerEvent ) => {
        if (!mountRef.current || !raycasterRef.current || !pointerRef.current || !cameraRef.current || transformControlsRef.current?.dragging) return;
        const rect = mountRef.current.getBoundingClientRect();
        pointerRef.current.x = ( (event.clientX - rect.left) / currentMount.clientWidth ) * 2 - 1;
        pointerRef.current.y = - ( (event.clientY - rect.top) / currentMount.clientHeight ) * 2 + 1;
        raycasterRef.current.setFromCamera( pointerRef.current, cameraRef.current );
        
        const allSelectableObjects = Array.from(threeObjectsRef.current.values()).filter(o => o.visible);
        const intersects = raycasterRef.current.intersectObjects( allSelectableObjects, true );
        if ( intersects.length > 0 ) {
            let intersectedObject = intersects[0].object;
            while(intersectedObject.parent && !intersectedObject.userData.id) {
                if (intersectedObject.parent === sceneRef.current) break;
                intersectedObject = intersectedObject.parent;
            }
            if (intersectedObject.userData.id) {
                setSelectedObjectId(intersectedObject.userData.id);
                if (intersectedObject.userData.type === 'Audio') {
                    const audio = audioElementsRef.current.get(intersectedObject.userData.id);
                    if (audio) {
                        if (audio.paused) {
                            audio.play().catch(e => console.error("Audio play failed:", e));
                        } else {
                            audio.pause();
                            audio.currentTime = 0;
                        }
                    }
                }
            } else {
                setSelectedObjectId(null);
            }
        } else {
            setSelectedObjectId(null);
        }
    }
    currentMount.addEventListener( 'pointerdown', onPointerDown );

    return () => {
      resizeObserver.disconnect();
      currentMount.removeEventListener('pointerdown', onPointerDown);
      themeObserver.disconnect();
      transformControlsRef.current?.dispose();
      orbitControlsRef.current?.dispose();
      threeObjectsRef.current.forEach((obj, id) => {
          sceneRef.current?.remove(obj);
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach(m => m?.dispose());
            }
          }
          if (videoElementsRef.current.has(id)) {
            videoElementsRef.current.get(id)?.remove();
            videoElementsRef.current.delete(id);
          }
          if (audioElementsRef.current.has(id)) {
            const audio = audioElementsRef.current.get(id);
            if (audio) {
                audio.pause();
                audio.src = '';
                audio.load();
            }
            audioElementsRef.current.delete(id);
          }
      });
      threeObjectsRef.current.clear();
      audioElementsRef.current.clear();
      particleSystemsRef.current.forEach((particleSystem) => {
          sceneRef.current?.remove(particleSystem.system);
          if (particleSystem.system instanceof THREE.Mesh || particleSystem.system instanceof THREE.Points) {
            particleSystem.system.geometry.dispose();
            if (Array.isArray(particleSystem.system.material)) {
                particleSystem.system.material.forEach(m => m.dispose());
            } else if (particleSystem.system.material) {
              (particleSystem.system.material as THREE.Material).dispose();
            }
          }
      });
      particleSystemsRef.current.clear();
      if (rendererRef.current?.domElement && currentMount.contains(rendererRef.current.domElement)) {
         currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      sceneRef.current?.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, updateSceneObjectFromTransform]);

  useEffect(() => {
    if (!sceneRef.current || !mountRef.current) return;
    
    const skyboxData = sceneObjects.find(obj => obj.type === 'Skybox');
    const skyboxLoaded = sceneRef.current.userData.skybox;

    if (skyboxData && !skyboxLoaded) {
      new THREE.TextureLoader().load(
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/2294472375_24a3b8ef46_o.jpg',
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          if (sceneRef.current) {
            sceneRef.current.background = texture;
            sceneRef.current.environment = texture;
            sceneRef.current.userData.skybox = true;
          }
        }
      );
    } else if (!skyboxData && skyboxLoaded) {
      const editorBgColor = getComputedStyle(mountRef.current).getPropertyValue('background-color') || 'hsl(var(--background))';
      sceneRef.current.background = new THREE.Color(editorBgColor);
      sceneRef.current.environment = null;
      sceneRef.current.userData.skybox = false;
    }
  }, [sceneObjects]);

  useEffect(() => {
    if (typeof skyTime !== 'number' || !directionalLightRef.current || !sceneRef.current) return;
    
    const ambientLight = sceneRef.current.children.find(c => c instanceof THREE.AmbientLight) as THREE.AmbientLight;
    if (!ambientLight) return;

    const sunCycle = [
        { time: 0, color: new THREE.Color('#0d1a2f'), intensity: 0.1, ambient: 0.05 }, // Night
        { time: 5, color: new THREE.Color('#0d1a2f'), intensity: 0.1, ambient: 0.05 }, // Pre-sunrise
        { time: 6, color: new THREE.Color('#ff8c61'), intensity: 1.0, ambient: 0.4 }, // Sunrise
        { time: 8, color: new THREE.Color('#ffead8'), intensity: 1.2, ambient: 0.8 }, // Morning
        { time: 12, color: new THREE.Color('#ffffff'), intensity: 1.5, ambient: 1.0 }, // Noon
        { time: 16, color: new THREE.Color('#ffead8'), intensity: 1.2, ambient: 0.8 }, // Afternoon
        { time: 18, color: new THREE.Color('#ff8c61'), intensity: 1.0, ambient: 0.4 }, // Sunset
        { time: 20, color: new THREE.Color('#0d1a2f'), intensity: 0.1, ambient: 0.05 }, // Post-sunset
        { time: 24, color: new THREE.Color('#0d1a2f'), intensity: 0.1, ambient: 0.05 } // Night
    ];

    const lerp = (a: number, b: number, alpha: number) => a + alpha * (b - a);

    const angle = (skyTime / 24 - 0.25) * Math.PI * 2;
    directionalLightRef.current.position.set(0, Math.sin(angle) * 20, Math.cos(angle) * 20);

    const currentFrameIndex = sunCycle.findIndex((frame, i) => {
        const nextFrame = sunCycle[i+1];
        return skyTime >= frame.time && (!nextFrame || skyTime < nextFrame.time);
    });
    
    const currentFrame = sunCycle[currentFrameIndex];
    const nextFrame = sunCycle[currentFrameIndex + 1] || currentFrame;

    const progress = (nextFrame.time - currentFrame.time) === 0 ? 0 : (skyTime - currentFrame.time) / (nextFrame.time - currentFrame.time);

    const newColor = currentFrame.color.clone().lerp(nextFrame.color, progress);
    const newIntensity = lerp(currentFrame.intensity, nextFrame.intensity, progress);
    const newAmbient = lerp(currentFrame.ambient, nextFrame.ambient, progress);
    
    directionalLightRef.current.color.copy(newColor);
    directionalLightRef.current.intensity = newIntensity;
    ambientLight.intensity = newAmbient;

  }, [skyTime]);


  useEffect(() => {
    if (!isClient || !sceneRef.current) return;

    const currentObjectIds = new Set(sceneObjects.map(objData => objData.id));

    threeObjectsRef.current.forEach((obj, id) => {
        if (!currentObjectIds.has(id)) {
            sceneRef.current?.remove(obj);
            if (transformControlsRef.current?.object === obj) {
                transformControlsRef.current.detach();
            }
            if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
                if (obj.geometry) obj.geometry.dispose();
                 if (obj.material) {
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                    materials.forEach(m => m?.dispose());
                }
            } else if (obj instanceof THREE.Group) {
                obj.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                         const materials = Array.isArray(child.material) ? child.material : [child.material];
                         materials.forEach(m => m?.dispose());
                    }
                });
            }
            if (videoElementsRef.current.has(id)) {
              videoElementsRef.current.get(id)?.remove();
              videoElementsRef.current.delete(id);
            }
            if (audioElementsRef.current.has(id)) {
              const audio = audioElementsRef.current.get(id);
              if (audio) {
                  audio.pause();
                  audio.src = '';
              }
              audioElementsRef.current.delete(id);
            }
            threeObjectsRef.current.delete(id);
        }
    });

    particleSystemsRef.current.forEach((particleSystem, id) => {
        if (!currentObjectIds.has(id)) {
            sceneRef.current?.remove(particleSystem.system);
            if (particleSystem.system instanceof THREE.Mesh || particleSystem.system instanceof THREE.Points) {
              particleSystem.system.geometry.dispose();
              const material = particleSystem.system.material as THREE.Material | THREE.Material[];
              if (Array.isArray(material)) {
                  material.forEach(m => m.dispose());
              } else {
                  material.dispose();
              }
            }
            particleSystemsRef.current.delete(id);
        }
    });

    sceneObjects.forEach(objData => {
      if (selectedObjectId === objData.id && !(objData.visible ?? true)) {
        setSelectedObjectId(null);
      }
      
      if (objData.type === 'ParticleSystem') {
          let existingSystem = particleSystemsRef.current.get(objData.id);
          if (existingSystem) {
              existingSystem.system.position.set(...objData.position);
              existingSystem.system.rotation.set(objData.rotation[0], objData.rotation[1], objData.rotation[2]);
              existingSystem.system.scale.set(...objData.scale);
              existingSystem.system.visible = objData.visible ?? true;
          } else {
              const newSystem = createParticleSystem(objData);
              if (newSystem.system) {
                  newSystem.system.position.set(...objData.position);
                  newSystem.system.visible = objData.visible ?? true;
                  particleSystemsRef.current.set(objData.id, newSystem);
                  sceneRef.current?.add(newSystem.system);
              }
          }
          return;
      }
      
      if (objData.type === 'Skybox') {
        return;
      }

      let existingThreeObject = threeObjectsRef.current.get(objData.id);
      
      let material: THREE.Material | THREE.Material[];
      if (existingThreeObject instanceof THREE.Mesh) {
          material = existingThreeObject.material;
      } else {
        const is3DText = objData.type === '3DText';
        material = new THREE.MeshStandardMaterial({
            color: objData.color,
            metalness: is3DText ? 0.0 : 0.3,
            roughness: is3DText ? 0.1 : 0.6 
        });
      }

      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.set(objData.color);
        if (objData.type === '3DText') {
          material.metalness = 0.0;
          material.roughness = 0.1;
        }
      }

      if (existingThreeObject) {
        existingThreeObject.position.set(...objData.position);
        existingThreeObject.rotation.set(objData.rotation[0], objData.rotation[1], objData.rotation[2]);
        existingThreeObject.scale.set(...objData.scale);
        existingThreeObject.visible = objData.visible ?? true;
        if (existingThreeObject instanceof THREE.Mesh) {
            existingThreeObject.castShadow = objData.type !== 'Plane';
            existingThreeObject.receiveShadow = true;
        }

        if (objData.type === '3DText' && objData.text && font) {
            const mesh = existingThreeObject as THREE.Mesh;
            const currentTextGeoParams = mesh.geometry?.parameters as any;
            if (mesh.userData.text !== objData.text || 
                (currentTextGeoParams && currentTextGeoParams.options && currentTextGeoParams.options.font !== font)) {
                 sceneRef.current?.remove(mesh);
                 if (transformControlsRef.current?.object === mesh) transformControlsRef.current.detach();
                 mesh.geometry.dispose();
                 if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose()); else mesh.material.dispose();
                 threeObjectsRef.current.delete(objData.id);
                 existingThreeObject = undefined; 
            }
        }
      }

      if (!existingThreeObject) {
        let geometry: THREE.BufferGeometry | undefined;
        let newObject: THREE.Object3D | undefined;

        switch (objData.type) {
            case 'Sphere': geometry = new THREE.SphereGeometry(0.5, 32, 16); break;
            case 'Pyramid': geometry = new THREE.ConeGeometry(0.5, 1, 4); break;
            case 'Cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
            case 'Cube': geometry = new THREE.BoxGeometry(1, 1, 1); break;
            case 'Plane': case 'Image': case 'Video':
                geometry = new THREE.PlaneGeometry(1, 1); break;
            case 'Audio':
                if (speakerTexture) {
                    const spriteMaterial = new THREE.SpriteMaterial({ map: speakerTexture, color: 0xffffff });
                    newObject = new THREE.Sprite(spriteMaterial);
                }
                if (objData.src && !audioElementsRef.current.has(objData.id)) {
                    const audioEl = new Audio(objData.src as string);
                    audioEl.preload = 'auto';
                    audioElementsRef.current.set(objData.id, audioEl);
                }
                break;
            case '3DText':
              if (font && objData.text) {
                const textGeo = new TextGeometry(objData.text, {
                  font: font,
                  size: 1.5, 
                  height: 0.6,
                  curveSegments: 12,
                  bevelEnabled: true,
                  bevelThickness: 0.1,
                  bevelSize: 0.05,
                  bevelOffset: 0,
                  bevelSegments: 4
                });
                textGeo.computeBoundingBox();
                if (textGeo.boundingBox) {
                    const centerOffset = new THREE.Vector3();
                    textGeo.boundingBox.getCenter(centerOffset).negate();
                    textGeo.translate(centerOffset.x, centerOffset.y, centerOffset.z);
                }
                geometry = textGeo;
              }
              break;
            case 'Model':
                if (objData.src && objData.format) {
                    if (objData.format === 'gltf' || objData.format === 'glb') {
                        const loader = new GLTFLoader();
                        loader.parse(
                            objData.src as ArrayBuffer,
                            '',
                            (gltf) => {
                                const model = gltf.scene;
                                model.traverse(child => {
                                    if (child instanceof THREE.Mesh) {
                                        child.castShadow = true;
                                        child.receiveShadow = true;
                                    }
                                });
                                const box = new THREE.Box3().setFromObject(model);
                                const center = box.getCenter(new THREE.Vector3());
                                model.position.sub(center);
                                model.visible = objData.visible ?? true;
                                model.userData = { id: objData.id, type: objData.type };
                                model.position.set(...objData.position);
                                model.rotation.set(objData.rotation[0], objData.rotation[1], objData.rotation[2]);
                                model.scale.set(...objData.scale);
                                threeObjectsRef.current.set(objData.id, model);
                                sceneRef.current?.add(model);
                            },
                            (error) => {
                                console.error('Error parsing GLTF model', error);
                            }
                        );
                    } else {
                        let loader;
                        if (objData.format === 'obj') {
                            loader = new OBJLoader();
                        } else if (objData.format === 'stl') {
                            loader = new STLLoader();
                        }

                        if (loader) {
                            try {
                                const model = loader.parse(objData.src as any);
                                model.traverse(child => {
                                    if (child instanceof THREE.Mesh) {
                                        child.castShadow = true;
                                        child.receiveShadow = true;
                                    }
                                });
                                const box = new THREE.Box3().setFromObject(model);
                                const center = box.getCenter(new THREE.Vector3());
                                model.position.sub(center);
                                newObject = model;
                            } catch (error) {
                                console.error('Failed to load model:', error);
                            }
                        }
                    }
                }
                break;
        }
        
        if(objData.type === 'Image' && objData.src) {
            const texture = new THREE.TextureLoader().load(objData.src as string, (tex) => {
                const aspect = tex.image.width / tex.image.height;
                setSceneObjects(prevObjects =>
                    prevObjects.map(o => {
                        if (o.id === objData.id) {
                            const baseScaleY = o.scale[1];
                            return { ...o, scale: [baseScaleY * aspect, baseScaleY, 1] as [number, number, number] };
                        }
                        return o;
                    })
                );
            });
            material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        }
        
        if(objData.type === 'Video' && objData.src) {
            const videoEl = document.createElement('video');
            videoEl.src = objData.src as string;
            videoEl.crossOrigin = 'anonymous';
            videoEl.loop = true;
            videoEl.muted = true;
            
            videoEl.onloadedmetadata = () => {
                const aspect = videoEl.videoWidth / videoEl.videoHeight;
                setSceneObjects(prevObjects =>
                    prevObjects.map(o => {
                        if (o.id === objData.id) {
                            const baseScaleY = o.scale[1];
                            return { ...o, scale: [baseScaleY * aspect, baseScaleY, 1] as [number, number, number] };
                        }
                        return o;
                    })
                );
            };

            videoEl.play();
            videoElementsRef.current.set(objData.id, videoEl);
            const texture = new THREE.VideoTexture(videoEl);
            material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        }


        if (geometry && !newObject) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = objData.type !== 'Plane';
            mesh.receiveShadow = true;
            if (objData.type === '3DText') {
                mesh.userData.text = objData.text;
            }
            newObject = mesh;
        }

        if (newObject) {
             newObject.visible = objData.visible ?? true;
             newObject.userData = { id: objData.id, type: objData.type };
             newObject.position.set(...objData.position);
             newObject.rotation.set(objData.rotation[0],objData.rotation[1],objData.rotation[2]);
             newObject.scale.set(...objData.scale);
             threeObjectsRef.current.set(objData.id, newObject);
             sceneRef.current?.add(newObject);
        }
      }
    });
  }, [isClient, sceneObjects, font, selectedObjectId, setSelectedObjectId, setSceneObjects, createParticleSystem, speakerTexture]);


  useEffect(() => {
    if (!isClient || !transformControlsRef.current || !orbitControlsRef.current || !cameraRef.current) return;
    const tc = transformControlsRef.current;
    const orbitControls = orbitControlsRef.current;
    const selectedObject3D = selectedObjectId ? threeObjectsRef.current.get(selectedObjectId) : null;

    if (selectedObject3D && activeTool && selectedObject3D.visible) {
        if (tc.object !== selectedObject3D) {
            tc.attach(selectedObject3D);
        }
        if (activeTool === 'Move' && tc.mode !== 'translate') { tc.setMode('translate'); }
        else if (activeTool === 'Rotate' && tc.mode !== 'rotate') { tc.setMode('rotate'); }
        else if (activeTool === 'Scale' && tc.mode !== 'scale') { tc.setMode('scale'); }
        tc.visible = true;
        tc.enabled = true;
        orbitControls.enabled = !tc.dragging;
    } else {
        if (tc.object) tc.detach();
        tc.visible = false;
        tc.enabled = false;
        orbitControls.enabled = true;
    }
  }, [isClient, selectedObjectId, activeTool, sceneObjects]);


  if (!isClient) {
    return <div ref={mountRef} className="w-full h-full bg-muted flex items-center justify-center"><p>Loading 3D View...</p></div>;
  }
  if (isClient && !font && sceneObjects.some(obj => obj.type === '3DText')) {
     return <div ref={mountRef} className="w-full h-full bg-muted flex items-center justify-center"><p>Loading Font for 3D Text...</p></div>;
  }

  return <div ref={mountRef} className="w-full h-full" aria-label="3D Modeling Viewport" />;
});

ThreeScene.displayName = 'ThreeScene';

export default ThreeScene;
