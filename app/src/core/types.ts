/** 领域模型。字段结构与正式版保持一致，替代数据只改值，不改结构。 */

export type Category = 'sight' | 'food' | 'fun' | 'rest'

/** 时间统一用"当天第几分钟"表示，避免时区与日期运算错误 */
export type Minute = number

export type OpenState = 'confirmed' | 'pending'

export interface OpenRule {
  start: Minute
  end: Minute
  /** 最晚入场，缺省视为与 end 相同 */
  lastEntry?: Minute
  /** 每周固定休息，0 = 周日 */
  closedOn?: number[]
  state: OpenState
  note?: string
}

export interface Place {
  id: string
  name: string
  category: Category
  district: string
  lat: number
  lng: number
  /** 建议停留（分钟） */
  duration: number
  open?: OpenRule
  ticket: number
  tags: string[]
  reason: string
  indoor: boolean
  needsBooking?: boolean
  rating: number
  priceLevel: 1 | 2 | 3
}

export type Pace = 'easy' | 'normal' | 'packed'

export interface Booking {
  placeId: string
  dayIndex: number
  time: Minute
}

export interface Prefs {
  city: string
  days: number
  pace: Pace
  arrivalTime: Minute
  arrivalPlace: string
  departureTime: Minute
  departurePlace: string
  interests: string[]
  budget: [number, number]
  mustGo: string[]
  bookings: Booking[]
  lodging: string
  /** 住宿未定时的假设 */
  lodgingAssumed: boolean
}

export type TransportMode = 'walk' | 'metro' | 'bus'

export interface Transit {
  mode: TransportMode
  minutes: number
  distance: number
  estimated: boolean
}

export type ItemKind = 'place' | 'meal' | 'transit' | 'arrival' | 'departure'

export interface PlanItem {
  id: string
  kind: ItemKind
  placeId?: string
  name: string
  start: Minute
  duration: Minute
  note?: string
  locked?: boolean
  warning?: string
  /** 可替换的候选（同片区同类型） */
  alternatives?: string[]
  /** 从上一站过来的交通（第一项为空） */
  fromPrev?: Transit
}

export interface DayPlan {
  index: number
  date: string
  district: string
  items: PlanItem[]
  summary: {
    activities: number
    transit: number
    walk: number
    cost: number
  }
}

export type UnscheduledReason =
  | 'time'
  | 'closed'
  | 'far'
  | 'budget'
  | 'pending'

export interface Unscheduled {
  placeId: string
  name: string
  reason: UnscheduledReason
}

export interface PlanResult {
  days: DayPlan[]
  unscheduled: Unscheduled[]
  assumptions: string[]
  /** 生成过程中的冲突，用于结果页提示 */
  warnings: string[]
}

export interface Trip {
  id: string
  city: string
  title: string
  createdAt: number
  updatedAt: number
  prefs: Prefs
  plan: PlanResult
  status: 'draft' | 'ready' | 'active' | 'done'
  /** 已完成的项目 id */
  done: string[]
  /** 跳过的项目 id */
  skipped: string[]
}
