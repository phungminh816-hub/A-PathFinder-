/**
 * Leaflet map and Bidirectional A* pathfinding over a local OSM graph.
 */

const appConfig = window.APP_CONFIG || {};
const mapConfig = appConfig.map || {};
const geocodingConfig = appConfig.geocoding || {};

// Global App State
let map;
let startCoord = null;
let endCoord = null;
let startMarker = null;
let endMarker = null;

// Graph Data (Indexed by sequential integer 0 to N-1)
let nodeLats = null; // Float64Array
let nodeLons = null; // Float64Array
let graph = []; // Array of arrays: nodeIndex -> Array of edge objects
let graphT = []; // Array of arrays: nodeIndex -> Array of incoming edge objects for backward search
let streetNetworkLayers = []; // Stores the 4 batched multi-polyline layers
let pathLayers = []; // Stores final route polyline layers

// Bounding box covered by the local graph.
const BBOX = {
  minLat: mapConfig.minLat ?? 20.980,
  maxLat: mapConfig.maxLat ?? 21.075,
  minLon: mapConfig.minLon ?? 105.770,
  maxLon: mapConfig.maxLon ?? 105.890
};

// Visualizer & Animation handles
let searchCanvasOverlay = null; // High-performance canvas visualizer overlay
let isSearching = false;
let animationTimeout = null;

