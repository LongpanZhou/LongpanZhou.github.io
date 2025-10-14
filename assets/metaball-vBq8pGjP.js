var r=document.createElement("canvas");document.body.appendChild(r);var m;r.width=window.innerWidth;r.height=window.innerHeight;const H=(()=>{const e=(n=!1)=>{const i=document.createElement("canvas").getContext("2d",{willReadFrequently:n});return i.moveTo(0,0),i.lineTo(120,121),i.stroke(),i.getImageData(0,0,200,200).data.join()};return e(!0)!==e(!1)})();H||alert("Your browser does not have hardware acceleration turned on, please turn on hardware acceleration for a better experience.");function w(){var e=r.getContext("webgl")||r.getContext("experimental-webgl");e.viewport(0,0,r.width,r.height);for(var n=15+parseInt((r.width+r.width)/128),c=[],i=(r.width+r.height)/96,x=(r.width+r.height)/48,s=0;s<n;s++){var h=Math.random()*(x-i)+i;c.push({x:Math.random()*(r.width-2*h)+h,y:Math.random()*(r.height-2*h)+h,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,r:h})}var y=`
  attribute vec2 position;

  void main() {
  // position specifies only x and y.
  // We set z to be 0.0, and w to be 1.0
  gl_Position = vec4(position, 0.0, 1.0);
  }
  `,S=`
  precision highp float;

  const float WIDTH = `+(r.width>>0)+`.0;
  const float HEIGHT = `+(r.height>>0)+`.0;

  uniform vec3 metaballs[`+n+`];

  void main(){
  float x = gl_FragCoord.x;
  float y = gl_FragCoord.y;

  float sum = 0.0;
  for (int i = 0; i < `+n+`; i++) {
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

  `,A=g(y,e.VERTEX_SHADER),p=g(S,e.FRAGMENT_SHADER),d=e.createProgram();e.attachShader(d,A),e.attachShader(d,p),e.linkProgram(d),e.useProgram(d);var T=new Float32Array([-1,1,-1,-1,1,1,1,-1]),R=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,R),e.bufferData(e.ARRAY_BUFFER,T,e.STATIC_DRAW);var u=C(d,"position");e.enableVertexAttribArray(u),e.vertexAttribPointer(u,2,e.FLOAT,e.FALSE,2*4,0);var E=F(d,"metaballs");l();function l(){for(var a=0;a<n;a++){var t=c[a];t.x+=t.vx,t.y+=t.vy,(t.x<t.r||t.x>r.width-t.r)&&(t.vx*=-1),(t.y<t.r||t.y>r.height-t.r)&&(t.vy*=-1)}for(var o=new Float32Array(3*n),a=0;a<n;a++){var v=3*a,f=c[a];o[v+0]=f.x,o[v+1]=f.y,o[v+2]=f.r}e.uniform3fv(E,o),e.drawArrays(e.TRIANGLE_STRIP,0,4),requestAnimationFrame(l)}function g(a,t){var o=e.createShader(t);if(e.shaderSource(o,a),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS))throw"Shader compile failed with: "+e.getShaderInfoLog(o);return o}function F(a,t){var o=e.getUniformLocation(a,t);if(o===-1)throw"Can not find uniform "+t+".";return o}function C(a,t){var o=e.getAttribLocation(a,t);if(o===-1)throw"Can not find attribute "+t+".";return o}r.onmousemove=function(a){a.clientX,a.clientY}}function L(){clearTimeout(m),m=setTimeout(()=>{r.width=window.innerWidth,r.height=window.innerHeight,w()},200)}w();window.addEventListener("resize",L);
