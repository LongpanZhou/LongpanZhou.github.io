import { lazy, Suspense, useRef, useMemo, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import './SummonersRift.css'
import Email from '../profile/icons/gmail.svg'
import Linkedin from '../profile/icons/linkedin.svg'
import Github from '../profile/icons/github.svg'
import Leetcode from '../profile/icons/leetcode.svg'
import { isMobile } from '../utils/isMobile'
import RiftModels from './RiftModels'
import { createCameraShake } from './cameraShake'
import PanelChrome, { DragButton } from './PanelChrome'
import PositionBox from './PositionBox'
import LayoutEditorUI from './LayoutEditorUI'
import { editState } from './riftEdit'
import { HudDraw } from '../components/DrawFrame'
import Loader from '../components/Loader'
import ProjectsHud, { useReadme } from './ProjectsHud'
import BlogHud from './BlogHud'
import ArxivHud from './ArxivHud'
import Css3dPanels from './Css3dPanels'
import type { Css3dPanel } from './Css3dPanels'
import { ARXIV_LAYOUT, ROAM, idlePaperInfo, initialArxivView, listHalf, moveOf, raise, restoreDefaults, sheetBase } from './arxivLayout'
import type { ArxivMode, ArxivViewState, PaperEntry, PaperInfo } from './arxivLayout'
import { resolveTarget } from '../pdf/pdfTarget'

// The papers of the arXiv view are drawn in the 3D scene. pdf.js is heavy, so they load on demand.
const ArxivPapers = lazy(() => import('./ArxivPapers'))

// The papers of the arXiv view: how many can be open at once, and where the list is remembered
// The colour of the sky: the scene's background and fog, and the tint the map has always been seen through
const SKY_COLOR = '#c8dbe6'
const MAX_ARXIV_PAPERS = 6
// What /arxiv shows: the paper that opens the view when no other address is given
const DEFAULT_ARXIV_PAPER = 'https://arxiv.org/pdf/1706.03762'
const ARXIV_LIST_KEY = 'arxiv-paper-list'
const loadArxivList = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(ARXIV_LIST_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
const saveArxivList = (targets: string[]) => {
  try {
    localStorage.setItem(ARXIV_LIST_KEY, JSON.stringify(targets))
  } catch {
    /* the list is just not remembered */
  }
}
import { useProjects } from '../projects/useProjects'

const PLAYLIST = [
  {
    title: 'Fade Away',
    artist: 'Jay Chou',
    audioSrc: '/music/ Jay Chou Fade AwayOfficial MV.mp3',
  },
  {
    title: 'Lucid Dreams',
    artist: 'Juice WRLD',
    audioSrc: '/music/Juice WRLD - Lucid Dreams Official Music Video.mp3',
  },
  {
    title: 'SKAI ISYOURGOD',
    artist: 'SKAI',
    audioSrc: '/music/ SKAI ISYOURGODOfficial Music Video.mp3',
  }
]

// Format time helper
const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Text inside a resizable HUD box scales with the box instead of being pushed into a wrap.
// PanelChrome keeps --hud-scale in sync with the panel's width.
// The box's content is zoomed as a whole (see .panel-fit in the CSS), so text, buttons and gaps
// inside scale together. Only the box's own padding needs the scale applied by hand.
const hud = (px: number) => `${px}px`
const hudPad = (px: number) => `calc(${px}px * var(--hud-scale, 1))`

// Music Player Component
function MusicPlayer({
  onUserInteraction,
  view,
  onFocusBox,
}: {
  onUserInteraction?: boolean
  view: MapView
  onFocusBox?: () => void // in the arXiv view, a click on the player (not on its controls) focuses it
}) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.6)
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasStartedRef = useRef(false)

  const currentTrack = PLAYLIST[currentTrackIndex]
  // In the arXiv view the player stands in the 3D scene (see Css3dPanels). No HUD box is drawn around
  // it there: the outline would not follow the panel's perspective.
  const music3d = view === 'arxiv'

  // Auto-play on ANY user interaction
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const tryPlay = () => {
      if (hasStartedRef.current) return
      
      audio.muted = false
      
      if (audio.paused) {
        audio.play().then(() => {
          hasStartedRef.current = true
          setIsPlaying(true)
        }).catch(() => {
          // Play blocked, waiting for user interaction
        })
      }
    }

    // Listen for any user interaction
    const events = ['click', 'touchstart', 'keydown', 'mousedown', 'touchend', 'pointerdown']
    events.forEach(event => document.addEventListener(event, tryPlay))

    return () => {
      events.forEach(event => document.removeEventListener(event, tryPlay))
    }
  }, [])
  
  // Set initial volume separately
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
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
        }).catch(() => {
          // Play failed
        })
      } else {
        setIsPlaying(true)
      }
    }
  }, [onUserInteraction, volume])

  // Use ref to track isPlaying inside event handlers without causing re-subscriptions
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => {
      // Play next track when current ends
      setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length)
    }
    
    const handleCanPlay = () => {
      // For track changes, play if was already playing - use ref to avoid stale closure
      if (isPlayingRef.current && hasStartedRef.current) {
        audio.play().catch(() => {})
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
  }, [currentTrackIndex])
  
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    // Only handle manual play/pause toggle, not track changes
    if (isPlaying && audio.paused) {
      audio.play().catch(() => setIsPlaying(false))
    } else if (!isPlaying && !audio.paused) {
      audio.pause()
    }
  }, [isPlaying])

  const togglePlay = useCallback(() => setIsPlaying(prev => !prev), [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  const nextTrack = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length)
  }, [])

  const prevTrack = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev - 1 + PLAYLIST.length) % PLAYLIST.length)
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value))
  }, [])

  return (
    <div id="css3d-music" className={`hud-box${music3d ? ' css3d-panel' : ''}`} style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      zIndex: 1000,
      padding: hudPad(12),
      width: '240px',
      overflow: 'auto'
    }}
    onClick={
      music3d
        ? (e) => {
            if (!(e.target as Element).closest('button, input, select, textarea, a, label')) onFocusBox?.()
          }
        : undefined
    }
    {...(music3d ? {} : { 'data-hud-draw': 'Music player', 'data-hud-always': true })}>
      {/* Each view keeps its own position, size and collapsed state for the player. The chrome is rebuilt
          when the view changes (the key), while the player and its audio keep playing. Both start in
          the bottom-left corner: the ids are new, so no position saved for the old corner applies. */}
      {music3d && <div className="css3d-grip" data-rotate title="Drag sideways to turn" />}
      <PanelChrome
        key={view}
        id={`music-${view}`}
        label="Music"
        // Not in the 3D scene: the panel's measured size there is its size on the screen, with
        // perspective, so the text scaling that follows the box size would shrink the contents
        resizable={!music3d}
        minWidth={130}
        minHeight={90}
      />
      <audio
        ref={audioRef} 
        src={currentTrack.audioSrc}
        loop={false}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
      />

      {/* Track Info */}
      <div style={{ marginBottom: '8px', textAlign: 'center' }}>
        <div style={{ 
          fontSize: hud(13),
          fontWeight: 'bold',
          color: '#C8AA6E',
          marginBottom: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }} data-hud-type>
          {currentTrack.title}
        </div>
        <div style={{ 
          fontSize: hud(11),
          color: '#d4d4d4'
        }} data-hud-type>
          {currentTrack.artist}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '8px' }} {...(music3d ? {} : { 'data-hud-draw': 'Progress', 'data-hud-always': true })}>
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
          fontSize: hud(9),
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
      }} {...(music3d ? {} : { 'data-hud-draw': 'Playback', 'data-hud-always': true })}>
        <button
          onClick={prevTrack}
          data-hud-fade
          style={{
            background: 'transparent',
            border: '1px solid #C8AA6E',
            color: '#C8AA6E',
            width: hud(28),
            height: hud(28),
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: hud(12),
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
          data-hud-fade
          style={{
            background: 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)',
            border: '2px solid #F0E6D2',
            color: '#0A1428',
            width: hud(36),
            height: hud(36),
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: hud(16),
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
          data-hud-fade
          style={{
            background: 'transparent',
            border: '1px solid #C8AA6E',
            color: '#C8AA6E',
            width: hud(28),
            height: hud(28),
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: hud(12),
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
        <span style={{ fontSize: hud(10) }}>🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          style={{
            flex: 1,
            height: '4px',
            cursor: 'pointer',
            accentColor: '#C8AA6E'
          }}
        />
        <span style={{ fontSize: hud(9), minWidth: hud(28), textAlign: 'right' }}>
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  )
}

// WASD Camera Controller Component with Auto-Movement
// Where the camera sits for the Projects view: high above the map, looking straight down
const PROJECTS_POSITION = new THREE.Vector3(-67.85, 170, 70) // x/z are near the map centre; a higher z moves the map up on screen
const PROJECTS_YAW_DEG = 0
const PROJECTS_PITCH_DEG = -90

// The Blog and arXiv views: low over the map, looking across it. Blog is the camera as the Position
// box showed it: x -28, y 7.5, z 30, yaw -44, pitch -18.5. arXiv is a level camera (pitch 0) at
// x -110, y 12, z 55, yaw -53, standing exactly in front of the two papers. Dragging looks around
// from there and scrolling moves along the view direction; both ease back, like the Projects view.
// The Position box reads camera.rotation in Euler order XYZ, but the camera is kept level: it is
// turned about the vertical axis first and then tilted (order YXZ), and the two orders give
// different yaw and pitch numbers for the same view (a yaw of -50 and a pitch of -20 on the box
// are really about -51.7 and -12.7 for a level camera). This turns the numbers read off the box
// back into the level pose, so the camera ends up looking exactly the way it did when they were
// read. Valid for a yaw between -90 and 90 degrees.
function levelPoseFromReadout(yawDeg: number, pitchDeg: number) {
  const a = Math.sin(THREE.MathUtils.degToRad(yawDeg))
  const b = Math.tan(THREE.MathUtils.degToRad(pitchDeg))
  const c = Math.sqrt((1 - a * a) / (1 + a * a * b * b)) // cosine of the level yaw
  return {
    yaw: Math.atan2(a * Math.sqrt(1 + b * b * c * c), c),
    pitch: Math.atan(b * c),
  }
}
const BLOG_VIEW = { position: new THREE.Vector3(-28, 7.5, 30), pose: levelPoseFromReadout(-44, -18.5) }
const ARXIV_VIEW = { position: new THREE.Vector3(-110, 12, 55), pose: { yaw: THREE.MathUtils.degToRad(-53), pitch: 0 } }

type MapView = 'home' | 'projects' | 'blog' | 'arxiv'

// What stands in the arXiv scene besides the papers: the controls right under them, and the music
// player to their left (turned a little toward them). Positions are in world units from the middle
// of the papers; scale is world units per CSS pixel (0.02 makes the 560 px controls 11 units wide).
const ARXIV_PANELS: Css3dPanel[] = [
  { id: 'css3d-arxiv-bar', x: 0, y: -9.3, scale: 0.02, move: 'bar' },
  { id: 'css3d-music', x: -8.8, y: -9.9, scale: 0.02, yawOffset: 0.28, move: 'music' },
]
// Where the camera goes to look at a panel when it is clicked: in front of it, close enough that it
// fills a good part of the screen
const ARXIV_SPOTS = {
  bar: { x: ARXIV_PANELS[0].x, y: ARXIV_PANELS[0].y, d: 13.5, yaw: ARXIV_PANELS[0].yawOffset ?? 0 },
  // The music player is turned toward the middle, so the camera moves round to look at it straight on
  music: { x: ARXIV_PANELS[1].x, y: ARXIV_PANELS[1].y, d: 11.5, yaw: ARXIV_PANELS[1].yawOffset ?? 0 },
}

function CameraController({ onPositionChange, onRotationChange, controlsRef, goingHome, projectsMode, freeView, arxivCompare, onArxivPage, startCinema, onNearHome }: {
  onPositionChange: (pos: { x: number, y: number, z: number }) => void,
  onRotationChange: (rot: { yaw: number, pitch: number }) => void,
  controlsRef: React.MutableRefObject<any>,
  goingHome: boolean,
  projectsMode: boolean, // any view other than home: the camera holds that view's pose
  freeView: 'blog' | 'arxiv' | null, // a low view (otherwise the Projects view, when projectsMode is set)
  arxivCompare: React.MutableRefObject<ArxivViewState>, // the arXiv comparison and focus, eased here
  onArxivPage: (id: string, by: number) => void, // the wheel turns the page of the paper in focus
  startCinema: boolean,
  onNearHome: (near: boolean) => void
}) {
  const { camera, gl } = useThree()
  const keysPressed = useRef<Set<string>>(new Set())
  const ctrlSince = useRef(0) // when Ctrl went down
  const ctrlStartY = useRef(0) // where the camera was when it did
  const ctrlKickedFor = useRef(-1) // the Ctrl press that has been given its nudge down
  const chordAt = useRef(0) // when Ctrl+Z or Ctrl+Y (undo, redo) was last pressed
  const chordDoneFor = useRef(-1) // the Ctrl press whose nudge an undo has taken back
  // Home view, in world units per second. The camera speeds up and slows down instead of starting and
  // stopping at once, and covers the same ground on any screen refresh rate.
  const moveSpeed = 30
  const moveVel = useRef(new THREE.Vector3())
  const autoVel = useRef(new THREE.Vector3()) // the auto camera's velocity, eased the same way
  const shake = useMemo(() => createCameraShake(), [])
  
  // Auto-movement state
  const [autoMove, setAutoMove] = useState(false)
  const autoMoveTarget = useRef(new THREE.Vector3())
  const autoMoveSpeed = useRef(0.02)
  const rotationSpeed = useRef(0.01)
  
  // Reusable THREE.js objects to avoid GC pressure
  const tempQuaternion = useRef(new THREE.Quaternion())
  const tempEuler = useRef(new THREE.Euler())
  const directionVec = useRef(new THREE.Vector3())
  const forwardVec = useRef(new THREE.Vector3())
  const rightVec = useRef(new THREE.Vector3())
  const upVec = useRef(new THREE.Vector3(0, 1, 0))
  const movementVec = useRef(new THREE.Vector3())
  const lookTargetVec = useRef(new THREE.Vector3())
  
  // Auto-start cinema mode when triggered
  useEffect(() => {
    if (startCinema) {
      setAutoMove(true)
    }
  }, [startCinema])
  
  // Home position
  const homePosition = useMemo(() => new THREE.Vector3(-61.2, 2.7, 49.0), [])
  const homeYawRad = useMemo(() => THREE.MathUtils.degToRad(150), [])
  const homePitchRad = useMemo(() => THREE.MathUtils.degToRad(-15), [])
  const projectsQuat = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(THREE.MathUtils.degToRad(PROJECTS_PITCH_DEG), THREE.MathUtils.degToRad(PROJECTS_YAW_DEG), 0, 'YXZ'),
      ),
    [],
  )
  // The Projects view can be dragged (tilt) and zoomed with the mouse, then eases back to the
  // overhead pose once the mouse is released
  const pageStep = useRef(onArxivPage)
  pageStep.current = onArxivPage
  const projState = useRef({ tiltX: 0, tiltZ: 0, zoom: 1, lastInput: 0, dragging: false, pan: new THREE.Vector3(), vel: new THREE.Vector3() })
  const projEuler = useRef(new THREE.Euler())
  const projRot = useRef(new THREE.Quaternion())
  const projDesiredQuat = useRef(new THREE.Quaternion())
  const projDesiredPos = useRef(new THREE.Vector3())
  const orbitPivot = useRef(new THREE.Vector3())
  useEffect(() => {
    if (!projectsMode) return
    const el = gl.domElement
    const st = projState.current
    const stopDrag: Array<() => void> = []
    // Left-drag on the background tilts the view around the middle of the map
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      st.dragging = true
      st.lastInput = performance.now()
      let lastX = e.clientX
      let lastY = e.clientY
      const move = (ev: PointerEvent) => {
        if (arxivCompare.current.dragging) {
          lastX = ev.clientX
          lastY = ev.clientY
          return
        }
        st.tiltZ = THREE.MathUtils.clamp(st.tiltZ + (ev.clientX - lastX) * 0.004, -1, 1)
        st.tiltX = THREE.MathUtils.clamp(st.tiltX - (ev.clientY - lastY) * 0.004, -1, 1)
        lastX = ev.clientX
        lastY = ev.clientY
        st.lastInput = performance.now()
      }
      const up = () => {
        st.dragging = false
        st.lastInput = performance.now()
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      stopDrag.push(up)
    }
    let wheelSum = 0
    let wheelAt = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // In a focus on a paper the wheel turns its pages: down for the next, up for the one before
      const cmpW = arxivCompare.current
      if (cmpW.focusTarget !== 0 && cmpW.focusId && (cmpW.lifts[cmpW.focusId] ?? 0) > 0.5) {
        wheelSum += e.deltaY
        const t = performance.now()
        if (Math.abs(wheelSum) >= 40 && t - wheelAt > 160) {
          pageStep.current(cmpW.focusId, wheelSum > 0 ? 1 : -1)
          wheelSum = 0
          wheelAt = t
        }
        return
      }
      st.zoom = THREE.MathUtils.clamp(st.zoom * Math.exp(e.deltaY * 0.001), 0.35, 1.8)
      st.lastInput = performance.now()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('wheel', onWheel)
      stopDrag.forEach((fn) => fn())
      st.tiltX = 0
      st.tiltZ = 0
      st.zoom = 1
      st.pan.set(0, 0, 0)
      st.dragging = false
    }
  }, [projectsMode, gl])

  // Set when the camera leaves the Projects view, so the way back home is quick, not cinematic
  const wasProjects = useRef(false)
  const fastReturn = useRef(false)
  const lookDistance = 30
  
  // Bounding box corners: (35,60,-40), (-170,60,-40), (-170,60,160), (35,60,160)
  const boundingBox = useMemo(() => ({
    minX: -170,
    maxX: 35,
    minY: 55,
    maxY: 65,
    minZ: -40,
    maxZ: 160
  }), [])
  
  // Center of the map to look toward
  const mapCenter = useMemo(() => new THREE.Vector3(-67.85, 0, 60), [])

  // Initialize target when auto-movement is enabled
  useEffect(() => {
    if (autoMove) {
      autoVel.current.set(0, 0, 0)
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
      const field = e.target as HTMLElement | null
      if (field && (/^(input|textarea|select)$/i.test(field.tagName) || field.isContentEditable)) return
      const key = e.key.toLowerCase()
      
      // Toggle auto-movement with 'C' key
      if (key === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setAutoMove(prev => !prev)
      } else {
        // Space lifts the camera, so the page must not scroll or press a focused button for it
        if (key === ' ' && field?.tagName !== 'BUTTON') e.preventDefault()
        if (key === 'control' && !keysPressed.current.has('control')) ctrlSince.current = performance.now()
        if ((key === 'z' || key === 'y') && (e.ctrlKey || e.metaKey)) chordAt.current = performance.now()
        keysPressed.current.add(key)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }

    // A key let go while the window was not looking would stay pressed (Ctrl often is)
    const releaseAll = () => keysPressed.current.clear()
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', releaseAll)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', releaseAll)
    }
  }, [])

  // Throttle state updates to ~10fps instead of 60fps
  const lastUpdateTime = useRef(0)
  const lastShown = useRef('')
  const UPDATE_INTERVAL = 100 // ms
  const wasNearHome = useRef(false)

  const throttledUpdate = (time: number) => {
    if (time - lastUpdateTime.current < UPDATE_INTERVAL) return
    lastUpdateTime.current = time

    const yaw = THREE.MathUtils.radToDeg(camera.rotation.y)
    const pitch = THREE.MathUtils.radToDeg(camera.rotation.x)

    // The readout shows one decimal, so only report when a shown number changes. Idle
    // frames then cost nothing instead of re-rendering the page ten times a second.
    const shown = [camera.position.x, camera.position.y, camera.position.z, yaw, pitch].map((v) => v.toFixed(1)).join()
    if (shown === lastShown.current) return
    lastShown.current = shown

    onPositionChange({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    })
    onRotationChange({ yaw, pitch })
  }

  const checkNearHome = () => {
    if (!goingHome) {
      if (wasNearHome.current) {
        wasNearHome.current = false
        onNearHome(false)
      }
      return
    }
    const dx = camera.position.x - homePosition.x
    const dy = camera.position.y - homePosition.y
    const dz = camera.position.z - homePosition.z
    const near = (dx * dx + dy * dy + dz * dz) < 16
    if (near !== wasNearHome.current) {
      wasNearHome.current = near
      onNearHome(near)
    }
  }

  useFrame((state, delta) => {
    const now = performance.now()

    if (wasProjects.current && !projectsMode) fastReturn.current = true
    wasProjects.current = projectsMode

    // Gentle shake while the camera is stale. Runs first so every branch below sees the real position.
    shake.update(camera, controlsRef.current?.target ?? null, now, goingHome && !projectsMode)

    // Keep the Position readout live in every mode, including idle and mouse orbit.
    throttledUpdate(now)

    // Projects view: fly to the overhead pose and hold it. The orbit controls are switched off and
    // the pose is set directly (straight down is where OrbitControls' up vector breaks down). The
    // user can drag to tilt the view around the middle of the map and scroll to zoom; once the
    // mouse is idle the tilt and zoom ease away and the camera returns to the overhead pose.
    if (projectsMode) {
      if (controlsRef.current) controlsRef.current.enabled = false
      moveVel.current.set(0, 0, 0)
      const dt = Math.min(delta, 0.1)
      const st = projState.current
      // The arXiv view keeps the tilt and zoom the user gave it, until they are reset
      if (arxivCompare.current.resetCamera) {
        arxivCompare.current.resetCamera = false
        st.tiltX = 0
        st.tiltZ = 0
        st.zoom = 1
        st.pan.set(0, 0, 0)
        st.vel.set(0, 0, 0)
      }
      if (!st.dragging && now - st.lastInput > 700 && freeView !== 'arxiv') {
        const decay = Math.exp(-2.2 * dt)
        st.tiltX *= decay
        st.tiltZ *= decay
        st.zoom = 1 + (st.zoom - 1) * decay
        if (Math.abs(st.tiltX) < 0.0005) st.tiltX = 0
        if (Math.abs(st.tiltZ) < 0.0005) st.tiltZ = 0
        if (Math.abs(st.zoom - 1) < 0.0005) st.zoom = 1
      }
      // Ease the arXiv comparison and focus toward what was asked for. The camera follows them
      // closely while they move.
      const cmp = arxivCompare.current
      const rate = 1 - Math.exp(-3.5 * dt)
      const faTarget = cmp.focusTarget !== 0 ? 1 : 0
      const comparing = Math.abs(cmp.target - cmp.t) > 0.0005
      const focusing =
        Math.abs(faTarget - cmp.fa) > 0.0005 || (cmp.focusTarget !== 0 && Math.abs(cmp.focusTarget - cmp.f) > 0.0005)
      // Focus on a panel: the same easing, toward the panel's position and distance
      const paTarget = cmp.panelTarget ? 1 : 0
      const panelFocusing =
        Math.abs(paTarget - cmp.pa) > 0.0005 ||
        (!!cmp.panelTarget &&
          (Math.abs(cmp.panelTarget.x - cmp.px) > 0.005 ||
            Math.abs(cmp.panelTarget.y - cmp.py) > 0.005 ||
            Math.abs(cmp.panelTarget.d - cmp.pd) > 0.005 ||
            Math.abs(cmp.panelTarget.yaw - cmp.pyaw) > 0.002))
      cmp.pa = Math.abs(paTarget - cmp.pa) > 0.0005 ? cmp.pa + (paTarget - cmp.pa) * rate : paTarget
      if (cmp.panelTarget) {
        cmp.px += (cmp.panelTarget.x - cmp.px) * rate
        cmp.py += (cmp.panelTarget.y - cmp.py) * rate
        cmp.pd += (cmp.panelTarget.d - cmp.pd) * rate
        cmp.pyaw += (cmp.panelTarget.yaw - cmp.pyaw) * rate
      }
      cmp.t = comparing ? cmp.t + (cmp.target - cmp.t) * rate : cmp.target
      cmp.fa = Math.abs(faTarget - cmp.fa) > 0.0005 ? cmp.fa + (faTarget - cmp.fa) * rate : faTarget
      // The side keeps its value while the focus eases away, so the camera does not swing sideways
      if (cmp.focusTarget !== 0) cmp.f = Math.abs(cmp.focusTarget - cmp.f) > 0.0005 ? cmp.f + (cmp.focusTarget - cmp.f) * rate : cmp.focusTarget
      // In the arXiv view the keys move the camera, the same keys as on Home: W and S in and out, A and D
      // left and right, Space (or E) up, Ctrl (or Q) down. Like the tilt and zoom, where it ends up is kept
      // until the defaults are restored. The camera speeds up and slows down instead of starting and
      // stopping at once. A tap of Ctrl gives a nudge down and holding it keeps going; Ctrl+Z and Ctrl+Y
      // (undo and redo of the drawing) start the same way, so they take that nudge back.
      if (freeView === 'arxiv') {
        const keys = keysPressed.current
        const held = (k: string) => (keys.has(k) ? 1 : 0)
        const press = ctrlSince.current
        if (keys.has('control') && ctrlKickedFor.current !== press) {
          ctrlKickedFor.current = press
          ctrlStartY.current = st.pan.y
          st.vel.y -= 10
        }
        if (chordAt.current >= press && chordAt.current - press < 500 && chordDoneFor.current !== press && ctrlKickedFor.current === press) {
          chordDoneFor.current = press
          st.pan.y = ctrlStartY.current
          st.vel.y = 0
        }
        const ctrlDown = keys.has('control') && chordDoneFor.current !== press
        // Along the list the camera may go as far as the ends of the row
        const roamX = THREE.MathUtils.lerp(ROAM.x, Math.max(ROAM.x, listHalf(cmp) + 6), cmp.t)
        const top = 14 // world units per second at full speed
        const follow = 1 - Math.exp(-9 * dt)
        st.vel.x += ((held('d') - held('a')) * top - st.vel.x) * follow
        st.vel.y += ((Math.max(held('e'), held(' ')) - Math.max(held('q'), ctrlDown ? 1 : 0)) * top - st.vel.y) * follow
        st.vel.z += ((held('w') - held('s')) * top - st.vel.z) * follow
        if (st.vel.lengthSq() < 0.0004) st.vel.set(0, 0, 0)
        else {
          st.pan.x = THREE.MathUtils.clamp(st.pan.x + st.vel.x * dt, -roamX, roamX)
          st.pan.y = THREE.MathUtils.clamp(st.pan.y + st.vel.y * dt, -ROAM.yDown, ROAM.yUp)
          st.pan.z = THREE.MathUtils.clamp(st.pan.z + st.vel.z * dt, -ROAM.out, ROAM.in)
          st.lastInput = now
        }
      }
      const tilted = st.pan.lengthSq() > 0 || st.tiltX !== 0 || st.tiltZ !== 0 || st.zoom !== 1 || comparing || focusing || panelFocusing

      if (freeView === 'arxiv') {
        // The camera orbits the thing it is looking at: dragging swings it round that point, which stays
        // in the middle of the picture, and scrolling moves toward or away from it. (Turning the camera
        // on the spot instead would swing the papers across the screen at the least touch.)
        const fv = ARXIV_VIEW
        // The view without the user's drag: level, turned toward a box in focus
        const baseYaw = fv.pose.yaw + cmp.pa * cmp.pyaw
        projRot.current.setFromEuler(projEuler.current.set(fv.pose.pitch, baseYaw, 0, 'YXZ'))
        directionVec.current.set(0, 0, -1).applyQuaternion(projRot.current)
        const base = projDesiredPos.current
        // Where that view puts the camera: at the box in focus (straight out from its front, turned like it)
        base.copy(fv.position)
        const sy = Math.sin(fv.pose.yaw)
        const cy = Math.cos(fv.pose.yaw)
        const along = cmp.pa * (ARXIV_LAYOUT.distance - cmp.pd * Math.cos(cmp.pyaw))
        const across = cmp.pa * (cmp.px + cmp.pd * Math.sin(cmp.pyaw))
        base.x += -sy * along + cy * across
        base.z += -cy * along - sy * across
        base.y += cmp.pa * cmp.py
        // Where the keys have moved the camera to
        base.addScaledVector(lookTargetVec.current.set(1, 0, 0).applyQuaternion(projRot.current), st.pan.x)
        base.y += st.pan.y
        base.addScaledVector(directionVec.current, st.pan.z)
        // The point it looks at, and how far that is
        const distance = THREE.MathUtils.lerp(ARXIV_LAYOUT.distance, cmp.pd, cmp.pa)
        orbitPivot.current.copy(base).addScaledVector(directionVec.current, distance)
        // The dragged view: turned round the point (sideways freely, up and down not far)
        const pitch = fv.pose.pitch + THREE.MathUtils.clamp(-st.tiltX * 0.8, -0.45, 0.45)
        projDesiredQuat.current.setFromEuler(projEuler.current.set(pitch, baseYaw + st.tiltZ * 0.8, 0, 'YXZ'))
        directionVec.current.set(0, 0, -1).applyQuaternion(projDesiredQuat.current)
        projDesiredPos.current.copy(orbitPivot.current).addScaledVector(directionVec.current, -(distance + (st.zoom - 1) * 40))
      } else if (freeView === 'blog') {
        // A low pose: dragging turns the view a little, scrolling moves along it
        projEuler.current.set(BLOG_VIEW.pose.pitch - st.tiltX * 0.8, BLOG_VIEW.pose.yaw + st.tiltZ * 0.8, 0, 'YXZ')
        projDesiredQuat.current.setFromEuler(projEuler.current)
        directionVec.current.set(0, 0, -1).applyQuaternion(projDesiredQuat.current)
        projDesiredPos.current.copy(BLOG_VIEW.position).addScaledVector(directionVec.current, -(st.zoom - 1) * 40)
      } else {
        // The Projects pose for this tilt and zoom: the overhead camera, turned about the ground
        // point under it
        projRot.current.setFromEuler(projEuler.current.set(st.tiltX, 0, st.tiltZ, 'XYZ'))
        projDesiredPos.current
          .set(0, PROJECTS_POSITION.y * st.zoom, 0)
          .applyQuaternion(projRot.current)
          .add(lookTargetVec.current.set(PROJECTS_POSITION.x, 0, PROJECTS_POSITION.z))
        projDesiredQuat.current.copy(projRot.current).multiply(projectsQuat)
      }

      // Slow on the first fly in, close behind the mouse while it is being used
      const k = 1 - Math.exp(-(tilted ? 10 : 2.2) * dt)
      // Move the real (unshaken) position and put the shake back on top, so the camera shake keeps
      // running once the camera has arrived. Pulling the shaken position toward the goal would
      // cancel the shake. The last few hundredths snap exactly onto the goal.
      const sway = shake.offset
      camera.position.sub(sway)
      if (!tilted && camera.position.distanceToSquared(projDesiredPos.current) < 0.0025) {
        camera.position.copy(projDesiredPos.current)
      } else {
        camera.position.lerp(projDesiredPos.current, k)
      }
      camera.position.add(sway)
      camera.quaternion.slerp(projDesiredQuat.current, k)
      if (controlsRef.current) {
        camera.getWorldDirection(lookTargetVec.current)
        controlsRef.current.target.copy(lookTargetVec.current.multiplyScalar(lookDistance).add(camera.position))
      }
      throttledUpdate(now)
      return
    }

    // Home animation mode - smoothly return to home position
    if (goingHome) {
      if (controlsRef.current) {
        controlsRef.current.enabled = !editState.dragging
      }

      moveVel.current.set(0, 0, 0)
      // The slow first fly-in closes 1% of the distance per frame at 60 frames a second; as a rate per
      // second it takes the same time on any screen
      const homeK = 1 - Math.exp(-(fastReturn.current ? 1.8 : 0.6) * Math.min(delta, 0.1))
      camera.position.lerp(homePosition, homeK)

      tempEuler.current.set(homePitchRad, homeYawRad, 0, 'YXZ')
      tempQuaternion.current.setFromEuler(tempEuler.current)
      camera.quaternion.slerp(tempQuaternion.current, homeK)

      if (controlsRef.current) {
        camera.getWorldDirection(lookTargetVec.current)
        lookTargetVec.current.multiplyScalar(lookDistance)
        lookTargetVec.current.add(camera.position)
        controlsRef.current.target.copy(lookTargetVec.current)
        controlsRef.current.update()
      }

      throttledUpdate(now)
      checkNearHome()
      if (fastReturn.current && camera.position.distanceToSquared(homePosition) < 16) fastReturn.current = false
      return
    }

    // Auto-movement mode
    if (autoMove) {
      const time = state.clock.elapsedTime
      const dt = Math.min(delta, 0.1)
      moveVel.current.set(0, 0, 0)

      const distanceToTargetSq = camera.position.distanceToSquared(autoMoveTarget.current)
      if (distanceToTargetSq < 64) {
        autoMoveTarget.current.set(
          Math.random() * (boundingBox.maxX - boundingBox.minX) + boundingBox.minX,
          Math.random() * (boundingBox.maxY - boundingBox.minY) + boundingBox.minY,
          Math.random() * (boundingBox.maxZ - boundingBox.minZ) + boundingBox.minZ
        )
        autoMoveSpeed.current = 0.025 + Math.random() * 0.1
        rotationSpeed.current = 0.01 + Math.random() * 0.375
      }

      directionVec.current.subVectors(autoMoveTarget.current, camera.position)
      directionVec.current.normalize()

      // The speeds are per frame at 60 frames a second. The velocity eases toward the new heading, so
      // the camera curves round to the next target instead of turning on the spot.
      const speedVariation = (Math.sin(time * 0.3) * 0.04 + autoMoveSpeed.current) * 60
      movementVec.current.copy(directionVec.current).multiplyScalar(speedVariation)
      autoVel.current.lerp(movementVec.current, 1 - Math.exp(-1.5 * dt))
      camera.position.addScaledVector(autoVel.current, dt)

      if (controlsRef.current) {
        const offsetX = Math.sin(time * rotationSpeed.current * 2) * 15
        const offsetY = Math.sin(time * rotationSpeed.current * 1.5) * 8
        const offsetZ = Math.cos(time * rotationSpeed.current * 2) * 15

        lookTargetVec.current.set(
          mapCenter.x + offsetX,
          mapCenter.y + offsetY,
          mapCenter.z + offsetZ
        )

        const lerpAmount = 1 - Math.pow(1 - Math.min(rotationSpeed.current * 0.5, 0.05), dt * 60)
        controlsRef.current.target.lerp(lookTargetVec.current, lerpAmount)
        controlsRef.current.update()
      }

      throttledUpdate(now)
      return
    }

    // Manual WASD controls: the keys set the speed the camera wants, and its real speed follows, so it
    // glides to a stop when the keys are let go
    const keys = keysPressed.current
    const vel = moveVel.current
    if (keys.size === 0 && vel.lengthSq() === 0) return
    const dt = Math.min(delta, 0.1)

    camera.getWorldDirection(forwardVec.current)
    forwardVec.current.y = 0
    forwardVec.current.normalize()

    rightVec.current.crossVectors(forwardVec.current, upVec.current).normalize()
    movementVec.current.set(0, 0, 0)

    if (keys.has('w')) movementVec.current.addScaledVector(forwardVec.current, moveSpeed)
    if (keys.has('s')) movementVec.current.addScaledVector(forwardVec.current, -moveSpeed)
    if (keys.has('a')) movementVec.current.addScaledVector(rightVec.current, -moveSpeed)
    if (keys.has('d')) movementVec.current.addScaledVector(rightVec.current, moveSpeed)
    if (keys.has('q') || keys.has('control')) movementVec.current.y -= moveSpeed
    if (keys.has('e') || keys.has(' ')) movementVec.current.y += moveSpeed

    vel.lerp(movementVec.current, 1 - Math.exp(-10 * dt))
    // The last of the glide is cut off, so the camera comes to rest (and the idle sway can start)
    if (movementVec.current.lengthSq() === 0 && vel.lengthSq() < 0.01) vel.set(0, 0, 0)

    if (vel.lengthSq() > 0) {
      directionVec.current.copy(vel).multiplyScalar(dt)
      camera.position.add(directionVec.current)

      if (controlsRef.current) {
        controlsRef.current.target.add(directionVec.current)
        controlsRef.current.update()
      }

      throttledUpdate(now)
    }
  })

  return null
}