// Custom Leaflet Canvas Overlay for high-performance visual search rendering
const SearchCanvasOverlay = L.Layer.extend({
  initialize: function(options) {
    L.setOptions(this, options);
    this.visitedF = [];
    this.frontierF = [];
    this.visitedB = [];
    this.frontierB = [];
  },
  onAdd: function(map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'leaflet-search-canvas-layer');
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = '0';
    this._canvas.style.left = '0';
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.zIndex = '400';
    
    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    
    map.getContainer().appendChild(this._canvas);
    map.on('move', this._redraw, this);
    map.on('resize', this._resize, this);
    this._redraw();
  },
  onRemove: function(map) {
    L.DomUtil.remove(this._canvas);
    map.off('move', this._redraw, this);
    map.off('resize', this._resize, this);
  },
  _resize: function() {
    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    this._redraw();
  },
  addVisitedF: function(nodeIdx) {
    this.visitedF.push(nodeIdx);
  },
  addFrontierF: function(nodeIdx) {
    this.frontierF.push(nodeIdx);
  },
  addVisitedB: function(nodeIdx) {
    this.visitedB.push(nodeIdx);
  },
  addFrontierB: function(nodeIdx) {
    this.frontierB.push(nodeIdx);
  },
  clear: function() {
    this.visitedF = [];
    this.frontierF = [];
    this.visitedB = [];
    this.frontierB = [];
    this._redraw();
  },
  _redraw: function() {
    if (!this._map || !this._canvas) return;
    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    
    const bounds = this._map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    
    // Helper to draw a list of nodes
    const drawNodes = (nodes, fillStyle, strokeStyle, radius) => {
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 0.5;
      const len = nodes.length;
      for (let i = 0; i < len; i++) {
        const idx = nodes[i];
        const lat = nodeLats[idx];
        const lon = nodeLons[idx];
        if (lat >= sw.lat && lat <= ne.lat && lon >= sw.lng && lon <= ne.lng) {
          const pt = this._map.latLngToContainerPoint([lat, lon]);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
    };
    
    // Draw Forward Visited Nodes (Cyan)
    drawNodes(this.visitedF, '#06b6d4', '#0891b2', 3.5);
    
    // Draw Backward Visited Nodes (Pink/Magenta)
    drawNodes(this.visitedB, '#ec4899', '#db2777', 3.5);
    
    // Draw Forward Frontier Nodes (Yellow)
    drawNodes(this.frontierF, '#fbbf24', '#d97706', 2.5);
    
    // Draw Backward Frontier Nodes (Rose)
    drawNodes(this.frontierB, '#f43f5e', '#e11d48', 2.5);
  }
});

// Priority Queue implementation (Binary Min-Heap backed by parallel arrays)
class PriorityQueue {
  constructor() {
    this.elements = [];
    this.priorities = [];
  }
  
  enqueue(element, priority) {
    this.elements.push(element);
    this.priorities.push(priority);
    this.bubbleUp();
  }
  
  dequeue() {
    if (this.elements.length === 0) return null;
    const minElement = this.elements[0];
    const endElement = this.elements.pop();
    const endPriority = this.priorities.pop();
    if (this.elements.length > 0) {
      this.elements[0] = endElement;
      this.priorities[0] = endPriority;
      this.sinkDown();
    }
    return { element: minElement, priority: minPriority };
  }
  
  bubbleUp() {
    let idx = this.elements.length - 1;
    const element = this.elements[idx];
    const priority = this.priorities[idx];
    while (idx > 0) {
      let parentIdx = Math.floor((idx - 1) / 2);
      let parentPriority = this.priorities[parentIdx];
      if (priority >= parentPriority) break;
      this.elements[idx] = this.elements[parentIdx];
      this.priorities[idx] = parentPriority;
      idx = parentIdx;
    }
    this.elements[idx] = element;
    this.priorities[idx] = priority;
  }
  
  sinkDown() {
    let idx = 0;
    const length = this.elements.length;
    const element = this.elements[idx];
    const priority = this.priorities[idx];
    while (true) {
      let leftChildIdx = 2 * idx + 1;
      let rightChildIdx = 2 * idx + 2;
      let leftChildPriority, rightChildPriority;
      let swap = null;
      if (leftChildIdx < length) {
        leftChildPriority = this.priorities[leftChildIdx];
        if (leftChildPriority < priority) {
          swap = leftChildIdx;
        }
      }
      if (rightChildIdx < length) {
        rightChildPriority = this.priorities[rightChildIdx];
        if (
          (swap === null && rightChildPriority < priority) ||
          (swap !== null && rightChildPriority < leftChildPriority)
        ) {
          swap = rightChildIdx;
        }
      }
      if (swap === null) break;
      this.elements[idx] = this.elements[swap];
      this.priorities[idx] = this.priorities[swap];
      idx = swap;
    }
    this.elements[idx] = element;
    this.priorities[idx] = priority;
  }
  
  isEmpty() {
    return this.elements.length === 0;
  }
  
}

// Distance & Bearing Calculations
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fast flat-surface approximation for A* heuristic
// For Hanoi (average lat ~21.0275), 1 deg lat ~ 111132m, 1 deg lon ~ 103906m
function fastDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * 111132;
  const dLon = (lon2 - lon1) * 103906;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// Bounding box constraint check
function isWithinBbox(lat, lng) {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLon && lng <= BBOX.maxLon;
}

// Locate the nearest Graph Node to click/geocode coordinates (Optimized Euclidean filter using typed arrays)
function findNearestNode(lat, lng) {
  let minSquaredDist = Infinity;
  let nearestNodeIndex = -1;
  if (!nodeLats) return -1;
  
  const len = nodeLats.length;
  for (let i = 0; i < len; i++) {
    const dLat = nodeLats[i] - lat;
    const dLng = nodeLons[i] - lng;
    const squaredDist = dLat * dLat + dLng * dLng;
    if (squaredDist < minSquaredDist) {
      minSquaredDist = squaredDist;
      nearestNodeIndex = i;
    }
  }
  return nearestNodeIndex;
}

// Initialize Leaflet Map
function initMap() {
  const center = [mapConfig.centerLat ?? 21.028, mapConfig.centerLon ?? 105.83];
  const defaultZoom = mapConfig.defaultZoom ?? 12;

  map = L.map('map', {
    preferCanvas: true,
    zoomControl: false
  }).setView(center, defaultZoom);

  L.tileLayer(
    mapConfig.tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: mapConfig.tileAttribution || '&copy; OpenStreetMap contributors',
      maxZoom: mapConfig.maxZoom ?? 19
    }
  ).addTo(map);
  
  L.control.zoom({
    position: 'topright'
  }).addTo(map);
  
  const hanoiBboxCoords = [
    [BBOX.minLat, BBOX.minLon],
    [BBOX.maxLat, BBOX.maxLon]
  ];
  
  L.rectangle(hanoiBboxCoords, {
    color: '#2563eb',
    weight: 2,
    dashArray: '6, 6',
    fillColor: '#2563eb',
    fillOpacity: 0.03,
    interactive: false
  }).addTo(map);
  
  // High-performance canvas search progress overlay
  searchCanvasOverlay = new SearchCanvasOverlay();
  searchCanvasOverlay.addTo(map);
  
  // Setup Map click listener
  map.on('click', handleMapClick);
}

// Handle Map clicks to set Start/End points
function handleMapClick(e) {
  if (isSearching) return;
  const clickCoord = e.latlng;
  
  if (!isWithinBbox(clickCoord.lat, clickCoord.lng)) {
    showStatus("Hãy chọn vị trí bên trong vùng giới hạn.", "error");
    return;
  }
  
  if (!startCoord) {
    // Set Start
    setStartPoint(clickCoord, "Map Coordinate");
  } else if (!endCoord) {
    // Set End
    setEndPoint(clickCoord, "Map Coordinate");
  } else {
    // Both already set: Reset and place Start at new location
    clearPathAndAnimations();
    setStartPoint(clickCoord, "Map Coordinate");
    clearEndPoint();
    showStatus("Đã đặt điểm đầu. Hãy chọn điểm cuối.", "info");
  }
}

