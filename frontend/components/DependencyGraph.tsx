'use client';

import { useState, useEffect, useRef } from 'react';
import { useDependencyGraph } from '@/lib/api';

interface DependencyGraphNode {
  bounty: {
    id: string;
    title: string;
    status: string;
    difficulty: string;
    rewardUsd: number;
  };
  isLocked: boolean;
  completedPrerequisites: number;
  totalPrerequisites: number;
}

interface DependencyGraphEdge {
  prerequisiteBountyId: string;
  dependentBountyId: string;
  isRequired: boolean;
}

interface DependencyGraph {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
}

interface Position {
  x: number;
  y: number;
}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 120;
const LAYER_HEIGHT = 180;

export function DependencyGraphVisualizer({ bountyId }: { bountyId?: string }) {
  const { data: graph, error, isLoading } = useDependencyGraph(bountyId);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, Position>>(new Map());

  // Calculate positions using a layered layout
  useEffect(() => {
    if (!graph?.nodes || !graph?.edges) return;

    const positions = new Map<string, Position>();
    const nodeMap = new Map(graph.nodes.map(n => [n.bounty.id, n]));
    
    // Build adjacency lists
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    
    graph.edges.forEach(edge => {
      if (!outgoing.has(edge.prerequisiteBountyId)) {
        outgoing.set(edge.prerequisiteBountyId, []);
      }
      if (!incoming.has(edge.dependentBountyId)) {
        incoming.set(edge.dependentBountyId, []);
      }
      
      outgoing.get(edge.prerequisiteBountyId)!.push(edge.dependentBountyId);
      incoming.get(edge.dependentBountyId)!.push(edge.prerequisiteBountyId);
    });

    // Topological sort to determine layers
    const layers: string[][] = [];
    const nodeToLayer = new Map<string, number>();
    const visited = new Set<string>();

    function dfs(nodeId: string): number {
      if (visited.has(nodeId)) {
        return nodeToLayer.get(nodeId) || 0;
      }

      visited.add(nodeId);
      
      const dependencies = incoming.get(nodeId) || [];
      if (dependencies.length === 0) {
        // Root node
        nodeToLayer.set(nodeId, 0);
        return 0;
      }

      // Place after the deepest dependency
      const maxDepDepth = Math.max(...dependencies.map(dep => dfs(dep)));
      const layer = maxDepDepth + 1;
      nodeToLayer.set(nodeId, layer);
      return layer;
    }

    // Process all nodes
    graph.nodes.forEach(node => {
      const layer = dfs(node.bounty.id);
      while (layers.length <= layer) {
        layers.push([]);
      }
      layers[layer].push(node.bounty.id);
    });

    // Position nodes within layers
    layers.forEach((layer, layerIndex) => {
      const layerWidth = layer.length * (NODE_WIDTH + 50);
      const startX = -layerWidth / 2;
      
      layer.forEach((nodeId, indexInLayer) => {
        const x = startX + indexInLayer * (NODE_WIDTH + 50) + NODE_WIDTH / 2;
        const y = layerIndex * LAYER_HEIGHT + NODE_HEIGHT / 2;
        positions.set(nodeId, { x, y });
      });
    });

    setNodePositions(positions);
  }, [graph]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 border border-emerald-200/20 rounded-lg bg-charcoal-800/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-red-200/20 rounded-lg bg-red-900/10">
        <p className="text-red-400">Failed to load dependency graph</p>
      </div>
    );
  }

  if (!graph?.nodes?.length) {
    return (
      <div className="p-6 border border-emerald-200/20 rounded-lg bg-charcoal-800/50">
        <p className="text-gray-400 text-center">No dependencies found</p>
      </div>
    );
  }

  // Calculate SVG dimensions
  const positions = Array.from(nodePositions.values());
  const minX = Math.min(...positions.map(p => p.x)) - NODE_WIDTH / 2 - 50;
  const maxX = Math.max(...positions.map(p => p.x)) + NODE_WIDTH / 2 + 50;
  const minY = Math.min(...positions.map(p => p.y)) - NODE_HEIGHT / 2 - 50;
  const maxY = Math.max(...positions.map(p => p.y)) + NODE_HEIGHT / 2 + 50;
  
  const svgWidth = maxX - minX;
  const svgHeight = maxY - minY;
  const offsetX = -minX;
  const offsetY = -minY;

  return (
    <div className="w-full border border-emerald-200/20 rounded-lg bg-charcoal-800/50 overflow-auto">
      <div className="p-4">
        <h3 className="text-xl font-bold text-emerald-100 mb-4">
          Bounty Dependency Graph
        </h3>
        <div className="flex gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded"></div>
            <span className="text-gray-300">Unlocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded"></div>
            <span className="text-gray-300">Locked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-300">Completed</span>
          </div>
        </div>
      </div>
      
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        className="w-full"
        style={{ minHeight: '400px' }}
      >
        {/* Render edges first */}
        {graph.edges.map((edge, index) => {
          const fromPos = nodePositions.get(edge.prerequisiteBountyId);
          const toPos = nodePositions.get(edge.dependentBountyId);
          
          if (!fromPos || !toPos) return null;

          const x1 = fromPos.x + offsetX;
          const y1 = fromPos.y + offsetY + NODE_HEIGHT / 2;
          const x2 = toPos.x + offsetX;
          const y2 = toPos.y + offsetY - NODE_HEIGHT / 2;

          return (
            <g key={`edge-${index}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={edge.isRequired ? '#10b981' : '#6b7280'}
                strokeWidth={edge.isRequired ? 2 : 1}
                strokeDasharray={edge.isRequired ? 'none' : '5,5'}
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#10b981"
            />
          </marker>
        </defs>

        {/* Render nodes */}
        {graph.nodes.map((node) => {
          const pos = nodePositions.get(node.bounty.id);
          if (!pos) return null;

          const x = pos.x + offsetX - NODE_WIDTH / 2;
          const y = pos.y + offsetY - NODE_HEIGHT / 2;
          
          const getNodeColor = () => {
            if (node.bounty.status === 'closed') return 'rgb(59 130 246)'; // blue
            if (node.isLocked) return 'rgb(107 114 128)'; // gray
            return 'rgb(16 185 129)'; // emerald
          };

          const getTextColor = () => {
            if (node.bounty.status === 'closed') return 'rgb(147 197 253)';
            if (node.isLocked) return 'rgb(156 163 175)';
            return 'rgb(167 243 208)';
          };

          return (
            <g key={node.bounty.id}>
              <rect
                x={x}
                y={y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                fill={getNodeColor()}
                fillOpacity={0.1}
                stroke={getNodeColor()}
                strokeWidth={2}
                rx={8}
              />
              
              <foreignObject
                x={x + 8}
                y={y + 8}
                width={NODE_WIDTH - 16}
                height={NODE_HEIGHT - 16}
              >
                <div className="text-xs">
                  <div
                    className="font-semibold truncate mb-1"
                    style={{ color: getTextColor() }}
                    title={node.bounty.title}
                  >
                    {node.bounty.title}
                  </div>
                  <div className="text-gray-400 mb-1">
                    ${node.bounty.rewardUsd} • {node.bounty.difficulty}
                  </div>
                  {node.totalPrerequisites > 0 && (
                    <div className="text-gray-400 text-xs">
                      Prerequisites: {node.completedPrerequisites}/{node.totalPrerequisites}
                    </div>
                  )}
                  <div className="mt-1">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        node.bounty.status === 'closed'
                          ? 'bg-blue-500/20 text-blue-300'
                          : node.isLocked
                          ? 'bg-gray-500/20 text-gray-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {node.bounty.status === 'closed'
                        ? 'Completed'
                        : node.isLocked
                        ? 'Locked'
                        : 'Available'}
                    </span>
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
