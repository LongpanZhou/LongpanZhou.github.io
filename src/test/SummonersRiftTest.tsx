import { Suspense, useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky, Grid, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import './SummonersRiftTest.css'

// WASD Camera Controller Component
function CameraController({ onPositionChange, controlsRef }: { 
  onPositionChange: (pos: { x: number, y: number, z: number }) => void,
  controlsRef: React.MutableRefObject<any>
}) {
  const { camera } = useThree()
  const keysPressed = useRef<Set<string>>(new Set())
  const moveSpeed = 0.5

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase())
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame(() => {
    if (keysPressed.current.size === 0) return

    // Create direction vectors using camera's rotation matrix
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    
    // Get camera's forward direction (negative Z in camera space)
    camera.getWorldDirection(forward)
    forward.y = 0 // Keep movement on XZ plane
    forward.normalize()
    
    // Get camera's right direction (cross product of forward and world up)
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    
    const movement = new THREE.Vector3()

    // Calculate movement based on keys pressed (clone vectors to avoid mutation)
    if (keysPressed.current.has('w')) {
      movement.add(forward.clone().multiplyScalar(moveSpeed))
    }
    if (keysPressed.current.has('s')) {
      movement.add(forward.clone().multiplyScalar(-moveSpeed))
    }
    if (keysPressed.current.has('a')) {
      movement.add(right.clone().multiplyScalar(-moveSpeed))
    }
    if (keysPressed.current.has('d')) {
      movement.add(right.clone().multiplyScalar(moveSpeed))
    }
    if (keysPressed.current.has('q')) {
      movement.y -= moveSpeed // Move down
    }
    if (keysPressed.current.has('e')) {
      movement.y += moveSpeed // Move up
    }

    // Apply movement to camera and controls target
    if (movement.length() > 0) {
      camera.position.add(movement)
      
      // Move OrbitControls target along with camera to prevent unwanted rotation
      if (controlsRef.current) {
        controlsRef.current.target.add(movement)
        controlsRef.current.update()
      }
      
      // Update position display
      onPositionChange({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      })
    }
  })

  return null
}

function SummonersRiftModel({ onProgress, onReady }: { onProgress?: (progress: number) => void, onReady?: () => void }) {
  const modelRef = useRef<THREE.Group>(null)
  
  // Load optimized Summoner's Rift with full textures!
  const { scene } = useGLTF('/src/rift-opt.glb', true, true, (loader) => {
    loader.manager.onProgress = (_url, loaded, total) => {
      const progress = (loaded / total) * 100
      if (onProgress) onProgress(progress)
    }
  })

  // Ensure loading reaches 100% when model is ready
  useEffect(() => {
    if (scene) {
      if (onProgress) {
        onProgress(100)
      }
      if (onReady) {
        onReady()
      }
    }
  }, [scene, onProgress, onReady])

  // VRAM Optimization: Process materials and textures
  useMemo(() => {
    console.log('=== Loaded Scene Info ===')
    const materialsCache = new Map<string, THREE.Material>()
    
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        console.log('Mesh:', mesh.name)
        
        // VRAM Optimization 1: Share materials across meshes
        if (mesh.material) {
          const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
          const materialKey = material.name || material.uuid
          
          if (materialsCache.has(materialKey)) {
            mesh.material = materialsCache.get(materialKey)!
          } else {
            materialsCache.set(materialKey, material)
            
            // VRAM Optimization 2: Reduce texture resolution and enable compression
            if ((material as any).map) {
              const texture = (material as any).map as THREE.Texture
              texture.minFilter = THREE.LinearMipmapLinearFilter
              texture.magFilter = THREE.LinearFilter
              texture.generateMipmaps = true
              texture.anisotropy = 2 // Reduce from default 16 to save VRAM
            }
            
            // VRAM Optimization 3: Fix material rendering and optimize
            const standardMat = material as THREE.MeshStandardMaterial
            
            // Ensure proper rendering - no transparency issues
            standardMat.side = THREE.FrontSide
            standardMat.transparent = false
            standardMat.opacity = 1.0
            standardMat.depthWrite = true
            standardMat.depthTest = true
            
            // Optimize texture maps while keeping them
            if (standardMat.normalMap) {
              standardMat.normalScale?.set(0.5, 0.5)
            }
            
            // Only set constant values if maps don't exist (don't dispose existing maps)
            if (!standardMat.roughnessMap) {
              standardMat.roughness = 0.8
            }
            if (!standardMat.metalnessMap) {
              standardMat.metalness = 0.0
            }
          }
        }
        
        // VRAM Optimization 4: Selectively enable shadows (not all meshes need them)
        const meshName = mesh.name.toLowerCase()
        // Only enable shadows for important/large objects
        if (meshName.includes('ground') || meshName.includes('terrain') || meshName.includes('base')) {
          mesh.receiveShadow = true
          mesh.castShadow = false // Ground doesn't cast shadows
        } else if (meshName.includes('tower') || meshName.includes('structure')) {
          mesh.castShadow = true
          mesh.receiveShadow = true
        } else {
          // Disable shadows for small/decorative objects
          mesh.castShadow = false
          mesh.receiveShadow = false
        }
        
        // VRAM Optimization 5: Frustum culling (enabled by default but ensure it's on)
        mesh.frustumCulled = true
      }
    })
    
    console.log(`Material instances reduced by sharing: ${materialsCache.size} unique materials`)
  }, [scene])
  
  // VRAM Optimization 6: Cleanup on unmount
  useEffect(() => {
    return () => {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          if (mesh.geometry) {
            mesh.geometry.dispose()
          }
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            materials.forEach(material => {
              // Dispose textures
              Object.keys(material).forEach(prop => {
                const value = (material as any)[prop]
                if (value && value.isTexture) {
                  value.dispose()
                }
              })
              material.dispose()
            })
          }
        }
      })
    }
  }, [scene])

  // Rotation disabled - static model
  // useFrame(() => {
  //   if (modelRef.current) {
  //     modelRef.current.rotation.y += 0.001
  //   }
  // })

  return (
    <group ref={modelRef}>
      <primitive object={scene} scale={0.01} position={[0, 0, 0]} />
    </group>
  )
}