// Set markers and update UI
function setStartPoint(latlng, name) {
  if (!isWithinBbox(latlng.lat, latlng.lng)) {
    showStatus("Điểm đầu phải nằm trong vùng giới hạn.", "error");
    return false;
  }
  
  startCoord = latlng;
  document.getElementById('startSearch').value = name === "Map Coordinate" 
    ? `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}` 
    : name;
  
  if (startMarker) map.removeLayer(startMarker);
  
  // Premium glowing green start indicator
  startMarker = L.marker(latlng, {
    icon: L.divIcon({
      className: 'start-marker-icon',
      html: `<div style="background-color:#10b981; width:14px; height:14px; border:2.5px solid #fff; border-radius:50%; box-shadow:0 0 10px #10b981; transform:translate(-2px, -2px)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    })
  }).addTo(map);
  
  map.panTo(latlng);
  clearPathAndAnimations();
  checkFindRouteState();
  return true;
}

function setEndPoint(latlng, name) {
  if (!isWithinBbox(latlng.lat, latlng.lng)) {
    showStatus("Điểm cuối phải nằm trong vùng giới hạn.", "error");
    return false;
  }
  
  endCoord = latlng;
  document.getElementById('endSearch').value = name === "Map Coordinate" 
    ? `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}` 
    : name;
  
  if (endMarker) map.removeLayer(endMarker);
  
  // Premium glowing red end indicator
  endMarker = L.marker(latlng, {
    icon: L.divIcon({
      className: 'end-marker-icon',
      html: `<div style="background-color:#ef4444; width:14px; height:14px; border:2.5px solid #fff; border-radius:50%; box-shadow:0 0 10px #ef4444; transform:translate(-2px, -2px)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    })
  }).addTo(map);
  
  clearPathAndAnimations();
  checkFindRouteState();
  return true;
}

function clearStartPoint() {
  startCoord = null;
  document.getElementById('startSearch').value = '';
  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
  }
  clearPathAndAnimations();
  checkFindRouteState();
}

function clearEndPoint() {
  endCoord = null;
  document.getElementById('endSearch').value = '';
  if (endMarker) {
    map.removeLayer(endMarker);
    endMarker = null;
  }
  clearPathAndAnimations();
  checkFindRouteState();
}

function checkFindRouteState() {
  const btn = document.getElementById('findRouteBtn');
  const hasGraph = nodeLats && nodeLats.length > 0;
  btn.disabled = !(startCoord && endCoord && hasGraph);
}

// Status Updates
function showStatus(text, type = "info") {
  const statusBox = document.getElementById('statusBox');
  const statusText = document.getElementById('statusText');
  const statusSpinner = document.getElementById('statusSpinner');
  const statusIndicator = document.getElementById('statusIndicator');
  
  statusBox.className = `status ${type}`;
  statusText.textContent = text;
  
  if (type === "loading") {
    statusSpinner.classList.remove('hidden');
    statusIndicator.classList.add('hidden');
    statusBox.className = 'status info';
  } else {
    statusSpinner.classList.add('hidden');
    statusIndicator.classList.remove('hidden');
  }
  
  statusBox.classList.remove('hidden');
}

// Load local map dataset (no Overpass API query latency!)
async function loadLocalMapData() {
  clearPathAndAnimations();
  clearNetworkLayers();
  
  showStatus("Đang tải dữ liệu đồ thị cục bộ...", "loading");
  
  try {
    const response = await fetch(mapConfig.dataUrl || 'map_data.json');
    if (!response.ok) throw new Error("Local map_data.json was not found.");
    
    const data = await response.json();
    parseOSMData(data);
    
  } catch (err) {
    console.error(err);
    showStatus("Không tải được dữ liệu đồ thị. Hãy kiểm tra MAP_DATA_URL và file map_data.json.", "error");
  }
}

