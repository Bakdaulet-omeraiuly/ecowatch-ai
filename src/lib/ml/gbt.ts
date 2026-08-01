// Оқытылған градиенттік бустинг моделін JSON-нан оқып, болжам есептеу.
// Оқыту `ml-service/` ішінде Python-мен жүреді; мұнда тек шығару (inference).

import raw from "@/data/models/aqi-model.json";

export interface TreeSpec {
  f: number[]; // белгі индексі (жапырақ болса −1)
  t: number[]; // шекара мәні
  l: number[]; // сол жақ түйін
  r: number[]; // оң жақ түйін
  v: number[]; // жапырақ мәні
}

export interface Metrics {
  mae: number;
  rmse: number;
  r2: number | null;
}

export interface TargetSpec {
  base: number;
  learningRate: number;
  trees: TreeSpec[];
  metrics: { model: Metrics; seasonalBaseline: Metrics; skill: number | null };
  testSamples: number;
}

export interface TrainedModel {
  trained: true;
  name: string;
  version: string;
  generatedAt: string;
  location: { name: string; lat: number; lng: number };
  trainPeriod: { start: string; end: string; hours: number };
  testFraction: number;
  features: string[];
  targets: Record<string, TargetSpec>;
  source: string;
  disclaimer: string;
}

export interface UntrainedModel {
  trained: false;
  name: string;
  note: string;
}

export type ModelFile = TrainedModel | UntrainedModel;

export const model = raw as unknown as ModelFile;

export function isTrained(m: ModelFile): m is TrainedModel {
  return m.trained === true;
}

/** Бір ағашты аралап, жапырақ мәнін қайтарады. */
function walk(tree: TreeSpec, x: number[]): number {
  let node = 0;
  // Терең тұйықталудан қорғаныс — ағаш тереңдігі ешқашан 64-тен аспайды
  for (let step = 0; step < 64; step++) {
    const f = tree.f[node];
    if (f < 0) return tree.v[node];
    node = x[f] <= tree.t[node] ? tree.l[node] : tree.r[node];
  }
  return tree.v[node] ?? 0;
}

export function predict(spec: TargetSpec, x: number[]): number {
  let out = spec.base;
  for (const tree of spec.trees) out += spec.learningRate * walk(tree, x);
  return out;
}
