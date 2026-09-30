import type { SiteContent, WorldLocation } from './types'

export const PLANET_RADIUS = 40

export function latLonToVector(lat: number, lon: number, radius = PLANET_RADIUS): [number, number, number] {
  const phi = (lat * Math.PI) / 180
  const theta = (lon * Math.PI) / 180
  return [
    +(radius * Math.cos(phi) * Math.sin(theta)).toFixed(3),
    +(radius * Math.sin(phi)).toFixed(3),
    +(radius * Math.cos(phi) * Math.cos(theta)).toFixed(3),
  ]
}

function loc(l: Omit<WorldLocation, 'worldPosition' | 'mapPosition'>): WorldLocation {
  const mapX = +(((l.lon + 180) % 360) / 3.6).toFixed(1)
  const mapY = +(50 - l.lat / 1.8).toFixed(1)
  return { ...l, worldPosition: latLonToVector(l.lat, l.lon), mapPosition: [mapX, mapY] }
}

export const seedContent: SiteContent = {
  profile: {
    name: 'MARC',
    headline: 'Creative · Brand · Film · Interactive',
    tagline: 'A small world of ideas,\nfilms, games and everything in between.',
    shortBio:
      '以创意和产品思维为核心，理解品牌与内容问题，并把想法跨文字、视觉、影像、互动、游戏与 AI 真正做出来的人。',
    currentDirection: 'Creative Direction × Interactive Storytelling × AI-assisted Creation',
    experience: [
      { period: '2023 — Now', title: 'Creative Lead', org: 'Independent', description: '在后台编辑你的真实经历。' },
    ],
    skills: ['Writing', 'Brand Strategy', 'Film Direction', 'Interaction Design', 'Prototyping', 'AI Workflow'],
    howIWork: ['IDEA', 'RESEARCH', 'WRITE', 'VISUALIZE', 'PROTOTYPE', 'MAKE', 'ITERATE'],
    email: 'hello@example.com',
    location: 'Earth',
    links: [],
  },
  locations: [
    loc({
      id: 'print-house', name: 'WRITE HOUSE', zone: 'main-town', lat: -1.25, lon: 31.63,
      question: '我能不能把东西想清楚、写清楚、讲清楚？',
      description: 'Writing · Editing · Copy · Narrative · Content · World Building',
      action: 'READ', color: '#e0773f', projectIds: ['sample-writing'], parking: true,
    }),
    loc({
      id: 'brand-museum', name: 'BRAND & CREATIVE MUSEUM', zone: 'main-town', lat: -5.42, lon: 42.77,
      question: '我能不能理解品牌与商业问题，并把问题转化为有效创意？',
      description: 'Brand · Strategy · Campaign · Creative · Big Idea',
      action: 'VIEW', color: '#e7b53f', projectIds: ['sample-brand'], parking: true,
    }),
    loc({
      id: 'cinema', name: 'MARC CINEMA', zone: 'main-town', lat: 34.01, lon: 115.7,
      question: '我能不能把想法转化成影像？',
      description: 'Film · TVC · AI Video · Storyboard · Camera Language',
      action: 'WATCH', color: '#c9524a', projectIds: ['sample-film'], parking: true,
    }),
    loc({
      id: 'experiment-lab', name: 'EXPERIMENT LAB', zone: 'main-town', lat: 31.43, lon: -175.56,
      question: '我能不能把想法变成可以玩的、可以互动的东西？',
      description: 'Game Design · Interaction · Prototype · 3D · AI Experiment',
      action: 'PLAY', color: '#3f9c93', projectIds: ['sample-lab'], parking: true,
    }),
    loc({
      id: 'arcade', name: 'ARCADE', zone: 'interest-area', lat: -5.62, lon: 146.26,
      question: 'THE GAMES THAT MADE ME',
      description: 'Games I Love · Gaming Memory · Design Influence',
      action: 'PLAY', color: '#3f78a8', projectIds: [], parking: true,
    }),
    loc({
      id: 'my-studio', name: 'MY STUDIO', zone: 'interest-area', lat: -10.46, lon: -147.79,
      question: '现在生活与创作中的自己',
      description: 'Photography · Reading · Music · Cycling · HOW I WORK',
      action: 'BROWSE', color: '#6aa06a', projectIds: [], parking: true,
    }),
    loc({
      id: 'observatory', name: 'OBSERVATORY', zone: 'future-hill', lat: 47.0, lon: -127.99,
      question: '我未来准备走向哪里？',
      description: 'Future · Next · Learning · To Be Made · Long-term Goal',
      action: 'VIEW', color: '#5f86b8', projectIds: [], parking: true,
    }),
  ],
  projects: [
    {
      id: 'sample-writing', title: 'Sample Story', subtitle: '示例写作项目', category: 'Writing', mediaType: 'text',
      year: '2025', context: '在后台 /admin 替换为你的真实内容。', role: 'Writer',
      cover: '', locationId: 'print-house', featured: true, published: true, tags: ['Narrative'],
    },
    {
      id: 'sample-brand', title: 'Sample Campaign', subtitle: '示例品牌项目', category: 'Brand / Creative', mediaType: 'gallery',
      year: '2025', context: 'BRIEF', problem: 'PROBLEM', insight: 'INSIGHT', strategy: 'STRATEGY', idea: 'BIG IDEA',
      execution: 'EXECUTION', result: 'RESULT', role: 'Creative Lead',
      cover: '', locationId: 'brand-museum', featured: true, published: true,
    },
    {
      id: 'sample-film', title: 'Sample Film', subtitle: '示例影像项目', category: 'Film', mediaType: 'video',
      year: '2025', role: 'Director', cover: '', locationId: 'cinema', published: true,
    },
    {
      id: 'sample-lab', title: 'Sample Prototype', subtitle: '示例互动项目', category: 'Interactive', mediaType: 'prototype',
      year: '2025', role: 'Designer & Developer', cover: '', locationId: 'experiment-lab', published: true,
    },
  ],
}
