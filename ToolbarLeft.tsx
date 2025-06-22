
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Move3d, RotateCw, Maximize2, Trash2, Copy, Plus, Box, Circle, Pyramid, Cylinder as CylinderIcon, Type, Square, Image as ImageIcon, Video, Flame, CloudRain, Snowflake, Wind, Sparkles, Waves, Download, Upload, Cloud, Music, Sun, Shapes } from "lucide-react";
import type { SceneObject, ActiveTool } from "@/app/page";

interface ToolbarLeftProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  onAddShape: (type: SceneObject['type']) => void;
  onDeleteObject: () => void;
  onCopyObject: () => void;
  onAddParticle: (particleType: string) => void;
  onImportImage: () => void;
  onImportVideo: () => void;
  onImportAudio: () => void;
  onImportModel: (format: string) => void;
  onExportScene: (format: string) => void;
  onImportCYB: () => void;
  onExportCYB: () => void;
}

const ToolbarLeft: React.FC<ToolbarLeftProps> = ({
  activeTool,
  setActiveTool,
  onAddShape,
  onDeleteObject,
  onCopyObject,
  onAddParticle,
  onImportImage,
  onImportVideo,
  onImportAudio,
  onImportModel,
  onExportScene,
  onImportCYB,
  onExportCYB,
}) => {
  const mainTools = [
    { name: "Move" as ActiveTool, icon: <Move3d className="w-5 h-5" />, ariaLabel: "Move Tool (M)" },
    { name: "Rotate" as ActiveTool, icon: <RotateCw className="w-5 h-5" />, ariaLabel: "Rotate Tool (R)" },
    { name: "Scale" as ActiveTool, icon: <Maximize2 className="w-5 h-5" />, ariaLabel: "Scale Tool (S)" },
  ];

  const actionTools = [
    { name: "Copy", icon: <Copy className="w-5 h-5" />, ariaLabel: "Copy Object (Ctrl+D)", action: onCopyObject, destructive: false },
    { name: "Delete", icon: <Trash2 className="w-5 h-5" />, ariaLabel: "Delete Object (Delete)", action: onDeleteObject, destructive: true },
  ];

  const shapes: { name: SceneObject['type']; icon: JSX.Element; displayName: string }[] = [
    { name: "Cube", icon: <Box className="w-4 h-4 mr-2" />, displayName: "Cube" },
    { name: "Sphere", icon: <Circle className="w-4 h-4 mr-2" />, displayName: "Sphere" },
    { name: "Plane", icon: <Square className="w-4 h-4 mr-2" />, displayName: "Plane" },
    { name: "Pyramid", icon: <Pyramid className="w-4 h-4 mr-2" />, displayName: "Pyramid" },
    { name: "Cylinder", icon: <CylinderIcon className="w-4 h-4 mr-2" />, displayName: "Cylinder" },
    { name: "3DText", icon: <Type className="w-4 h-4 mr-2" />, displayName: "3D Text" },
  ];
  
  const particles: { name: string; icon: JSX.Element }[] = [
    { name: "Fire", icon: <Flame className="w-4 h-4 mr-2" /> },
    { name: "Rain", icon: <CloudRain className="w-4 h-4 mr-2" /> },
    { name: "Snow", icon: <Snowflake className="w-4 h-4 mr-2" /> },
    { name: "Steam", icon: <Wind className="w-4 h-4 mr-2" /> },
    { name: "Magic", icon: <Sparkles className="w-4 h-4 mr-2" /> },
    { name: "Water", icon: <Waves className="w-4 h-4 mr-2" /> },
    { name: "Fog", icon: <Cloud className="w-4 h-4 mr-2" /> },
  ];
  
  const importFormats: { name: string; format: string }[] = [
    { name: 'GLTF (.gltf/.glb)', format: 'gltf' },
    { name: 'OBJ (.obj)', format: 'obj' },
    { name: 'STL (.stl)', format: 'stl' },
  ];
  
  const exportFormats: { name: string; format: string }[] = [
    { name: 'GLTF (.glb)', format: 'gltf' },
    { name: 'OBJ (.obj)', format: 'obj' },
  ];

  return (
      <div className="p-3 bg-card border-r border-border flex flex-col items-center space-y-3 shadow-md">
        {/* Add Shape/Effect Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  className="rounded-full w-12 h-12 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-110 focus:scale-110"
                  aria-label="Add new shape or effect"
                >
                  <Plus className="w-6 h-6" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Add New... (A)</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" className="w-56">
            <DropdownMenuLabel>Add to Scene</DropdownMenuLabel>
            <DropdownMenuSeparator />
             <DropdownMenuItem className="cursor-pointer" onSelect={() => onAddShape('Skybox')}>
              <Sun className="w-4 h-4 mr-2" />
              <span>Skybox</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Box className="w-4 h-4 mr-2" />
                <span>Shapes</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {shapes.map((shape) => (
                    <DropdownMenuItem key={shape.name} className="cursor-pointer" onSelect={() => onAddShape(shape.name)}>
                      {shape.icon}
                      <span>{shape.displayName}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span>Effects</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        {particles.map((particle) => (
                          <DropdownMenuItem key={particle.name} className="cursor-pointer" onSelect={() => onAddParticle(particle.name)}>
                            {particle.icon}
                            <span>{particle.name}</span>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <Upload className="w-4 h-4 mr-2" />
                    <span>Import</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem className="cursor-pointer" onSelect={onImportCYB}>
                            Scene (.cyb)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer" onSelect={onImportImage}>
                            Image
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onSelect={onImportVideo}>
                            Video
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onSelect={onImportAudio}>
                            <Music className="w-4 h-4 mr-2" />
                            Audio
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Model</DropdownMenuLabel>
                         {importFormats.map((item) => (
                            <DropdownMenuItem key={item.format} className="cursor-pointer" onSelect={() => onImportModel(item.format)}>
                            <span>{item.name}</span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
             <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <Download className="w-4 h-4 mr-2" />
                    <span>Export</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem className="cursor-pointer" onSelect={onExportCYB}>
                           Scene (.cyb)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Model As...</DropdownMenuLabel>
                        {exportFormats.map((item) => (
                            <DropdownMenuItem key={item.format} className="cursor-pointer" onSelect={() => onExportScene(item.format)}>
                            <span>{item.name}</span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="border-t border-border w-full my-1"></div>

        {/* Main Tools: Move, Rotate, Scale */}
        {mainTools.map((tool) => {
          const isActive = activeTool === tool.name;
          return (
            <Tooltip key={tool.name}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`rounded-full w-12 h-12 shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-110 focus:scale-110 ${isActive ? 'ring-2 ring-primary ring-offset-background ring-offset-2' : 'hover:bg-primary/20'}`}
                  onClick={() => setActiveTool(tool.name)}
                  aria-label={tool.ariaLabel}
                  aria-pressed={isActive}
                >
                  {tool.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{tool.ariaLabel}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        
        <div className="border-t border-border w-full my-1"></div>


        {/* Action Tools: Copy, Delete */}
        {actionTools.map((tool) => (
          <Tooltip key={tool.name}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full w-12 h-12 shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-110 focus:scale-110 ${tool.destructive ? 'hover:bg-destructive/20 hover:text-destructive' : 'hover:bg-primary/20'}`}
                onClick={tool.action}
                aria-label={tool.ariaLabel}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tool.ariaLabel}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
  );
};

export default ToolbarLeft;
