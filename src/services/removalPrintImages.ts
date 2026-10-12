/** Removal designs belong to the expired task, never the billboard's current campaign. */
export function verifiedRemovalDesignSource(installation: { design_face_a?: string | null; design_face_b?: string | null } | undefined, contract: { design_face_a?: string | null; design_face_b?: string | null } | undefined) {
  // Both inputs must belong to this exact billboard and removal contract.
  // An empty installation record must not hide a design explicitly saved on the contract.
  return {
    design_face_a: installation?.design_face_a?.trim() || contract?.design_face_a?.trim() || null,
    design_face_b: installation?.design_face_b?.trim() || contract?.design_face_b?.trim() || null,
  };
}

export function isRemovalDesignEnabled(design: any): boolean {
  if (!design || typeof design !== 'object') return false;
  if (design.enabled === false || design.active === false || design.isEnabled === false || design.is_enabled === false) {
    return false;
  }
  if (design.disabled === true || design.has_design === false || design.hasDesign === false) {
    return false;
  }
  if (typeof design.status === 'string' && ['disabled', 'inactive', 'off', 'cancelled'].includes(design.status.toLowerCase())) {
    return false;
  }
  return true;
}

export function matchesRemovalDesignBillboard(design: any, billboard: any): boolean {
  if (!design || !billboard) return false;
  if (!isRemovalDesignEnabled(design)) return false;

  const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase();
  const bId = billboard.ID ?? billboard.id;
  const bName = billboard.Billboard_Name ?? billboard.billboard_name ?? billboard.name ?? billboard.code;
  const normBName = normalize(bName);
  const numBId = bId != null && !isNaN(Number(bId)) ? Number(bId) : null;

  // Explicit billboard ID properties ONLY — never treat design.id or design.ID as billboard ID!
  const explicitBillboardId = design.billboardId ?? design.billboard_id ?? design.billboardID ?? design.billboard_ID;
  const explicitBillboardCode = design.billboardCode ?? design.billboard_code ?? design.billboardName ?? design.billboard_name;

  // If billboardIds array exists (e.g. grouped designs)
  if (Array.isArray(design.billboardIds)) {
    const inIds = design.billboardIds.some((bid: any) => {
      if (bid == null) return false;
      if (numBId !== null && Number(bid) === numBId) return true;
      if (normBName && normalize(bid) === normBName) return true;
      return false;
    });
    if (!inIds) return false;
    if (explicitBillboardCode && normBName && normalize(explicitBillboardCode) !== normBName) return false;
    return true;
  }

  // If both explicit billboardId and billboardCode are provided, both must match
  if (explicitBillboardId != null && String(explicitBillboardId).trim() !== '' && explicitBillboardCode != null && String(explicitBillboardCode).trim() !== '') {
    const idMatch = (numBId !== null && Number(explicitBillboardId) === numBId) || (normBName && normalize(explicitBillboardId) === normBName);
    const codeMatch = normBName && normalize(explicitBillboardCode) === normBName;
    return Boolean(idMatch && codeMatch);
  }

  // If explicit billboardId is provided
  if (explicitBillboardId != null && String(explicitBillboardId).trim() !== '') {
    return (numBId !== null && Number(explicitBillboardId) === numBId) || (normBName && normalize(explicitBillboardId) === normBName);
  }

  // If explicit billboardCode / billboardName is provided
  if (explicitBillboardCode != null && String(explicitBillboardCode).trim() !== '') {
    return Boolean(normBName && normalize(explicitBillboardCode) === normBName);
  }

  // If billboardNames array exists
  if (Array.isArray(design.billboardNames)) {
    return Boolean(normBName && design.billboardNames.some((n: any) => normalize(n) === normBName));
  }

  return false;
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
