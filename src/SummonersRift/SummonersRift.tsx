import { Suspense, useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky, Grid, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import './SummonersRift.css'
import Email from '../profile/icons/gmail.svg'
import Linkedin from '../profile/icons/linkedin.svg'
import Github from '../profile/icons/github.svg'
import Leetcode from '../profile/icons/leetcode.svg'
import { isMobile } from '../utils/isMobile'

// Music Player Component
function MusicPlayer({ onUserInteraction }: { onUserInteraction?: boolean }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.6)
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasStartedRef = useRef(false)

  // Playlist with weights
const playlist = [
  {
    title: 'Fade Away',
    artist: 'Jay Chou',
    audioSrc: '/music/ Jay Chou Fade AwayOfficial MV.mp3',
    weight: 0.6
  },
  {
    title: 'Lucid Dreams',
    artist: 'Juice WRLD',
    audioSrc: '/music/Juice WRLD - Lucid Dreams Official Music Video.mp3',
    weight: 0.2
  },
  {
    title: 'SKAI ISYOURGOD',
    artist: 'SKAI',
    audioSrc: '/music/ SKAI ISYOURGODOfficial Music Video.mp3',
    weight: 0.2
  }
]

  const currentTrack = playlist[currentTrackIndex]

  // Auto-play on ANY user interaction
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Set initial volume
    audio.volume = volume

    const tryPlay = () => {
      if (hasStartedRef.current) return
      
      audio.muted = false
      
      if (audio.paused) {
        audio.play().then(() => {
          hasStartedRef.current = true
          setIsPlaying(true)
          console.log('✓ Audio started playing')
        }).catch((err) => {
          console.log('⚠ Play blocked, waiting for user interaction', err)
        })
      }
    }

    // Listen for any user interaction
    const events = ['click', 'touchstart', 'keydown', 'mousedown', 'touchend', 'pointerdown']
    events.forEach(event => document.addEventListener(event, tryPlay))

    return () => {
      events.forEach(event => document.removeEventListener(event, tryPlay))
    }
  }, [volume])

  // Also trigger on explicit user interaction prop
  useEffect(() => {
    if (onUserInteraction && audioRef.current) {
      const audio = audioRef.current
      audio.muted = false
      
      if (audio.paused) {
        audio.volume = volume
        audio.play().then(() => {
          hasStartedRef.current = true
          setIsPlaying(true)
          console.log('Music started after user interaction')
        }).catch(err => {
          console.log('Play failed:', err)
        })
      } else {
        setIsPlaying(true)
      }
    }
  }, [onUserInteraction, volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => {
      // Play next track when current ends
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length)
    }
    
    const handleCanPlay = () => {
      // For track changes, play if was already playing
      if (isPlaying && hasStartedRef.current) {
        audio.play().catch(err => {
          console.log('Play failed on track change:', err)
        })
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [currentTrackIndex, isPlaying])
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])
  
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    // Only handle manual play/pause toggle, not track changes
    if (isPlaying && audio.paused) {
      audio.play().catch(err => {
        console.log('Play failed:', err)
        setIsPlaying(false)
      })
    } else if (!isPlaying && !audio.paused) {
      audio.pause()
    }
  }, [isPlaying])

  const togglePlay = () => setIsPlaying(!isPlaying)

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length)
  }

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length)
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, rgba(1, 10, 19, 0.95) 0%, rgba(0, 20, 40, 0.9) 100%)',
      border: '2px solid #C8AA6E',
      borderRadius: '8px',
      padding: '12px',
      width: '240px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 0 20px rgba(200, 170, 110, 0.3)',
      fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
      color: '#F0E6D2'
    }}>
      <audio 
        ref={audioRef} 
        src={currentTrack.audioSrc}
        loop={false}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
      />

      {/* Track Info */}
      <div style={{ marginBottom: '8px', textAlign: 'center' }}>
        <div style={{ 
          fontSize: '13px', 
          fontWeight: 'bold',
          color: '#C8AA6E',
          marginBottom: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {currentTrack.title}
        </div>
        <div style={{ 
          fontSize: '11px',
          color: '#d4d4d4'
        }}>
          {currentTrack.artist}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '8px' }}>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: '100%',
            height: '4px',
            cursor: 'pointer',
            accentColor: '#C8AA6E'
          }}
        />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: '9px',
          color: '#d4d4d4',
          marginTop: '2px'
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px'
      }}>
        <button
          onClick={prevTrack}
          style={{
            background: 'transparent',
            border: '1px solid #C8AA6E',
            color: '#C8AA6E',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(200, 170, 110, 0.2)'
            e.currentTarget.style.borderColor = '#0AC8FF'
            e.currentTarget.style.color = '#0AC8FF'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = '#C8AA6E'
            e.currentTarget.style.color = '#C8AA6E'
          }}
        >
          ⏮
        </button>
        
        <button
          onClick={togglePlay}
          style={{
            background: 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)',
            border: '2px solid #F0E6D2',
            color: '#0A1428',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          onClick={nextTrack}
          style={{
            background: 'transparent',
            border: '1px solid #C8AA6E',
            color: '#C8AA6E',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(200, 170, 110, 0.2)'
            e.currentTarget.style.borderColor = '#0AC8FF'
            e.currentTarget.style.color = '#0AC8FF'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = '#C8AA6E'
            e.currentTarget.style.color = '#C8AA6E'
          }}
        >
          ⏭
        </button>
      </div>

      {/* Volume Control */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '10px' }}>🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{
            flex: 1,
            height: '4px',
            cursor: 'pointer',
            accentColor: '#C8AA6E'
          }}
        />
        <span style={{ fontSize: '9px', minWidth: '28px', textAlign: 'right' }}>
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  )
}

