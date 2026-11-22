// ONNX Runtime Web YOLO11 client-side object detection engine for Hulu Guard

import { getModelRecord, saveModelBuffer } from './storage.js';

export const YOLO_INPUT_SIZE = 640;

export const WASTE_CLASSES = [
  { id: 'plastic_bottle', label: 'Botol Plastik', weightKg: 0.028, color: '#2E7D32' },
  { id: 'plastic_packaging', label: 'Kemasan Plastik', weightKg: 0.012, color: '#D97706' },
  { id: 'glass_bottle', label: 'Botol Kaca', weightKg: 0.250, color: '#0284C7' },
  { id: 'glass_waste', label: 'Sampah Kaca', weightKg: 0.120, color: '#0EA5E9' },
  { id: 'metal_can', label: 'Kaleng Logam', weightKg: 0.018, color: '#DC2626' },
  { id: 'other_waste', label: 'Sampah Lainnya', weightKg: 0.030, color: '#7C3AED' },
  { id: 'Plastic', label: 'Plastik', weightKg: 0.015, color: '#16A34A' },
  { id: 'Carton_packaging', label: 'Kemasan Karton', weightKg: 0.035, color: '#B45309' }
];

let cachedSession = null;
let cachedSource = null;

export function getClassMeta(classIndexOrId) {
  if (typeof classIndexOrId === 'number') {
    return WASTE_CLASSES[classIndexOrId] || {
      id: `class_${classIndexOrId}`,
      label: `Item #${classIndexOrId}`,
      weightKg: 0.02,
      color: '#1B3B2B'
    };
  }
  return WASTE_CLASSES.find((c) => c.id === classIndexOrId) || {
    id: String(classIndexOrId),
    label: String(classIndexOrId),
    weightKg: 0.02,
    color: '#1B3B2B'
  };
}

export async function getModelStatus() {
  if (cachedSession) {
    return { ready: true, source: cachedSource };
  }
  const idbModel = await getModelRecord();
  if (idbModel && idbModel.buffer) {
    return {
      ready: true,
      source: 'indexeddb',
      name: idbModel.name || 'yolo11_huluguard.onnx',
      sizeMb: (idbModel.byteLength / (1024 * 1024)).toFixed(2)
    };
  }
  try {
    const res = await fetch('./models/yolo11_huluguard.onnx', { method: 'HEAD' });
    if (res.ok) {
      return { ready: true, source: 'bundled', name: 'yolo11_huluguard.onnx' };
    }
  } catch {
    // Not bundled
  }
  return { ready: false, source: 'missing' };
}

export async function importOnnxFile(file) {
  const buffer = await file.arrayBuffer();
  await saveModelBuffer(file.name || 'yolo11_huluguard.onnx', buffer);
  cachedSession = null;
  cachedSource = null;
  return loadYoloSession();
}