// Parse OSM JSON and build topological adjacency list (using typed arrays and numeric indices)
function parseOSMData(data) {
  const elements = data.elements;
  
  // Temporary map to look up node index by OSM ID
  const osmIdToIndex = new Map();
  const tempLats = [];
  const tempLons = [];
  let nodeIndex = 0;
  
  // 1. Gather Nodes and assign indices
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.type === 'node') {
      osmIdToIndex.set(String(element.id), nodeIndex);
      tempLats.push(element.lat);
      tempLons.push(element.lon);
      nodeIndex++;
    }
  }
  
  // Create typed arrays for fast spatial lookup and heuristic calculation
  nodeLats = new Float64Array(tempLats);
  nodeLons = new Float64Array(tempLons);
  
  // Initialize graph and transpose graph as arrays of arrays
  graph = new Array(nodeIndex);
  graphT = new Array(nodeIndex);
  for (let i = 0; i < nodeIndex; i++) {
    graph[i] = [];
    graphT[i] = [];
  }
  
  // 2. Build Adjacency list from Ways
  for (let k = 0; k < elements.length; k++) {
    const element = elements[k];
    if (element.type === 'way' && element.nodes) {
      const wayNodes = element.nodes;
      const tags = element.tags || {};
      const isOneWay = tags.oneway === 'yes' || tags.oneway === 'true' || tags.oneway === '1';
      const isReverse = tags.oneway === '-1';
      const isRailway = !!tags.railway;
      const streetName = tags.name || 'Unnamed Road';
      
      // Simulate Traffic density weights deterministically based on way ID
      let traffic = "normal";
      let weightMultiplier = 1.0;
      
      if (!isRailway) {
        const seed = element.id % 100;
        if (seed > 85) {
          traffic = "heavy";
          weightMultiplier = 5.0; // 5x routing weight
        } else if (seed > 70) {
          traffic = "medium";
          weightMultiplier = 2.5; // 2.5x routing weight
        }
      }
      
      for (let i = 0; i < wayNodes.length - 1; i++) {
        const uStr = String(wayNodes[i]);
        const vStr = String(wayNodes[i+1]);
        
        const u = osmIdToIndex.get(uStr);
        const v = osmIdToIndex.get(vStr);
        
        if (u !== undefined && v !== undefined) {
          const dist = haversineDistance(nodeLats[u], nodeLons[u], nodeLats[v], nodeLons[v]);
          
          const edgeData = {
            distance: dist,
            weight: dist * weightMultiplier,
            name: streetName,
            type: tags.highway || tags.railway || "road",
            traffic: traffic,
            isRailway: isRailway
          };
          
          // Connect bidirectional or one-way edges
          if (!isReverse) {
            graph[u].push({ to: v, ...edgeData });
            graphT[v].push({ to: u, ...edgeData });
          }
          if (!isOneWay && !isReverse) {
            graph[v].push({ to: u, ...edgeData });
            graphT[u].push({ to: v, ...edgeData });
          }
          if (isReverse) {
            graph[v].push({ to: u, ...edgeData });
            graphT[u].push({ to: v, ...edgeData });
          }
        }
      }
    }
  }
  
  const nodeCount = nodeLats.length;
  
  if (nodeCount === 0) {
    showStatus("Dữ liệu bản đồ không có node nào.", "error");
    return;
  }
  
  // Render Network
  renderLoadedNetwork();
  
  document.getElementById('statNodes').textContent = nodeCount.toLocaleString('vi-VN');
  showStatus("Đã tải đồ thị. Chọn điểm đầu và điểm cuối trong vùng giới hạn.", "success");
  checkFindRouteState();
}

// Render OSM Network using High-Performance Leaflet Canvas Multi-Polylines (grouped into 4 layers)
function renderLoadedNetwork() {
  clearNetworkLayers();
  
  const normalCoords = [];
  const mediumCoords = [];
  const heavyCoords = [];
  const railwayCoords = [];
  
  const seenEdges = new Set();
  const graphLen = graph.length;
  
  for (let u = 0; u < graphLen; u++) {
    const neighbors = graph[u];
    
    for (let i = 0; i < neighbors.length; i++) {
      const edge = neighbors[i];
      const v = edge.to;
      
      const edgeKey = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      
      const segment = [
        [nodeLats[u], nodeLons[u]],
        [nodeLats[v], nodeLons[v]]
      ];
      
      if (edge.isRailway) {
        railwayCoords.push(segment);
      } else if (edge.traffic === 'heavy') {
        heavyCoords.push(segment);
      } else if (edge.traffic === 'medium') {
        mediumCoords.push(segment);
      } else {
        normalCoords.push(segment);
      }
    }
  }
  
  // Create MultiPolylines for canvas rendering speed
  const showGraph = document.getElementById('toggleGraph').checked;
  
  const normalLayer = L.polyline(normalCoords, {
    color: '#10b981', // green
    weight: 1.5,
    opacity: 0.25,
    interactive: false
  });
  
  const mediumLayer = L.polyline(mediumCoords, {
    color: '#f59e0b', // orange/amber
    weight: 2.0,
    opacity: 0.35,
    interactive: false
  });
  
  const heavyLayer = L.polyline(heavyCoords, {
    color: '#ef4444', // red
    weight: 2.5,
    opacity: 0.45,
    interactive: false
  });
  
  const railwayLayer = L.polyline(railwayCoords, {
    color: '#3b82f6', // blue
    weight: 1.8,
    dashArray: '4, 4',
    opacity: 0.5,
    interactive: false
  });
  
  streetNetworkLayers = [normalLayer, mediumLayer, heavyLayer, railwayLayer];
  
  if (showGraph) {
    streetNetworkLayers.forEach(layer => layer.addTo(map));
  }
}

function clearNetworkLayers() {
  streetNetworkLayers.forEach(layer => map.removeLayer(layer));
  streetNetworkLayers = [];
}

function toggleNetworkGraphVisibility() {
  const show = document.getElementById('toggleGraph').checked;
  streetNetworkLayers.forEach(layer => {
    if (show) {
      layer.addTo(map);
    } else {
      map.removeLayer(layer);
    }
  });
}

