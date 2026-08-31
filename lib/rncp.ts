import { projects, type Project } from './projects'

/* ---------- raw requirement data (from 42 Paris's RNCP 6/7 meta articles) ---------- */

type ProjEntry = string | { name: string; note: string }

export type RncpCategory = {
  key: string
  name: string
  minXp: number
  minProjects: number
  projects: ProjEntry[]
  footnote?: string
}

export type RncpOption = {
  key: string
  name: string
  categories: RncpCategory[]
}

export type RncpCert = {
  id: 'rncp6' | 'rncp7'
  label: string
  degree: string
  years: number
  level: number
  events: number
  codes: string[]
  options: RncpOption[]
}

export const SUITE_PAIRS: { sequel: string; predecessor: string }[] = [
  { sequel: '42sh', predecessor: 'minishell' },
  { sequel: 'BADASS', predecessor: 'NetPractice' },
  { sequel: 'DoomNukem', predecessor: 'cub3d' },
  { sequel: 'Inception Of Things', predecessor: 'inception' },
  { sequel: 'HumanGL', predecessor: 'scop' },
  { sequel: 'kfs-2', predecessor: 'kfs-1' },
  { sequel: 'Override', predecessor: 'rainfall' },
  { sequel: 'Pestilence', predecessor: 'famine' },
  { sequel: 'RT', predecessor: 'miniRT' },
  { sequel: 'Total perspective vortex', predecessor: 'dslr' },
]

const PISCINE_NOTE = 'Piscine rollup: last child validated counts as 1 project; validate every child for full XP.'