// The map is one 20 MB file, and it is the only thing the loading screen waits for. How much of it has
// arrived (0 to 1) is read off the download itself, so the bar moves while it comes in. Counting finished
// files, as drei's useProgress does, would leave the bar at zero until the whole file was there.
const MAP_URL = '/rift-opt.glb'
let mapFraction = 0
const reportMapProgress: NonNullable<Parameters<typeof useGLTF>[3]> = (loader) => {
  // Every model shares this one loader, and this runs on every use of it: wrap its load only once
  type Load = (url: string, onLoad: (data: unknown) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) => void
  const target = loader as unknown as { load: Load; reportsMap?: boolean }
  if (target.reportsMap) return
  target.reportsMap = true
  const load = target.load.bind(loader)
  target.load = (url, onLoad, onProgress, onError) =>
    load(
      url,
      onLoad,
      url !== MAP_URL
        ? onProgress
        : (e) => {
            if (e.total > 0) mapFraction = Math.min(1, e.loaded / e.total)
            onProgress?.(e)
          },
      onError,
    )
}

function SummonersRiftModel({ onReady, isMobileDevice }: { onReady?: () => void; isMobileDevice: boolean }) {
  // Load optimized Summoner's Rift with full textures
  const { scene } = useGLTF(MAP_URL, true, true, reportMapProgress)

  // Notify when model is ready
  useEffect(() => {
    if (scene && onReady) {
      onReady()
    }
  }, [scene, onReady])

  // VRAM Optimization: Process materials and textures
  useMemo(() => {
    const materialsCache = new Map<string, THREE.Material>()
    const mobile = isMobileDevice
    
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        
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
              } else {
                // Desktop: Better quality with mipmaps and filtering
                texture.minFilter = THREE.LinearMipmapLinearFilter
                texture.magFilter = THREE.LinearFilter
                texture.generateMipmaps = true
                texture.anisotropy = 2
              }
            }
            
            // VRAM Optimization 3: Material simplification - Mobile vs Desktop
            const standardMat = material as THREE.MeshStandardMaterial
            
            // The map file marks every material as glass (KHR_materials_transmission, factor 1). three.js
            // draws glass in a separate pass that shows what is behind it, so models behind or under the
            // map showed through it, with dark patches where they were. Make it a plain solid surface that
            // looks the same: no diffuse light (glass has none), and the picture as an unlit glow, tinted by
            // the sky colour it used to be seen against.
            const glass = material as THREE.MeshPhysicalMaterial
            if (glass.transmission > 0) {
              glass.transmission = 0
              glass.color.set(0x000000)
              glass.emissive.set(SKY_COLOR)
              glass.emissiveMap = glass.map
              glass.emissiveIntensity = 1
              glass.specularIntensity = 0
            }

            standardMat.side = THREE.FrontSide
            standardMat.transparent = false
            standardMat.opacity = 1.0
            standardMat.depthWrite = true
            standardMat.depthTest = true
            
            if (mobile) {
              // Mobile: Remove expensive texture maps entirely
              if (standardMat.normalMap) standardMat.normalMap = null
              if (standardMat.roughnessMap) standardMat.roughnessMap = null
              if (standardMat.metalnessMap) standardMat.metalnessMap = null
              if (standardMat.aoMap) standardMat.aoMap = null
              
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
              if (!standardMat.roughnessMap) standardMat.roughness = 0.8
              if (!standardMat.metalnessMap) standardMat.metalness = 0.0
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
  }, [scene, isMobileDevice])

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
    <group>
      <primitive object={scene} scale={0.01} position={[0, 0, 0]} />
    </group>
  )
}

