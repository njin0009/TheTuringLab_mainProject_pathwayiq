export interface Career {
  id:           string
  title:        string
  anzsco:       string
  industry:     string
  salary:       { entry: number; mid: number; senior: number }
  demand:       { vic: 'High' | 'Medium' | 'Low'; national: 'High' | 'Medium' | 'Low' }
  growth_10yr:  number
  ai_risk:      number        // 0–1 from Oxford × ABS composite
  shortage:     boolean
  disappearing: boolean
  labels:       string[]      // e.g. ["↑ Shortage", "Low AI risk"]
  pathways:     Pathway[]
  atar_typical: number | null
  interests:    string[]      // e.g. ["Analytical", "Social"]
}

export interface Pathway {
  type:            'University' | 'TAFE' | 'Apprenticeship' | 'Online'
  name:            string
  institution:     string
  duration:        string
  cost:            string
  atar_required:   string
  employment_rate: number
  entry_salary:    number
}

export interface QuizResponse {
  q1: string   // work style preference
  q2: string   // environment preference
  q3: string   // subject interest
  q4: string   // values / motivation
}

export interface CareerMatch extends Career {
  match_score:   number   // 0–100
  match_reasons: string[]
}

export type AIRiskLevel = 'Low' | 'Medium' | 'High'
