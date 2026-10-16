// Story beats for the Elane walkthrough.
// Each chapter is one viewport of scroll. The camera travels between the
// keyframes (through any `via` points on the way, so it walks through the door
// and the arch rather than the walls), and the same data drives the text, the
// hotspots and the photographic fallback, so the three can never drift apart.
//
// World units are metres. The facade sits on z = 0; the street is +z and the
// house runs back to z = -20:
//   reception + lounge   z  0 → -5
//   styling floor        z -5 → -12.5   (stations on the east wall, x = 6)
//   arch / partition     z -12.5
//   ritual lounge        z -12.5 → -20  (wash basins on the back wall)
//
// Copy only restates what the site already says about the house; the 3D room
// is an illustrative visualisation and is labelled as such in the interface.

const IMG = '/Images'

export const chapters = [
  {
    id: 'arrival',
    label: 'The Arrival',
    index: '01',
    camera: { position: [3.4, 1.55, 15.5], target: [-0.6, 2.75, 0] },
    portraitCamera: { position: [0.9, 1.5, 17.5], target: [0, 2.9, 0] },
    portraitPush: 0,
    still: `${IMG}/hero.jpg`,
    hotspots: [
      {
        id: 'signage',
        label: 'Golf Course Road',
        position: [2.75, 4.4, 0.5],
        detail: 'Elane Beauty House, Golf Course Road, Gurugram. Open Monday to Saturday, 10:00 to 20:00.',
        action: { href: '#studio', label: 'Plan your visit' },
      },
      {
        id: 'entrance',
        label: 'The entrance',
        position: [0, 1.4, 0.5],
        detail:
          'A calm counterpoint to the pace of the city: step in from the street and the house slows down.',
      },
    ],
  },
  {
    id: 'floor',
    label: 'The Styling Floor',
    index: '02',
    eyebrow: 'Chapter 02 / The Styling Floor',
    title: ['Everything,', 'considered.'],
    copy:
      'Arched mirrors, soft backlight and stations set apart from one another. Precision cuts, colour, treatments and considered styling, without the noise.',
    via: [
      { position: [0.2, 1.62, 5], target: [0, 1.65, -4] },
      { position: [0, 1.62, -0.8], target: [1.4, 1.45, -7] },
    ],
    camera: { position: [-3.1, 1.72, -3.3], target: [5.0, 1.15, -10.4] },
    // Phones: further down the floor (clear of the reception desk) and
    // turned toward the stations
    portraitCamera: { position: [-1.5, 1.7, -2.4], target: [5.4, 1.0, -9.0] },
    portraitPush: 0.12,
    still: `${IMG}/interior.jpg`,
    hotspots: [
      {
        id: 'stations',
        label: 'Styling stations',
        position: [5.88, 1.95, -7.2],
        detail:
          'Each station pairs an arched mirror with an even, glare-free backlight, so colour and cut are judged in true light.',
        action: { href: '#services', label: 'View services' },
      },
      {
        id: 'consultation',
        label: 'Consultation first',
        position: [4.95, 1.05, -9.0],
        detail:
          'Our stylists listen first, understand the individual, then create something that feels unmistakably yours.',
      },
    ],
  },
  {
    id: 'ritual',
    label: 'The Ritual',
    index: '03',
    eyebrow: 'Chapter 03 / The Ritual',
    title: ['A slower', 'kind of care.'],
    copy:
      'Through the arch, the light drops and the room quietens. Reclined basins for washing and hair treatments, and a place for thoughtful skin rituals.',
    // Through the arch (3 m wide, centred on x = 0) before turning
    via: [
      { position: [0.1, 1.62, -10.2], target: [0, 1.35, -17] },
      { position: [0.4, 1.56, -13.1], target: [-0.6, 1.0, -19] },
    ],
    camera: { position: [2.7, 1.45, -14.5], target: [-1.3, 0.95, -19.3] },
    portraitCamera: { position: [2.3, 1.5, -14.0], target: [-1.4, 0.7, -19.3] },
    portraitPush: 0.1,
    still: `${IMG}/skincare.jpg`,
    hotspots: [
      {
        id: 'basins',
        label: 'Reclined basins',
        position: [-2.6, 1.02, -19.35],
        detail:
          'Deep basins with fully reclining seats: the part of the appointment where nothing is rushed.',
      },
      {
        id: 'skin',
        label: 'Skin rituals',
        position: [-4.6, 0.95, -17.3],
        detail: 'Thoughtful rituals designed around the individual.',
        action: { href: '#services', label: 'Skin at Elane' },
      },
    ],
  },
  {
    id: 'transformation',
    label: 'The Transformation',
    index: '04',
    eyebrow: 'Chapter 04 / The Transformation',
    title: ['You bring the vision.', 'We refine it.'],
    copy:
      'Beauty should never feel like a formula. From the first consultation to the final detail, every look is shaped around the person in the chair.',
    // Back out through the arch, then up the floor to the second station
    via: [
      { position: [0.5, 1.55, -13.2], target: [0, 1.4, -8] },
      { position: [0.2, 1.6, -11.3], target: [1.5, 1.4, -7] },
    ],
    camera: { position: [2.35, 1.5, -4.9], target: [5.6, 1.32, -7.0] },
    portraitCamera: { position: [2.9, 1.45, -4.7], target: [5.6, 1.1, -7.3] },
    portraitPush: 0.1,
    still: `${IMG}/styling.jpg`,
    photo: { src: `${IMG}/styling.jpg`, alt: 'Hair styling, editorial photograph' },
    hotspots: [
      {
        id: 'mirror',
        label: 'The mirror',
        position: [5.9, 2.2, -7.2],
        detail:
          'Soft light from all around the mirror keeps shadows off the face, so the finished look reads exactly as it will outside.',
      },
      {
        id: 'details',
        label: 'Finishing details',
        position: [5.7, 0.95, -6.85],
        detail: 'Quietly polished details that complete the look.',
      },
    ],
  },
  {
    id: 'appointment',
    label: 'Your Appointment',
    index: '05',
    via: [{ position: [1.6, 1.6, -4.6], target: [-2.5, 1.4, -2.6] }],
    // Desk and brand mark right of centre; the booking card reads on the left
    camera: { position: [2.4, 1.55, -1.25], target: [-5.1, 1.32, -2.05] },
    portraitCamera: { position: [2.1, 1.5, -0.7], target: [-4.6, 0.95, -3.7] },
    portraitPush: 0.25,
    still: `${IMG}/salon.jpg`,
    hotspots: [
      {
        id: 'reception',
        label: 'Reception',
        position: [-4.05, 1.12, -3.1],
        detail: 'Every visit begins here. Tell us what you are looking for and we will take it from there.',
        action: { href: '#booking', label: 'Request an appointment' },
      },
    ],
  },
]

export const hotspotIndex = Object.fromEntries(
  chapters.flatMap((chapter) =>
    chapter.hotspots.map((hotspot) => [hotspot.id, { ...hotspot, chapter: chapter.id }]),
  ),
)
