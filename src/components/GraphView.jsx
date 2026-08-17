import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  BookOpen,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  X
} from "lucide-react";

export default function GraphView({
  notes,
  onNavigateToNote,
  theme = "beige"
}) {
  const graphRef = useRef(null);

  const graphContainerRef = useRef(null);

const [graphSize, setGraphSize] = useState({
  width: 0,
  height: 0
});

  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const graphTheme = {
    beige: {
      page: "#F5F2EB",
      panel: "#FFFFFF",
      border: "#D8CDBA",
      edge: "#CFC6B8",
      edgeActive: "#8B7D68",
      node: "#6B5E4B",
      nodeActive: "#202122",
      nodeConnected: "#8A7962",
      text: "#3F372B",
      muted: "#8A8176",
      input: "#FFFFFF"
    },

    wikipedia: {
      page: "#F8F9FA",
      panel: "#FFFFFF",
      border: "#C8CCD1",
      edge: "#C8CCD1",
      edgeActive: "#72777D",
      node: "#3366CC",
      nodeActive: "#202122",
      nodeConnected: "#5B7DBB",
      text: "#202122",
      muted: "#72777D",
      input: "#FFFFFF"
    },

    charcoal: {
      page: "#171717",
      panel: "#1F1F1F",
      border: "#404040",
      edge: "#4A4A4A",
      edgeActive: "#A3A3A3",
      node: "#93C5FD",
      nodeActive: "#F5F5F5",
      nodeConnected: "#60A5FA",
      text: "#F5F5F5",
      muted: "#A3A3A3",
      input: "#262626"
    }
  }[theme];

  /*
   * ---------------------------------------------------------
   * GRAPH DATA
   * ---------------------------------------------------------
   */

  const graphData = useMemo(() => {
    const nodes = notes.map((note) => ({
      id: note.id,
      name: note.title || "Untitled",
      title: note.title || "Untitled"
    }));

    const noteByTitle = new Map(
      nodes.map((node) => [
        node.name.trim().toLowerCase(),
        node
      ])
    );

    const links = [];

    notes.forEach((note) => {
      const source = nodes.find(
        (node) => node.id === note.id
      );

      if (!source) return;

      const linksFound =
        note.body?.match(/\[\[(.*?)\]\]/g) || [];

      linksFound.forEach((rawLink) => {
        const linkedTitle = rawLink
          .slice(2, -2)
          .trim()
          .toLowerCase();

        const target = noteByTitle.get(linkedTitle);

        if (!target || target.id === source.id) return;

        links.push({
          source: source.id,
          target: target.id
        });
      });
    });

    /*
     * Calculate connection counts.
     * This is used for node size, similar to Obsidian.
     */
    const degree = new Map();

    nodes.forEach((node) => {
      degree.set(node.id, 0);
    });

    links.forEach((link) => {
      degree.set(
        link.source,
        (degree.get(link.source) || 0) + 1
      );

      degree.set(
        link.target,
        (degree.get(link.target) || 0) + 1
      );
    });

    nodes.forEach((node) => {
      node.connections = degree.get(node.id) || 0;

      /*
       * Keep nodes visually restrained.
       * Highly connected notes become larger,
       * but never enormous.
       */
      node.val = Math.min(
        2 + node.connections * 0.75,
        10
      );
    });

    return {
      nodes,
      links
    };
  }, [notes]);

  /*
   * ---------------------------------------------------------
   * CONNECTION / SELECTION HELPERS
   * ---------------------------------------------------------
   */

  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set();

    const connected = new Set([
      selectedNode.id
    ]);

    graphData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "object"
          ? link.source.id
          : link.source;

      const targetId =
        typeof link.target === "object"
          ? link.target.id
          : link.target;

      if (sourceId === selectedNode.id) {
        connected.add(targetId);
      }

      if (targetId === selectedNode.id) {
        connected.add(sourceId);
      }
    });

    return connected;
  }, [selectedNode, graphData.links]);

  const isConnectedToSelected = (node) => {
    if (!selectedNode) return false;

    return connectedNodeIds.has(node.id);
  };

  const isLinkConnectedToSelected = (link) => {
    if (!selectedNode) return false;

    const sourceId =
      typeof link.source === "object"
        ? link.source.id
        : link.source;

    const targetId =
      typeof link.target === "object"
        ? link.target.id
        : link.target;

    return (
      sourceId === selectedNode.id ||
      targetId === selectedNode.id
    );
  };

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
   */

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return [];

    return graphData.nodes
      .filter((node) =>
        node.name.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [searchQuery, graphData.nodes]);

  const focusNode = (node) => {
    setSelectedNode(node);
    setSearchQuery("");

    const graph = graphRef.current;

    if (!graph || node.x == null || node.y == null) {
      return;
    }

    graph.centerAt(
      node.x,
      node.y,
      600
    );

    graph.zoom(
      3,
      600
    );
  };

  /*
   * ---------------------------------------------------------
   * GRAPH INITIALIZATION
   * ---------------------------------------------------------
   */
