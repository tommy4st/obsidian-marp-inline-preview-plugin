export const normalizePath = (p: string): string => {
  const s = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = s.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (resolved.length > 0) resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
};
export class TFile {}
export class App {}
