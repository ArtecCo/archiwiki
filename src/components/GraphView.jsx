import React, { useEffect, useRef } from "react";
import { BookOpen } from "lucide-react";

export default function GraphView({ notes, onNavigateToNote }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = canvas.parentElement.clientHeight || 500;

    // Generate physical properties for simulation
    const nodes = notes.map((note, index) => {
      const angle = (index / notes.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.3;
      return {
        id: note.id,
        title: note.title || "Untitled",
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        size: 6
      };
    });

    // Parse connections based on decrypted links
    const links = [];
    notes.forEach(note => {
      const linksFound = note.body?.match(/\[\[(.*?)\]\]/g) || [];
      linksFound.forEach(link => {
        const titleStr = link.replace("[[", "").replace("]]", "").trim().toLowerCase();
        const target = nodes.find(n => n.title.toLowerCase() === titleStr);
        const source = nodes.find(n => n.id === note.id);
        if (target && source) {
          links.push({ source, target });
        }
      });
    });

    // Basic layout stabilization logic
    const updatePhysics = () => {
      // 1. Repulsive forces between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 120) {
            const force = (120 - dist) / dist * 0.15;
            nodes[i].x -= dx * force;
            nodes[i].y -= dy * force;
            nodes[j].x += dx * force;
            nodes[j].y += dy * force;
          }
        }
      }

      // 2. Multi-link attractions
      links.forEach(link => {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = 80;
        const force = (dist - targetDist) / dist * 0.05;
        
        link.source.x += dx * force;
        link.source.y += dy * force;
        link.target.x -= dx * force;
        link.target.y -= dy * force;
      });

      // Keep inside viewing range
      nodes.forEach(node => {
        node.x = Math.max(20, Math.min(width - 20, node.x));
        node.y = Math.max(20, Math.min(height - 20, node.y));
      });
    };

    // Run basic visual frames
    const render = () => {
      updatePhysics();
      ctx.clearRect(0, 0, width, height);

      // Draw Connection Threads
      ctx.strokeStyle = "#e5e5e5";
      ctx.lineWidth = 1;
      links.forEach(link => {
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.stroke();
      });

      // Draw Core Nodes
      nodes.forEach(node => {
        ctx.fillStyle = "#202122";
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fill();

        // Node Title Labels
        ctx.fillStyle = "#202122";
        ctx.font = "11px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(node.title, node.x, node.y - 10);
      });
    };

    const animation = setInterval(render, 30);
    return () => clearInterval(animation);
  }, [notes]);

  return (
    <div className="flex-1 flex flex-col bg-[#F5F2EB] text-[#202122] h-full p-8">
      <div className="flex items-center gap-2 mb-6 border-b border-neutral-300 pb-4">
        <BookOpen size={20} />
        <h2 className="text-xl font-serif font-bold">Manuscript Network Map</h2>
      </div>
      <p className="text-xs italic text-neutral-500 mb-4">A visualization of local references and links. Drag and drop connections or click notes directly inside editor viewports.</p>
      <div className="flex-1 bg-white border border-neutral-200 rounded relative overflow-hidden min-h-[400px]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}

