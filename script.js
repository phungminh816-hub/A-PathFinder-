/**
 * AstraMap - Premium A* Pathfinding Visualizer (Offline-first Local Graph Mode)
 * Fully optimized with Leaflet HTML5 Canvas rendering and local map_data.json.
 */

// Global App State
let map;
let startCoord = null;
let endCoord = null;
let startMarker = null;
let endMarker = null;

// Graph Data
let nodes = {}; // nodeId -> { lat, lon }
let graph = {}; // nodeId -> Array of edge objects
let streetNetworkLayers = []; // Stores the 4 batched multi-polyline layers
let pathLayers = []; // Stores final route polyline layers

// Bounding box of Central Hanoi map data
const BBOX = {
  minLat: 20.980,
  maxLat: 21.075,
  minLon: 105.770,
  maxLon: 105.890
};

// Visualizer & Animation handles
let visualizerGroup; // LayerGroup for search progression markers
let isSearching = false;
let animationTimeout = null;

// Priority Queue implementation (Binary Min-Heap)
class PriorityQueue {
  constructor() {
    this.values = [];
  }
  
  enqueue(element, priority) {
    this.values.push({ element, priority });
    this.bubbleUp();
  }
  
  dequeue() {
    if (this.values.length === 0) return null;
    const min = this.values[0];
    const end = this.values.pop();
    if (this.values.length > 0) {
      this.values[0] = end;
      this.sinkDown();
    }
    return min;
  }
  
  bubbleUp() {
    let idx = this.values.length - 1;
    const element = this.values[idx];
    while (idx > 0) {
      let parentIdx = Math.floor((idx - 1) / 2);
      let parent = this.values[parentIdx];
      if (element.priority >= parent.priority) break;
      this.values[parentIdx] = element;
      this.values[idx] = parent;
      idx = parentIdx;
    }
  }
  
