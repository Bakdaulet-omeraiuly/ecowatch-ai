export type RiskLevel = "low" | "medium" | "high" | "critical";

export type IssueType =
  | "oil_spill"
  | "household_waste"
  | "construction_waste"
  | "industrial"
  | "land_degradation"
  | "mosquito_breeding"
  | "other";

export type AnalysisMode = "satellite" | "photo" | "combined";

export type VerificationStatus = "confirmed" | "unconfirmed" | "contradicted";

export interface EvidenceItem {
  sign: string; // Белгі: "Жер деградациясы"
  evidence: string; // Дәлел: "NDVI прокси-индексі 0.21 — өсімдік жамылғысы әлсіз"
  confidence: number; // 0-100
  prediction: string; // Болжам: "Шара қолданылмаса..."
}

export interface ScientificAnalysis {
  ndvi: number; // 0-1, vegetation density (RGB-based proxy estimate)
  ndbi: number; // 0-1, built-up / technogenic surfaces proxy
  ndwi: number; // 0-1, water presence proxy
  areaM2: number; // estimated affected area
  changeDynamics: string; // vs previous period
  nearbyInfrastructure: string[]; // within 2-5 km, visible in image
  textureNote: string; // chaotic shapes, reflectance anomalies
  evidence: EvidenceItem[];
}

export interface AnalysisResult {
  science?: ScientificAnalysis;
  riskScore: number; // 0-100
  confidence: number; // 0-100
  riskLevel: RiskLevel;
  oilPollution: boolean;
  illegalDumping: boolean;
  landDegradation: boolean;
  standingWater: boolean;
  detectedFeatures: string[];
  recommendation: string;
  summary: string;
  verificationStatus?: VerificationStatus;
  verificationNotes?: string;
  issueType?: IssueType;
}

export interface Site {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  district: string;
  mode: AnalysisMode;
  analysis: AnalysisResult;
  mosquitoRiskIndex: number; // 0-100
  imageUrl?: string; // satellite static image
  imageryYear?: number | null; // Sentinel-2 mosaic year; null/undefined = current imagery
  photoThumb?: string; // citizen photo (base64 thumbnail)
  createdAt: string; // ISO
  flagged: boolean;
  isSeed?: boolean;
}

export type AlertStatus = "sent" | "acknowledged" | "inspecting" | "resolved";

export interface Alert {
  id: string;
  siteId: string;
  siteName: string;
  lat: number;
  lng: number;
  riskScore: number;
  riskLevel: RiskLevel;
  recipient: string; // responsible authority
  reason: string;
  createdAt: string;
  status: AlertStatus;
}

export interface ForecastPoint {
  month: string; // "2026-07"
  score: number;
  isProjection: boolean;
}

export interface Forecast {
  trend: "improving" | "stable" | "degrading";
  points: ForecastPoint[];
  drivers: string[];
  outlook: string;
}
