import { useEffect, useRef, useState } from 'react'
import { PLANT_STEMS, PLANT_LEAVES, PLANT_BERRIES } from './teaPlantVectorData'

const TOTAL_FRAMES = 60

export default function Generator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('Initializing generator...')

  const parseOrigin = (origin: string) => {
    const parts = origin.split(' ')
    const bx = parseFloat(parts[0])
    const by = parseFloat(parts[1])
    return { bx, by }
  }

  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const parseHex = (hex: string) => {
      const cleanHex = hex.replace('#', '')
      const num = parseInt(cleanHex, 16)
      return [ (num >> 16) & 255, (num >> 8) & 255, num & 255 ]
    }
    const c1 = parseHex(color1)
    const c2 = parseHex(color2)
    const r = Math.round(c1[0] + factor * (c2[0] - c1[0]))
    const g = Math.round(c1[1] + factor * (c2[1] - c1[1]))
    const b = Math.round(c1[2] + factor * (c2[2] - c1[2]))
    return `rgb(${r}, ${g}, ${b})`
  }

  const getSkyColors = (progress: number) => {
    if (progress < 0.4) {
      const p = progress / 0.4
      return {
        top: interpolateColor('#060b08', '#1c2d24', p),
        bottom: interpolateColor('#101a14', '#573d12', p)
      }
    } else {
      const p = (progress - 0.4) / 0.6
      return {
        top: interpolateColor('#1c2d24', '#fbfaf8', p),
        bottom: interpolateColor('#573d12', '#d9e2dc', p)
      }
    }
  }

  const drawLeaf = (ctx: CanvasRenderingContext2D, leaf: typeof PLANT_LEAVES[0], scale: number) => {
    if (scale <= 0) return
    const { bx, by } = parseOrigin(leaf.origin)

    ctx.save()
    ctx.translate(bx, by)
    ctx.scale(scale, scale)
    ctx.translate(-bx, -by)

    const leafPath = new Path2D(leaf.d)
    const leafGrad = ctx.createLinearGradient(bx, by, bx + 60, by - 60)
    leafGrad.addColorStop(0, '#163513')
    leafGrad.addColorStop(1, '#377a31')
    ctx.fillStyle = leafGrad
    ctx.fill(leafPath)

    ctx.strokeStyle = '#0e230b'
    ctx.lineWidth = 1.6
    ctx.stroke(leafPath)

    ctx.strokeStyle = '#8bb56e'
    ctx.lineWidth = 1.2
    ctx.stroke(new Path2D(leaf.centerVein))

    leaf.sideVeins.forEach((veinPath) => {
      ctx.stroke(new Path2D(veinPath))
    })

    ctx.restore()
  }

  const drawBerry = (ctx: CanvasRenderingContext2D, berry: typeof PLANT_BERRIES[0], scale: number) => {
    if (scale <= 0) return
    ctx.save()
    ctx.beginPath()
    ctx.arc(berry.cx, berry.cy, berry.r * scale, 0, Math.PI * 2)

    const grad = ctx.createRadialGradient(berry.cx - 2, berry.cy - 2, 1, berry.cx, berry.cy, berry.r)
    grad.addColorStop(0, '#ffbb33')
    grad.addColorStop(0.3, '#d48806')
    grad.addColorStop(1, '#7a2200')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
  }

  const renderFrameToBlob = async (frameIndex: number): Promise<Blob> => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    ctx.save()
    ctx.clearRect(0, 0, 1920, 1080)

    const progress = (frameIndex - 1) / (TOTAL_FRAMES - 1)

    // 1. Draw Sky
    const skyColors = getSkyColors(progress)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 1080)
    skyGrad.addColorStop(0, skyColors.top)
    skyGrad.addColorStop(1, skyColors.bottom)
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, 1920, 1080)

    // 2. Draw Sun
    ctx.save()
    const sunY = 620 - progress * 180
    const sunRadius = 140 + progress * 60
    const sunGrad = ctx.createRadialGradient(960, sunY, 10, 960, sunY, sunRadius)
    sunGrad.addColorStop(0, 'rgba(255, 240, 200, 0.95)')
    sunGrad.addColorStop(0.3, 'rgba(255, 180, 50, 0.4)')
    sunGrad.addColorStop(1, 'rgba(255, 100, 0, 0)')
    ctx.fillStyle = sunGrad
    ctx.beginPath()
    ctx.arc(960, sunY, sunRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 3. Draw Parallax Mountains
    const farOffset = (1 - progress) * 35
    const midOffset = (1 - progress) * 15

    // Mountain 1 (Far silhouette)
    ctx.fillStyle = progress < 0.4 
      ? interpolateColor('#0a110d', '#1e2d23', progress / 0.4)
      : interpolateColor('#1e2c23', '#cdd6d0', (progress - 0.4) / 0.6)
    ctx.beginPath()
    ctx.moveTo(0, 1080)
    ctx.lineTo(0, 650 + farOffset)
    ctx.quadraticCurveTo(500, 520 + farOffset, 1000, 680 + farOffset)
    ctx.quadraticCurveTo(1500, 840 + farOffset, 1920, 620 + farOffset)
    ctx.lineTo(1920, 1080)
    ctx.closePath()
    ctx.fill()

    // Mountain 2 (Mid range)
    ctx.fillStyle = progress < 0.4
      ? interpolateColor('#0c1712', '#25382d', progress / 0.4)
      : interpolateColor('#25382d', '#b5c4bc', (progress - 0.4) / 0.6)
    ctx.beginPath()
    ctx.moveTo(0, 1080)
    ctx.lineTo(0, 750 + midOffset)
    ctx.quadraticCurveTo(700, 630 + midOffset, 1300, 790 + midOffset)
    ctx.quadraticCurveTo(1600, 870 + midOffset, 1920, 730 + midOffset)
    ctx.lineTo(1920, 1080)
    ctx.closePath()
    ctx.fill()

    // Mountain 3 (Fore-ground tea hills)
    ctx.fillStyle = progress < 0.4
      ? interpolateColor('#101c15', '#2a4235', progress / 0.4)
      : interpolateColor('#2a4235', '#95aa9c', (progress - 0.4) / 0.6)
    ctx.beginPath()
    ctx.moveTo(0, 1080)
    ctx.lineTo(0, 860)
    ctx.quadraticCurveTo(960, 790, 1920, 890)
    ctx.lineTo(1920, 1080)
    ctx.closePath()
    ctx.fill()

    // 4. Draw Stems
    PLANT_STEMS.forEach((stemPath, index) => {
      const startFrame = 1 + index * 1.6
      const duration = 7
      let stemProgress = 0

      if (frameIndex >= startFrame + duration) {
        stemProgress = 1
      } else if (frameIndex > startFrame) {
        stemProgress = (frameIndex - startFrame) / duration
      }

      if (stemProgress <= 0) return

      const path = new Path2D(stemPath)
      ctx.save()
      ctx.strokeStyle = progress < 0.4 
        ? interpolateColor('#0c1310', '#1c2620', progress / 0.4)
        : interpolateColor('#1c2620', '#101613', (progress - 0.4) / 0.6)
      ctx.lineWidth = 4.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (stemProgress < 1) {
        ctx.setLineDash([stemProgress * 650, 650])
      }
      ctx.stroke(path)
      ctx.restore()
    })

    // 5. Draw Node Berries
    PLANT_BERRIES.forEach((berry, index) => {
      const startFrame = 14 + index * 0.6
      const duration = 6
      let berryScale = 0

      if (frameIndex >= startFrame + duration) {
        berryScale = 1
      } else if (frameIndex > startFrame) {
        berryScale = (frameIndex - startFrame) / duration
      }

      drawBerry(ctx, berry, berryScale)
    })

    // 6. Draw Blooming Leaves
    const sortedLeaves = [...PLANT_LEAVES].sort((a, b) => {
      const ay = parseFloat(a.origin.split(' ')[1])
      const by = parseFloat(b.origin.split(' ')[1])
      return by - ay
    })

    sortedLeaves.forEach((leaf, index) => {
      const isApex = leaf.id.includes('apex')
      let startFrame = 16
      let duration = 9

      if (isApex) {
        startFrame = 49 + (index % 3) * 2.5
        duration = 7
      } else {
        startFrame = 16 + (index / (sortedLeaves.length - 3)) * 31
        duration = 8
      }

      let leafScale = 0
      if (frameIndex >= startFrame + duration) {
        leafScale = 1
      } else if (frameIndex > startFrame) {
        const lp = (frameIndex - startFrame) / duration
        leafScale = 1 - Math.pow(1 - lp, 3)
      }

      drawLeaf(ctx, leaf, leafScale)
    })

    ctx.restore()

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!)
      }, 'image/webp', 0.92)
    })
  }

  useEffect(() => {
    const runGeneration = async () => {
      setStatus('Starting frame rendering...')
      for (let i = 1; i <= TOTAL_FRAMES; i++) {
        setStatus(`Rendering frame ${i}/${TOTAL_FRAMES}...`)
        const blob = await renderFrameToBlob(i)
        const frameFileName = `${String(i).padStart(2, '0')}.webp`
        
        setStatus(`Uploading frame ${frameFileName}...`)
        await fetch(`http://localhost:9999/save?name=${frameFileName}`, {
          method: 'POST',
          body: blob
        })
      }
      setStatus('All 60 frames rendered and saved successfully to public/webp!')
    }

    // Run after short delay to ensure canvas mount
    setTimeout(runGeneration, 500)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#111] text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Elegantsip Frame Generator</h1>
      <p className="text-gray-400 mb-6">{status}</p>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="border border-white/20 max-w-4xl w-full aspect-video bg-black shadow-2xl rounded-lg"
      />
    </div>
  )
}
