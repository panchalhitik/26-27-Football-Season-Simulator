/// <reference lib="webworker" />

import { monteCarloSeason } from './season';
import type { SeasonRunInput } from '@/types';

export interface SimWorkerRequest {
  id: string;
  input: SeasonRunInput;
}

export interface SimWorkerResponse {
  id: string;
  result: ReturnType<typeof monteCarloSeason>;
}

self.addEventListener('message', (ev: MessageEvent<SimWorkerRequest>) => {
  const { id, input } = ev.data;
  const result = monteCarloSeason(input);
  const response: SimWorkerResponse = { id, result };
  (self as unknown as Worker).postMessage(response);
});

export {};
