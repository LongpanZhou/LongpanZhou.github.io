var animationFrameId = null;
var debounceTimeout;
var currentGl = null;
var currentProgram = null;
var currentVertexShader = null;
var currentFragmentShader = null;
var currentVertexBuffer = null;

const hasHWA = (() => {
  const test = (force=false) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: force });
    ctx.moveTo(0, 0),
    ctx.lineTo(120, 121);
    ctx.stroke();
    return ctx.getImageData(0, 0, 200, 200).data.join();
  };
  return test(true) !== test(false);
})();

export function initMetaball(canvas) {
  if (!hasHWA) {
    console.warn("Hardware acceleration not detected. Metaball effect may perform poorly.");
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Clean up previous resources
  cleanup();

  setCanvasSize(canvas);

  function rerender() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cleanup();
      setCanvasSize(canvas);
    }, 200);
  }

  window._metaballRerender = rerender;
  window.addEventListener('resize', rerender);
}

function cleanup() {
  if (animationFrameId != null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (currentGl && currentProgram) {
    if (currentVertexShader) currentGl.deleteShader(currentVertexShader);
    if (currentFragmentShader) currentGl.deleteShader(currentFragmentShader);
    if (currentVertexBuffer) currentGl.deleteBuffer(currentVertexBuffer);
    currentGl.deleteProgram(currentProgram);
  }
  currentGl = null;
  currentProgram = null;
  currentVertexShader = null;
  currentFragmentShader = null;
  currentVertexBuffer = null;
}

export function destroyMetaball() {
  cleanup();
  clearTimeout(debounceTimeout);
  if (window._metaballRerender) {
    window.removeEventListener('resize', window._metaballRerender);
    delete window._metaballRerender;
  }
}

function setCanvasSize(canvas) {
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  gl.viewport(0, 0, canvas.width, canvas.height);

  var numMetaballs = 15 + parseInt((canvas.width + canvas.height)/128);
  var metaballs = [];

  var minRadius = (canvas.width + canvas.height) / 96;
  var maxRadius = (canvas.width + canvas.height) / 48;

  for (var i = 0; i < numMetaballs; i++) {
    var radius = Math.random() * (maxRadius - minRadius) + minRadius;
    metaballs.push({
      x: Math.random() * (canvas.width - 2 * radius) + radius,
      y: Math.random() * (canvas.height - 2 * radius) + radius,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      r: radius
    });
  }

  var vertexShaderSrc = `
  attribute vec2 position;

  void main() {
  gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  var fragmentShaderSrc = `
  precision mediump float;

  const float WIDTH = ` + (canvas.width >> 0) + `.0;
  const float HEIGHT = ` + (canvas.height >> 0) + `.0;

  uniform vec3 metaballs[` + numMetaballs + `];

  void main(){
  float x = gl_FragCoord.x;
  float y = gl_FragCoord.y;

  float sum = 0.0;
  for (int i = 0; i < ` + numMetaballs + `; i++) {
  vec3 metaball = metaballs[i];
  float dx = metaball.x - x;
  float dy = metaball.y - y;
  float radius = metaball.z;

  sum += (radius * radius) / (dx * dx + dy * dy);
  }

  if (sum >= 0.99) {
  gl_FragColor = vec4(mix(vec3(x / WIDTH, y / HEIGHT, 1.0), vec3(1.0, 1.0, 1.0), max(0.0, 1.0 - (sum - 0.99) * 100.0)), 1.0);
  return;
  }

  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }

  `;

  var vertexShader = compileShader(gl, vertexShaderSrc, gl.VERTEX_SHADER);
  var fragmentShader = compileShader(gl, fragmentShaderSrc, gl.FRAGMENT_SHADER);

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  var vertexData = new Float32Array([
    -1.0,  1.0,
    -1.0, -1.0,
    1.0,  1.0,
    1.0, -1.0,
  ]);
  var vertexDataBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  var positionHandle = getAttribLocation(gl, program, 'position');
  gl.enableVertexAttribArray(positionHandle);
  gl.vertexAttribPointer(positionHandle, 2, gl.FLOAT, gl.FALSE, 2 * 4, 0);

  var metaballsHandle = getUniformLocation(gl, program, 'metaballs');

  // Store references for cleanup
  currentGl = gl;
  currentProgram = program;
  currentVertexShader = vertexShader;
  currentFragmentShader = fragmentShader;
  currentVertexBuffer = vertexDataBuffer;

  // Pre-allocate the GPU data array once
  var dataToSendToGPU = new Float32Array(3 * numMetaballs);

  loop();
  function loop() {
    for (var i = 0; i < numMetaballs; i++) {
      var metaball = metaballs[i];
      metaball.x += metaball.vx;
      metaball.y += metaball.vy;

      if (metaball.x < metaball.r || metaball.x > canvas.width - metaball.r) metaball.vx *= -1;
      if (metaball.y < metaball.r || metaball.y > canvas.height - metaball.r) metaball.vy *= -1;
    }

    for (var i = 0; i < numMetaballs; i++) {
      var baseIndex = 3 * i;
      var mb = metaballs[i];
      dataToSendToGPU[baseIndex + 0] = mb.x;
      dataToSendToGPU[baseIndex + 1] = mb.y;
      dataToSendToGPU[baseIndex + 2] = mb.r;
    }
    gl.uniform3fv(metaballsHandle, dataToSendToGPU);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animationFrameId = requestAnimationFrame(loop);
  }

  function compileShader(gl, shaderSource, shaderType) {
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
    }

    return shader;
  }

  function getUniformLocation(gl, program, name) {
    var uniformLocation = gl.getUniformLocation(program, name);
    if (uniformLocation === -1) {
      throw 'Can not find uniform ' + name + '.';
    }
    return uniformLocation;
  }

  function getAttribLocation(gl, program, name) {
    var attributeLocation = gl.getAttribLocation(program, name);
    if (attributeLocation === -1) {
      throw 'Can not find attribute ' + name + '.';
    }
    return attributeLocation;
  }
}