// A* Routing Logic
function startPathfinding() {
  if (isSearching || !startCoord || !endCoord || !nodeLats || nodeLats.length === 0) return;
  
  clearPathAndAnimations();
  isSearching = true;
  
  const routingPreference = document.getElementById('routingPreference').value;
  const speedSetting = document.getElementById('searchSpeed').value;
  
  // Locate closest topological nodes
  const startNodeId = findNearestNode(startCoord.lat, startCoord.lng);
  const endNodeId = findNearestNode(endCoord.lat, endCoord.lng);
  
  if (startNodeId === -1 || endNodeId === -1) {
    showStatus("Không thể ghép tọa độ vào đồ thị đường đi.", "error");
    isSearching = false;
    return;
  }
  
  showStatus("Đang chạy Bidirectional A*...", "loading");
  
  const numNodes = nodeLats.length;
  
  // Bidirectional A* structures
  const gScoreF = new Float64Array(numNodes);
  const gScoreB = new Float64Array(numNodes);
  gScoreF.fill(Infinity);
  gScoreB.fill(Infinity);
  
  const edgeToF = new Array(numNodes);
  const edgeToB = new Array(numNodes);
  
  const visitedF = new Uint8Array(numNodes);
  const visitedB = new Uint8Array(numNodes);
  let visitedCount = 0;
  
  gScoreF[startNodeId] = 0;
  gScoreB[endNodeId] = 0;
  
  const pqF = new PriorityQueue();
  const pqB = new PriorityQueue();
  
  pqF.enqueue(startNodeId, fastDistance(nodeLats[startNodeId], nodeLons[startNodeId], nodeLats[endNodeId], nodeLons[endNodeId]));
  pqB.enqueue(endNodeId, fastDistance(nodeLats[endNodeId], nodeLons[endNodeId], nodeLats[startNodeId], nodeLons[startNodeId]));
  
  let found = false;
  let bestPathLength = Infinity;
  let meetingNode = -1;
  const startTime = performance.now();
  
  // INSTANT mode (Runs without visual sweeps)
  if (speedSetting === "instant") {
    while (!pqF.isEmpty() && !pqB.isEmpty()) {
      const minPriorityF = pqF.priorities[0];
      const minPriorityB = pqB.priorities[0];
      
      // Stop condition
      if (minPriorityF + minPriorityB >= bestPathLength) {
        if (meetingNode !== -1) found = true;
        break;
      }
      
      let current;
      if (minPriorityF <= minPriorityB) {
        current = pqF.dequeue().element;
        if (visitedF[current] === 1) continue;
        
        if (visitedB[current] === 1) {
          found = true;
          meetingNode = current;
          break;
        }
        
        visitedF[current] = 1;
        visitedCount++;
        
        const neighbors = graph[current] || [];
        const neighborsLen = neighbors.length;
        for (let i = 0; i < neighborsLen; i++) {
          const edge = neighbors[i];
          const neighbor = edge.to;
          if (visitedF[neighbor] === 1) continue;
          
          if (routingPreference === "railway" && !edge.isRailway) continue;
          if (routingPreference !== "railway" && edge.isRailway) continue;
          
          const costWeight = routingPreference === "shortest" ? edge.distance : edge.weight;
          const tentativeG = gScoreF[current] + costWeight;
          
          if (tentativeG < gScoreF[neighbor]) {
            gScoreF[neighbor] = tentativeG;
            edgeToF[neighbor] = { from: current, edge: edge };
            const h = fastDistance(nodeLats[neighbor], nodeLons[neighbor], nodeLats[endNodeId], nodeLons[endNodeId]);
            pqF.enqueue(neighbor, tentativeG + h);
            
            // Check meeting point
            if (gScoreB[neighbor] < Infinity) {
              const candidate = tentativeG + gScoreB[neighbor];
              if (candidate < bestPathLength) {
                bestPathLength = candidate;
                meetingNode = neighbor;
              }
            }
          }
        }
      } else {
        current = pqB.dequeue().element;
        if (visitedB[current] === 1) continue;
        
        if (visitedF[current] === 1) {
          found = true;
          meetingNode = current;
          break;
        }
        
        visitedB[current] = 1;
        visitedCount++;
        
        const neighbors = graphT[current] || [];
        const neighborsLen = neighbors.length;
        for (let i = 0; i < neighborsLen; i++) {
          const edge = neighbors[i];
          const neighbor = edge.to;
          if (visitedB[neighbor] === 1) continue;
          
          if (routingPreference === "railway" && !edge.isRailway) continue;
          if (routingPreference !== "railway" && edge.isRailway) continue;
          
          const costWeight = routingPreference === "shortest" ? edge.distance : edge.weight;
          const tentativeG = gScoreB[current] + costWeight;
          
          if (tentativeG < gScoreB[neighbor]) {
            gScoreB[neighbor] = tentativeG;
            edgeToB[neighbor] = { from: current, edge: edge };
            const h = fastDistance(nodeLats[neighbor], nodeLons[neighbor], nodeLats[startNodeId], nodeLons[startNodeId]);
            pqB.enqueue(neighbor, tentativeG + h);
            
            // Check meeting point
            if (gScoreF[neighbor] < Infinity) {
              const candidate = gScoreF[neighbor] + tentativeG;
              if (candidate < bestPathLength) {
                bestPathLength = candidate;
                meetingNode = neighbor;
              }
            }
          }
        }
      }
    }
    
    isSearching = false;
    const elapsed = performance.now() - startTime;
    console.log(`Bidirectional A* solved in ${elapsed.toFixed(1)}ms`);
    
    if (found || meetingNode !== -1) {
      if (meetingNode === -1) meetingNode = startNodeId;
      drawFinalPath(startNodeId, endNodeId, edgeToF, edgeToB, meetingNode, visitedCount);
    } else {
      showStatus("Không tìm thấy đường giữa hai vị trí.", "error");
    }
    
  } else {
    // ANIMATED mode (Slow & Detailed or Fast batches)
    const batchSize = speedSetting === "animated-fast" ? 35 : 1;
    const intervalTime = speedSetting === "animated-fast" ? 16 : 40;
    
    if (searchCanvasOverlay) searchCanvasOverlay.clear();
    
    function animateStep() {
      if ((pqF.isEmpty() && pqB.isEmpty()) || !isSearching) {
        if (!found && meetingNode === -1) {
          showStatus("Không tìm thấy đường giữa hai vị trí.", "error");
          isSearching = false;
        }
        return;
      }
      
      let canvasChanged = false;
      
      for (let i = 0; i < batchSize; i++) {
        if (pqF.isEmpty() && pqB.isEmpty()) break;
        
        const minPriorityF = pqF.isEmpty() ? Infinity : pqF.priorities[0];
        const minPriorityB = pqB.isEmpty() ? Infinity : pqB.priorities[0];
        
        if (minPriorityF + minPriorityB >= bestPathLength) {
          found = true;
          isSearching = false;
          if (searchCanvasOverlay) searchCanvasOverlay._redraw();
          drawFinalPath(startNodeId, endNodeId, edgeToF, edgeToB, meetingNode, visitedCount);
          return;
        }
        
        let current;
        if (minPriorityF <= minPriorityB) {
          current = pqF.dequeue().element;
          if (visitedF[current] === 1) continue;
          
          if (visitedB[current] === 1) {
            found = true;
            isSearching = false;
            if (searchCanvasOverlay) searchCanvasOverlay._redraw();
            drawFinalPath(startNodeId, endNodeId, edgeToF, edgeToB, meetingNode !== -1 ? meetingNode : current, visitedCount);
            return;
          }
          
          visitedF[current] = 1;
          visitedCount++;
          
          if (searchCanvasOverlay) searchCanvasOverlay.addVisitedF(current);
          canvasChanged = true;
          
          const neighbors = graph[current] || [];
          const neighborsLen = neighbors.length;
          for (let j = 0; j < neighborsLen; j++) {
            const edge = neighbors[j];
            const neighbor = edge.to;
            if (visitedF[neighbor] === 1) continue;
            
            if (routingPreference === "railway" && !edge.isRailway) continue;
            if (routingPreference !== "railway" && edge.isRailway) continue;
            
            const costWeight = routingPreference === "shortest" ? edge.distance : edge.weight;
            const tentativeG = gScoreF[current] + costWeight;
            
            if (tentativeG < gScoreF[neighbor]) {
              gScoreF[neighbor] = tentativeG;
              edgeToF[neighbor] = { from: current, edge: edge };
              const h = fastDistance(nodeLats[neighbor], nodeLons[neighbor], nodeLats[endNodeId], nodeLons[endNodeId]);
              pqF.enqueue(neighbor, tentativeG + h);
              
              if (searchCanvasOverlay) searchCanvasOverlay.addFrontierF(neighbor);
              canvasChanged = true;
              
              if (gScoreB[neighbor] < Infinity) {
                const candidate = tentativeG + gScoreB[neighbor];
                if (candidate < bestPathLength) {
                  bestPathLength = candidate;
                  meetingNode = neighbor;
                }
              }
            }
          }
        } else {
          current = pqB.dequeue().element;
          if (visitedB[current] === 1) continue;
          
          if (visitedF[current] === 1) {
            found = true;
            isSearching = false;
            if (searchCanvasOverlay) searchCanvasOverlay._redraw();
            drawFinalPath(startNodeId, endNodeId, edgeToF, edgeToB, meetingNode !== -1 ? meetingNode : current, visitedCount);
            return;
          }
          
          visitedB[current] = 1;
          visitedCount++;
          
          if (searchCanvasOverlay) searchCanvasOverlay.addVisitedB(current);
          canvasChanged = true;
          
          const neighbors = graphT[current] || [];
          const neighborsLen = neighbors.length;
          for (let j = 0; j < neighborsLen; j++) {
            const edge = neighbors[j];
            const neighbor = edge.to;
            if (visitedB[neighbor] === 1) continue;
            
            if (routingPreference === "railway" && !edge.isRailway) continue;
            if (routingPreference !== "railway" && edge.isRailway) continue;
            
            const costWeight = routingPreference === "shortest" ? edge.distance : edge.weight;
            const tentativeG = gScoreB[current] + costWeight;
            
            if (tentativeG < gScoreB[neighbor]) {
              gScoreB[neighbor] = tentativeG;
              edgeToB[neighbor] = { from: current, edge: edge };
              const h = fastDistance(nodeLats[neighbor], nodeLons[neighbor], nodeLats[startNodeId], nodeLons[startNodeId]);
              pqB.enqueue(neighbor, tentativeG + h);
              
              if (searchCanvasOverlay) searchCanvasOverlay.addFrontierB(neighbor);
              canvasChanged = true;
              
              if (gScoreF[neighbor] < Infinity) {
                const candidate = gScoreF[neighbor] + tentativeG;
                if (candidate < bestPathLength) {
                  bestPathLength = candidate;
                  meetingNode = neighbor;
                }
              }
            }
          }
        }
      }
      
      if (canvasChanged && searchCanvasOverlay) {
        searchCanvasOverlay._redraw();
      }
      
      document.getElementById('statVisited').textContent = visitedCount.toLocaleString('vi-VN');
      
      if (speedSetting === "animated-fast") {
        animationTimeout = requestAnimationFrame(animateStep);
      } else {
        animationTimeout = setTimeout(animateStep, intervalTime);
      }
    }
    
    animateStep();
  }
}

