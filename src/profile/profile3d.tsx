import { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import './profile3d.css'
import Linkedin from './icons/linkedin.svg'
import Github from './icons/github.svg'
import Leetcode from './icons/leetcode.svg'
import Email from './icons/gmail.svg'

// Interactive Particle System
function ParticleField({ onHover }: { onHover: (hovered: boolean) => void }) {
  const particlesRef = useRef<THREE.Points>(null)
  const particleCount = 3000
  
  // Generate particle positions in a sphere formation
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      
      // Create particles in a sphere
      const radius = 8 + Math.random() * 4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos((Math.random() * 2) - 1)
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i3 + 2] = radius * Math.cos(phi)
      
      // Gradient colors from cyan to gold
      const colorMix = Math.random()
      colors[i3] = colorMix * 0.78 + (1 - colorMix) * 0.0  // R
      colors[i3 + 1] = colorMix * 0.67 + (1 - colorMix) * 0.83  // G
      colors[i3 + 2] = colorMix * 0.43 + (1 - colorMix) * 1.0  // B
    }
    
    return { positions, colors }
  }, [])

  // Animate particles
  useFrame((state) => {
    if (particlesRef.current) {
      const time = state.clock.elapsedTime
      particlesRef.current.rotation.y = time * 0.05
      particlesRef.current.rotation.x = Math.sin(time * 0.1) * 0.1
      
      // Wave effect
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        const x = positions[i3]
        const y = positions[i3 + 1]
        const z = positions[i3 + 2]
        
        const distance = Math.sqrt(x * x + y * y + z * z)
        const wave = Math.sin(distance * 0.5 - time * 2) * 0.3
        
        positions[i3 + 1] = y + wave * 0.01
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(true)
  }

  const handlePointerOut = () => {
    onHover(false)
  }

  return (
    <points 
      ref={particlesRef}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Floating Text
function FloatingText() {
  const textRef = useRef<any>(null)
  
  useFrame((state) => {
    if (textRef.current) {
      textRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.3
    }
  })

  return (
    <Text
      ref={textRef}
      position={[0, 0, 0]}
      fontSize={0.8}
      color="#00d4ff"
      anchorX="center"
      anchorY="middle"
      fontWeight="bold"
    >
      HOVER TO REVEAL
    </Text>
  )
}

// Central Glow Effect
function CentralGlow() {
  return (
    <>
      <pointLight position={[0, 0, 0]} color="#00d4ff" intensity={2} distance={15} />
      <pointLight position={[5, 5, 5]} color="#c8aa6e" intensity={1.5} distance={10} />
      <pointLight position={[-5, -5, -5]} color="#00d4ff" intensity={1.5} distance={10} />
    </>
  )
}

function Profile3D() {
  const [showCard, setShowCard] = useState(false)

  return (
    <div className='particle-profile-container'>
      {/* Three.js Canvas */}
      <div className='particle-canvas'>
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <color attach="background" args={['#010a13']} />
          <fog attach="fog" args={['#010a13', 10, 30]} />
          
          <ambientLight intensity={0.2} />
          <CentralGlow />
          
          <ParticleField onHover={setShowCard} />
          {!showCard && <FloatingText />}
          
          <OrbitControls 
            enableZoom={false}
            autoRotate={!showCard}
            autoRotateSpeed={0.5}
            enablePan={false}
          />
        </Canvas>
      </div>

      {/* Profile Card - Shows on Hover */}
      <div className={`particle-card ${showCard ? 'particle-card-visible' : ''}`}>
        <div className='particle-card-inner'>
          {/* Header with hextech effects */}
          <div className='particle-card-header'>
            <div className='particle-level-badge'>
              <span className='particle-level'>∞</span>
            </div>
            <div className='particle-name-section'>
              <h1 className='particle-name'>Longpan Zhou</h1>
              <p className='particle-title'>Software Developer</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className='particle-stats'>
            <div className='particle-stat'>
              <span className='particle-stat-label'>Stack</span>
              <span className='particle-stat-value'>Full Stack</span>
            </div>
            <div className='particle-stat'>
              <span className='particle-stat-label'>Rank</span>
              <span className='particle-stat-value'>Challenger</span>
            </div>
            <div className='particle-stat'>
              <span className='particle-stat-label'>Status</span>
              <span className='particle-stat-value'>Available</span>
            </div>
          </div>

          {/* Languages */}
          <div className='particle-languages'>
            <div className='particle-lang-badge'>Python</div>
            <div className='particle-lang-badge'>C++</div>
            <div className='particle-lang-badge'>React.js</div>
          </div>

          {/* About */}
          <div className='particle-about'>
            <div className='particle-section-title'>
              <span className='particle-hex-icon'>⬡</span>
              About Me
            </div>
            <p className='particle-about-text'>
              I'm a Software Developer specializing in Python, C++, and React.js. My expertise 
              spans a diverse range of technologies, enabling me to build everything from low-level 
              system applications to cutting-edge AI solutions.
              <br/><br/>
              I'm passionate about continuous learning, problem-solving, and crafting elegant code. 
              When I'm not coding, you'll find me reading tech articles or competing in League of Legends!
            </p>
          </div>

          {/* Social Links */}
          <div className='particle-socials'>
            <a href="https://www.linkedin.com/in/longpan-zhou/" target="_blank" rel="noopener noreferrer" className='particle-social-icon' title="LinkedIn">
              <img src={Linkedin} alt="LinkedIn" />
            </a>
            <a href="https://github.com/LongpanZhou" target="_blank" rel="noopener noreferrer" className='particle-social-icon' title="GitHub">
              <img src={Github} alt="GitHub" />
            </a>
            <a href="https://leetcode.com/u/longpanzhou/" target="_blank" rel="noopener noreferrer" className='particle-social-icon' title="LeetCode">
              <img src={Leetcode} alt="LeetCode" />
            </a>
            <a href="mailto:patrickzhoul123@gmail.com" className='particle-social-icon' title="Email">
              <img src={Email} alt="Email" />
            </a>
          </div>

          {/* Action Buttons */}
          <div className='particle-actions'>
            <a href="https://github.com/LongpanZhou" className='particle-btn particle-btn-primary' target="_blank" rel="noopener noreferrer">
              View Projects
            </a>
            <a href="https://leetcode.com/u/longpanzhou/" className='particle-btn particle-btn-secondary' target="_blank" rel="noopener noreferrer">
              Challenge Me
            </a>
          </div>
        </div>
      </div>

      {/* Instruction text */}
      <div className={`particle-instruction ${showCard ? 'particle-instruction-hidden' : ''}`}>
        Move your mouse over the particle field
      </div>
    </div>
  )
}

export default Profile3D