useEffect(() => {
  const container = graphContainerRef.current;

  if (!container) return;

  const updateSize = () => {
    const rect = container.getBoundingClientRect();

    setGraphSize({
      width: Math.floor(rect.width),
      height: Math.floor(rect.height)
    });
  };

  updateSize();

  const observer = new ResizeObserver(updateSize);
  observer.observe(container);

  return () => {
    observer.disconnect();
  };
}, []);


  useEffect(() => {
    if (!graphRef.current) return;

    const timer = setTimeout(() => {
      graphRef.current?.zoomToFit(
        700,
        60
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [graphData]);

  /*
   * ---------------------------------------------------------
   * EMPTY STATE
   * ---------------------------------------------------------
   */

  if (notes.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{
          background: graphTheme.page,
          color: graphTheme.text
        }}
      >
        <BookOpen
          size={36}
          strokeWidth={1}
          className="mb-5"
          style={{ color: graphTheme.muted }}
        />

        <h2 className="font-serif text-2xl">
          Your knowledge graph is empty
        </h2>

        <p
          className="mt-2 text-sm italic"
          style={{ color: graphTheme.muted }}
        >
          Create articles and connect them with [[wiki links]].
        </p>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * GRAPH
   * ---------------------------------------------------------
   */

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{
        background: graphTheme.page,
        color: graphTheme.text
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between gap-4 px-6 py-3 border-b"
        style={{
          borderColor: graphTheme.border
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen
            size={19}
            strokeWidth={1.5}
          />

          <div className="min-w-0">
            <h2 className="font-serif font-semibold text-lg">
              Knowledge Graph
            </h2>

            <p
              className="text-[10px] uppercase tracking-[0.15em]"
              style={{
                color: graphTheme.muted
              }}
            >
              {graphData.nodes.length} articles ·{" "}
              {graphData.links.length} connections
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-56 max-sm:w-40">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{
              color: graphTheme.muted
            }}
          />

          <input
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
            placeholder="Find an article..."
            className="w-full rounded border pl-8 pr-8 py-1.5 text-xs outline-none"
            style={{
              background: graphTheme.input,
              borderColor: graphTheme.border,
              color: graphTheme.text
            }}
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X
                size={13}
                style={{
                  color: graphTheme.muted
                }}
              />
            </button>
          )}

          {searchResults.length > 0 && (
            <div
              className="absolute z-50 top-full left-0 right-0 mt-1 border rounded shadow-lg overflow-hidden"
              style={{
                background: graphTheme.panel,
                borderColor: graphTheme.border
              }}
            >
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() =>
                    focusNode(node)
                  }
                  className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="truncate">
                    {node.name}
                  </div>

                  <div
                    className="text-[9px] mt-0.5"
                    style={{
                      color: graphTheme.muted
                    }}
                  >
                    {node.connections} connections
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graph area */}
      <div
  ref={graphContainerRef}
  className="flex-1 min-h-0 relative overflow-hidden"
  style={{
    background: graphTheme.page
  }}
>

  {graphSize.width > 0 && graphSize.height > 0 && (
        <ForceGraph2D
  ref={graphRef}
  graphData={graphData}
  width={graphSize.width}
  height={graphSize.height}
  backgroundColor={graphTheme.page}

          /*
           * Physics
           */
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
          warmupTicks={80}
          cooldownTicks={180}
          cooldownTime={12000}

          d3Force={(forceName, force) => {
            if (forceName === "charge") {
              force.strength(-180);
              force.distanceMax(500);
            }

            if (forceName === "link") {
              force.distance(110);
              force.strength(0.7);
            }

            if (forceName === "center") {
              force.strength(0.08);
            }
          }}

          /*
           * Nodes
           */
          nodeVal={(node) =>
            selectedNode?.id === node.id
              ? node.val + 3
              : node.val
          }

          nodeColor={(node) => {
            if (selectedNode?.id === node.id) {
              return graphTheme.nodeActive;
            }

            if (
              selectedNode &&
              isConnectedToSelected(node)
            ) {
              return graphTheme.nodeConnected;
            }

            if (selectedNode) {
              return graphTheme.node;
            }

            return graphTheme.node;
          }}

          nodeLabel={(node) => `
            <div style="
              padding:6px 8px;
              border-radius:5px;
              font-family:Georgia,serif;
              font-size:12px;
              background:${graphTheme.panel};
              color:${graphTheme.text};
              border:1px solid ${graphTheme.border};
              box-shadow:0 2px 8px rgba(0,0,0,.12);
            ">
              <strong>${escapeHtml(node.name)}</strong>
              <div style="
                margin-top:2px;
                font-size:10px;
                opacity:.65;
              ">
                ${node.connections} connections
              </div>
            </div>
          `}

          /*
           * Keep labels subtle and readable.
           */
          nodeCanvasObject={(
            node,
            ctx,
            globalScale
          ) => {
            const label =
              node.name.length > 32
                ? `${node.name.slice(0, 31)}…`
                : node.name;

            const fontSize =
              Math.max(
                9,
                12 / globalScale
              );

            const nodeRadius =
              Math.sqrt(node.val) * 3;

            const isSelected =
              selectedNode?.id === node.id;

            const isConnected =
              selectedNode &&
              isConnectedToSelected(node);

            const isDimmed =
              selectedNode &&
              !isSelected &&
              !isConnected;

            ctx.globalAlpha = isDimmed
              ? 0.22
              : 1;

            ctx.beginPath();

            ctx.arc(
              node.x,
              node.y,
              nodeRadius +
                (isSelected ? 2 : 0),
              0,
              2 * Math.PI
            );

            ctx.fillStyle =
              isSelected
                ? graphTheme.nodeActive
                : isConnected
                ? graphTheme.nodeConnected
                : graphTheme.node;

            ctx.fill();

            if (isSelected) {
              ctx.beginPath();

              ctx.arc(
                node.x,
                node.y,
                nodeRadius + 5,
                0,
                2 * Math.PI
              );

              ctx.strokeStyle =
                graphTheme.nodeActive;

              ctx.lineWidth = 1;
              ctx.stroke();
            }

            /*
             * Labels become visible as the user zooms in.
             * This prevents large graphs from becoming unreadable.
             */
            if (globalScale >= 0.8) {
              ctx.font = `${
                isSelected
                  ? "600"
                  : "400"
              } ${fontSize}px Georgia, serif`;

              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              ctx.fillStyle =
                graphTheme.text;

              ctx.fillText(
                label,
                node.x,
                node.y -
                  nodeRadius -
                  8 / globalScale
              );
            }

            ctx.globalAlpha = 1;
          }}

          /*
           * Links
           */
          linkColor={(link) => {
            if (
              selectedNode &&
              isLinkConnectedToSelected(link)
            ) {
              return graphTheme.edgeActive;
            }

            return graphTheme.edge;
          }}

          linkWidth={(link) => {
            if (
              selectedNode &&
              isLinkConnectedToSelected(link)
            ) {
              return 1.8;
            }

            return 0.8;
          }}

          linkOpacity={0.65}

          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalArrowColor={() =>
            graphTheme.edgeActive
          }

          /*
           * Interaction
           */
          enableZoomInteraction
          enablePanInteraction
          enableNodeDrag

          onNodeHover={(node) => {
            setHoveredNode(node || null);
          }}

          onNodeClick={(node) => {
            setSelectedNode(node);

            /*
             * Smoothly bring the clicked node
             * toward the center.
             */
            if (
              node.x != null &&
              node.y != null
            ) {
              graphRef.current?.centerAt(
                node.x,
                node.y,
                500
              );
            }
          }}

          onNodeDoubleClick={(node) => {
            onNavigateToNote(node.id);
          }}

          onBackgroundClick={() => {
            setSelectedNode(null);
            setHoveredNode(null);
          }}

          showPointerCursor={(item) =>
            Boolean(item)
          }
          />
)}

        {/* Hover information */}
        {hoveredNode && (
          <div
            className="pointer-events-none absolute left-4 bottom-4 rounded border px-3 py-2 shadow-sm"
            style={{
              background: graphTheme.panel,
              borderColor: graphTheme.border
            }}
          >
            <div className="text-xs font-semibold">
              {hoveredNode.name}
            </div>

            <div
              className="text-[10px] mt-0.5"
              style={{
                color: graphTheme.muted
              }}
            >
              {hoveredNode.connections}{" "}
              {hoveredNode.connections === 1
                ? "connection"
                : "connections"}
            </div>
          </div>
        )}

        {/* Controls */}
        <div
          className="absolute right-4 bottom-4 flex items-center gap-1 rounded border p-1 shadow-sm"
          style={{
            background: graphTheme.panel,
            borderColor: graphTheme.border
          }}
        >
          <GraphButton
            title="Zoom in"
            onClick={() =>
              graphRef.current?.zoom(
                1.5,
                300
              )
            }
            icon={<ZoomIn size={15} />}
          />

          <GraphButton
            title="Zoom out"
            onClick={() =>
              graphRef.current?.zoom(
                0.67,
                300
              )
            }
            icon={<ZoomOut size={15} />}
          />

          <GraphButton
            title="Fit graph"
            onClick={() =>
              graphRef.current?.zoomToFit(
                700,
                60
              )
            }
            icon={<Maximize2 size={15} />}
          />

          <GraphButton
            title="Clear selection"
            onClick={() =>
              setSelectedNode(null)
            }
            icon={<RotateCcw size={15} />}
          />
        </div>

        {/* Selected node indicator */}
        {selectedNode && (
          <div
            className="absolute top-4 left-4 flex items-center gap-2 rounded border px-3 py-2 shadow-sm"
            style={{
              background: graphTheme.panel,
              borderColor: graphTheme.border
            }}
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate max-w-56">
                {selectedNode.name}
              </div>

              <div
                className="text-[9px] uppercase tracking-wider mt-0.5"
                style={{
                  color: graphTheme.muted
                }}
              >
                {Math.max(
                  0,
                  connectedNodeIds.size - 1
                )}{" "}
                connected articles
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedNode(null)
              }
              className="shrink-0"
              title="Clear selection"
            >
              <X
                size={13}
                style={{
                  color: graphTheme.muted
                }}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/*
 * Small HTML escaping helper for the node tooltip.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
 * Small reusable graph control.
 */
function GraphButton({
  title,
  onClick,
  icon
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
    >
      {icon}
    </button>
  );
}
