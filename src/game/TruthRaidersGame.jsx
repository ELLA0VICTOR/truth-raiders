import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { RaidScene } from './RaidScene'

export default function TruthRaidersGame({ avatarFrame, onReady, onChamber, onProximity }) {
  const mountRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    if (!mountRef.current || gameRef.current) return undefined

    const handleReady = () => onReady?.()
    const handleChamber = (event) => onChamber?.(event.detail.chamberIndex)
    const handleProximity = (event) => onProximity?.(event.detail.chamberId)

    window.addEventListener('truthraider:ready', handleReady)
    window.addEventListener('truthraider:chamber', handleChamber)
    window.addEventListener('truthraider:proximity', handleProximity)

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mountRef.current,
      width: 640,
      height: 416,
      pixelArt: true,
      backgroundColor: '#070907',
      scene: RaidScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: false,
        pixelArt: true,
      },
      callbacks: {
        postBoot: (game) => {
          game.scene.start('TruthRaidersRaid', { avatarFrame })
        },
      },
    })

    return () => {
      window.removeEventListener('truthraider:ready', handleReady)
      window.removeEventListener('truthraider:chamber', handleChamber)
      window.removeEventListener('truthraider:proximity', handleProximity)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [avatarFrame, onChamber, onProximity, onReady])

  return <div ref={mountRef} className="game-canvas" />
}
