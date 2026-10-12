/** Removal designs belong to the expired task, never the billboard's current campaign. */
export function verifiedRemovalDesignSource(installation: { design_face_a?: string | null; design_face_b?: string | null } | undefined, contract: { design_face_a?: string | null; design_face_b?: string | null } | undefined) {
  // Both inputs must belong to this exact billboard and removal contract.
  // An empty installation record must not hide a design explicitly saved on the contract.
  return {
    design_face_a: installation?.design_face_a?.trim() || contract?.design_face_a?.trim() || null,
    design_face_b: installation?.design_face_b?.trim() || contract?.design_face_b?.trim() || null,
  };
}

export function matchesRemovalDesignBillboard(design: any, billboard: any) {
  const id = design.billboardId ?? design.billboard_id ?? design.ID ?? design.id;
  const code = design.billboardCode ?? design.billboard_code ?? design.billboardName ?? design.billboard_name;
  const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase();
  if (id != null && String(id).trim()) {
    return Number(id) === Number(billboard.ID) || normalize(id) === normalize(billboard.Billboard_Name);
  }
  return Boolean(code && normalize(code) === normalize(billboard.Billboard_Name));
}

export function removalPrintImages(item: { design_face_a?: string | null; design_face_b?: string | null; installed_image_url?: string | null; installed_image_face_a_url?: string | null; installed_image_face_b_url?: string | null }, billboard: { Image_URL?: string | null }, supportsBackFace = true, knownSitePhotos: (string | null | undefined)[] = []) {
  const identity = (url: string) => {
    const value = url.trim();
    const driveId = value.match(/[?&]id=([^&]+)/)?.[1] || value.match(/\/d\/([^/=]+)/)?.[1];
    if (driveId && /google(?:usercontent)?\.com/.test(value)) return `drive:${driveId}`;
    return value.replace(/[?].*$/, '').replace(/=s\d+.*$/, '');
  };
  const photos = new Set([...knownSitePhotos, billboard.Image_URL, item.installed_image_url, item.installed_image_face_a_url, item.installed_image_face_b_url].filter(Boolean).map(url => identity(url!)));
  const design = (url?: string | null) => {
    const value = url?.trim();
    return value && !photos.has(identity(value)) ? value : null;
  };
  const faceA = design(item.design_face_a);
  const faceB = supportsBackFace ? design(item.design_face_b) : null;
  return { faceA, faceB, main: billboard.Image_URL?.trim() || '' };
}
