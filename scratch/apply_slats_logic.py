# -*- coding: utf-8 -*-
import sys

# UTF-8 console output
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# 1. State hook definitions
old_states = """  const [coverT5ColorMode, setCoverT5ColorMode] = useState<boolean>(true);
  const [coverT5BgColorOnly, setCoverT5BgColorOnly] = useState<boolean>(false);"""

new_states = """  const [coverT5ColorMode, setCoverT5ColorMode] = useState<boolean>(true);
  const [coverT5BgColorOnly, setCoverT5BgColorOnly] = useState<boolean>(false);
  const [coverT5SlatCount, setCoverT5SlatCount] = useState<number>(5);
  const [coverT5BgShatter, setCoverT5BgShatter] = useState<boolean>(true);"""

if old_states in code:
    code = code.replace(old_states, new_states)
    print("Success: added coverT5SlatCount and coverT5BgShatter states.")
else:
    old_states_lf = old_states.replace("\r\n", "\n")
    code_lf = code.replace("\r\n", "\n")
    if old_states_lf in code_lf:
        code_lf = code_lf.replace(old_states_lf, new_states.replace("\r\n", "\n"))
        code = code_lf
        print("Success: added coverT5SlatCount and coverT5BgShatter states (LF normal).")
    else:
        print("Error: state hooks not found in file.")

# 2. Serialization (Save template)
old_save = "coverT5Style, coverT5ColorMode, coverT5FillBackground, coverT5BgColorOnly,"
new_save = "coverT5Style, coverT5ColorMode, coverT5FillBackground, coverT5BgColorOnly, coverT5SlatCount, coverT5BgShatter,"

if old_save in code:
    code = code.replace(old_save, new_save)
    print("Success: updated templateData serialization fields.")
else:
    print("Error: serialization fields not found.")

# 3. Deserialization (Load template)
old_load = "if (typeof gpsAny.coverT5BgColorOnly === 'boolean') setCoverT5BgColorOnly(gpsAny.coverT5BgColorOnly);"
new_load = """if (typeof gpsAny.coverT5BgColorOnly === 'boolean') setCoverT5BgColorOnly(gpsAny.coverT5BgColorOnly);
      if (gpsAny.coverT5SlatCount !== undefined) setCoverT5SlatCount(Number(gpsAny.coverT5SlatCount) || 5);
      if (typeof gpsAny.coverT5BgShatter === 'boolean') setCoverT5BgShatter(gpsAny.coverT5BgShatter);"""

if old_load in code:
    code = code.replace(old_load, new_load)
    print("Success: updated handleLoadTemplate hooks.")
else:
    old_load_lf = old_load.replace("\r\n", "\n")
    code_lf = code.replace("\r\n", "\n")
    if old_load_lf in code_lf:
        code_lf = code_lf.replace(old_load_lf, new_load.replace("\r\n", "\n"))
        code = code_lf
        print("Success: updated handleLoadTemplate hooks (LF normal).")
    else:
        print("Error: load template hooks not found.")

# 4. renderWindowSlats implementation with count and shatter support
old_slats = """                            <div className="absolute inset-0 flex z-0" style={{ filter: `blur(${coverT4.bgBlur}px) saturate(1.95) brightness(0.78)` }}>
                              <div className="absolute inset-0 z-0 bg-black" />
                              <div className="absolute inset-0 z-10" style={{ backgroundColor: accent, opacity: 0.65, mixBlendMode: 'color' }} />
                              <div className="absolute inset-0 z-20" style={{ background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)`, opacity: 0.7, mixBlendMode: 'screen' }} />
                              
                              {coverT5BgColorOnly ? (
                                <div className="absolute inset-0 z-10" style={{ background: `radial-gradient(circle at 50% 50%, ${accent}dd 0%, #000 100%)` }} />
                              ) : (
                                coverT5FillBackground ? (
                                  <div className="absolute inset-0 z-10 overflow-hidden">
                                    <img
                                      src={photos[0]?.url}
                                      crossOrigin="anonymous"
                                      alt=""
                                      className="w-full h-full object-cover"
                                      style={{
                                        transform: `scale(1.2) ${isReflection ? 'scaleY(-1)' : ''}`,
                                      }}
                                    />
                                  </div>
                                ) : (
                                  Array.from({ length: 5 }).map((_, colIdx) => {
                                    const photo = photos[colIdx % photos.length];
                                    if (!photo) return null;
                                    return (
                                      <div key={`win-bg-photo-${colIdx}`} className="h-full flex-1 relative z-10">
                                        <img
                                          src={photo.url}
                                          crossOrigin="anonymous"
                                          alt=""
                                          className="w-full h-full object-cover"
                                          style={{
                                            transform: `scale(1.6) ${isReflection ? 'scaleY(-1)' : ''}`,
                                            objectPosition: `${20 + colIdx * 15}% 50%`,
                                          }}
                                        />
                                      </div>
                                    );
                                  })
                                )
                              )}
                            </div>
                            
                            {/* Transparent glass slat panels on top */}
                            <div className="absolute inset-0 flex z-10">
                              {coverT5BgColorOnly || coverT5FillBackground ? (
                                <div 
                                  key={`win-bg-slat-single${isReflection ? '-refl' : ''}`}
                                  className="h-full flex-1 relative"
                                  style={{
                                    boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)',
                                  }}
                                >
                                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)' }} />
                                </div>
                              ) : (
                                Array.from({ length: 5 }).map((_, colIdx) => (
                                  <div
                                    key={`win-bg-slat-${colIdx}${isReflection ? '-refl' : ''}`}
                                    className="h-full flex-1 relative"
                                    style={{
                                      borderRight: '1px solid rgba(255,255,255,0.08)',
                                      borderLeft: '1px solid rgba(0,0,0,0.2)',
                                      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.45)',
                                    }}
                                  >
                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 30%, rgba(0,0,0,0.15) 100%)' }} />
                                  </div>
                                ))
                              )}
                            </div>"""

