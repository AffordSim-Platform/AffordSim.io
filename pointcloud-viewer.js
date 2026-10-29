/* Lightweight, local WebGL point-cloud viewer. The input is a packed stream of
 * little-endian float32 x/y/z followed by uint8 r/g/b (15 bytes per point). */
(() => {
  'use strict';
  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform vec2 uOrbit;
    uniform float uDistance;
    uniform float uAspect;
    uniform float uPixelRatio;
    varying vec3 vColor;
    void main() {
      float cy = cos(uOrbit.x), sy = sin(uOrbit.x);
      float cp = cos(uOrbit.y), sp = sin(uOrbit.y);
      vec3 p = vec3(cy * aPosition.x + sy * aPosition.z, aPosition.y,
                    -sy * aPosition.x + cy * aPosition.z);
      p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
      float depth = uDistance - p.z;
      float nearPlane = 0.08, farPlane = 16.0;
      float clipZ = (2.0 * (depth - nearPlane) / (farPlane - nearPlane) - 1.0) * depth;
      gl_Position = vec4(p.x * 2.1 / uAspect, p.y * 2.1, clipZ, depth);
      gl_PointSize = clamp(2.5 * uPixelRatio * 3.2 / depth, 1.0, 7.0 * uPixelRatio);
      vColor = aColor;
    }`;
  const fragmentShader = `
    precision mediump float;
    varying vec3 vColor;
    void main() {
      vec2 d = gl_PointCoord - vec2(0.5);
      if (dot(d, d) > 0.25) discard;
      gl_FragColor = vec4(vColor, 1.0);
    }`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const reason = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`WebGL shader failed: ${reason}`);
    }
    return shader;
  }

  function decode(buffer) {
    if (buffer.byteLength % 15 !== 0 || !buffer.byteLength) {
      throw new Error('Invalid point-cloud data.');
    }
    const view = new DataView(buffer);
    const total = buffer.byteLength / 15;
    // Use a bounded sample to estimate a useful view without a few distant
    // reconstruction outliers shrinking the rest of the scene.
    const step = Math.max(1, Math.ceil(total / 40000));
    const xs = [], ys = [], zs = [];
    for (let i = 0; i < total; i += step) {
      const p = i * 15;
      const x = view.getFloat32(p, true), y = view.getFloat32(p + 4, true), z = view.getFloat32(p + 8, true);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) { xs.push(x); ys.push(y); zs.push(z); }
    }
    if (!xs.length) throw new Error('Point cloud contains no valid positions.');
    const bounds = [xs, ys, zs].map(values => {
      values.sort((a, b) => a - b);
      return [values[Math.floor((values.length - 1) * 0.01)], values[Math.floor((values.length - 1) * 0.99)]];
    });
    const center = bounds.map(([lo, hi]) => (lo + hi) / 2);
    const radius = Math.max(...bounds.map(([lo, hi]) => (hi - lo) / 2), 1e-8);
    const positions = new Float32Array(total * 3), colors = new Uint8Array(total * 3);
    let count = 0;
    for (let i = 0; i < total; i++) {
      const p = i * 15;
      const x = (view.getFloat32(p, true) - center[0]) / radius;
      const y = (view.getFloat32(p + 4, true) - center[1]) / radius;
      const z = (view.getFloat32(p + 8, true) - center[2]) / radius;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) ||
          Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 2) continue;
      positions.set([x, y, z], count * 3);
      colors.set([view.getUint8(p + 12), view.getUint8(p + 13), view.getUint8(p + 14)], count * 3);
      count++;
    }
    if (!count) throw new Error('Point cloud contains no displayable points.');
    return { positions: positions.subarray(0, count * 3), colors: colors.subarray(0, count * 3), count };
  }

  // Browsers block fetch(file://...) even when both files are local. A local
  // script can load normally, so use byte-identical encoded data in that case.
  // Hosted pages continue to fetch the compact binary assets directly.
  function loadPointCloud(container) {
    const path = container.dataset.pointcloud;
    if (window.location.protocol !== 'file:') {
      return fetch(path).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      });
    }
    return new Promise((resolve, reject) => {
      const scene = container.dataset.scene;
      const script = document.createElement('script');
      script.src = `${path}.js`;
      script.onload = () => {
        try {
          const encoded = window.AFFORDSIM_LOCAL_POINTCLOUDS?.[scene];
          if (typeof encoded !== 'string') throw new Error('Local point-cloud data is missing.');
          const binary = atob(encoded);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          delete window.AFFORDSIM_LOCAL_POINTCLOUDS[scene];
          resolve(bytes.buffer);
        } catch (error) { reject(error); }
        finally { script.remove(); }
      };
      script.onerror = () => { script.remove(); reject(new Error('Local point-cloud script failed to load.')); };
      document.head.appendChild(script);
    });
  }

  function makeViewer(container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'pointcloud-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${container.getAttribute('aria-label') || 'Reconstructed point cloud'}. Drag or use arrow keys to rotate; scroll or use plus and minus to zoom.`);
    const status = document.createElement('div');
    status.className = 'pointcloud-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading reconstructed point cloud…';
    const hint = document.createElement('div');
    hint.className = 'pointcloud-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Drag to rotate · scroll to zoom';
    hint.hidden = true;
    container.append(canvas, status, hint);
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false });
    if (!gl) { status.textContent = 'Your browser cannot display the point cloud.'; return; }
    let program, positionBuffer, colorBuffer, points = 0, orbit = [-0.65, 0.35], distance = 3.4;
    let pendingFrame = false;
    const pointers = new Map();
    let pinchDistance = null;
    const invalidate = () => {
      if (pendingFrame || !points) return;
      pendingFrame = true;
      requestAnimationFrame(() => { pendingFrame = false; draw(); });
    };
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0.055, 0.085, 0.11, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(program);
      gl.uniform2f(gl.getUniformLocation(program, 'uOrbit'), ...orbit);
      gl.uniform1f(gl.getUniformLocation(program, 'uDistance'), distance);
      gl.uniform1f(gl.getUniformLocation(program, 'uAspect'), width / height);
      gl.uniform1f(gl.getUniformLocation(program, 'uPixelRatio'), dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      const color = gl.getAttribLocation(program, 'aColor');
      gl.enableVertexAttribArray(color);
      gl.vertexAttribPointer(color, 3, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.drawArrays(gl.POINTS, 0, points);
    };
    const limitPitch = n => Math.max(-1.55, Math.min(1.55, n));
    const limitDistance = n => Math.max(1.45, Math.min(8, n));
    canvas.addEventListener('pointerdown', event => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      pinchDistance = null;
    });
    canvas.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) { orbit[0] += dx * 0.009; orbit[1] = limitPitch(orbit[1] + dy * 0.009); }
      else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const next = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance !== null && next > 0) distance = limitDistance(distance * pinchDistance / next);
        pinchDistance = next;
      }
      invalidate();
    });
    const endPointer = event => { pointers.delete(event.pointerId); pinchDistance = null; };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      distance = limitDistance(distance * Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.002));
      invalidate();
    }, { passive: false });
    canvas.addEventListener('keydown', event => {
      let handled = true;
      if (event.key === 'ArrowLeft') orbit[0] -= 0.12;
      else if (event.key === 'ArrowRight') orbit[0] += 0.12;
      else if (event.key === 'ArrowUp') orbit[1] = limitPitch(orbit[1] - 0.12);
      else if (event.key === 'ArrowDown') orbit[1] = limitPitch(orbit[1] + 0.12);
      else if (event.key === '+' || event.key === '=') distance = limitDistance(distance * 0.9);
      else if (event.key === '-') distance = limitDistance(distance * 1.1);
      else if (event.key === 'Home') { orbit = [-0.65, 0.35]; distance = 3.4; }
      else handled = false;
      if (handled) { event.preventDefault(); invalidate(); }
    });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(invalidate).observe(container);
    else window.addEventListener('resize', invalidate);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      status.hidden = false;
      status.textContent = 'The point-cloud viewer was interrupted. Reload to try again.';
    });
    loadPointCloud(container)
      .then(buffer => {
        const data = decode(buffer);
        const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
        const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
        program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.STATIC_DRAW);
        points = data.count;
        status.hidden = true;
        hint.hidden = false;
        container.dataset.pointCount = String(points);
        invalidate();
      })
      .catch(error => {
        console.error('Could not load reconstructed point cloud:', error);
        status.textContent = 'Reconstructed point cloud is unavailable.';
      });
  }
  const initialize = () => document.querySelectorAll('.pointcloud-viewer[data-pointcloud]').forEach(makeViewer);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
