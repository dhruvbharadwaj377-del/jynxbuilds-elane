import { useCallback, useEffect, useRef, useState } from 'react'
import { chapters, hotspotIndex } from './chapters.js'
import './experience.css'

const LAST = chapters.length - 1

// ---------------------------------------------------------------------------
// Capability checks
// ---------------------------------------------------------------------------

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Returns null when 3D should not run at all, otherwise a quality tier.
function detectQuality() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return null
  }
  if (navigator.connection?.saveData) return null
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return null

  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = window.innerWidth < 820
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4
  return coarse || small || fewCores || lowMemory ? 'low' : 'high'
}

// 'auto' | 'photo'
function readPreference() {
  try {
    return window.localStorage.getItem('elane:view') === 'photo' ? 'photo' : 'auto'
  } catch {
    return 'auto'
  }
}

function writePreference(view) {
  try {
    window.localStorage.setItem('elane:view', view === 'photo' ? 'photo' : 'auto')
  } catch {
    // Storage unavailable (private mode): the choice still applies for this visit.
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SalonExperience() {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const menuRef = useRef(null)
  const blockRefs = useRef([])
  const hotspotRefs = useRef({})
  const sceneRef = useRef(null)
  const activeRef = useRef(0)

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')

  const [quality] = useState(detectQuality)
  const [preference, setPreference] = useState(readPreference)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState(null)
  const [active, setActive] = useState(0)
  const [mood, setMood] = useState('evening')
  const [selectedHotspot, setOpenHotspot] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // The procedural 3D house is the default where the device can run it; the
  // site's own photography is the fallback and the opt-out.
  const can3D = Boolean(quality) && !failed
  const view = can3D && preference !== 'photo' ? '3d' : 'photo'
  const mode = view === 'photo' ? 'still' : ready ? 'ready' : 'loading'
  const live3D = view === '3d' && ready

  // A feature card only stays open while its chapter is on screen
  const openHotspot =
    selectedHotspot && hotspotIndex[selectedHotspot].chapter === chapters[active].id ? selectedHotspot : null
  const feature = openHotspot ? hotspotIndex[openHotspot] : null
  const toggleHotspot = (id) => setOpenHotspot((current) => (current === id ? null : id))

  // ----- Scroll → progress -----

  // Measured from the chapter blocks themselves rather than assuming they are
  // all one viewport tall, so a taller card (large text, a short landscape
  // phone) can never put the camera out of step with the copy.
  const readProgress = useCallback(() => {
    const tops = blockRefs.current.map((el) => (el ? el.getBoundingClientRect().top : 0))
    if (tops.length < chapters.length) return 0
    if (tops[0] >= 0) return 0
    for (let i = 0; i < LAST; i++) {
      if (tops[i + 1] > 0) {
        const span = tops[i + 1] - tops[i]
        return span > 0 ? (i + -tops[i] / span) / LAST : i / LAST
      }
    }
    return 1
  }, [])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const progress = readProgress()
      const chapter = Math.round(progress * LAST)
      if (chapter !== activeRef.current) {
        activeRef.current = chapter
        setActive(chapter)
      }
      const scene = sceneRef.current
      if (scene) {
        // Reduced motion: cut between chapter compositions instead of flying
        if (reducedMotion) scene.setProgress(chapter / LAST, { instant: true })
        else scene.setProgress(progress)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [readProgress, reducedMotion])

  // Escape closes the feature card, then the menu
  useEffect(() => {
    if (!openHotspot && !menuOpen) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (openHotspot) setOpenHotspot(null)
      else setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openHotspot, menuOpen])

  // The menu closes on any click outside it
  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  // ----- Hotspot projection (runs after every rendered frame, no React work) -----

  const positionHotspots = useCallback((project, progress) => {
    const stage = stageRef.current
    const height = stage?.clientHeight || window.innerHeight
    const width = stage?.clientWidth || window.innerWidth
    // On portrait screens the chapter text fills the lower part of the frame
    const floor = width / height < 0.85 ? height * 0.56 : height
    const position = progress * LAST
    chapters.forEach((chapter, index) => {
      const arrived = Math.abs(position - index) < 0.12
      for (const hotspot of chapter.hotspots) {
        const el = hotspotRefs.current[hotspot.id]
        if (!el) continue
        const point = project(hotspot.position)
        const show = arrived && point.visible && point.y < floor
        el.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`
        if (el.dataset.visible !== String(show)) el.dataset.visible = String(show)
      }
    })
  }, [])

  // ----- 3D lifecycle -----

  useEffect(() => {
    if (view !== '3d') return undefined

    let cancelled = false
    let scene = null
    let resizeObserver = null
    let visibilityObserver = null

    const fail = () => {
      if (cancelled) return
      sceneRef.current?.dispose()
      sceneRef.current = null
      scene = null
      setNotice('3D unavailable, showing photography')
      setFailed(true)
    }

    const start = async () => {
      try {
        const { createSalonScene } = await import('./scene.js')
        if (cancelled || !canvasRef.current) return
        scene = createSalonScene({
          canvas: canvasRef.current,
          chapters,
          quality,
          onRender: positionHotspots,
          onContextLost: fail,
        })
        sceneRef.current = scene

        const stage = stageRef.current
        scene.resize(stage.clientWidth, stage.clientHeight)

        const progress = readProgress()
        const chapter = Math.round(progress * LAST)
        scene.setProgress(reducedMotion ? chapter / LAST : progress, { instant: true })

        resizeObserver = new ResizeObserver(([entry]) => {
          const { width, height } = entry.contentRect
          scene?.resize(width, height)
        })
        resizeObserver.observe(stage)

        // Stop drawing entirely when the walkthrough is offscreen
        visibilityObserver = new IntersectionObserver(([entry]) => {
          scene?.setActive(entry.isIntersecting)
        })
        visibilityObserver.observe(sectionRef.current)

        setReady(true)
      } catch (error) {
        console.warn('[Elane] 3D view unavailable, showing photography instead.', error)
        fail()
      }
    }

    // Let the page paint its photographic poster first, then build the scene.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 900 })
      : window.setTimeout(start, 200)

    return () => {
      cancelled = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      scene?.dispose()
      sceneRef.current = null
      setReady(false)
    }
  }, [view, quality, positionHotspots, readProgress, reducedMotion])

  // Lighting mood
  useEffect(() => {
    sceneRef.current?.setMood(mood === 'daylight' ? 1 : 0, { instant: reducedMotion })
  }, [mood, ready, reducedMotion])

  // Pointer parallax: desktop only, never with reduced motion
  useEffect(() => {
    if (!live3D || !finePointer || reducedMotion) return undefined
    const onMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = (event.clientY / window.innerHeight) * 2 - 1
      sceneRef.current?.setPointer(x, -y)
    }
    const onLeave = () => sceneRef.current?.setPointer(0, 0)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      sceneRef.current?.setPointer(0, 0)
    }
  }, [live3D, finePointer, reducedMotion])

  const goToChapter = (index) => {
    setOpenHotspot(null)
    blockRefs.current[index]?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const chooseView = (next) => {
    writePreference(next)
    setPreference(next === 'photo' ? 'photo' : 'auto')
    setNotice(null)
    setOpenHotspot(null)
  }

  const blockRef = (index) => (el) => {
    blockRefs.current[index] = el
  }

  const featureList = (chapter) =>
    chapter.hotspots.length > 0 && (
      <div className="elx-features">
        <span>In this view</span>
        <ul>
          {chapter.hotspots.map((hotspot) => (
            <li key={hotspot.id}>
              <button
                type="button"
                aria-expanded={openHotspot === hotspot.id}
                aria-controls="elx-feature"
                onClick={() => toggleHotspot(hotspot.id)}
              >
                {hotspot.label}
                <b aria-hidden="true">{openHotspot === hotspot.id ? '−' : '+'}</b>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <section
      ref={sectionRef}
      id="top"
      className={`elx elx--${mode} elx--${mood} elx--chapter-${chapters[active].id}`}
      aria-label="Elane, an interactive walk through the house"
    >
      {/* ================= STAGE (sticky) ================= */}

      <div ref={stageRef} className="elx-stage">
        <div className="elx-stills" aria-hidden="true">
          {chapters.map((chapter, index) => {
            // Outside the photographic view only the poster is kept, so the
            // chapter photos are never downloaded alongside the 3D scene.
            if (mode !== 'still' && index !== 0) return null
            return (
              <img
                key={chapter.id}
                src={chapter.still}
                alt=""
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'auto'}
                loading={index === 0 ? 'eager' : 'lazy'}
                className={(mode === 'still' ? index === active : true) ? 'is-active' : ''}
              />
            )
          })}
        </div>

        {view === '3d' && <canvas ref={canvasRef} className="elx-canvas" aria-hidden="true" />}

        <div className="elx-scrim" aria-hidden="true" />

        {/* Hotspots, positioned imperatively from the 3D camera. They are a
            pointer shortcut: keyboard and screen-reader users get the same
            features, in reading order, from each chapter's "In this view" list. */}
        <div className="elx-hotspots" aria-hidden="true">
          {live3D &&
            chapters.flatMap((chapter) =>
              chapter.hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  ref={(el) => {
                    hotspotRefs.current[hotspot.id] = el
                  }}
                  type="button"
                  className={`elx-hotspot ${openHotspot === hotspot.id ? 'is-open' : ''}`}
                  data-visible="false"
                  tabIndex={-1}
                  onClick={() => toggleHotspot(hotspot.id)}
                >
                  <span className="elx-hotspot-dot" />
                  <span className="elx-hotspot-label">{hotspot.label}</span>
                </button>
              )),
            )}
        </div>

        {/* Chapter rail */}
        <nav className="elx-rail" aria-label="Experience chapters">
          <ol>
            {chapters.map((chapter, index) => (
              <li key={chapter.id}>
                <button
                  type="button"
                  className={index === active ? 'is-active' : ''}
                  aria-current={index === active ? 'step' : undefined}
                  aria-label={`Chapter ${chapter.index}: ${chapter.label}`}
                  onClick={() => goToChapter(index)}
                >
                  <span>
                    <em>{chapter.index}</em> {chapter.label}
                  </span>
                  <i aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Feature card (opened from a hotspot or the chapter list) */}
        <div id="elx-feature" className="elx-feature" data-chapter={chapters[active].id} aria-live="polite">
          {feature && (
            <div className="elx-feature-card">
              <span>In this view</span>
              <h3>{feature.label}</h3>
              <p>{feature.detail}</p>
              <div className="elx-feature-actions">
                {feature.action && (
                  <a href={feature.action.href} onClick={() => setOpenHotspot(null)}>
                    {feature.action.label} <b aria-hidden="true">↘</b>
                  </a>
                )}
                <button type="button" onClick={() => setOpenHotspot(null)}>
                  Close <b aria-hidden="true">×</b>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status and the experience menu */}
        <div className="elx-controls">
          <div className="elx-status" role="status">
            {mode === 'loading' && <span className="elx-loading">Opening the house</span>}
            {mode === 'ready' && !notice && <span>Illustrative 3D interior</span>}
            {notice && mode !== 'loading' && <span>{notice}</span>}
            {mode === 'still' && !notice && <span>Photographic view</span>}
          </div>

          <div ref={menuRef} className={`elx-menu ${menuOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="elx-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="elx-menu-panel"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span>Experience</span>
              <i aria-hidden="true" />
            </button>
            <div id="elx-menu-panel" className="elx-menu-panel" hidden={!menuOpen}>
              {can3D && (
                <div className="elx-menu-group">
                  <span id="elx-view-label">View</span>
                  <div className="elx-segmented" role="group" aria-labelledby="elx-view-label">
                    {[
                      ['3d', '3D'],
                      ['photo', 'Photographs'],
                    ].map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={view === value} onClick={() => chooseView(value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {live3D && (
                <div className="elx-menu-group">
                  <span id="elx-light-label">Light</span>
                  <div className="elx-segmented" role="group" aria-labelledby="elx-light-label">
                    {[
                      ['evening', 'Evening'],
                      ['daylight', 'Daylight'],
                    ].map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={mood === value} onClick={() => setMood(value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!can3D && (
                <p className="elx-menu-note">
                  {quality
                    ? '3D could not start on this device, so photographs are shown.'
                    : 'Photographs are shown on this device to keep things fast.'}
                </p>
              )}
              {view === '3d' && (
                <p className="elx-menu-note">
                  The 3D house is an illustrative visualisation, not a photograph of the salon.
                </p>
              )}
              <a href="#house" className="elx-menu-skip" onClick={() => setMenuOpen(false)}>
                Skip the walkthrough <b aria-hidden="true">↓</b>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TRACK (scrolling content) ================= */}

      <div className="elx-track">
        {/* Chapter 01: The Arrival (the hero) */}
        <div ref={blockRef(0)} className={`elx-block elx-intro ${active === 0 ? 'is-active' : ''}`}>
          <div className="elx-intro-top">
            <span>Beauty House</span>
            <span>Gurugram · New Delhi</span>
          </div>

          <div className="elx-intro-main">
            <p className="elx-eyebrow">Est. 2026</p>
            <h1>
              Beauty,
              <br />
              <i>refined.</i>
            </h1>
            <p className="elx-intro-copy">
              A modern beauty house shaped around individuality, intention and the art of feeling like
              yourself.
            </p>
            <div className="elx-actions">
              <a href="#booking" className="elx-btn elx-btn--solid">
                <span>Book an appointment</span>
                <b aria-hidden="true">↗</b>
              </a>
              <button type="button" className="elx-btn" onClick={() => goToChapter(1)}>
                <span>Step inside</span>
                <b aria-hidden="true">↓</b>
              </button>
            </div>
            {featureList(chapters[0])}
          </div>

          <button type="button" className="elx-scroll-cue" onClick={() => goToChapter(1)}>
            <span>Scroll to enter</span>
            <i aria-hidden="true" />
          </button>
        </div>

        {/* Chapters 02 – 04 */}
        {chapters.slice(1, LAST).map((chapter, i) => {
          const index = i + 1
          return (
            <div
              key={chapter.id}
              ref={blockRef(index)}
              className={`elx-block elx-chapter elx-chapter--${chapter.id} ${active === index ? 'is-active' : ''}`}
            >
              <article className="elx-card">
                <p className="elx-card-eyebrow">{chapter.eyebrow}</p>
                <h2>
                  {chapter.title[0]}
                  <br />
                  <i>{chapter.title[1]}</i>
                </h2>
                <p className="elx-card-copy">{chapter.copy}</p>
                {chapter.photo && (
                  <figure className="elx-card-photo">
                    <img src={chapter.photo.src} alt={chapter.photo.alt} loading="lazy" decoding="async" />
                    <figcaption>Editorial photography</figcaption>
                  </figure>
                )}
                {featureList(chapter)}
                <span className="elx-card-index" aria-hidden="true">
                  {chapter.index} / 05
                </span>
              </article>
            </div>
          )
        })}

        {/* Chapter 05: Your Appointment */}
        <div ref={blockRef(LAST)} className={`elx-block elx-chapter elx-closing ${active === LAST ? 'is-active' : ''}`}>
          <article className="elx-card">
            <p className="elx-card-eyebrow">Chapter 05 / Your Appointment</p>
            <h2>
              Begin
              <br />
              <i>here.</i>
            </h2>
            <p className="elx-card-copy">
              Tell us what you&rsquo;re looking for and we&rsquo;ll take it from there. Golf Course Road,
              Gurugram &middot; Monday to Saturday, 10:00 to 20:00.
            </p>
            <div className="elx-actions">
              <a href="#booking" className="elx-btn elx-btn--solid">
                <span>Request an appointment</span>
                <b aria-hidden="true">↘</b>
              </a>
              <a href="#services" className="elx-btn">
                <span>View services</span>
                <b aria-hidden="true">↓</b>
              </a>
            </div>
            {featureList(chapters[LAST])}
            <span className="elx-card-index" aria-hidden="true">
              05 / 05
            </span>
          </article>
        </div>
      </div>
    </section>
  )
}