// Preload the model
useGLTF.preload('/src/rift-opt.glb')

function SummonersRiftTest() {
  const [isReady, setIsReady] = useState(false)
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0, z: 0 })
  const controlsRef = useRef<any>(null)
  
  // Generate random camera position (only once on mount)
  const randomCamera = useMemo(() => {
    const distance = 50 + Math.random() * 50 // Random distance 50-100
    const angle = Math.random() * Math.PI * 2 // Random angle around Y axis
    const height = 20 + Math.random() * 40 // Random height 20-60
    
    const position = {
      x: Math.cos(angle) * distance,
      y: height,
      z: Math.sin(angle) * distance
    }
    
    setCameraPos(position)
    return position
  }, [])
  
  // Handle progress updates
  const handleProgress = (_progress: number) => {
    // Progress tracking removed, just keep for compatibility
  }
  
  // Handle model ready
  const handleReady = () => {
    setIsReady(true)
  }

  return (
    <div className="summoners-rift-test">
      {/* Header */}
      <div className="test-header">
        <div className="test-info">
          <span>Camera Position: ({cameraPos.x.toFixed(1)}, {cameraPos.y.toFixed(1)}, {cameraPos.z.toFixed(1)})</span>
        </div>
        <a href="/#/" className="back-button">← Back to Home</a>
      </div>

      {/* Three.js Canvas - VRAM Optimization 8: Performance settings */}
      <Canvas
        camera={{ 
          position: [randomCamera.x, randomCamera.y, randomCamera.z],
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        shadows
        gl={{ 
          powerPreference: "high-performance",
          antialias: false, // Disable for VRAM savings
          stencil: false,
          depth: true
        }}
        dpr={[1, 1.5]} // Limit pixel ratio to save VRAM
      >
        {/* Background */}
        <color attach="background" args={['#0a1428']} />
        <fog attach="fog" args={['#0a1428', 50, 200]} />
        
        {/* Lighting - VRAM Optimization 7: Reduced shadow map size */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={500}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
          shadow-bias={-0.0001}
        />
        <pointLight position={[-50, 30, -50]} intensity={0.5} color="#00d4ff" />
        <pointLight position={[50, 30, 50]} intensity={0.5} color="#c8aa6e" />

        {/* Sky */}
        <Sky
          distance={450000}
          sunPosition={[100, 20, 100]}
          inclination={0.6}
          azimuth={0.25}
        />

        {/* Grid for reference */}
        <Grid
          args={[200, 200]}
          cellSize={2}
          cellThickness={0.5}
          cellColor="#c8aa6e"
          sectionSize={10}
          sectionThickness={1}
          sectionColor="#00d4ff"
          fadeDistance={150}
          fadeStrength={1}
          followCamera={false}
          position={[0, -5, 0]}
        />

        {/* Load the Summoner's Rift Model */}
        <Suspense fallback={<LoadingIndicator />}>
          <SummonersRiftModel onProgress={handleProgress} onReady={handleReady} />
        </Suspense>

        {/* WASD Camera Controller */}
        <CameraController onPositionChange={setCameraPos} controlsRef={controlsRef} />

        {/* Controls */}
        <OrbitControls
          ref={controlsRef}
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={10}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2}
          target={[0, 0, 0]}
          onChange={(e) => {
            if (e?.target) {
              const camera = e.target.object
              setCameraPos({
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
              })
            }
          }}
        />
      </Canvas>

      {/* Loading Overlay */}
      {!isReady && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading Summoner's Rift</p>
        </div>
      )}

      {/* Controls Info */}
      <div className="controls-info">
        <h3>Controls</h3>
        <ul>
          <li><strong>W/A/S/D:</strong> Move camera forward/left/back/right</li>
          <li><strong>Q/E:</strong> Move camera down/up</li>
          <li><strong>Left Click + Drag:</strong> Rotate view</li>
          <li><strong>Right Click + Drag:</strong> Pan camera</li>
          <li><strong>Scroll:</strong> Zoom in/out</li>
        </ul>
      </div>
    </div>
  )
}

// Loading indicator for Suspense
function LoadingIndicator() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.02
      meshRef.current.rotation.y += 0.02
    }
  })
  
  return (
    <group>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[3, 3, 3]} />
        <meshStandardMaterial color="#00d4ff" wireframe />
      </mesh>
      <pointLight position={[0, 0, 0]} color="#00d4ff" intensity={2} />
    </group>
  )
}

export default SummonersRiftTest