// Backtrack from Destination and draw path + instructions
function drawFinalPath(startNodeId, endNodeId, edgeToF, edgeToB, meetingNode, visitedCount) {
  // 1. Backtrack forward search: meetingNode -> startNodeId
  let curr = meetingNode;
  const forwardNodes = [];
  const forwardEdges = [];
  while (curr !== startNodeId) {
    const parentObj = edgeToF[curr];
    if (!parentObj) break;
    forwardNodes.push(curr);
    forwardEdges.push(parentObj.edge);
    curr = parentObj.from;
  }
  forwardNodes.push(startNodeId);
  forwardNodes.reverse();
  forwardEdges.reverse();
  
  // 2. Trace backward search: meetingNode -> endNodeId
  curr = meetingNode;
  const backwardNodes = [];
  const backwardEdges = [];
  while (curr !== endNodeId) {
    const parentObj = edgeToB[curr];
    if (!parentObj) break;
    curr = parentObj.from;
    backwardNodes.push(curr);
    backwardEdges.push(parentObj.edge);
  }
  
  const pathNodesCombined = forwardNodes.concat(backwardNodes);
  const pathEdgesCombined = forwardEdges.concat(backwardEdges);
  
  if (pathNodesCombined.length <= 1) {
    showStatus("Không tìm thấy đường giữa hai vị trí.", "error");
    return;
  }
  
  const pathCoords = pathNodesCombined.map(idx => [nodeLats[idx], nodeLons[idx]]);
  
  // Wipe animated search points to clearly highlight path
  if (searchCanvasOverlay) searchCanvasOverlay.clear();
  
  // Glowing multi-layered path polyline
  const glowPolyline = L.polyline(pathCoords, {
    color: '#a78bfa', // Light violet glow
    weight: 8,
    opacity: 0.35,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);
  
  const corePolyline = L.polyline(pathCoords, {
    color: '#8b5cf6', // Violet
    weight: 3.5,
    opacity: 1.0,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);
  
  pathLayers = [glowPolyline, corePolyline];
  
  // Fit map around completed path bounds
  map.fitBounds(corePolyline.getBounds(), { padding: [50, 50] });
  
  // Accumulate metrics
  let totalDistance = 0;
  let totalTimeSeconds = 0;
  
  for (const edge of pathEdgesCombined) {
    totalDistance += edge.distance;
    
    // Standard vehicle velocity profiles (m/s)
    let speedLimitKmh = 40;
    if (edge.type === 'motorway') speedLimitKmh = 100;
    else if (edge.type === 'trunk') speedLimitKmh = 80;
    else if (edge.type === 'primary') speedLimitKmh = 60;
    else if (edge.type === 'secondary') speedLimitKmh = 50;
    else if (edge.type === 'tertiary') speedLimitKmh = 40;
    else if (edge.type === 'residential' || edge.type === 'living_street') speedLimitKmh = 30;
    else if (edge.type === 'railway' || edge.isRailway) speedLimitKmh = 50;
    
    // Apply simulated traffic slows
    let weightMultiplier = 1.0;
    if (edge.traffic === 'medium') weightMultiplier = 2.5;
    else if (edge.traffic === 'heavy') weightMultiplier = 5.0;
    
    const speedMs = (speedLimitKmh / 3.6) / weightMultiplier;
    totalTimeSeconds += edge.distance / speedMs;
  }
  
  const totalDistanceKm = totalDistance / 1000;
  const totalTimeMins = Math.round(totalTimeSeconds / 60) || 1; // Minimum 1 minute
  
  // Render Stats
  document.getElementById('statDistance').textContent = totalDistanceKm.toFixed(2) + " km";
  document.getElementById('statTime').textContent = totalTimeMins + " phút";
  document.getElementById('statVisited').textContent = visitedCount.toLocaleString('vi-VN');
  document.getElementById('statsSection').classList.remove('hidden');
  
  showStatus("Đã tìm thấy đường đi.", "success");
}

// Reset A* animation timers and path objects
function clearPathAndAnimations() {
  isSearching = false;
  if (animationTimeout) {
    cancelAnimationFrame(animationTimeout);
    clearTimeout(animationTimeout);
    animationTimeout = null;
  }
  
  if (searchCanvasOverlay) searchCanvasOverlay.clear();
  
  pathLayers.forEach(layer => map.removeLayer(layer));
  pathLayers = [];
  
  document.getElementById('statsSection').classList.add('hidden');
}

// Full Clean Reset (Clear Map Button)
function resetAll() {
  clearPathAndAnimations();
  clearStartPoint();
  clearEndPoint();
  
  document.getElementById('statVisited').textContent = "0";
  document.getElementById('statDistance').textContent = "0.0 km";
  document.getElementById('statTime').textContent = "0 phút";
  
  showStatus("Sẵn sàng. Hãy chọn điểm đầu và điểm cuối.", "info");
}

// Nominatim Geocoding Autocomplete Suggestions
function setupAutocomplete(inputId, dropdownId, setCoordCallback) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);

  if (geocodingConfig.enabled === false) {
    input.placeholder = "Bấm trên bản đồ để chọn điểm";
    input.disabled = true;
    return;
  }
  
  const queryNominatim = debounce(async (text) => {
    if (text.length < 3) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }
    
    try {
      const url = new URL(geocodingConfig.url || 'https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('q', text);
      url.searchParams.set('limit', String(geocodingConfig.limit || 5));
      url.searchParams.set('accept-language', geocodingConfig.language || 'vi');
      url.searchParams.set('viewbox', `${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon},${BBOX.minLat}`);
      url.searchParams.set('bounded', '1');
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      
      renderSuggestions(data);
    } catch (err) {
      console.error("Nominatim search error: ", err);
    }
  }, geocodingConfig.debounceMs || 1000);
  
  function renderSuggestions(items) {
    dropdown.innerHTML = '';
    if (items.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }
    
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      
      const nameParts = item.display_name.split(',');
      const title = nameParts[0];
      const details = nameParts.slice(1).join(',').trim();
      
      const titleElement = document.createElement('strong');
      const detailsElement = document.createElement('small');
      titleElement.textContent = title;
      detailsElement.textContent = details;
      div.append(titleElement, document.createElement('br'), detailsElement);
      
      div.addEventListener('click', () => {
        const latlng = L.latLng(parseFloat(item.lat), parseFloat(item.lon));
        
        // Ensure coordinates are inside central Hanoi loaded region
        if (isWithinBbox(latlng.lat, latlng.lng)) {
          setCoordCallback(latlng, title);
          dropdown.innerHTML = '';
          dropdown.classList.add('hidden');
        } else {
          showStatus(`"${title}" nằm ngoài vùng dữ liệu. Hãy chọn một địa chỉ khác.`, "error");
        }
      });
      
      dropdown.appendChild(div);
    });
    
    dropdown.classList.remove('hidden');
  }
  
  // Event listeners
  input.addEventListener('input', (e) => {
    queryNominatim(e.target.value);
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

// Debounce helper
function debounce(func, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// Page load initialization
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  
  // Load static network database
  loadLocalMapData();
  
  // Bind inputs
  setupAutocomplete('startSearch', 'startSuggestions', setStartPoint);
  setupAutocomplete('endSearch', 'endSuggestions', setEndPoint);
  
  // Bind Clear buttons
  document.getElementById('clearStart').addEventListener('click', clearStartPoint);
  document.getElementById('clearEnd').addEventListener('click', clearEndPoint);
  
  // Control buttons
  document.getElementById('findRouteBtn').addEventListener('click', startPathfinding);
  document.getElementById('clearAllBtn').addEventListener('click', resetAll);
  
  // Toggles & Settings changes
  document.getElementById('toggleGraph').addEventListener('change', toggleNetworkGraphVisibility);
  
  document.getElementById('routingPreference').addEventListener('change', () => {
    clearPathAndAnimations();
    checkFindRouteState();
  });
});