// WASD Camera Controller Component with Auto-Movement
function CameraController({ onPositionChange, onRotationChange, controlsRef, goingHome, startCinema }: { 
  onPositionChange: (pos: { x: number, y: number, z: number }) => void,
  onRotationChange: (rot: { yaw: number, pitch: number }) => void,
  controlsRef: React.MutableRefObject<any>,
  goingHome: boolean,
  startCinema: boolean
}) {
  const { camera } = useThree()
  const keysPressed = useRef<Set<string>>(new Set())
  const moveSpeed = 0.5
  
  // Auto-movement state
  const [autoMove, setAutoMove] = useState(false)
  const autoMoveTarget = useRef(new THREE.Vector3())
  const autoMoveSpeed = useRef(0.02)
  const rotationSpeed = useRef(0.01)
  
  // Auto-start cinema mode when triggered
  useEffect(() => {
    if (startCinema) {
      setAutoMove(true)
    }
  }, [startCinema])
  
  // Home position
  const homePosition = new THREE.Vector3(-61.2, 2.7, 49.0)
  
  // Bounding box corners: (35,60,-40), (-170,60,-40), (-170,60,160), (35,60,160)
  const boundingBox = {
    minX: -170,
    maxX: 35,
    minY: 55,
    maxY: 65,
    minZ: -40,
    maxZ: 160
  }
  
  // Center of the map to look toward
  const mapCenter = new THREE.Vector3(-67.85, 0, 60)

  // Initialize target when auto-movement is enabled
  useEffect(() => {
    if (autoMove) {
      autoMoveTarget.current.set(
        Math.random() * (boundingBox.maxX - boundingBox.minX) + boundingBox.minX,
        Math.random() * (boundingBox.maxY - boundingBox.minY) + boundingBox.minY,
        Math.random() * (boundingBox.maxZ - boundingBox.minZ) + boundingBox.minZ
      )
      autoMoveSpeed.current = 0.01 + Math.random() * 0.04
      rotationSpeed.current = 0.005 + Math.random() * 0.015
    }
  }, [autoMove])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      
      // Toggle auto-movement with 'C' key
      if (key === 'c') {
        e.preventDefault()
        setAutoMove(prev => {
          console.log('Toggling auto-movement:', !prev)
          return !prev
        })
      } else {
        keysPressed.current.add(key)
      }
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

  useFrame((state) => {
    // Home animation mode - smoothly return to home position
    if (goingHome) {
    const targetYaw = 150 // Your desired home yaw
    const targetPitch = -15 // Your desired home pitch
    
    // Convert to radians
    const targetYawRad = THREE.MathUtils.degToRad(targetYaw)
    const targetPitchRad = THREE.MathUtils.degToRad(targetPitch)
      
      // Keep OrbitControls enabled - user can still move camera
      if (controlsRef.current) {
        controlsRef.current.enabled = true
      }
      
      // Gently pull camera toward home position
      camera.position.lerp(homePosition, 0.01)
      
      // Gently pull rotation toward home orientation (slower slerp rate)
      const targetQuaternion = new THREE.Quaternion()
      const targetEuler = new THREE.Euler(targetPitchRad, targetYawRad, 0, 'YXZ')
      targetQuaternion.setFromEuler(targetEuler)
      
      camera.quaternion.slerp(targetQuaternion, 0.01)
      
      // Update OrbitControls target based on camera look direction
      if (controlsRef.current) {
        const lookDistance = 30
        const lookTarget = new THREE.Vector3()
        camera.getWorldDirection(lookTarget)
        lookTarget.multiplyScalar(lookDistance)
        lookTarget.add(camera.position)
        
        controlsRef.current.target.copy(lookTarget)
        controlsRef.current.update()
      }
      
      // Calculate yaw and pitch for display
      const yaw = THREE.MathUtils.radToDeg(camera.rotation.y)
      const pitch = THREE.MathUtils.radToDeg(camera.rotation.x)
      
      // Update display
      onPositionChange({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      })
      onRotationChange({
        yaw: yaw,
        pitch: pitch
      })
      
      return // Skip other controls when going home
    }
    
    // Auto-movement mode
    if (autoMove) {
      const time = state.clock.elapsedTime
      
      // Check if reached target, generate new one
      const distanceToTarget = camera.position.distanceTo(autoMoveTarget.current)
      if (distanceToTarget < 8) {
        // Generate new random target within bounding box
        autoMoveTarget.current.set(
          Math.random() * (boundingBox.maxX - boundingBox.minX) + boundingBox.minX,
          Math.random() * (boundingBox.maxY - boundingBox.minY) + boundingBox.minY,
          Math.random() * (boundingBox.maxZ - boundingBox.minZ) + boundingBox.minZ
        )
        autoMoveSpeed.current = 0.025 + Math.random() * 0.1
        rotationSpeed.current = 0.01 + Math.random() * 0.375
      }
      
      // Smooth movement toward target with varying speed
      const direction = new THREE.Vector3().subVectors(autoMoveTarget.current, camera.position)
      direction.normalize()
      
      const speedVariation = Math.sin(time * 0.3) * 0.04 + autoMoveSpeed.current
      const movement = direction.multiplyScalar(speedVariation)
      
      camera.position.add(movement)
      
      // Camera looks toward map center with smooth variation
      if (controlsRef.current) {
        const offsetX = Math.sin(time * rotationSpeed.current * 2) * 15
        const offsetY = Math.sin(time * rotationSpeed.current * 1.5) * 8
        const offsetZ = Math.cos(time * rotationSpeed.current * 2) * 15
        
        const lookTarget = new THREE.Vector3(
          mapCenter.x + offsetX,
          mapCenter.y + offsetY,
          mapCenter.z + offsetZ
        )
        
        const lerpAmount = Math.min(rotationSpeed.current * 0.5, 0.05)
        controlsRef.current.target.lerp(lookTarget, lerpAmount)
        controlsRef.current.update()
      }
      
      // Calculate yaw and pitch from camera rotation
      const yaw = THREE.MathUtils.radToDeg(camera.rotation.y)
      const pitch = THREE.MathUtils.radToDeg(camera.rotation.x)
      
      // Update position and rotation display
      onPositionChange({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      })
      onRotationChange({
        yaw: yaw,
        pitch: pitch
      })
      
      return // Skip manual controls when auto-moving
    }
    
    // Manual WASD controls
    if (keysPressed.current.size === 0) return

    // Create direction vectors using camera's rotation matrix
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    
    // Get camera's forward direction
    camera.getWorldDirection(forward)
    forward.y = 0 // Keep movement on XZ plane
    forward.normalize()
    
    // Get camera's right direction
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    
    const movement = new THREE.Vector3()

    // Calculate movement based on keys pressed
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
      
      // Calculate yaw and pitch from camera rotation
      const yaw = THREE.MathUtils.radToDeg(camera.rotation.y)
      const pitch = THREE.MathUtils.radToDeg(camera.rotation.x)
      
      // Update position and rotation display
      onPositionChange({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      })
      onRotationChange({
        yaw: yaw,
        pitch: pitch
      })
    }
  })

  return null
}

