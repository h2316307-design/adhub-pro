const scriptPromises = new Map<string, Promise<void>>();

export function loadScriptOnce(src: string, id: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  // If already on the page, assume it will (or already did) load.
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) return Promise.resolve();

  const cached = scriptPromises.get(id);
  if (cached) return cached;

  const p = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(id, p);
  return p;
}