new_slats = """                            <div className="absolute inset-0 flex z-0" style={{ filter: `blur(${coverT4.bgBlur}px) saturate(1.95) brightness(0.78)` }}>
                              <div className="absolute inset-0 z-0 bg-black" />
                              <div className="absolute inset-0 z-10" style={{ backgroundColor: accent, opacity: 0.65, mixBlendMode: 'color' }} />
                              <div className="absolute inset-0 z-20" style={{ background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)`, opacity: 0.7, mixBlendMode: 'screen' }} />
                              
                              {coverT5BgColorOnly ? (
                                <div className="absolute inset-0 z-10" style={{ background: `radial-gradient(circle at 50% 50%, ${accent}dd 0%, #000 100%)` }} />
                              ) : (
                                !coverT5BgShatter || coverT5FillBackground ? (
                                  <div className="absolute inset-0 z-10 overflow-hidden">
                                    <img
                                      src={photos[0]?.url}
                                      crossOrigin="anonymous"
                                      alt=""
                                      className="w-full h-full object-cover"
                                      style={{
                                        transform: `scale(1.2) ${isReflection ? 'scaleY(-1)' : ''}`,
                                      }}
                                    />
                                  </div>
                                ) : (
                                  Array.from({ length: coverT5SlatCount }).map((_, colIdx) => {
                                    const photo = photos[colIdx % photos.length];
                                    if (!photo) return null;
                                    return (
                                      <div key={`win-bg-photo-${colIdx}`} className="h-full flex-1 relative z-10">
                                        <img
                                          src={photo.url}
                                          crossOrigin="anonymous"
                                          alt=""
                                          className="w-full h-full object-cover"
                                          style={{
                                            transform: `scale(1.6) ${isReflection ? 'scaleY(-1)' : ''}`,
                                            objectPosition: `${20 + colIdx * (60 / (coverT5SlatCount - 1 || 1))}% 50%`,
                                          }}
                                        />
                                      </div>
                                    );
                                  })
                                )
                              )}
                            </div>
                            
                            {/* Transparent glass slat panels on top */}
                            <div className="absolute inset-0 flex z-10">
                              {coverT5BgColorOnly || coverT5FillBackground ? (
                                <div 
                                  key={`win-bg-slat-single${isReflection ? '-refl' : ''}`}
                                  className="h-full flex-1 relative"
                                  style={{
                                    boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)',
                                  }}
                                >
                                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)' }} />
                                </div>
                              ) : (
                                Array.from({ length: coverT5SlatCount }).map((_, colIdx) => (
                                  <div
                                    key={`win-bg-slat-${colIdx}${isReflection ? '-refl' : ''}`}
                                    className="h-full flex-1 relative"
                                    style={{
                                      borderRight: '1px solid rgba(255,255,255,0.08)',
                                      borderLeft: '1px solid rgba(0,0,0,0.2)',
                                      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.45)',
                                    }}
                                  >
                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 30%, rgba(0,0,0,0.15) 100%)' }} />
                                  </div>
                                ))
                              )}
                            </div>"""

if old_slats in code:
    code = code.replace(old_slats, new_slats)
    print("Success: updated renderWindowSlats counts and fragmentation logic.")
else:
    old_slats_lf = old_slats.replace("\r\n", "\n")
    code_lf = code.replace("\r\n", "\n")
    if old_slats_lf in code_lf:
        code_lf = code_lf.replace(old_slats_lf, new_slats.replace("\r\n", "\n"))
        code = code_lf
        print("Success: updated renderWindowSlats logic (LF normal).")
    else:
        print("Error: slats render block not found.")

# Write back changes
with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)

print("Slats background logic updated.")