function SummonersRiftModel({ onReady }: { onReady?: () => void }) {
  const modelRef = useRef<THREE.Group>(null)
  
  // Load optimized Summoner's Rift with full textures
  const { scene } = useGLTF('/rift-opt.glb', true, true)

  // Notify when model is ready
  useEffect(() => {
    if (scene && onReady) {
      onReady()
    }
  }, [scene, onReady])

  // VRAM Optimization: Process materials and textures
  useMemo(() => {
    console.log('=== Loaded Scene Info ===')
    const materialsCache = new Map<string, THREE.Material>()
    const mobile = isMobile()
    
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
            
            // VRAM Optimization 2: Texture optimizations - Mobile vs Desktop
            if ((material as any).map) {
              const texture = (material as any).map as THREE.Texture
              
              if (mobile) {
                // Mobile: Simplified texture settings for performance
                texture.minFilter = THREE.LinearFilter
                texture.magFilter = THREE.LinearFilter
                texture.generateMipmaps = false
                texture.anisotropy = 0
                console.log('Mobile texture settings applied')
              } else {
                // Desktop: Better quality with mipmaps and filtering
                texture.minFilter = THREE.LinearMipmapLinearFilter
                texture.magFilter = THREE.LinearFilter
                texture.generateMipmaps = true
                texture.anisotropy = 2
                console.log('Desktop texture settings applied')
              }
            }
            
            // VRAM Optimization 3: Material simplification - Mobile vs Desktop
            const standardMat = material as THREE.MeshStandardMaterial
            
            // Ensure proper rendering
            standardMat.side = THREE.FrontSide
            standardMat.transparent = false
            standardMat.opacity = 1.0
            standardMat.depthWrite = true
            standardMat.depthTest = true
            
            if (mobile) {
              // Mobile: Remove expensive texture maps entirely
              if (standardMat.normalMap) {
                standardMat.normalMap = null
                console.log('Removed normal map (mobile)')
              }
              if (standardMat.roughnessMap) {
                standardMat.roughnessMap = null
                console.log('Removed roughness map (mobile)')
              }
              if (standardMat.metalnessMap) {
                standardMat.metalnessMap = null
                console.log('Removed metalness map (mobile)')
              }
              if (standardMat.aoMap) {
                standardMat.aoMap = null
                console.log('Removed AO map (mobile)')
              }
              
              // Set simple constant values for mobile
              standardMat.roughness = 0.8
              standardMat.metalness = 0.0
              standardMat.aoMapIntensity = 0
            } else {
              // Desktop: Keep texture maps but optimize
              if (standardMat.normalMap) {
                standardMat.normalScale?.set(0.5, 0.5)
              }
              
              // Only set constant values if maps don't exist
              if (!standardMat.roughnessMap) {
                standardMat.roughness = 0.8
              }
              if (!standardMat.metalnessMap) {
                standardMat.metalness = 0.0
              }
            }
          }
        }
        
        // VRAM Optimization 4: Shadow settings - Mobile vs Desktop
        const meshName = mesh.name.toLowerCase()
        
        if (mobile) {
          // Mobile: Disable all shadows for performance
          mesh.castShadow = false
          mesh.receiveShadow = false
        } else {
          // Desktop: Selectively enable shadows
          if (meshName.includes('ground') || meshName.includes('terrain') || meshName.includes('base')) {
            mesh.receiveShadow = true
            mesh.castShadow = false
          } else if (meshName.includes('tower') || meshName.includes('structure')) {
            mesh.castShadow = true
            mesh.receiveShadow = true
          } else {
            // Disable shadows for small/decorative objects
            mesh.castShadow = false
            mesh.receiveShadow = false
          }
        }
        
        // VRAM Optimization 5: Frustum culling
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

  return (
    <group ref={modelRef}>
      <primitive object={scene} scale={0.01} position={[0, 0, 0]} />
    </group>
  )
}

