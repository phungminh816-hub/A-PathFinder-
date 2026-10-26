'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class ClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

function createElement(id) {
  return {
    id,
    checked: id === 'toggleGraph',
    classList: new ClassList(),
    className: '',
    disabled: false,
    innerHTML: '',
    textContent: '',
    value: id === 'routingPreference' ? 'shortest' : id === 'searchSpeed' ? 'instant' : '',
    addEventListener() {},
    append() {}
  };
}

const elements = new Map();
const documentStub = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement(id));
    return elements.get(id);
  },
  createElement() {
    return createElement('dynamic');
  },
  addEventListener() {}
};

function layer() {
  return {
    addTo() { return this; },
    getBounds() { return {}; }
  };
}

const leafletStub = {
  Layer: {
    extend(definition) {
      class ExtendedLayer {
        constructor(options) {
          if (definition.initialize) definition.initialize.call(this, options);
        }
      }
      Object.assign(ExtendedLayer.prototype, definition);
      return ExtendedLayer;
    }
  },
  setOptions() {},
  polyline: layer,
  marker: layer,
  divIcon(options) { return options; },
  latLng(lat, lng) { return { lat, lng }; }
};

const mapStub = {
  fitBounds() {},
  panTo() {},
  removeLayer() {}
};

const context = vm.createContext({
  console,
  document: documentStub,
  L: leafletStub,
  performance,
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  cancelAnimationFrame: clearTimeout,
  setTimeout,
  clearTimeout,
  window: {
    APP_CONFIG: {},
    addEventListener() {}
  }
});

const projectRoot = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(projectRoot, 'My_Map', 'script.js'), 'utf8');
const exposeTestApi = `
  globalThis.testApi = {
    parseOSMData,
    setStartPoint,
    setEndPoint,
    startPathfinding,
    findNearestNode,
    setMap(value) { map = value; },
    get graph() { return graph; },
    get nodeLats() { return nodeLats; },
    get nodeLons() { return nodeLons; },
    get pathLayerCount() { return pathLayers.length; }
  };
`;

vm.runInContext(`${appSource}\n${exposeTestApi}`, context, { filename: 'script.js' });
const api = context.testApi;
api.setMap(mapStub);

const mapData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'My_Map', 'map_data.json'), 'utf8'));
api.parseOSMData(mapData);

const startNode = api.findNearestNode(21.028, 105.83);
const queue = [startNode];
const seen = new Uint8Array(api.graph.length);
seen[startNode] = 1;
let endNode = startNode;
let furthestDistance = 0;

for (let cursor = 0; cursor < queue.length && cursor < 10000; cursor++) {
  const current = queue[cursor];
  const dLat = (api.nodeLats[current] - api.nodeLats[startNode]) * 111132;
  const dLon = (api.nodeLons[current] - api.nodeLons[startNode]) * 103906;
  const distance = Math.hypot(dLat, dLon);
  if (distance > furthestDistance) {
    furthestDistance = distance;
    endNode = current;
  }

  for (const edge of api.graph[current]) {
    if (edge.isRailway || seen[edge.to]) continue;
    seen[edge.to] = 1;
    queue.push(edge.to);
  }
}

if (endNode === startNode || furthestDistance < 500) {
  throw new Error('Không tìm được cặp node đường bộ phù hợp cho smoke test.');
}

api.setStartPoint(leafletStub.latLng(api.nodeLats[startNode], api.nodeLons[startNode]), 'Test start');
api.setEndPoint(leafletStub.latLng(api.nodeLats[endNode], api.nodeLons[endNode]), 'Test end');

const findButton = documentStub.getElementById('findRouteBtn');
if (findButton.disabled) throw new Error('Nút Tìm đường vẫn bị vô hiệu hóa sau khi chọn đủ hai điểm.');

api.startPathfinding();

if (api.pathLayerCount !== 2) throw new Error('Thuật toán không dựng được polyline kết quả.');
if (documentStub.getElementById('statsSection').classList.contains('hidden')) {
  throw new Error('Thống kê tuyến vẫn bị ẩn sau khi tìm đường.');
}
if (!documentStub.getElementById('statDistance').textContent.endsWith('km')) {
  throw new Error('Khoảng cách tuyến không được cập nhật.');
}

console.log(`Pathfinding smoke test passed: ${queue.length} reachable nodes, ${(furthestDistance / 1000).toFixed(2)} km test span.`);

async function runAnimatedSmokeTest() {
  documentStub.getElementById('routingPreference').value = 'traffic';
  documentStub.getElementById('searchSpeed').value = 'animated-fast';
  api.setStartPoint(leafletStub.latLng(api.nodeLats[startNode], api.nodeLons[startNode]), 'Animated start');
  api.setEndPoint(leafletStub.latLng(api.nodeLats[endNode], api.nodeLons[endNode]), 'Animated end');
  api.startPathfinding();

  const deadline = Date.now() + 10000;
  while (api.pathLayerCount !== 2 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  if (api.pathLayerCount !== 2) {
    throw new Error('Chế độ hoạt ảnh không hoàn thành tuyến trong thời gian cho phép.');
  }
  console.log('Animated traffic-aware pathfinding smoke test passed.');
}

runAnimatedSmokeTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
