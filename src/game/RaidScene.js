import Phaser from 'phaser'
import characterSheet from '../assets/sprites/kenney_roguelike-characters/Spritesheet/roguelikeChar_transparent.png'
import dungeonSheet from '../assets/sprites/kenney_roguelike-caves-dungeons/Spritesheet/roguelikeDungeon_transparent.png'
import itemSheet from '../assets/sprites/kenney_roguelike-rpg-pack/Spritesheet/roguelikeSheet_transparent.png'

const TILE = 32
const MAP_WIDTH = 20
const MAP_HEIGHT = 13

const CHAMBER_POINTS = [
  { x: 4, y: 3, frame: 96, id: 0 },
  { x: 15, y: 3, frame: 98, id: 1 },
  { x: 10, y: 6, frame: 100, id: 2 },
  { x: 5, y: 9, frame: 102, id: 3 },
  { x: 15, y: 9, frame: 104, id: 4 },
]

function emitGameEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`truthraider:${name}`, { detail }))
}

export class RaidScene extends Phaser.Scene {
  constructor() {
    super('TruthRaidersRaid')
  }

  init(data) {
    this.avatarFrame = data.avatarFrame ?? 9
  }

  preload() {
    this.load.spritesheet('raiders', characterSheet, {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
    })
    this.load.spritesheet('dungeon', dungeonSheet, {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
    })
    this.load.spritesheet('items', itemSheet, {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
    })
  }

  create() {
    this.cameras.main.setBackgroundColor('#070907')
    this.drawDungeon()
    this.createChambers()

    this.player = this.add.sprite(10 * TILE, 6 * TILE, 'raiders', this.avatarFrame)
    this.player.setScale(2.35)
    this.player.setDepth(10)

    this.playerHalo = this.add.circle(this.player.x, this.player.y + 5, 19, 0xc9b56b, 0.09)
    this.playerHalo.setStrokeStyle(1, 0xc9b56b, 0.5)
    this.playerHalo.setDepth(8)

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      interact: Phaser.Input.Keyboard.KeyCodes.SPACE,
    })

    this.input.keyboard.on('keydown-SPACE', () => this.tryInteract())
    this.interactionHint = this.add.text(MAP_WIDTH * TILE / 2, MAP_HEIGHT * TILE - 22, 'PRESS SPACE', {
      fontFamily: 'Cascadia Code, monospace',
      fontSize: '11px',
      color: '#f0d57a',
      backgroundColor: '#070907',
      padding: { x: 10, y: 5 },
    })
    this.interactionHint.setOrigin(0.5)
    this.interactionHint.setDepth(30)
    this.interactionHint.setAlpha(0)

    emitGameEvent('ready')
  }

  drawDungeon() {
    for (let row = 0; row < MAP_HEIGHT; row += 1) {
      for (let col = 0; col < MAP_WIDTH; col += 1) {
        const edge = row === 0 || col === 0 || row === MAP_HEIGHT - 1 || col === MAP_WIDTH - 1
        const frame = edge ? 33 + ((row + col) % 4) : 1 + ((row * 3 + col) % 4)
        const tile = this.add.sprite(col * TILE + TILE / 2, row * TILE + TILE / 2, 'dungeon', frame)
        tile.setScale(2)
        tile.setAlpha(edge ? 0.96 : 0.9)
      }
    }

    for (let col = 3; col < 17; col += 1) {
      this.add.sprite(col * TILE + TILE / 2, 6 * TILE + TILE / 2, 'dungeon', 13).setScale(2).setAlpha(0.72)
    }

    for (let row = 2; row < 11; row += 1) {
      this.add.sprite(10 * TILE + TILE / 2, row * TILE + TILE / 2, 'dungeon', 13).setScale(2).setAlpha(0.72)
    }

    const title = this.add.text(18, 18, 'FALSE-LIGHT CATACOMBS', {
      fontFamily: 'Cascadia Code, monospace',
      fontSize: '12px',
      color: '#c9b56b',
      letterSpacing: 2,
    })
    title.setDepth(20)
  }

  createChambers() {
    this.chambers = CHAMBER_POINTS.map((point) => {
      const x = point.x * TILE + TILE / 2
      const y = point.y * TILE + TILE / 2
      const ring = this.add.circle(x, y, 26, 0x111d16, 0.62)
      ring.setStrokeStyle(2, 0xc9b56b, 0.72)

      const relic = this.add.sprite(x, y, 'items', point.frame)
      relic.setScale(2.4)
      relic.setDepth(9)

      this.tweens.add({
        targets: [ring, relic],
        y: y - 3,
        duration: 1200 + point.id * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })

      const label = this.add.text(x, y + 33, `LEVEL ${point.id + 1}`, {
        fontFamily: 'Cascadia Code, monospace',
        fontSize: '9px',
        color: '#8b8161',
      })
      label.setOrigin(0.5)

      return { ...point, x, y, ring, relic }
    })
  }

  update(_time, delta) {
    const speed = 0.16 * delta
    const moveX = Number(this.keys.right.isDown || this.keys.arrowRight.isDown) - Number(this.keys.left.isDown || this.keys.arrowLeft.isDown)
    const moveY = Number(this.keys.down.isDown || this.keys.arrowDown.isDown) - Number(this.keys.up.isDown || this.keys.arrowUp.isDown)

    if (moveX !== 0 || moveY !== 0) {
      const nextX = Phaser.Math.Clamp(this.player.x + moveX * speed, TILE * 1.35, TILE * (MAP_WIDTH - 1.35))
      const nextY = Phaser.Math.Clamp(this.player.y + moveY * speed, TILE * 1.35, TILE * (MAP_HEIGHT - 1.35))
      this.player.setPosition(nextX, nextY)
      this.player.setFlipX(moveX < 0)
    }

    this.playerHalo.setPosition(this.player.x, this.player.y + 5)
    this.highlightNearestChamber()
  }

  highlightNearestChamber() {
    this.nearestChamber = null
    for (const chamber of this.chambers) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, chamber.x, chamber.y)
      const near = distance < 58
      chamber.ring.setStrokeStyle(near ? 3 : 2, near ? 0xf0d57a : 0xc9b56b, near ? 1 : 0.72)
      chamber.relic.setAlpha(near ? 1 : 0.76)
      if (near) this.nearestChamber = chamber
    }

    if (this.nearestChamber) {
      this.interactionHint.setText(`PRESS SPACE: LEVEL ${this.nearestChamber.id + 1}`)
      this.interactionHint.setAlpha(1)
    } else {
      this.interactionHint.setAlpha(0)
    }

    emitGameEvent('proximity', {
      chamberId: this.nearestChamber?.id ?? null,
    })
  }

  tryInteract() {
    if (!this.nearestChamber) return
    this.tweens.add({
      targets: this.nearestChamber.relic,
      scale: 3.2,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    })
    emitGameEvent('chamber', {
      chamberIndex: this.nearestChamber.id,
    })
  }
}