export const RNCP_CERTS: RncpCert[] = [
  {
    id: 'rncp6',
    label: 'RNCP 6',
    degree: "Bachelor-equivalent",
    years: 3,
    level: 17,
    events: 10,
    codes: ['RNCP 36135', 'RNCP 39783 (renewal)'],
    options: [
      {
        key: 'web-mobile',
        name: 'Web & mobile application development',
        categories: [
          {
            key: 'web',
            name: 'Web',
            minXp: 15000,
            minProjects: 2,
            projects: [
              { name: 'Piscine PHP Symfony', note: PISCINE_NOTE },
              { name: 'Piscine Python Django', note: PISCINE_NOTE },
              { name: 'Piscine Ruby on Rails', note: PISCINE_NOTE },
              'Camagru', 'Matcha', 'Hypertube', 'Red Tetris', 'Darkly',
              'h42n42', 'Tokenizer', 'TokenizeArt', 'Music-room',
            ],
          },
          {
            key: 'mobile',
            name: 'Mobile',
            minXp: 10000,
            minProjects: 2,
            projects: [
              'ft_hangouts', 'Swifty_companion', 'Swifty_proteins', 'Music room',
              { name: 'Piscine Mobile', note: PISCINE_NOTE },
            ],
          },
        ],
      },
      {
        key: 'applicative',
        name: 'Applicative software development',
        categories: [
          {
            key: 'oop',
            name: 'Object-oriented programming',
            minXp: 10000,
            minProjects: 2,
            projects: [
              'Bomberman', 'Nibbler',
              { name: 'Piscine PHP Symfony', note: PISCINE_NOTE },
              { name: 'Piscine Python Django', note: PISCINE_NOTE },
              { name: 'Piscine Ruby on Rails', note: PISCINE_NOTE },
              { name: 'Piscine Mobile', note: PISCINE_NOTE },
              { name: 'Piscine Object', note: PISCINE_NOTE },
              'Camagru', 'Matcha', 'Hypertube', 'Red Tetris', 'Darkly', 'H42n42',
              'ft_hangouts', 'Swifty_companion', 'Swifty_proteins',
              'Avaj launcher', 'Swingy', 'fix-me',
            ],
          },
          {
            key: 'functional',
            name: 'Functional programming',
            minXp: 10000,
            minProjects: 2,
            projects: [
              { name: 'Piscine OCaml', note: PISCINE_NOTE },
              'ft_turing', 'ft_ality', 'h42n42',
            ],
          },
          {
            key: 'imperative',
            name: 'Imperative programming',
            minXp: 10000,
            minProjects: 2,
            projects: [
              'libasm', 'zappy', 'ft_linux', 'little penguin', 'taskmaster', 'strace',
              'malloc', 'Matt Daemon', 'nm', 'lem_ipc', 'kfs-1', 'kfs-2',
              'ft_malcolm', 'ft_ssl_md5', 'Darkly', 'Snowcrash', 'Rainfall', 'Override',
              'Boot2root', 'Ft_Shield', 'Woody Woodpacker', 'Famine', 'Pestilence',
              'ft_select', 'ft_script',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'rncp7',
    label: 'RNCP 7',
    degree: "Master-equivalent",
    years: 5,
    level: 21,
    events: 15,
    codes: ['RNCP 36137', 'RNCP 39774 (renewal)'],
    options: [
      {
        key: 'network-systems',
        name: 'Network & information systems architecture',
        categories: [
          {
            key: 'unix-kernel',
            name: 'Unix / Kernel',
            minXp: 30000,
            minProjects: 2,
            projects: [
              'libasm', 'zappy', 'ft_linux', 'little penguin', 'taskmaster', 'strace',
              'malloc', 'Matt Daemon', 'nm', 'lem_ipc', 'ft_script', 'ft_select',
              'filesystem', 'userspace_digressions', 'drivers-and-interrupts', 'process-and-memory',
              { name: 'KFS 1–10', note: 'Extended kernel series — completing every stage is not mandatory.' },
            ],
          },
          {
            key: 'sysadmin',
            name: 'System administration',
            minXp: 50000,
            minProjects: 3,
            projects: [
              'cloud-1', 'BADASS', 'Inception Of Things', 'taskmaster',
              'ft_ping', 'ft_traceroute', 'ft_nmap',
              'Active Discovery', 'Automatic Directory', 'Administrative Directory', 'Accessible Directory',
            ],
          },
          {
            key: 'security',
            name: 'Security',
            minXp: 50000,
            minProjects: 3,
            projects: [
              'ft_malcolm', 'ft_ssl_md5', 'Darkly', 'Snowcrash', 'Rainfall', 'Override',
              'boot2root', 'ft_shield', 'Woody Woodpacker', 'Famine', 'Pestilence',
              { name: 'Piscine Cybersecurity', note: PISCINE_NOTE },
              'UnleashTheBox', 'Active Connect', 'MicroForensX', 'ActiveTechTales', 'tinky-winkey',
            ],
          },
        ],
      },
      {
        key: 'database',
        name: 'Database architecture & data',
        categories: [
          {
            key: 'web-db',
            name: 'Web · Database',
            minXp: 50000,
            minProjects: 2,
            projects: [
              { name: 'Piscine PHP Symfony', note: PISCINE_NOTE },
              { name: 'Piscine Python Django', note: PISCINE_NOTE },
              { name: 'Piscine Ruby on Rails', note: PISCINE_NOTE },
              'Camagru', 'Matcha', 'Hypertube', 'Red Tetris', 'Darkly',
              'h42n42', 'Tokenizer', 'TokenizeArt', 'Music-room',
            ],
          },
          {
            key: 'ai',
            name: 'Artificial intelligence',
            minXp: 70000,
            minProjects: 3,
            projects: [
              { name: '[DEPRECATED] Piscine Machine Learning', note: PISCINE_NOTE },
              { name: 'Piscine Python for Data Science', note: PISCINE_NOTE },
              { name: 'Piscine Data Science', note: PISCINE_NOTE },
              'Linear regression', 'DSLR', 'Multi layer perceptron', 'Gomoku',
              'Total perspective vortex', 'Expert system', 'Krpsim', 'Matrix',
              'Ready set boole', 'Leaffliction', 'Learn2Slither',
            ],
          },
        ],
      },
    ],
  },
]

/* ---------- matching against the live project snapshot ---------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/* known naming drift between the RNCP wording and this account's project titles */
const ALIASES: Record<string, string> = {
  'piscine python django': 'piscine django',
  'piscine mobile': 'mobile',
  'piscine python for data science': 'python for data science',
  'piscine cybersecurity': 'cybersecurity',
  'linear regression': 'ft_linear_regression',
  'little penguin': 'little-penguin-1',
}

const liveByNorm = new Map(projects.map((p) => [norm(p.name), p] as const))

export type RncpRef = {
  raw: string
  note?: string
  deprecated: boolean
  project: Project | null
}

function entryName(e: ProjEntry) {
  return typeof e === 'string' ? e : e.name
}
function entryNote(e: ProjEntry) {
  return typeof e === 'string' ? undefined : e.note
}

export function resolveRef(entry: ProjEntry): RncpRef {
  const raw = entryName(entry).replace(/^\[deprecated\]\s*/i, '')
  const deprecated = /deprecated/i.test(entryName(entry))
  const note = entryNote(entry)
  if (deprecated) return { raw, note, deprecated, project: null }
  const alias = ALIASES[raw.toLowerCase()]
  const project = liveByNorm.get(norm(alias ?? raw)) ?? null
  return { raw, note, deprecated: false, project }
}

/* ---------- progress computation, driven entirely by lib/projects.ts status ---------- */

export type CategoryProgress = {
  category: RncpCategory
  refs: RncpRef[]
  doneXp: number
  doneCount: number
  xpPct: number
  countPct: number
  met: boolean
}

export function computeCategory(category: RncpCategory): CategoryProgress {
  const refs = category.projects.map(resolveRef)
  const done = refs.filter((r) => r.project?.status === 'Done')
  const doneXp = done.reduce((a, r) => a + (r.project?.xp ?? 0), 0)
  const doneCount = done.length
  return {
    category,
    refs,
    doneXp,
    doneCount,
    xpPct: category.minXp ? Math.min(1, doneXp / category.minXp) : 1,
    countPct: category.minProjects ? Math.min(1, doneCount / category.minProjects) : 1,
    met: doneXp >= category.minXp && doneCount >= category.minProjects,
  }
}

export type OptionProgress = {
  option: RncpOption
  categories: CategoryProgress[]
  met: boolean
  overallPct: number
}

export function computeOption(option: RncpOption): OptionProgress {
  const categories = option.categories.map(computeCategory)
  const met = categories.every((c) => c.met)
  const overallPct = categories.reduce((a, c) => a + Math.min(c.xpPct, c.countPct), 0) / categories.length
  return { option, categories, met, overallPct }
}

export type SuiteProgress = {
  sequel: string
  predecessor: string
  sequelRef: RncpRef
  predecessorRef: RncpRef
  met: boolean
}

export function computeSuite(): SuiteProgress[] {
  return SUITE_PAIRS.map((pair) => {
    const sequelRef = resolveRef(pair.sequel)
    const predecessorRef = resolveRef(pair.predecessor)
    return { ...pair, sequelRef, predecessorRef, met: sequelRef.project?.status === 'Done' }
  })
}

export const PRO_EXPERIENCE_NAMES = ['Work Experience I', 'Work Experience II', 'Startup Experience']

export function computeProExperience() {
  const refs = PRO_EXPERIENCE_NAMES.map(resolveRef)
  const done = refs.filter((r) => r.project?.status === 'Done')
  return { refs, doneCount: done.length, met: done.length >= 2 }
}

export function computeCoreCurriculum() {
  const core = projects.filter((p) => p.categories.includes('Core Curriculum'))
  const done = core.filter((p) => p.status === 'Done')
  return { total: core.length, done: done.length }
}