// Preload the model
useGLTF.preload('/rift-opt.glb')

function SummonersRift() {
  const [isReady, setIsReady] = useState(false)
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0, z: 0 })
  const [cameraRotation, setCameraRotation] = useState({ yaw: 0, pitch: 0 })
  const [goingHome, setGoingHome] = useState(true)
  const [startCinema, setStartCinema] = useState(false)
  const [showCenterPanel, setShowCenterPanel] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const controlsRef = useRef<any>(null)

  // Mobile detection
  const mobile = isMobile()
  
  // Get secret parameter from URL
  const secret = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('secret') === 'false' ? false : true
  }, [])
  
  // Home position for distance calculation
  const homePosition = { x: -61, y: 2.7, z: 49.0 }
  
  // Camera spawn at random position
  const randomCamera = useMemo(() => {
    const position = {
      x: -170 + Math.random() * (35 - (-170)),
      y: 40 + Math.random() * 60,
      z: -40 + Math.random() * (160 - (-40))
    }
    
    const rotation = {
      yaw: Math.random() * 360 - 180,
      pitch: -90 + Math.random() * 60
    }
    
    setCameraPos(position)
    setCameraRotation(rotation)
    return position
  }, [])
  
  // Handle model ready
  const handleReady = () => {
    setIsReady(true)
  }
  
  // Handle going home
  const handleGoHome = () => {
    setGoingHome(true)
  }
  
  // Handle start exploring - disable going home and enable cinema mode
  const handleStartExploring = () => {
    setGoingHome(false)
    setStartCinema(true)
    setUserInteracted(true) // Trigger music playback
  }
  
  // Toggle cinema mode handler (mobile)
  // Dispatch a synthetic 'keydown' event for 'c' so it behaves exactly like pressing the C key
  const handleToggleCinema = () => {
      const evt = new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', keyCode: 67, bubbles: true, cancelable: true })
      window.dispatchEvent(evt)
      setStartCinema(prev => !prev)
  }
  
  // Custom cursor and cleanup
  useEffect(() => {
    // Force custom cursor styling
    const style = document.createElement('style')
    style.id = 'summoners-rift-cursor-override'
    style.innerHTML = `
      body, body *, .summoners-rift-test, .summoners-rift-test * {
        cursor: url(/cursor.png), auto !important;
      }
      .hide-cursor, .hide-cursor * {
        cursor: url(/cursor.png), auto !important;
      }
      .dropping-text {
        display: none !important;
      }
    `
    document.head.appendChild(style)
    
    // Remove animal clicks elements
    const removeAnimalClicks = () => {
      document.body.classList.remove('hide-cursor')
      const animalElements = document.querySelectorAll('.dropping-text')
      animalElements.forEach(el => el.remove())
    }
    
    // Use MutationObserver for better performance
    removeAnimalClicks()
    const observer = new MutationObserver(removeAnimalClicks)
    observer.observe(document.body, { childList: true, subtree: true })
    
    return () => {
      observer.disconnect()
      const customStyle = document.getElementById('summoners-rift-cursor-override')
      if (customStyle) {
        customStyle.remove()
      }
    }
  }, [])

  // Check distance to home position and show panel when close
  useEffect(() => {
    if (goingHome) {
      if (showCenterPanel) return;
      const distance = Math.sqrt(
        Math.pow(cameraPos.x - homePosition.x, 2) +
        Math.pow(cameraPos.y - homePosition.y, 2) +
        Math.pow(cameraPos.z - homePosition.z, 2)
      )
      
      setShowCenterPanel(distance < 4)
    } else {
      setShowCenterPanel(false)
    }
  }, [cameraPos, goingHome])

  return (
    <div className="summoners-rift-test" style={{ cursor: 'url(/cursor.png), auto' }}>
      {/* Cinema Toggle Button for Mobile */}
      {!goingHome && mobile && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 2001
        }}>
          <button
            onClick={handleToggleCinema}
            style={{
              background: startCinema ? 'linear-gradient(135deg, #0AC8FF 0%, #C8AA6E 100%)' : 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)',
              border: '2px solid #F0E6D2',
              color: '#0A1428',
              fontSize: '18px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              padding: '14px 32px',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(10, 200, 255, 0.3)',
              fontFamily: 'Beaufort for LOL, Times New Roman, serif',
              transition: 'all 0.3s',
            }}
            aria-label={startCinema ? 'Exit Cinema Mode' : 'Enter Cinema Mode'}
          >
            {startCinema ? '🎬' : '🎬'}
          </button>
        </div>
      )}

      {/* Inline CSS for League of Legends style animations */}
      <style>{`
        @keyframes fadeInCenter {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes hexGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(200, 170, 110, 0.3), 0 0 40px rgba(10, 200, 255, 0.2), inset 0 0 60px rgba(200, 170, 110, 0.1); }
          50% { box-shadow: 0 0 30px rgba(200, 170, 110, 0.5), 0 0 60px rgba(10, 200, 255, 0.3), inset 0 0 80px rgba(200, 170, 110, 0.2); }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(200, 170, 110, 0.6); }
          50% { border-color: rgba(200, 170, 110, 1); }
        }
        .summoners-rift-test * {
          cursor: url(/cursor.png), auto !important;
        }
      `}</style>
      
      {/* Fixed Camera Info - Top Left */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '15px 20px',
        borderRadius: '8px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.6',
        pointerEvents: 'none'
      }}>
        <div>Position: ({cameraPos.x.toFixed(1)}, {cameraPos.y.toFixed(1)}, {cameraPos.z.toFixed(1)})</div>
        <div>Yaw: {cameraRotation.yaw.toFixed(1)}° | Pitch: {cameraRotation.pitch.toFixed(1)}°</div>
      </div>

      {/* Back to Home Button - Top Right on desktop, Bottom Left on mobile */}
      {!goingHome && (
        <div style={{
          position: 'fixed',
          top: mobile ? 'auto' : '20px',
          right: mobile ? 'auto' : '20px',
          bottom: mobile ? '20px' : 'auto',
          left: mobile ? '20px' : 'auto',
          zIndex: 1000
        }}>
          <button
            onClick={handleGoHome}
            style={{
              background: 'linear-gradient(135deg, rgba(1, 10, 19, 0.95) 0%, rgba(0, 20, 40, 0.9) 100%)',
              border: '2px solid #C8AA6E',
              color: '#C8AA6E',
              fontSize: '14px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              padding: '12px 24px',
              cursor: 'pointer',
              fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
              clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              boxShadow: '0 0 15px rgba(200, 170, 110, 0.4), inset 0 0 20px rgba(200, 170, 110, 0.1)',
              transition: 'all 0.3s ease',
              position: 'relative',
              backdropFilter: 'blur(5px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = '2px solid #0AC8FF'
              e.currentTarget.style.color = '#0AC8FF'
              e.currentTarget.style.boxShadow = '0 0 25px rgba(10, 200, 255, 0.6), inset 0 0 30px rgba(10, 200, 255, 0.2)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = '2px solid #C8AA6E'
              e.currentTarget.style.color = '#C8AA6E'
              e.currentTarget.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.4), inset 0 0 20px rgba(200, 170, 110, 0.1)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {/* Corner accents */}
            <span style={{
              position: 'absolute',
              top: '3px',
              right: '3px',
              width: '8px',
              height: '8px',
              borderTop: '1px solid #C8AA6E',
              borderRight: '1px solid #C8AA6E'
            }} />
            <span style={{
              position: 'absolute',
              bottom: '3px',
              left: '3px',
              width: '8px',
              height: '8px',
              borderBottom: '1px solid #C8AA6E',
              borderLeft: '1px solid #C8AA6E'
            }} />
            {mobile ? 'Home' : '← Back to Home'}
          </button>
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas
        style={{ 
          width: '100vw', 
          height: '100vh', 
          display: 'block',
          position: 'fixed',
          top: 0,
          left: 0
        }}
        camera={{ 
          position: [randomCamera.x, randomCamera.y, randomCamera.z],
          fov: 60,
          near: 0.1,
          far: mobile ? 500 : 1000  // Mobile: Reduced render distance
        }}
        shadows
        gl={{ 
          powerPreference: mobile ? "default" : "high-performance",  // Mobile: Battery savings
          stencil: false,
          depth: true,
          logarithmicDepthBuffer: mobile ? true : false  // Mobile: Better depth precision
        }}
        dpr={ [1, 1.5]}
      >
        {/* Background */}
        <color attach="background" args={['#0a1428']} />
        {/* Fog - Mobile: Closer fog to cull distant objects earlier */}
        <fog attach="fog" args={['#0a1428', 100, 250]} />
        
        {/* Lighting - Mobile vs Desktop */}
        {mobile ? (
          /* Mobile: Only ambient + 1 directional light (2 lights total) */
          <>
            <ambientLight intensity={6} />
            <directionalLight
              position={[-75, 250, 75]}
              intensity={6}
              castShadow={false}
            />
          </>
        ) : (
          /* Desktop: Ambient + directional + point + hemisphere lights (4 lights total) */
          <>
            <ambientLight intensity={6} />
            <directionalLight
              position={[-75, 250, 75]}
              intensity={6}
              castShadow={false}
            />
            <pointLight position={[-75, 200, 75]} intensity={300} distance={300} decay={2} />
            <hemisphereLight args={['#ffffff', '#ffffff', 4]} />
          </>
        )}

        {/* Sky */}
        <Sky
          distance={450000}
          sunPosition={[100, 20, 100]}
          inclination={0.6}
          azimuth={0.25}
        />

        {/* Grid for reference */}
        {!mobile && (
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
        )}

        {/* Load the Summoner's Rift Model */}
        <Suspense fallback={<LoadingIndicator />}>
          <SummonersRiftModel onReady={handleReady} />
        </Suspense>

        {/* WASD Camera Controller */}
        <CameraController 
          onPositionChange={setCameraPos} 
          onRotationChange={setCameraRotation} 
          controlsRef={controlsRef}
          goingHome={goingHome}
          startCinema={startCinema}
        />

        {/* Controls */}
        <OrbitControls
          ref={controlsRef}
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={10}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2}
          target={[-67.85, 0, 60]}
          enableDamping={true}
          dampingFactor={0.05}
          onChange={(e) => {
            if (e?.target) {
              const camera = e.target.object
              // Update position
              setCameraPos({
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
              })
              // Update rotation
              const yaw = THREE.MathUtils.radToDeg(camera.rotation.y)
              const pitch = THREE.MathUtils.radToDeg(camera.rotation.x)
              setCameraRotation({
                yaw: yaw,
                pitch: pitch
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

      {/* Center Content - Only show button when secret is false, show full panel when secret is true */}
      {goingHome && showCenterPanel && !secret && (
        <div style={{
          position: 'fixed',
          top: '90%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999
        }}>
          {/* Start Exploring Button - Standalone */}
          <button
            onClick={handleStartExploring}
            style={{
              background: 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)',
              border: '2px solid #F0E6D2',
              color: '#0A1428',
              fontSize: mobile ? '14px' : '16px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: mobile ? '1px' : '2px',
              padding: mobile ? '12px 20px' : '15px 40px',
              borderRadius: '0',
              clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 20px rgba(200, 170, 110, 0.5)',
              fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 0 30px rgba(200, 170, 110, 0.8)'
              e.currentTarget.style.background = 'linear-gradient(135deg, #F0E6D2 0%, #C8AA6E 100%)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(200, 170, 110, 0.5)'
              e.currentTarget.style.background = 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)'
            }}
          >
            ⬢ Start Exploring ⬢
          </button>
        </div>
      )}

      {/* Center Content - League of Legends Style Panel - Only when secret is true */}
      {goingHome && showCenterPanel && secret && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999,
          background: 'linear-gradient(135deg, rgba(1, 10, 19, 0.98) 0%, rgba(0, 20, 40, 0.98) 100%)',
          padding: mobile ? '30px 20px' : '60px 80px',
          clipPath: mobile ? 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))' : 'polygon(0 0, calc(100% - 25px) 0, 100% 25px, 100% 100%, 25px 100%, 0 calc(100% - 25px))',
          color: 'white',
          fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
          textAlign: 'center',
          minWidth: mobile ? '90vw' : '600px',
          maxWidth: mobile ? '95vw' : '700px',
          border: mobile ? '2px solid rgba(200, 170, 110, 0.8)' : '3px solid rgba(200, 170, 110, 0.8)',
          opacity: 0,
          animation: 'fadeInCenter 1.5s ease-in forwards, hexGlow 3s infinite, borderPulse 2s infinite',
          backdropFilter: 'blur(15px)',
          boxShadow: '0 0 40px rgba(200, 170, 110, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Close Button - Top Right */}
          <button
            onClick={handleStartExploring}
            aria-label="Close panel"
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: 'transparent',
              border: '2px solid #C8AA6E',
              color: '#C8AA6E',
              fontSize: '20px',
              fontWeight: 'bold',
              width: '32px',
              height: '32px',
              padding: '0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1',
              zIndex: 1001,
              boxSizing: 'content-box',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = '2px solid #0AC8FF'
              e.currentTarget.style.color = '#0AC8FF'
              e.currentTarget.style.background = 'rgba(10, 200, 255, 0.1)'
              const span = e.currentTarget.querySelector('span') as HTMLElement | null
              if (span) span.style.transform = 'rotate(90deg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = '2px solid #C8AA6E'
              e.currentTarget.style.color = '#C8AA6E'
              e.currentTarget.style.background = 'transparent'
              const span = e.currentTarget.querySelector('span') as HTMLElement | null
              if (span) span.style.transform = 'rotate(0deg)'
            }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.3s ease', transform: 'rotate(0deg)' }}>×</span>
          </button>
          
          {/* Hextech corner accents - Enhanced */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '40px',
            height: '40px',
            borderTop: '3px solid #C8AA6E',
            borderRight: '3px solid #C8AA6E',
            boxShadow: '0 0 10px rgba(200, 170, 110, 0.5)'
          }} />

          {/* Rank Badge Style Accent */}
          <div style={{
            position: 'absolute',
            top: '0px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)',
            padding: mobile ? '6px 15px' : '8px 30px',
            clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
            fontSize: mobile ? '9px' : '12px',
            fontWeight: 'bold',
            letterSpacing: mobile ? '1px' : '2px',
            color: '#0A1428',
            textTransform: 'uppercase',
            boxShadow: '0 4px 15px rgba(200, 170, 110, 0.6)'
          }}>
            ⬢ Summoner Profile ⬢
          </div>

          {/* Title with LoL gold - Enhanced */}
          <h2 style={{ 
            margin: mobile ? '20px 0 10px 0' : '30px 0 15px 0', 
            fontSize: mobile ? '28px' : '42px',
            fontWeight: 'bold',
            color: '#C8AA6E',
            textTransform: 'uppercase',
            letterSpacing: mobile ? '2px' : '4px',
            textShadow: '0 0 25px rgba(200, 170, 110, 0.6), 0 0 50px rgba(10, 200, 255, 0.4)',
            lineHeight: '1.2'
          }}>
            Longpan Zhou
          </h2>
          
          {/* Role Badge */}
          <div style={{
            display: 'inline-block',
            background: 'rgba(10, 200, 255, 0.1)',
            border: '2px solid #0AC8FF',
            padding: mobile ? '6px 15px' : '8px 25px',
            marginBottom: mobile ? '20px' : '30px',
            clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            fontSize: mobile ? '11px' : '13px',
            color: '#0AC8FF',
            letterSpacing: mobile ? '1.5px' : '3px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            boxShadow: '0 0 20px rgba(10, 200, 255, 0.3)'
          }}>
            ⬡ Software Developer ⬡
          </div>

          {/* Quote Section */}
          <div style={{ 
            fontSize: mobile ? '14px' : '18px', 
            lineHeight: '1.8',
            color: '#d4d4d4',
            marginBottom: mobile ? '20px' : '35px',
            padding: mobile ? '15px 0' : '20px 0',
            borderTop: '1px solid rgba(200, 170, 110, 0.3)',
            borderBottom: '1px solid rgba(200, 170, 110, 0.3)'
          }}>
            <p style={{ margin: '0', fontStyle: 'italic', color: '#F0E6D2' }}>
              "I code, sleep, and repeat."
            </p>
          </div>

          {/* Social Links - Enhanced LoL Style */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: mobile ? '10px' : '15px',
            marginBottom: mobile ? '20px' : '35px'
          }}>
            <a 
              href="mailto:patrickzhoul123@gmail.com" 
              title="Email"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: mobile ? '40px' : '50px',
                height: mobile ? '40px' : '50px',
                background: 'rgba(200, 170, 110, 0.1)',
                border: '2px solid #C8AA6E',
                color: '#C8AA6E',
                fontSize: mobile ? '18px' : '24px',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(10, 200, 255, 0.2)'
                e.currentTarget.style.borderColor = '#0AC8FF'
                e.currentTarget.style.color = '#0AC8FF'
                e.currentTarget.style.transform = 'translateY(-5px) scale(1.1)'
                e.currentTarget.style.boxShadow = '0 5px 25px rgba(10, 200, 255, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(200, 170, 110, 0.1)'
                e.currentTarget.style.borderColor = '#C8AA6E'
                e.currentTarget.style.color = '#C8AA6E'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
            >
              <img src={Email} alt="Email" style={{ width: mobile ? '18px' : '24px', height: mobile ? '18px' : '24px' }} />
            </a>
            <a 
              href="https://github.com/LongpanZhou" 
              target="_blank" 
              title="GitHub"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: mobile ? '40px' : '50px',
                height: mobile ? '40px' : '50px',
                background: 'rgba(200, 170, 110, 0.1)',
                border: '2px solid #C8AA6E',
                color: '#C8AA6E',
                fontSize: mobile ? '18px' : '24px',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(10, 200, 255, 0.2)'
                e.currentTarget.style.borderColor = '#0AC8FF'
                e.currentTarget.style.color = '#0AC8FF'
                e.currentTarget.style.transform = 'translateY(-5px) scale(1.1)'
                e.currentTarget.style.boxShadow = '0 5px 25px rgba(10, 200, 255, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(200, 170, 110, 0.1)'
                e.currentTarget.style.borderColor = '#C8AA6E'
                e.currentTarget.style.color = '#C8AA6E'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
            >
              <img src={Github} alt="GitHub" style={{ width: mobile ? '18px' : '24px', height: mobile ? '18px' : '24px' }} />
            </a>
            <a 
              href="https://leetcode.com/u/longpanzhou/" 
              target="_blank" 
              title="LeetCode"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: mobile ? '40px' : '50px',
                height: mobile ? '40px' : '50px',
                background: 'rgba(200, 170, 110, 0.1)',
                border: '2px solid #C8AA6E',
                color: '#C8AA6E',
                fontSize: mobile ? '18px' : '24px',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(10, 200, 255, 0.2)'
                e.currentTarget.style.borderColor = '#0AC8FF'
                e.currentTarget.style.color = '#0AC8FF'
                e.currentTarget.style.transform = 'translateY(-5px) scale(1.1)'
                e.currentTarget.style.boxShadow = '0 5px 25px rgba(10, 200, 255, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(200, 170, 110, 0.1)'
                e.currentTarget.style.borderColor = '#C8AA6E'
                e.currentTarget.style.color = '#C8AA6E'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
            >
              <img src={Leetcode} alt="LeetCode" style={{ width: mobile ? '18px' : '24px', height: mobile ? '18px' : '24px' }} />
            </a>
            <a 
              href="https://www.linkedin.com/in/longpan-zhou/" 
              target="_blank" 
              title="LinkedIn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: mobile ? '40px' : '50px',
                height: mobile ? '40px' : '50px',
                background: 'rgba(200, 170, 110, 0.1)',
                border: '2px solid #C8AA6E',
                color: '#C8AA6E',
                fontSize: mobile ? '18px' : '24px',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(10, 200, 255, 0.2)'
                e.currentTarget.style.borderColor = '#0AC8FF'
                e.currentTarget.style.color = '#0AC8FF'
                e.currentTarget.style.transform = 'translateY(-5px) scale(1.1)'
                e.currentTarget.style.boxShadow = '0 5px 25px rgba(10, 200, 255, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(200, 170, 110, 0.1)'
                e.currentTarget.style.borderColor = '#C8AA6E'
                e.currentTarget.style.color = '#C8AA6E'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.2)'
              }}
            >
              <img src={Linkedin} alt="LinkedIn" style={{ width: mobile ? '18px' : '24px', height: mobile ? '18px' : '24px' }} />
            </a>
          </div>

          {/* Divider line */}
          <div style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #C8AA6E, transparent)',
            margin: mobile ? '15px 0' : '25px 0',
            boxShadow: '0 0 10px rgba(200, 170, 110, 0.5)'
          }} />

          {/* Start Exploring Button */}
          <button
            onClick={handleStartExploring}
            style={{
              background: 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)',
              border: '2px solid #F0E6D2',
              color: '#0A1428',
              fontSize: mobile ? '14px' : '16px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: mobile ? '1px' : '2px',
              padding: mobile ? '12px 20px' : '15px 40px',
              borderRadius: '0',
              clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 20px rgba(200, 170, 110, 0.5)',
              fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
              marginTop: mobile ? '5px' : '10px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 0 30px rgba(200, 170, 110, 0.8)'
              e.currentTarget.style.background = 'linear-gradient(135deg, #F0E6D2 0%, #C8AA6E 100%)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(200, 170, 110, 0.5)'
              e.currentTarget.style.background = 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)'
            }}
          >
            ⬢ Start Exploring ⬢
          </button>
        </div>
      )}

      {/* Controls Info - Hidden when going home or on mobile */}
      {!mobile && (
      <div className="controls-info">
        <h3>Controls</h3>
        <ul>
            <li><strong>C:</strong> Toggle auto-movement (cinematic mode)</li>
            <li><strong>W/A/S/D:</strong> Move camera forward/left/back/right</li>
            <li><strong>Q/E:</strong> Move camera down/up</li>
            <li><strong>Left Click + Drag:</strong> Rotate view</li>
          <li><strong>Right Click + Drag:</strong> Pan camera</li>
          <li><strong>Scroll:</strong> Zoom in/out</li>
        </ul>
      </div>
      )}

  {/* Music Player - hidden on mobile */}
  {!mobile && secret && <MusicPlayer onUserInteraction={userInteracted} />}
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

export default SummonersRift