export async function loadYoloSession() {
  if (!window.ort) {
    return {
      session: null,
      error: 'ONNX Runtime Web (ort) belum termuat. Hubungkan ke internet sekali untuk caching offline.'
    };
  }

  if (cachedSession) {
    return { session: cachedSession, source: cachedSource };
  }

  // Configure WASM paths cleanly
  if (window.ort.env && window.ort.env.wasm) {
    window.ort.env.wasm.numThreads = 1;
    window.ort.env.wasm.simd = true;
  }

  try {
    // 1. Check IndexedDB cached user-provided or previously cached ONNX model
    const idbModel = await getModelRecord();
    if (idbModel && idbModel.buffer) {
      cachedSession = await window.ort.InferenceSession.create(idbModel.buffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      cachedSource = 'indexeddb';
      return { session: cachedSession, source: cachedSource };
    }

    // 2. Fetch bundled ./models/yolo11_huluguard.onnx
    const response = await fetch('./models/yolo11_huluguard.onnx');
    if (!response.ok) {
      return {
        session: null,
        error: 'File model models/yolo11_huluguard.onnx belum tersedia. Muat file .onnx atau verifikasi jumlah manual.'
      };
    }
    const buffer = await response.arrayBuffer();
    await saveModelBuffer('yolo11_huluguard.onnx', buffer);
    cachedSession = await window.ort.InferenceSession.create(buffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    cachedSource = 'bundled';
    return { session: cachedSession, source: cachedSource };
  } catch (err) {
    return {
      session: null,
      error: `Gagal memuat model ONNX: ${err?.message || err}`
    };
  }
}

/**
 * Letterbox preprocess an HTMLImageElement onto 640x640 RGB NCHW Float32 tensor.
 */
function preprocessImage(img, targetSize = YOLO_INPUT_SIZE) {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  const scale = Math.min(targetSize / origW, targetSize / origH);
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const padX = Math.floor((targetSize - newW) / 2);
  const padY = Math.floor((targetSize - newH) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#727272';
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.drawImage(img, 0, 0, origW, origH, padX, padY, newW, newH);

  const { data } = ctx.getImageData(0, 0, targetSize, targetSize);
  const planeSize = targetSize * targetSize;
  const floatData = new Float32Array(3 * planeSize);

  for (let i = 0; i < planeSize; i++) {
    const px = i * 4;
    floatData[i] = data[px] / 255.0; // R
    floatData[planeSize + i] = data[px + 1] / 255.0; // G
    floatData[2 * planeSize + i] = data[px + 2] / 255.0; // B
  }

  const tensor = new window.ort.Tensor('float32', floatData, [1, 3, targetSize, targetSize]);
  return { tensor, scale, padX, padY, origW, origH };
}

function computeIoU(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (interArea <= 0) return 0;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  return interArea / (areaA + areaB - interArea + 1e-6);
}

function nonMaxSuppression(boxes, iouThreshold = 0.45) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const selected = [];
  while (sorted.length > 0) {
    const current = sorted.shift();
    selected.push(current);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (computeIoU(current, sorted[i]) >= iouThreshold) {
        sorted.splice(i, 1);
      }
    }
  }
  return selected;
}

/**
 * Decode YOLO11 output tensor: supports [1, 4+C, N] (standard Ultralytics) or [1, N, 4+C]
 */
function decodeYoloOutput(outputTensor, meta, confThreshold = 0.25, iouThreshold = 0.45) {
  const { dims, data } = outputTensor;
  if (!dims || dims.length < 3) return [];

  const dim1 = dims[1];
  const dim2 = dims[2];
  const expectedChannels = 4 + WASTE_CLASSES.length;

  let numBoxes = 0;
  let numAttrs = 0;
  let transposed = false;

  if (dim1 <= 64 && dim2 > dim1) {
    // [1, 4+C, 8400]
    numAttrs = dim1;
    numBoxes = dim2;
    transposed = false;
  } else {
    // [1, 8400, 4+C]
    numBoxes = dim1;
    numAttrs = dim2;
    transposed = true;
  }

  const numClasses = Math.max(1, numAttrs - 4);
  const candidates = [];

  for (let i = 0; i < numBoxes; i++) {
    let cx, cy, w, h;
    if (!transposed) {
      cx = data[0 * numBoxes + i];
      cy = data[1 * numBoxes + i];
      w = data[2 * numBoxes + i];
      h = data[3 * numBoxes + i];
    } else {
      const base = i * numAttrs;
      cx = data[base];
      cy = data[base + 1];
      w = data[base + 2];
      h = data[base + 3];
    }

    let bestClass = 0;
    let bestScore = -1;
    for (let c = 0; c < numClasses; c++) {
      const score = !transposed
        ? data[(4 + c) * numBoxes + i]
        : data[i * numAttrs + 4 + c];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (bestScore < confThreshold) continue;

    // Handle normalized [0..1] vs pixel [0..640] coordinates
    const scaleFactor = cx <= 1.5 && cy <= 1.5 && w <= 1.5 && h <= 1.5 ? YOLO_INPUT_SIZE : 1;
    const x1Net = cx * scaleFactor - (w * scaleFactor) / 2;
    const y1Net = cy * scaleFactor - (h * scaleFactor) / 2;
    const x2Net = cx * scaleFactor + (w * scaleFactor) / 2;
    const y2Net = cy * scaleFactor + (h * scaleFactor) / 2;

    const x1 = Math.max(0, (x1Net - meta.padX) / meta.scale);
    const y1 = Math.max(0, (y1Net - meta.padY) / meta.scale);
    const x2 = Math.min(meta.origW, (x2Net - meta.padX) / meta.scale);
    const y2 = Math.min(meta.origH, (y2Net - meta.padY) / meta.scale);

    if (x2 - x1 < 4 || y2 - y1 < 4) continue;

    const classMeta = getClassMeta(bestClass < expectedChannels - 4 ? bestClass : 0);
    candidates.push({
      x1,
      y1,
      x2,
      y2,
      score: bestScore,
      classIndex: bestClass,
      classId: classMeta.id,
      label: classMeta.label,
      color: classMeta.color
    });
  }

  return nonMaxSuppression(candidates, iouThreshold);
}

export async function runYoloDetection(imageElement, confThreshold = 0.25) {
  const { session, source, error } = await loadYoloSession();
  if (!session) {
    return {
      ok: false,
      modelReady: false,
      error,
      detections: [],
      inferenceMs: 0
    };
  }

  const start = performance.now();
  const meta = preprocessImage(imageElement, YOLO_INPUT_SIZE);
  const inputName = session.inputNames[0];
  const outputs = await session.run({ [inputName]: meta.tensor });
  const outputName = session.outputNames[0];
  const detections = decodeYoloOutput(outputs[outputName], meta, confThreshold, 0.45);
  const inferenceMs = Math.round(performance.now() - start);

  return {
    ok: true,
    modelReady: true,
    source,
    detections,
    inferenceMs
  };
}

export function drawDetectionsOnCanvas(canvas, imageElement, detections = []) {
  if (!canvas || !imageElement) return;
  const w = imageElement.naturalWidth || imageElement.width || 640;
  const h = imageElement.naturalHeight || imageElement.height || 640;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(imageElement, 0, 0, w, h);

  const lineWidth = Math.max(2.5, Math.round(w / 220));
  const fontSize = Math.max(13, Math.round(w / 38));
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;

  for (const det of detections) {
    const bw = det.x2 - det.x1;
    const bh = det.y2 - det.y1;

    // Bounding box
    ctx.strokeStyle = det.color || '#C5E898';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(det.x1, det.y1, bw, bh, 8);
    } else {
      ctx.rect(det.x1, det.y1, bw, bh);
    }
    ctx.stroke();

    // Subtle fill highlight
    ctx.fillStyle = `${det.color || '#1B3B2B'}22`;
    ctx.fill();

    // Label pill
    const pct = Math.round(det.score * 100);
    const text = `${det.classId} ${pct}%`;
    const metrics = ctx.measureText(text);
    const padX = 8;
    const pillH = fontSize + 10;
    const pillW = metrics.width + padX * 2;
    const pillX = Math.max(2, Math.min(det.x1, w - pillW - 2));
    const pillY = det.y1 > pillH + 4 ? det.y1 - pillH - 2 : det.y1 + 2;

    ctx.fillStyle = det.color || '#1B3B2B';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pillX, pillY, pillW, pillH, 6);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pillX + padX, pillY + pillH / 2 + 1);
  }
}

export function buildClassCounts(detections = [], overrides = {}) {
  const counts = {};
  for (const cls of WASTE_CLASSES) {
    counts[cls.id] = 0;
  }
  for (const det of detections) {
    if (det.classId in counts) {
      counts[det.classId] += 1;
    } else {
      counts.other_waste += 1;
    }
  }
  // Apply manual +/- adjustments
  for (const [key, val] of Object.entries(overrides)) {
    if (key in counts) {
      counts[key] = Math.max(0, Number(val) || 0);
    }
  }
  return counts;
}

export function calculateTotals(counts) {
  let totalItems = 0;
  let totalWeightKg = 0;
  for (const cls of WASTE_CLASSES) {
    const qty = Number(counts[cls.id]) || 0;
    totalItems += qty;
    totalWeightKg += qty * cls.weightKg;
  }
  return {
    totalItems,
    totalWeightKg: Number(totalWeightKg.toFixed(3))
  };
}
