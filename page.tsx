
"use client";

import React, { useState, useCallback, useRef } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import ThreeScene from "@/components/cybernox/ThreeScene";
import ToolbarLeft from "@/components/cybernox/ToolbarLeft";
import ObjectListPanel from "@/components/cybernox/ObjectListPanel";
import { Button } from '@/components/ui/button';
import { PanelRightOpen } from 'lucide-react';
import type { ThreeSceneRef } from '@/components/cybernox/ThreeScene';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export interface SceneObject {
  id: string;
  name: string;
  type: 'Cube' | 'Sphere' | 'Plane' | 'Pyramid' | 'Cylinder' | '3DText' | 'Image' | 'Video' | 'ParticleSystem' | 'Model' | 'Audio' | 'Skybox';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  text?: string; 
  visible?: boolean;
  src?: string | ArrayBuffer;
  format?: string;
  particleType?: string;
}

export type ActiveTool = 'Move' | 'Rotate' | 'Scale' | null;

interface AudioPreviewProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  audioData: {
    src: string | ArrayBuffer;
    name: string;
  } | null;
  onAddToScene: () => void;
}

const AudioPreview: React.FC<AudioPreviewProps> = ({ isOpen, onOpenChange, audioData, onAddToScene }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Audio Preview: {audioData?.name}</DialogTitle>
          <DialogDescription>
            Listen to the audio below. Click "Add to Scene" to import it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          {audioData?.src && (
            <audio controls autoPlay src={audioData.src as string} className="w-full">
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onAddToScene}>Add to Scene</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function Cybernox3DPage() {
  const threeSceneRef = useRef<ThreeSceneRef>(null);
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([
    {
      id: "initial-cube-1",
      name: "Blue Cube",
      type: "Cube",
      position: [-2, 0.5, 0],
      rotation: [0, Math.PI / 4, 0],
      scale: [1,1,1],
      color: "#4285F4"
    },
    {
      id: "initial-sphere-1",
      name: "Red Sphere",
      type: "Sphere",
      position: [2, 0.75, 1],
      rotation: [0,0,0],
      scale: [1.5, 1.5, 1.5],
      color: "#DB4437"
    },
    {
      id: "initial-plane-1",
      name: "Green Plane",
      type: "Plane",
      position: [0, 0.01, -2],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [3, 2, 1],
      color: "#0F9D58"
    },
     {
      id: "initial-cylinder-1",
      name: "Yellow Cylinder",
      type: "Cylinder",
      position: [0, 0.5, 2],
      rotation: [0,0,0],
      scale: [0.5, 1, 0.5],
      color: "#F4B400"
    },
  ]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>("initial-cube-1");
  const [activeTool, setActiveTool] = useState<ActiveTool>('Move');
  const [isObjectListVisible, setIsObjectListVisible] = useState(true);
  const [isAudioPreviewOpen, setIsAudioPreviewOpen] = useState(false);
  const [previewAudioData, setPreviewAudioData] = useState<{ src: string | ArrayBuffer; name: string; } | null>(null);
  const [skyTime, setSkyTime] = useState<number>(12);


  const addSceneObject = useCallback((type: SceneObject['type'], options: { src?: string | ArrayBuffer, name?: string, format?: string } = {}) => {
    const newObjectId = `object-${Date.now()}`;
    
    let baseName: string = options.name || type;
    if (type === '3DText' && !options.name) baseName = '3D Text';
    if ((type === 'Model' || type === 'Audio') && options.name) {
      baseName = options.name.split('.')[0];
    }
    
    let counter = 1;
    let newObjectName = baseName;
    if (!options.name || type !== 'Model') {
       while (sceneObjects.some(obj => obj.name === newObjectName)) {
         newObjectName = `${baseName} ${counter++}`;
       }
    }
    
    if (type === 'Skybox') {
      if (sceneObjects.some(obj => obj.type === 'Skybox')) {
        return; // Only one skybox allowed
      }
      newObjectName = 'Skybox';
    }


    let textContent: string | undefined = undefined;
    let objectColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;

    if (type === '3DText') {
      const userText = window.prompt("Enter text for the 3D object:", "Hello");
      if (userText === null || userText.trim() === "") {
        return;
      }
      textContent = userText;
      objectColor = '#FFFFFF';
    }
    
    if (type === 'Image' || type === 'Video' || type === 'Model' || type === 'Audio' || type === 'Skybox') {
      objectColor = '#FFFFFF'
    }

    let newObjectScale: [number, number, number] = [1, 1, 1];
    if (type === 'Plane') {
        newObjectScale = [2, 2, 1];
    } else if (type === 'Image' || type === 'Video') {
        newObjectScale = [5, 5, 1];
    }

    const newObject: SceneObject = {
      id: newObjectId,
      name: newObjectName,
      type: type,
      position: (type === 'Model' || type === 'Skybox') ? [0, 0, 0] : [Math.random() * 4 - 2, 2.5 + Math.random() * 1, Math.random() * 4 - 2],
      rotation: [0, 0, 0],
      scale: newObjectScale,
      color: objectColor,
      text: textContent,
      src: options.src,
      format: options.format,
      visible: true,
    };

    setSceneObjects(prevObjects => [...prevObjects, newObject]);
    setSelectedObjectId(newObjectId);
  }, [sceneObjects]);

  const deleteSelectedObject = useCallback(() => {
    if (!selectedObjectId) {
      return;
    }
    setSceneObjects(prevObjects => prevObjects.filter(obj => obj.id !== selectedObjectId));
    setSelectedObjectId(null);
  }, [selectedObjectId]);

  const copySelectedObject = useCallback(() => {
    if (!selectedObjectId) {
      return;
    }
    const originalObject = sceneObjects.find(obj => obj.id === selectedObjectId);
    if (originalObject) {
      const newObjectId = `object-${Date.now()}`;
      let baseName = originalObject.type === '3DText' ? '3D Text' : originalObject.type;
      
      const nameWithoutCopySuffix = originalObject.name.replace(/ \(\text{Copy} \d+\)$/, "");
      const nameWithoutNumberSuffix = nameWithoutCopySuffix.replace(/ \d+$/, "");
      if (sceneObjects.some(obj => obj.name.startsWith(nameWithoutNumberSuffix))) {
          baseName = nameWithoutNumberSuffix;
      }

      let counter = 1;
      let newObjectName = `${baseName} (Copy ${counter})`;

      while (sceneObjects.some(obj => obj.name === newObjectName)) {
        counter++;
        newObjectName = `${baseName} (Copy ${counter})`;
      }

      const newObject: SceneObject = {
        ...originalObject,
        id: newObjectId,
        name: newObjectName,
        position: [
          originalObject.position[0] + 0.5,
          originalObject.position[1],
          originalObject.position[2] + 0.5,
        ],
      };
      setSceneObjects(prevObjects => [...prevObjects, newObject]);
      setSelectedObjectId(newObjectId);
    }
  }, [selectedObjectId, sceneObjects]);

  const toggleObjectVisibility = useCallback((objectId: string) => {
    setSceneObjects(prevObjects =>
      prevObjects.map(obj =>
        obj.id === objectId ? { ...obj, visible: !(obj.visible ?? true) } : obj
      )
    );
  }, []);

  const handleAddParticle = useCallback((particleType: string) => {
    const newObjectId = `object-${Date.now()}`;
    
    let counter = 1;
    let baseName = particleType;
    let newObjectName = baseName;
    while (sceneObjects.some(obj => obj.name === `${baseName} ${counter}`)) {
        counter++;
    }
    newObjectName = `${baseName} ${counter}`;

    const newObject: SceneObject = {
      id: newObjectId,
      name: newObjectName,
      type: 'ParticleSystem',
      particleType: particleType,
      position: [0, 1.5, 0], 
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#FFFFFF',
      visible: true,
    };

    setSceneObjects(prevObjects => [...prevObjects, newObject]);
  }, [sceneObjects]);

  const handleImportMedia = useCallback((accept: 'image/*' | 'video/*') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readEvent) => {
        const src = readEvent.target?.result as string;
        const type = accept === 'image/*' ? 'Image' : 'Video';
        
        let counter = 1;
        let baseName = file.name.split('.')[0] || type;
        let newObjectName = baseName;
        while (sceneObjects.some(obj => obj.name === newObjectName)) {
          newObjectName = `${baseName} (${counter})`;
          counter++;
        }
        
        addSceneObject(type, { src, name: newObjectName });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [addSceneObject, sceneObjects]);

  const handleImportAudio = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readEvent) => {
        const src = readEvent.target?.result as string;
        setPreviewAudioData({ src, name: file.name });
        setIsAudioPreviewOpen(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);
  
  const handleImportModel = useCallback((format: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `.${format},` + (format === 'gltf' ? '.glb' : '');
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readEvent) => {
        const content = readEvent.target?.result;
        if (content) {
            addSceneObject('Model', { src: content, name: file.name, format });
        }
      };
      
      if (format === 'gltf' || format === 'glb' || format === 'stl') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    };
    input.click();
  }, [addSceneObject]);
  
  const handleExportScene = useCallback((format: string) => {
    if (threeSceneRef.current) {
        threeSceneRef.current.exportScene(format);
    }
  }, []);
  
  const handleAddToSceneFromAudioPreview = useCallback(() => {
    if (previewAudioData) {
        let counter = 1;
        let baseName = previewAudioData.name.split('.')[0] || 'Audio';
        let newObjectName = baseName;
        while (sceneObjects.some(obj => obj.name === newObjectName)) {
          newObjectName = `${baseName} (${counter})`;
          counter++;
        }
        addSceneObject('Audio', { src: previewAudioData.src, name: newObjectName });
        setIsAudioPreviewOpen(false);
        setPreviewAudioData(null);
    }
  }, [previewAudioData, addSceneObject, sceneObjects]);
  
  const handleObjectListClick = useCallback((objectId: string) => {
    setSelectedObjectId(objectId);
    const obj = sceneObjects.find(o => o.id === objectId);
    if (obj && obj.type === 'Audio') {
        threeSceneRef.current?.playAudio(obj.id);
    }
  }, [sceneObjects]);

  const handleExportSceneCYB = useCallback(() => {
    try {
      const serializableObjects = sceneObjects.map(obj => {
        if (obj.src instanceof ArrayBuffer) {
          let binary = '';
          const bytes = new Uint8Array(obj.src);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = window.btoa(binary);
          return { ...obj, src: `data:application/octet-stream;base64,${base64}`, isArrayBuffer: true };
        }
        return obj;
      });

      const sceneData = JSON.stringify(serializableObjects, null, 2);
      const blob = new Blob([sceneData], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cybernox-scene.cyb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to export CYB scene:", error);
    }
  }, [sceneObjects]);

  const handleImportSceneCYB = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.cyb,application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readEvent) => {
        try {
          const content = readEvent.target?.result as string;
          if (content) {
            const importedData = JSON.parse(content);
            if (Array.isArray(importedData)) {
              const deserializedObjects = importedData.map((obj: any) => {
                if (obj.isArrayBuffer && typeof obj.src === 'string' && obj.src.startsWith('data:application/octet-stream;base64,')) {
                  const base64 = obj.src.split(',')[1];
                  const binary_string = window.atob(base64);
                  const len = binary_string.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binary_string.charCodeAt(i);
                  }
                  const newObj = { ...obj, src: bytes.buffer };
                  delete newObj.isArrayBuffer;
                  return newObj;
                }
                return obj;
              });

              setSceneObjects(deserializedObjects);
              setSelectedObjectId(null);
            } else {
              console.error("Invalid .cyb file format: root should be an array.");
            }
          }
        } catch (error) {
          console.error("Failed to import CYB scene:", error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden antialiased font-body bg-background">
        <ToolbarLeft
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          onAddShape={addSceneObject}
          onDeleteObject={deleteSelectedObject}
          onCopyObject={copySelectedObject}
          onAddParticle={handleAddParticle}
          onImportImage={() => handleImportMedia('image/*')}
          onImportVideo={() => handleImportMedia('video/*')}
          onImportAudio={handleImportAudio}
          onImportModel={handleImportModel}
          onExportScene={handleExportScene}
          onImportCYB={handleImportSceneCYB}
          onExportCYB={handleExportSceneCYB}
        />
        <main className="flex-1 relative overflow-hidden">
          <ThreeScene
            ref={threeSceneRef}
            sceneObjects={sceneObjects}
            setSceneObjects={setSceneObjects}
            selectedObjectId={selectedObjectId}
            setSelectedObjectId={setSelectedObjectId}
            activeTool={activeTool}
            skyTime={skyTime}
          />
          {!isObjectListVisible && (
            <div className="absolute top-4 right-4 z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setIsObjectListVisible(true)} className="rounded-full w-12 h-12 shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-110 focus:scale-110">
                    <PanelRightOpen />
                    <span className="sr-only">Open Object Panel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Show Objects Panel</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </main>
        {isObjectListVisible && (
            <aside className="w-72 bg-card border-l border-border flex flex-col shadow-lg">
              <div className="flex-grow min-h-0">
                <ObjectListPanel
                  objects={sceneObjects}
                  selectedObjectId={selectedObjectId}
                  onSelectObject={handleObjectListClick}
                  onToggleVisibility={toggleObjectVisibility}
                  onTogglePanel={() => setIsObjectListVisible(false)}
                  skyTime={skyTime}
                  setSkyTime={setSkyTime}
                />
              </div>
            </aside>
        )}
      </div>
      <AudioPreview
        isOpen={isAudioPreviewOpen}
        onOpenChange={setIsAudioPreviewOpen}
        audioData={previewAudioData}
        onAddToScene={handleAddToSceneFromAudioPreview}
      />
    </TooltipProvider>
  );
}