  sinkDown() {
    let idx = 0;
    const length = this.values.length;
    const element = this.values[0];
    while (true) {
      let leftChildIdx = 2 * idx + 1;
      let rightChildIdx = 2 * idx + 2;
      let leftChild, rightChild;
      let swap = null;
      if (leftChildIdx < length) {
        leftChild = this.values[leftChildIdx];
        if (leftChild.priority < element.priority) {
          swap = leftChildIdx;
        }
      }
      if (rightChildIdx < length) {
        rightChild = this.values[rightChildIdx];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null && rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildIdx;
        }
      }
      if (swap === null) break;
      this.values[idx] = this.values[swap];
      this.values[swap] = element;
      idx = swap;
    }
  }
  
  isEmpty() {
    return this.values.length === 0;
  }
  
  clear() {
    this.values = [];
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

function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// Bounding box constraint check
function isWithinBbox(lat, lng) {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLon && lng <= BBOX.maxLon;
}

// Locate the nearest Graph Node to click/geocode coordinates (Optimized Euclidean filter)
function findNearestNode(lat, lng) {
  let minSquaredDist = Infinity;
  let nearestNodeId = null;
  
  // Fast Euclidean pre-filtering in degrees
  for (const id in nodes) {
    const node = nodes[id];
    const dLat = node.lat - lat;
    const dLng = node.lon - lng;
    const squaredDist = dLat * dLat + dLng * dLng;
    if (squaredDist < minSquaredDist) {
      minSquaredDist = squaredDist;
      nearestNodeId = id;
    }
  }
  return nearestNodeId;
}

// Initialize Leaflet Map
function initMap() {
  // Hanoi center by default
  map = L.map('map', {
    preferCanvas: true,
    zoomControl: false // Custom styled controls placed via CSS
  }).setView([21.028, 105.83], 12);
  
  // Add CartoDB Dark Matter tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);
  
  // Add customized Zoom control on the top right
  L.control.zoom({
    position: 'topright'
  }).addTo(map);
  
  // Highlight central Hanoi routing zone boundary
  const hanoiBboxCoords = [
    [BBOX.minLat, BBOX.minLon],
    [BBOX.maxLat, BBOX.maxLon]
  ];
  
  L.rectangle(hanoiBboxCoords, {
    color: '#8b5cf6', // Violet neon
    weight: 2,
    dashArray: '6, 6',
    fillColor: '#8b5cf6',
    fillOpacity: 0.03,
    interactive: false
  }).addTo(map);
  
  // Layer Groups
  visualizerGroup = L.layerGroup().addTo(map);
  
  // Setup Map click listener
  map.on('click', handleMapClick);
}

// Handle Map clicks to set Start/End points
function handleMapClick(e) {
  if (isSearching) return;
  const clickCoord = e.latlng;
  
  if (!isWithinBbox(clickCoord.lat, clickCoord.lng)) {
    showStatus("Please pick a location inside the highlighted region.", "error");
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
    showStatus("Start point set. Choose End point inside the highlighted zone.", "info");
  }
}

// Set markers and update UI
function setStartPoint(latlng, name) {
  if (!isWithinBbox(latlng.lat, latlng.lng)) {
    showStatus("Start point must be inside the highlighted Hanoi region.", "error");
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
    showStatus("End point must be inside the highlighted Hanoi region.", "error");
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
  const hasGraph = Object.keys(nodes).length > 0;
  btn.disabled = !(startCoord && endCoord && hasGraph);
}

// Status Updates
function showStatus(text, type = "info") {
  const statusBox = document.getElementById('statusBox');
  const statusText = document.getElementById('statusText');
  const statusSpinner = document.getElementById('statusSpinner');
  const statusIndicator = document.getElementById('statusIndicator');
  
  statusBox.className = `status-box ${type}`;
  statusText.textContent = text;
  
  if (type === "loading") {
    statusSpinner.classList.remove('hidden');
    statusIndicator.classList.add('hidden');
    statusBox.className = `status-box info`;
  } else {
    statusSpinner.classList.add('hidden');
    statusIndicator.classList.remove('hidden');
  }
  
  statusBox.classList.remove('hidden');
}

function hideStatus() {
  document.getElementById('statusBox').classList.add('hidden');
}

// Load local map dataset (no Overpass API query latency!)
async function loadLocalMapData() {
  clearPathAndAnimations();
  clearNetworkLayers();
  
  showStatus("Loading map_data.json from local database...", "loading");
  
  try {
    const response = await fetch('map_data.json');
    if (!response.ok) throw new Error("Local map_data.json was not found.");
    
    const data = await response.json();
    parseOSMData(data);
    
  } catch (err) {
    console.error(err);
    showStatus("Failed to load map data. Please verify map_data.json is inside project root.", "error");
  }
}

// Parse OSM JSON and build topological adjacency list
function parseOSMData(data) {
  nodes = {};
  graph = {};
  
  const elements = data.elements;
  
  // 1. Gather Nodes
  for (const element of elements) {
    if (element.type === 'node') {
      nodes[element.id] = {
        lat: element.lat,
        lon: element.lon
      };
    }
  }
  
  let edgeCount = 0;
  
  // 2. Build Adjacency list from Ways
  for (const element of elements) {
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
        const u = String(wayNodes[i]);
        const v = String(wayNodes[i+1]);
        
        if (nodes[u] && nodes[v]) {
          const dist = haversineDistance(nodes[u].lat, nodes[u].lon, nodes[v].lat, nodes[v].lon);
          
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
            if (!graph[u]) graph[u] = [];
            graph[u].push({ to: v, ...edgeData });
            edgeCount++;
          }
          if (!isOneWay && !isReverse) {
            if (!graph[v]) graph[v] = [];
            graph[v].push({ to: u, ...edgeData });
            edgeCount++;
          }
          if (isReverse) {
            if (!graph[v]) graph[v] = [];
            graph[v].push({ to: u, ...edgeData });
            edgeCount++;
          }
        }
      }
    }
  }
  
  const nodeCount = Object.keys(nodes).length;
  
  if (nodeCount === 0) {
    showStatus("No nodes found in the map dataset.", "error");
    return;
  }
  
  // Render Network
  renderLoadedNetwork();
  
  document.getElementById('statNodes').textContent = nodeCount + " nodes";
  showStatus(`Urban Hanoi loaded. Choose Start & End points inside the highlighted region.`, "success");
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
  
  for (const u in graph) {
    const neighbors = graph[u];
    const nodeU = nodes[u];
    
    for (const edge of neighbors) {
      const v = edge.to;
      const nodeV = nodes[v];
      
      const edgeKey = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      
      const segment = [
        [nodeU.lat, nodeU.lon],
        [nodeV.lat, nodeV.lon]
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
  if (isSearching || !startCoord || !endCoord || Object.keys(nodes).length === 0) return;
  
  clearPathAndAnimations();
  isSearching = true;
  
  const routingPreference = document.getElementById('routingPreference').value;
  const speedSetting = document.getElementById('searchSpeed').value;
  
  // Locate closest topological nodes
  const startNodeId = findNearestNode(startCoord.lat, startCoord.lng);
  const endNodeId = findNearestNode(endCoord.lat, endCoord.lng);
  
  if (!startNodeId || !endNodeId) {
    showStatus("Could not map routing coordinates to the street network graph.", "error");
    isSearching = false;
    return;
  }
  
  showStatus("Executing A* Pathfinding algorithm...", "loading");
  
  // A* structures
  const gScore = {}; // Cost to node
  const fScore = {}; // Cost + Heuristic
  const edgeTo = {}; // Traceback paths
  const visited = new Set();
  
  // Initialize
  for (const id in nodes) {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
  }
  
  const startNode = nodes[startNodeId];
  const endNode = nodes[endNodeId];
  
  gScore[startNodeId] = 0;
  fScore[startNodeId] = haversineDistance(startNode.lat, startNode.lon, endNode.lat, endNode.lon);
  
  const pq = new PriorityQueue();
  pq.enqueue(startNodeId, fScore[startNodeId]);
  
  let found = false;
  const startTime = performance.now();
  
  // INSTANT mode (Runs without visual A* sweeps)
  if (speedSetting === "instant") {
    while (!pq.isEmpty()) {
      const current = pq.dequeue().element;
      
      if (current === endNodeId) {
        found = true;
        break;
      }
      
      if (visited.has(current)) continue;
      visited.add(current);
      
      const neighbors = graph[current] || [];
      for (const edge of neighbors) {
        const neighbor = edge.to;
        if (visited.has(neighbor)) continue;
        
        // Routing preference filter rules
        if (routingPreference === "railway" && !edge.isRailway) continue;
        if (routingPreference !== "railway" && edge.isRailway) continue;
        
        // Traffic penalty rules
        const costWeight = routingPreference === "shortest" ? edge.distance : edge.weight;
        const tentativeG = gScore[current] + costWeight;
        
        if (tentativeG < gScore[neighbor]) {
          gScore[neighbor] = tentativeG;
          edgeTo[neighbor] = { from: current, edge: edge };
          const h = haversineDistance(nodes[neighbor].lat, nodes[neighbor].lon, endNode.lat, endNode.lon);
          fScore[neighbor] = tentativeG + h;
          pq.enqueue(neighbor, fScore[neighbor]);
        }
      }
    }
    
    isSearching = false;
    const elapsed = performance.now() - startTime;
    console.log(`A* pathfinding solved in ${elapsed.toFixed(1)}ms`);
    
    if (found) {
      drawFinalPath(startNodeId, endNodeId, edgeTo, visited.size);
    } else {
      showStatus("No route found between the selected locations.", "error");
    }
    
  } else {
    // ANIMATED mode (Slow & Detailed or Fast batches)
    const batchSize = speedSetting === "animated-fast" ? 35 : 1;
    const intervalTime = speedSetting === "animated-fast" ? 16 : 40; // requestAnimationFrame or setTimeout
    
    function animateStep() {
      if (pq.isEmpty() || !isSearching) {
        if (!found) {
          showStatus("No route found between the selected locations.", "error");
          isSearching = false;
        }
        return;
      }
      
      for (let i = 0; i < batchSize; i++) {
        if (pq.isEmpty()) break;
        
        const current = pq.dequeue().element;
        
        if (current === endNodeId) {
          found = true;
          isSearching = false;
          drawFinalPath(startNodeId, endNodeId, edgeTo, visited.size);
          return;
        }
        
        if (visited.has(current)) continue;
        visited.add(current);
        
        // Draw visited node (Cyan CircleMarker directly on HTML5 Canvas)
        const node = nodes[current];
        L.circleMarker([node.lat, node.lon], {
          radius: 3.5,
          fillColor: '#06b6d4',
          color: '#0891b2',
          weight: 0.5,
          fillOpacity: 0.75,
          interactive: false
        }).addTo(visualizerGroup);
        
        const neighbors = graph[current] || [];
        for (const edge of neighbors) {
          const neighbor = edge.to;
          if (visited.has(neighbor)) continue;
          
          if (routingPreference === "railway" && !edge.isRailway) continue;
          if (routingPreference !== "railway" && edge.isRailway) continue;
          
          const costWeight = routingPreference === "shortest" ? edge.distance : edge.weight;
          const tentativeG = gScore[current] + costWeight;
          
          if (tentativeG < gScore[neighbor]) {
            gScore[neighbor] = tentativeG;
            edgeTo[neighbor] = { from: current, edge: edge };
            const h = haversineDistance(nodes[neighbor].lat, nodes[neighbor].lon, endNode.lat, endNode.lon);
            fScore[neighbor] = tentativeG + h;
            pq.enqueue(neighbor, fScore[neighbor]);
            
            // Draw frontier queue node (Yellow CircleMarker on Canvas)
            const neighborNode = nodes[neighbor];
            L.circleMarker([neighborNode.lat, neighborNode.lon], {
              radius: 2.5,
              fillColor: '#fbbf24',
              color: '#d97706',
              weight: 0.5,
              fillOpacity: 0.7,
              interactive: false
            }).addTo(visualizerGroup);
          }
        }
      }
      
      // Update real-time Visited stats in panel
      document.getElementById('statVisited').textContent = visited.size + " nodes";
      
      if (speedSetting === "animated-fast") {
        animationTimeout = requestAnimationFrame(animateStep);
      } else {
        animationTimeout = setTimeout(animateStep, intervalTime);
      }
    }
    
    // Begin step animation
    animateStep();
  }
}

// Backtrack from Destination and draw path + instructions
function drawFinalPath(startNodeId, endNodeId, edgeTo, visitedCount) {
  const pathNodes = [];
  const pathEdges = [];
  let curr = endNodeId;
  
  while (curr !== startNodeId) {
    const edgeObj = edgeTo[curr];
    if (!edgeObj) break;
    pathNodes.push(curr);
    pathEdges.push(edgeObj.edge);
    curr = edgeObj.from;
  }
  pathNodes.push(startNodeId);
  
  pathNodes.reverse();
  pathEdges.reverse();
  
  const pathCoords = pathNodes.map(id => [nodes[id].lat, nodes[id].lon]);
  
  // Wipe animated search points to clearly highlight path
  visualizerGroup.clearLayers();
  
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
  
  for (const edge of pathEdges) {
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
  document.getElementById('statTime').textContent = totalTimeMins + " mins";
  document.getElementById('statVisited').textContent = visitedCount + " nodes";
  document.getElementById('statsSection').classList.remove('hidden');
  
  // Generate step-by-step turn instructions
  generateTurnByTurnDirections(pathNodes, pathEdges);
}

function generateTurnByTurnDirections(pathNodes, pathEdges) {
  const listEl = document.getElementById('directionsList');
  listEl.innerHTML = '';
  
  const instructions = [];
  let currentStreet = pathEdges[0].name;
  let currentDist = 0;
  let prevBearing = null;
  
  for (let i = 0; i < pathEdges.length; i++) {
    const edge = pathEdges[i];
    currentDist += edge.distance;
    
    const u = pathNodes[i];
    const v = pathNodes[i+1];
    const bearing = calculateBearing(nodes[u].lat, nodes[u].lon, nodes[v].lat, nodes[v].lon);
    
    const isLast = i === pathEdges.length - 1;
    const nextEdge = isLast ? null : pathEdges[i+1];
    
    if (nextEdge === null || nextEdge.name !== currentStreet) {
      let turnAction = "Head along";
      if (prevBearing !== null) {
        const angleDiff = (bearing - prevBearing + 540) % 360 - 180;
        if (angleDiff < -40) {
          turnAction = "Turn left onto";
        } else if (angleDiff > 40) {
          turnAction = "Turn right onto";
        } else {
          turnAction = "Continue onto";
        }
      }
      
      const label = currentStreet === 'Unnamed Road' ? 'local street' : `<strong>${currentStreet}</strong>`;
      instructions.push({
        text: `${turnAction} ${label}`,
        distance: currentDist
      });
      
      currentStreet = nextEdge ? nextEdge.name : '';
      currentDist = 0;
    }
    prevBearing = bearing;
  }
  
  instructions.push({
    text: "Arrive at <strong>Destination</strong>",
    distance: 0
  });
  
  instructions.forEach(ins => {
    const li = document.createElement('li');
    li.innerHTML = ins.text;
    if (ins.distance > 0) {
      const span = document.createElement('span');
      span.className = 'dist';
      span.textContent = ins.distance >= 1000 
        ? `Go ${(ins.distance / 1000).toFixed(1)} km` 
        : `Go ${Math.round(ins.distance)} meters`;
      li.appendChild(span);
    }
    listEl.appendChild(li);
  });
  
  document.getElementById('directionsSection').classList.remove('hidden');
  showStatus("Route path computed!", "success");
}

// Reset A* animation timers and path objects
function clearPathAndAnimations() {
  isSearching = false;
  if (animationTimeout) {
    cancelAnimationFrame(animationTimeout);
    clearTimeout(animationTimeout);
    animationTimeout = null;
  }
  
  visualizerGroup.clearLayers();
  
  pathLayers.forEach(layer => map.removeLayer(layer));
  pathLayers = [];
  
  document.getElementById('statsSection').classList.add('hidden');
  document.getElementById('directionsSection').classList.add('hidden');
  document.getElementById('directionsList').innerHTML = '';
}

// Full Clean Reset (Clear Map Button)
function resetAll() {
  clearPathAndAnimations();
  clearStartPoint();
  clearEndPoint();
  
  document.getElementById('statVisited').textContent = "0 nodes";
  document.getElementById('statDistance').textContent = "0.0 km";
  document.getElementById('statTime').textContent = "0 mins";
  
  showStatus("Ready. Choose Start & End points inside the highlighted region.", "info");
}

// Nominatim Geocoding Autocomplete Suggestions
function setupAutocomplete(inputId, dropdownId, setCoordCallback) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  
  const queryNominatim = debounce(async (text) => {
    if (text.length < 3) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      
      renderSuggestions(data);
    } catch (err) {
      console.error("Nominatim search error: ", err);
    }
  }, 350);
  
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
      
      div.innerHTML = `<div><strong>${title}</strong><br><small style="color:var(--text-muted); font-size:11px">${details}</small></div>`;
      
      div.addEventListener('click', () => {
        const latlng = L.latLng(parseFloat(item.lat), parseFloat(item.lon));
        
        // Ensure coordinates are inside central Hanoi loaded region
        if (isWithinBbox(latlng.lat, latlng.lng)) {
          setCoordCallback(latlng, title);
          dropdown.innerHTML = '';
          dropdown.classList.add('hidden');
        } else {
          showStatus(`"${title}" is outside Central Hanoi. Please choose a nearby address within the highlighted region.`, "error");
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