// Preload the model
useGLTF.preload(MAP_URL, true, true, reportMapProgress)

// Reusable social link component for LoL-styled icons
function SocialLink({ href, title, icon, alt, mobile, external = false }: {
  href: string, title: string, icon: string, alt: string, mobile: boolean, external?: boolean
}) {
  const size = hud(mobile ? 40 : 50)
  const imgSize = hud(mobile ? 18 : 24)
  return (
    <a
      href={href}
      title={title}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: 'rgba(200, 170, 110, 0.1)',
        border: '2px solid #C8AA6E',
        color: '#C8AA6E',
        fontSize: mobile ? hud(18) : hud(24),
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
      <img src={icon} alt={alt} style={{ width: imgSize, height: imgSize }} />
    </a>
  )
}

function SummonersRift() {
  const [isReady, setIsReady] = useState(false)
  // Mount the Three.js Canvas only after the first paint, so the nav bar and
  // loading screen are on screen and interactive before the GLB parse (which
  // blocks the main thread) begins.
  const [canvasMounted, setCanvasMounted] = useState(false)
  // Order: loading screen, then the rift finishes loading, then the HUD draws. Every HUD
  // panel stays hidden until its box is drawn, so no panel background shows during loading.
  const [drawn, setDrawn] = useState(false)
  // Hide every HUD panel from before the first paint until its box is drawn. Layout effect,
  // so there is no frame where the panels show first. Lifted when drawing ends.
  useLayoutEffect(() => {
    if (drawn) return
    document.documentElement.classList.add('hud-booting')
    return () => document.documentElement.classList.remove('hud-booting')
  }, [drawn])
  useEffect(() => {
    // Safety net, counted from when the rift is ready: never leave the HUD hidden if the
    // drawing cannot report back
    if (!isReady) return
    const timer = window.setTimeout(() => setDrawn(true), 8000)
    return () => window.clearTimeout(timer)
  }, [isReady])
  // The loading screen fades out over the scene once it is ready, and is taken away after the fade
  const [loaderGone, setLoaderGone] = useState(false)
  useEffect(() => {
    if (!isReady) return
    const timer = window.setTimeout(() => setLoaderGone(true), 700)
    return () => window.clearTimeout(timer)
  }, [isReady])
  // The map's file has arrived (it is the first thing the scene loads), though it may still be unpacking
  const mapFetched = useProgress((s) => s.loaded > 0)
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0, z: 0 })
  const [cameraRotation, setCameraRotation] = useState({ yaw: 0, pitch: 0 })
  const [goingHome, setGoingHome] = useState(true)
  const [startCinema, setStartCinema] = useState(false)
  const [showCenterPanel, setShowCenterPanel] = useState(false)
  // Set by the Profile button, so the profile panel can be reopened without moving the camera
  const [profileOpen, setProfileOpen] = useState(false)
  // /projects is the same map seen from above, with the README and every repo drawn over it
  const { pathname, search } = useLocation()
  const projectsView = pathname === '/projects'
  const blogView = pathname === '/blog'
  // Projects and Blog are the same map seen from different camera poses
  // The arXiv view is every other address: the PDF viewer reads the paper from the address
  const arxivView = !['/', '/projects', '/blog'].includes(pathname)
  const subView = projectsView || blogView || arxivView
  const view: MapView = projectsView ? 'projects' : blogView ? 'blog' : arxivView ? 'arxiv' : 'home'
  const [showProjects, setShowProjects] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const controlsRef = useRef<any>(null)

  // Mobile detection
  const mobile = useMemo(() => isMobile(), [])
  
  // Get secret parameter from URL
  const secret = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('secret') === 'false' ? false : true
  }, [])
  
  // onNearHome callback for CameraController to check distance
  const handleNearHome = useCallback((near: boolean) => {
    setShowCenterPanel(near)
  }, [])
  
  // Entering the Projects view clears the home panels; leaving it sends the camera back home
  const wasProjectsView = useRef(false)
  useEffect(() => {
    if (subView) {
      setProfileOpen(false)
      setShowCenterPanel(false)
    } else if (wasProjectsView.current) {
      setGoingHome(true)
      setStartCinema(false)
    }
    wasProjectsView.current = subView
  }, [subView])

  // Fetched as soon as the page loads (cached for ten minutes), so the data is already here when
  // Projects is clicked
  // The music player stays mounted (so the music keeps playing), but its box is drawn again every
  // time the view changes, like the panels that are rebuilt
  // Coming back to a view draws the layout editor afresh, once. Opening and closing it within a view
  // does not. This runs in the commit itself (a layout effect), before the HUD notices the editor
  // mounting again.
  const forgetView = useRef(view)
  useLayoutEffect(() => {
    if (forgetView.current === view) return
    forgetView.current = view
    window.dispatchEvent(new CustomEvent('hud-forget', { detail: { names: ['Layout editor'] } }))
  }, [view])

  const prevView = useRef(view)
  useEffect(() => {
    // Only a real change of view (not the first render, nor React's development double run)
    if (prevView.current === view) return
    prevView.current = view
    const frame = requestAnimationFrame(() =>
      window.dispatchEvent(new CustomEvent('hud-redraw', { detail: { selector: '[data-hud-draw="Music player"]' } })),
    )
    return () => cancelAnimationFrame(frame)
  }, [view])

  const readme = useReadme(true)
  const repos = useProjects(true)
  // The panels are drawn shortly after the camera starts moving, once the GitHub data is in. They
  // do not wait for the home boxes to finish drawing.
  const projectsDataReady = !readme.loading && !repos.loading
  useEffect(() => {
    if (!(projectsView && isReady && projectsDataReady)) {
      setShowProjects(false)
      return
    }
    const timer = window.setTimeout(() => setShowProjects(true), 300)
    return () => window.clearTimeout(timer)
  }, [projectsView, isReady, projectsDataReady])

  // The Blog box is drawn shortly after the camera starts moving, like the Projects box
  const [showBlog, setShowBlog] = useState(false)
  useEffect(() => {
    if (!(blogView && isReady)) {
      setShowBlog(false)
      return
    }
    const timer = window.setTimeout(() => setShowBlog(true), 300)
    return () => window.clearTimeout(timer)
  }, [blogView, isReady])

  // The arXiv view: the list of papers (the ones kept from before, and the one in the address), and
  // what each reports. The side-by-side comparison is a 0..1 value the camera and the sheets both
  // follow (eased in CameraController).
  const arxivTarget = useMemo(() => (/^\/arxiv\/?$/i.test(pathname) ? DEFAULT_ARXIV_PAPER : resolveTarget(pathname, search)), [pathname, search])
  const [arxivPapers, setArxivPapers] = useState<PaperEntry[]>([])
  const [arxivInfo, setArxivInfo] = useState<Record<string, PaperInfo>>({})
  const arxivInfoRef = useRef<Record<string, PaperInfo>>({}) // always current
  const arxivIds = useRef(0)
  // The papers in one long row, one after the other (the same while the focus jumps from one to the next)
  const [arxivList, setArxivList] = useState(() => {
    try {
      return window.localStorage.getItem('arxiv-list-layout') === '1'
    } catch {
      return false
    }
  })
  // Which papers are left out of the list (all are in it unless unticked)
  const [arxivLeftOut, setArxivLeftOut] = useState<string[]>([])
  const toggleArxivListed = (id: string) =>
    setArxivLeftOut((out) => (out.includes(id) ? out.filter((x) => x !== id) : [...out, id]))
  const toggleArxivList = () =>
    setArxivList((on) => {
      try {
        window.localStorage.setItem('arxiv-list-layout', on ? '0' : '1')
      } catch {
        /* just not remembered */
      }
      return !on
    })
  const [arxivMode, setArxivMode] = useState<ArxivMode>('overview')
  const arxivCompare = useRef<ArxivViewState>(initialArxivView())

  useEffect(() => {
    if (!arxivView) return
    const stored = loadArxivList()
    const targets = arxivTarget && !stored.includes(arxivTarget) ? [arxivTarget, ...stored] : stored
    const unique = targets.filter((t, i) => targets.indexOf(t) === i).slice(0, MAX_ARXIV_PAPERS)
    setArxivPapers((prev) =>
      unique.map((t) => prev.find((p) => p.target === t) ?? { id: `p${++arxivIds.current}`, target: t, page: 1 }),
    )
  }, [arxivView, arxivTarget])

  const onArxivInfo = useCallback((id: string, patch: Partial<PaperInfo>) => {
    const prev = arxivInfoRef.current[id] ?? idlePaperInfo()
    arxivInfoRef.current = { ...arxivInfoRef.current, [id]: { ...prev, ...patch } }
    setArxivInfo(arxivInfoRef.current)
  }, [])
  const addArxivPaper = (raw: string): string | null => {
    const text = raw.trim()
    if (!text) return 'Type a PDF address or an arXiv id.'
    const address = (/^\d{4}\.\d{4,5}(v\d+)?$/.test(text) ? `arxiv.org/pdf/${text}` : text).replace(/arxiv\.org\/abs\//i, 'arxiv.org/pdf/')
    const url = resolveTarget('/' + address.replace(/^\/+/, ''), '')
    if (!url) return 'That is not a PDF link.'
    const have = arxivPapers.find((p) => p.target === url)
    if (have) {
      setArxivMode(`focus:${have.id}`)
      return null
    }
    if (arxivPapers.length >= MAX_ARXIV_PAPERS) return `Up to ${MAX_ARXIV_PAPERS} papers at a time. Remove one first.`
    const next = [...arxivPapers, { id: `p${++arxivIds.current}`, target: url, page: 1 }]
    setArxivPapers(next)
    saveArxivList(next.map((p) => p.target))
    return null
  }
  const removeArxivPaper = (id: string) => {
    const next = arxivPapers.filter((p) => p.id !== id)
    setArxivPapers(next)
    saveArxivList(next.map((p) => p.target))
    setArxivLeftOut((out) => out.filter((x) => x !== id))
    const rest = { ...arxivInfoRef.current }
    delete rest[id]
    arxivInfoRef.current = rest
    setArxivInfo(rest)
    setArxivMode((m) => (m === `focus:${id}` ? 'overview' : m))
  }
  // Page Up and Page Down in a focus: the page before or after, kept inside the paper
  const stepArxivPage = useCallback((id: string, by: number) => {
    const pages = arxivInfoRef.current[id]?.pages ?? 0
    setArxivPapers((list) =>
      list.map((p) => (p.id === id ? { ...p, page: Math.max(1, pages ? Math.min(p.page + by, pages) : p.page + by) } : p)),
    )
  }, [])
  // Drag a row of the list to a new place: the order of the list is the order of the sheets in the row
  const reorderArxivPaper = (id: string, to: number) => {
    const i = arxivPapers.findIndex((p) => p.id === id)
    if (i < 0) return
    const next = arxivPapers.filter((p) => p.id !== id)
    next.splice(Math.max(0, Math.min(to, next.length)), 0, arxivPapers[i])
    setArxivPapers(next)
    saveArxivList(next.map((p) => p.target))
  }

  // The sheets that exist: one per paper, named by the paper's id, in the order of the list
  const sheetKey = arxivPapers.map((p) => p.id).join(',')
  const sheetIds = useMemo(() => (sheetKey ? sheetKey.split(',') : []), [sheetKey])
  const listIds = useMemo(() => sheetIds.filter((id) => !arxivLeftOut.includes(id)), [sheetIds, arxivLeftOut])
  useEffect(() => {
    const v = arxivCompare.current
    v.order = sheetIds
    v.listOrder = listIds
  }, [sheetIds, listIds])
  // A focus on a sheet that is gone goes back to the overview
  useEffect(() => {
    const gone = arxivMode.startsWith('focus:') && !sheetIds.includes(arxivMode.slice(6))
    if (gone && arxivPapers.length > 0) setArxivMode('overview')
  }, [arxivMode, sheetIds, arxivPapers.length])

  useEffect(() => {
    const v = arxivCompare.current
    const focusId = arxivMode.startsWith('focus:') ? arxivMode.slice(6) : null
    v.target = arxivView && arxivList ? 1 : 0
    v.focusTarget = arxivView && focusId ? 1 : 0
    if (focusId) {
      v.focusId = focusId
      raise(v, focusId)
    }
    v.panelFocus = arxivView && (arxivMode === 'bar' || arxivMode === 'music') ? arxivMode : null
    // Focusing a box (a sheet, the controls or the music player) takes the camera to where the user
    // has put it, straight in front of it, turned the way the box is turned
    if (arxivView && (arxivMode === 'bar' || arxivMode === 'music')) {
      const spot = ARXIV_SPOTS[arxivMode]
      const m = moveOf(v, arxivMode)
      v.panelTarget = { ...spot, x: spot.x + m.x, y: spot.y + m.y, yaw: spot.yaw + m.yaw }
    } else if (arxivView && focusId) {
      // The camera also sinks a little so the controls under the sheets stay in view. In the list the
      // sheet is in its place in the long row, flat to the camera, and the focus stays that way as it
      // moves from one sheet to the next.
      const m = moveOf(v, focusId)
      v.panelTarget = arxivList && v.listOrder.includes(focusId)
        ? { x: sheetBase(v, focusId, ARXIV_LAYOUT.listGap, v.listOrder).x, y: -ARXIV_LAYOUT.compareDrop, d: ARXIV_LAYOUT.compareDistance, yaw: 0 }
        : { x: sheetBase(v, focusId).x + m.x, y: m.y - ARXIV_LAYOUT.compareDrop, d: ARXIV_LAYOUT.compareDistance, yaw: m.yaw }
    } else {
      v.panelTarget = null
    }
  }, [arxivView, arxivMode, sheetIds, listIds, arxivList])

  // A focus starts from the focus pose itself: the tilt, zoom and roaming the camera had before are
  // taken off, or the box would not land in the middle, face on
  useEffect(() => {
    if (arxivView && (arxivMode.startsWith('focus:') || arxivMode === 'bar' || arxivMode === 'music')) {
      arxivCompare.current.resetCamera = true
    }
  }, [arxivView, arxivMode])

  // R puts the sheets, the controls and the music player back where they started (and the camera
  // back to the overview); Esc goes back to the overview from a focus; Page Up and Page Down (or the up
  // and down arrows) turn the page of the paper in focus. All but Esc are ignored while typing.
  const arxivModeRef = useRef(arxivMode)
  arxivModeRef.current = arxivMode
  useEffect(() => {
    if (!arxivView) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArxivMode('overview')
        return
      }
      const field = e.target as HTMLElement | null
      if (field && (/^(input|textarea|select)$/i.test(field.tagName) || field.isContentEditable)) return
      const mode = arxivModeRef.current
      if (mode.startsWith('focus:') && ['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        stepArxivPage(mode.slice(6), e.key === 'PageDown' || e.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return
      restoreDefaults(arxivCompare.current)
      setArxivMode('overview')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [arxivView, stepArxivPage])
  useEffect(() => {
    if (!arxivView) {
      arxivInfoRef.current = {}
      setArxivInfo({})
      setArxivMode('overview')
      arxivCompare.current.t = 0
      arxivCompare.current.fa = 0
      arxivCompare.current.pa = 0
    }
  }, [arxivView])

  // The arXiv box is drawn shortly after the camera starts moving, like the others
  const [showArxiv, setShowArxiv] = useState(false)
  useEffect(() => {
    if (!(arxivView && isReady)) {
      setShowArxiv(false)
      return
    }
    const timer = window.setTimeout(() => setShowArxiv(true), 300)
    return () => window.clearTimeout(timer)
  }, [arxivView, isReady])

  // Camera spawn at random position - use lazy initialization for initial state
  const [initialCamera] = useState(() => {
    const position = {
      x: -170 + Math.random() * (35 - (-170)),
      y: 40 + Math.random() * 60,
      z: -40 + Math.random() * (160 - (-40))
    }
    return position
  })
  
  // Initialize camera state on mount only
  useEffect(() => {
    setCameraPos(initialCamera)
    setCameraRotation({
      yaw: Math.random() * 360 - 180,
      pitch: -90 + Math.random() * 60
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Defer the Canvas past the first paint (double rAF) so the nav is
  // interactive before Three.js starts blocking the main thread.
  useEffect(() => {
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setCanvasMounted(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])
  
  // Handle model ready
  const handleReady = useCallback(() => {
    setIsReady(true)
  }, [])
  
  // Handle start exploring
  const handleStartExploring = useCallback(() => {
    setProfileOpen(false)
    setGoingHome(false)
    setStartCinema(true)
    setUserInteracted(true) // Trigger music playback
  }, [])
  
  // Toggle cinema mode handler (mobile)
  const handleToggleCinema = useCallback(() => {
    setStartCinema(prev => !prev)
  }, [])
  
  // Custom cursor styling
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'summoners-rift-cursor-override'
    style.innerHTML = `
      body, body *, .summoners-rift-test, .summoners-rift-test * {
        cursor: url(/cursor.png), auto !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      const customStyle = document.getElementById('summoners-rift-cursor-override')
      if (customStyle) {
        customStyle.remove()
      }
    }
  }, [])


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
        @keyframes fadeInBottom {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
      
      {/* Fixed Camera Info - Top Left (below nav bar) */}
      {!subView && <PositionBox pos={cameraPos} rot={cameraRotation} />}

      {/* Back to Home button removed - nav bar replaces it */}

      {/* Three.js Canvas */}
      {canvasMounted && (
      <Canvas
        // A click on the background (nothing in the scene was hit) zooms the arXiv view back out
        onPointerMissed={() => setArxivMode((m) => (m === 'overview' ? m : 'overview'))}
        style={{
          width: '100vw', 
          height: '100vh', 
          display: 'block',
          position: 'fixed',
          top: 0,
          left: 0,
          // In the arXiv view the canvas stands above the 3D panels (z-index 800) and below the HUD
          // (1000+), so it can hide them behind a sheet; see Css3dPanels
          zIndex: arxivView ? 850 : undefined
        }}
        camera={{ 
          position: [initialCamera.x, initialCamera.y, initialCamera.z],
          fov: 60,
          near: 0.5, // a tight near/far range keeps depth precise, so models under the map stay hidden
          far: 600 // the fog is fully opaque by 500
        }}
        shadows
        gl={{ 
          powerPreference: mobile ? "default" : "high-performance",  // Mobile: Battery savings
          stencil: false,
          depth: true,
          logarithmicDepthBuffer: true // overlapping map surfaces z-fight without it
        }}
        dpr={ [1, 1.5]}
      >
        {/* Background */}
        <color attach="background" args={[SKY_COLOR]} />
        <fog attach="fog" args={[SKY_COLOR, 200, 500]} />
        
        {/* Lighting - Mobile vs Desktop */}
        <ambientLight intensity={25} />


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
          <SummonersRiftModel onReady={handleReady} isMobileDevice={mobile} />
        </Suspense>

        {/* Towers, nexuses and champions built from real CC0 models. They are mounted, and so start to
            download, once the map's file is in: about forty megabytes of models loading beside the map
            kept the loading screen up more than twice as long. Each one appears as it arrives. */}
        {(mapFetched || isReady) && (
          <Suspense fallback={null}>
            {/* The floating tags over the models are off in the arXiv view, and back as they were elsewhere */}
            <RiftModels hideTags={arxivView} />
          </Suspense>
        )}

        {/* The controls and the music player of the arXiv view, inside the scene. After the camera
            controller, so they see where the camera is this frame. */}
        {arxivView && isReady && (
          <Css3dPanels anchor={{ position: ARXIV_VIEW.position, yaw: ARXIV_VIEW.pose.yaw }} panels={ARXIV_PANELS} view={arxivCompare} />
        )}

        {/* The two papers of the arXiv view, inside the scene */}
        {arxivView && isReady && (
          <Suspense fallback={null}>
            <ArxivPapers
              papers={arxivPapers}
              anchor={{ position: ARXIV_VIEW.position, yaw: ARXIV_VIEW.pose.yaw }}
              compare={arxivCompare}
              onInfo={onArxivInfo}
              onPick={(sheetId) => setArxivMode(`focus:${sheetId}`)}
            />
          </Suspense>
        )}

        {/* WASD Camera Controller */}
        <CameraController
          onPositionChange={setCameraPos}
          onRotationChange={setCameraRotation}
          controlsRef={controlsRef}
          goingHome={goingHome}
          projectsMode={subView}
          freeView={blogView ? 'blog' : arxivView ? 'arxiv' : null}
          arxivCompare={arxivCompare}
          onArxivPage={stepArxivPage}
          startCinema={startCinema}
          onNearHome={handleNearHome}
        />

        {/* Controls */}
        <OrbitControls
          makeDefault
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
        />
      </Canvas>
      )}

      {/* Loading Overlay with Progress */}
      {!loaderGone && <LoadingScreen done={isReady} />}

      {/* Center Content - Only show button when secret is false, show full panel when secret is true */}
      {goingHome && showCenterPanel && !secret && (
        <div style={{
          position: 'fixed',
          top: '90%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 4000
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

      {/* Layout editor pill and panel (local only, open by default) */}
      {!subView && <LayoutEditorUI />}

      {/* Quick button to bring the profile back after it has been closed */}
      {secret && drawn && isReady && !subView && !((goingHome && showCenterPanel) || profileOpen) && (
        <DragButton
          id="profile-button"
          onClick={() => setProfileOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4000,
            padding: '8px 18px',
            background: 'linear-gradient(135deg, rgba(1, 10, 19, 0.95) 0%, rgba(0, 20, 40, 0.9) 100%)',
            border: '1px solid #C8AA6E',
            color: '#C8AA6E',
            fontFamily: '"Beaufort for LOL", "Times New Roman", serif',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 0 14px rgba(200, 170, 110, 0.3)',
          }}
        >
          ⬢ Profile
        </DragButton>
      )}

      {/* Center Content - League of Legends Style Panel - Only when secret is true */}
      {secret && ((goingHome && showCenterPanel) || profileOpen) && (
        <div className="hud-box" style={{
          position: 'fixed',
          // Docked to the bottom of the screen, centred
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          maxHeight: 'calc(100vh - 110px)',
          overflowY: 'auto',
          zIndex: 4000,
          padding: mobile ? `${hudPad(30)} ${hudPad(20)}` : `${hudPad(60)} ${hudPad(80)}`,
          textAlign: 'center',
          // A fluid starting width. PanelChrome replaces it with the dragged size, if any.
          width: mobile ? 'calc(100vw - 24px)' : 'min(700px, calc(100vw - 24px))',
          opacity: 0,
          // Only the fade-in: the border, glow and corners are the shared box look
          animation: 'fadeInBottom 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }} data-hud-draw="Profile" data-hud-always>
          <PanelChrome id="profile" label="Profile" resizable noButton minWidth={280} minHeight={180} />
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
            padding: mobile ? `${hud(6)} ${hud(15)}` : `${hud(8)} ${hud(30)}`,
            clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
            fontSize: mobile ? hud(9) : hud(12),
            fontWeight: 'bold',
            letterSpacing: mobile ? '1px' : '2px',
            color: '#0A1428',
            textTransform: 'uppercase',
            boxShadow: '0 4px 15px rgba(200, 170, 110, 0.6)'
          }} data-hud-type>
            ⬢ Summoner Profile ⬢
          </div>

          {/* Title with LoL gold - Enhanced */}
          <h2 style={{ 
            margin: mobile ? '20px 0 10px 0' : '30px 0 15px 0', 
            fontSize: mobile ? hud(28) : hud(42),
            fontWeight: 'bold',
            color: '#C8AA6E',
            textTransform: 'uppercase',
            letterSpacing: mobile ? '2px' : '4px',
            textShadow: '0 0 25px rgba(200, 170, 110, 0.6), 0 0 50px rgba(10, 200, 255, 0.4)',
            lineHeight: '1.2'
          }} data-hud-type>
            Longpan Zhou
          </h2>
          
          {/* Role Badge */}
          <div style={{
            display: 'inline-block',
            background: 'rgba(10, 200, 255, 0.1)',
            border: '2px solid #0AC8FF',
            padding: mobile ? `${hud(6)} ${hud(15)}` : `${hud(8)} ${hud(25)}`,
            marginBottom: mobile ? '20px' : '30px',
            clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            fontSize: mobile ? hud(11) : hud(13),
            color: '#0AC8FF',
            letterSpacing: mobile ? '1.5px' : '3px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            boxShadow: '0 0 20px rgba(10, 200, 255, 0.3)'
          }} data-hud-type>
            ⬡ Software Developer ⬡
          </div>

          {/* Social Links - Enhanced LoL Style */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: mobile ? '10px' : '15px',
            marginBottom: mobile ? '20px' : '35px'
          }} data-hud-fade data-hud-draw="Links" data-hud-always>
            <SocialLink href="mailto:patrickzhoul123@gmail.com" title="Email" icon={Email} alt="Email" mobile={mobile} />
            <SocialLink href="https://github.com/LongpanZhou" title="GitHub" icon={Github} alt="GitHub" mobile={mobile} external />
            <SocialLink href="https://leetcode.com/u/longpanzhou/" title="LeetCode" icon={Leetcode} alt="LeetCode" mobile={mobile} external />
            <SocialLink href="https://www.linkedin.com/in/longpan-zhou/" title="LinkedIn" icon={Linkedin} alt="LinkedIn" mobile={mobile} external />
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
              fontSize: mobile ? hud(14) : hud(16),
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: mobile ? '1px' : '2px',
              padding: mobile ? `${hud(12)} ${hud(20)}` : `${hud(15)} ${hud(40)}`,
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
      {!mobile && !subView && (
      <div className="controls-info hud-box" data-hud-draw="Controls" data-hud-always>
        <PanelChrome id="controls-below" label="Controls" resizable fillText minWidth={110} minHeight={60} />
        <h3 data-hud-type>Controls</h3>
        <ul data-hud-draw="Keys" data-hud-always>
            <li data-hud-fade><strong>C:</strong> Auto camera</li>
            <li data-hud-fade><strong>W A S D:</strong> Move</li>
            <li data-hud-fade><strong>Q E:</strong> Down / up</li>
            <li data-hud-fade><strong>Space:</strong> Up</li>
            <li data-hud-fade><strong>Ctrl:</strong> Down</li>
            <li data-hud-fade><strong>Left drag:</strong> Look</li>
          <li data-hud-fade><strong>Right drag:</strong> Pan</li>
          <li data-hud-fade><strong>Scroll:</strong> Zoom</li>
        </ul>
      </div>
      )}

  {/* Music Player - hidden on mobile */}
  {!mobile && secret && <MusicPlayer onUserInteraction={userInteracted} view={view} onFocusBox={() => setArxivMode('music')} />}

      {/* README and repos over the map in the Projects view */}
      {showProjects && projectsView && <ProjectsHud projects={repos.projects} />}
      {showBlog && blogView && <BlogHud />}
      {showArxiv && arxivView && (
        <ArxivHud
          papers={arxivPapers.map((p) => ({ ...p, ...(arxivInfo[p.id] ?? idlePaperInfo()) }))}
          urlError={arxivTarget ? null : 'The address is not a PDF link.'}
          listLayout={arxivList}
          onToggleList={toggleArxivList}
          onFocusSheet={(sheetId) => {
            setArxivLeftOut((out) => out.filter((x) => x !== sheetId))
            setArxivMode(`focus:${sheetId}`)
          }}
          leftOut={arxivLeftOut}
          onToggleListed={toggleArxivListed}
          onAdd={addArxivPaper}
          onRemove={removeArxivPaper}
          onReorder={reorderArxivPaper}
          onFocusBox={() => setArxivMode('bar')}
          onReset={() => {
            restoreDefaults(arxivCompare.current)
            setArxivMode('overview')
          }}
        />
      )}

      {/* Wireframe boxes over the HUD panels above (home page only) */}
      <HudDraw ready={isReady} onDone={() => setDrawn(true)} />
    </div>
  )
}

// Enhanced loading screen with progress
function LoadingScreen({ done }: { done: boolean }) {
  // Most of the bar is the map's file arriving, by its bytes. The rest is the map being unpacked, for
  // which drei's progress (loaded items over known items) is the only measure: more items are
  // discovered while loading, so that number can start high and fall back. The bar shows the highest
  // value reached so far, eased toward it, and only reads 100 once the scene is ready (this screen
  // then fades away).
  const { progress: raw } = useProgress()
  const rawRef = useRef(raw)
  rawRef.current = raw
  const best = useRef(0)
  if (done) best.current = 100
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (t: number) => {
      const k = 1 - Math.exp(-((t - last) / 1000) * 7.5)
      last = t
      const now = mapFraction < 1 ? mapFraction * 90 : 90 + Math.min(rawRef.current, 100) * 0.09
      best.current = Math.max(best.current, Math.min(now, 99))
      setProgress((p) => (best.current - p < 0.05 ? best.current : p + (best.current - p) * k))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <Loader label="Loading Summoner's Rift" progress={progress} done={done} />
}

// Loading indicator for Suspense
function LoadingIndicator() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 1.2 * delta
      meshRef.current.rotation.y += 1.2 * delta
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
