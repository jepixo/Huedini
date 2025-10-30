import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- TYPE DEFINITIONS ---
type Style = 'Harmonious' | 'Vibrant' | 'Pastel' | 'Dark' | 'Warm' | 'Cool' | 'Duotone' | 'Brands';
type GradientType = 'linear' | 'radial' | 'conic' | 'mesh';
type AppMode = 'gradients' | 'palettes' | 'trending' | 'favorites';
type GeneratorMode = 'single' | 'palette';

interface Gradient {
  css: string;
  colors: string[];
  style: Style;
  type: GradientType;
  brandName?: string;
}

interface Palette {
    colors: string[];
    style: Style;
    brandName?: string;
}

interface Favorites {
    gradients: Gradient[];
    palettes: Palette[];
}

interface GeneratorConfig {
    mode: GeneratorMode;
    palette: string[];
    suggestionCount: number;
    gradientMinColors: number;
    gradientMaxColors: number;
    paletteMinColors: number;
    paletteMaxColors: number;
}

// --- HSL/RGB/Hex Color Manipulation Engine ---
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;

const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (c: number) => `0${Math.round(c).toString(16)}`.slice(-2);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = (r: number, g: number, b: number): { h: number, s: number, l: number } => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s, l: l };
};

const hslToRgb = (h: number, s: number, l: number): { r: number, g: number, b: number } => {
    let r, g, b;
    if (s === 0) { r = g = b = l; } 
    else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1/3);
        g = hue2rgb(p, q, h / 360);
        b = hue2rgb(p, q, h / 360 - 1/3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
};

const hexToHsl = (hex: string) => {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
};

const hslToHex = (h: number, s: number, l: number) => {
    const {r, g, b} = hslToRgb(h, s, l);
    return rgbToHex(r, g, b);
};


// --- ALGORITHMS ---
const PALETTE_STYLES: Style[] = ['Harmonious', 'Vibrant', 'Pastel', 'Dark', 'Warm', 'Cool', 'Duotone', 'Brands'];

const generateStyledPalette = (baseHsl: { h: number, s: number, l: number }, style: Style, colorCount: number, includeBase: boolean = true): string[] => {
    const baseHex = hslToHex(baseHsl.h, baseHsl.s, baseHsl.l);
    const count = style === 'Duotone' ? 2 : Math.max(2, Math.min(10, colorCount));

    if (style === 'Duotone') {
        const duotoneStrategies = [
            // 1. Classic Complementary
            () => hslToHex((baseHsl.h + 180) % 360, baseHsl.s, baseHsl.l),
            // 2. High Contrast (Light) - almost white
            () => hslToHex((baseHsl.h + randomInt(-10, 10) + 360) % 360, randomFloat(0.1, 0.3), randomFloat(0.9, 0.98)),
            // 3. High Contrast (Dark) - almost black
            () => hslToHex((baseHsl.h + randomInt(-10, 10) + 360) % 360, randomFloat(0.7, 1.0), randomFloat(0.1, 0.25)),
            // 4. Analogous (shifted lightness)
            () => {
                const l = baseHsl.l > 0.6 ? baseHsl.l - randomFloat(0.3, 0.4) : baseHsl.l + randomFloat(0.3, 0.4);
                const h = (baseHsl.h + randomInt(25, 45) * (Math.random() > 0.5 ? 1 : -1) + 360) % 360;
                return hslToHex(h, baseHsl.s, Math.max(0, Math.min(1, l)));
            },
            // 5. Triadic
            () => hslToHex((baseHsl.h + 120 * randomInt(1, 2)) % 360, baseHsl.s, baseHsl.l),
            // 6. A very different, vibrant color
            () => hslToHex((baseHsl.h + randomInt(100, 260) + 360) % 360, randomFloat(0.7, 1.0), randomFloat(0.5, 0.7)),
        ];
        
        let secondColor = duotoneStrategies[randomInt(0, duotoneStrategies.length - 1)]();

        // Ensure the second color is not the same as the first
        while (secondColor === baseHex) {
            secondColor = duotoneStrategies[randomInt(0, duotoneStrategies.length - 1)]();
        }

        return [baseHex, secondColor];
    }

    let candidates: { h: number, s: number, l: number }[] = [];
    const harmonyHues: number[] = [(baseHsl.h + 30) % 360, (baseHsl.h - 30) % 360, (baseHsl.h + 120) % 360, (baseHsl.h + 240) % 360, (baseHsl.h + 180) % 360];
    
    switch (style) {
        case 'Vibrant': candidates = Array.from({length: 20}, () => ({ h: (baseHsl.h + randomInt(-180, 180)) % 360, s: randomFloat(0.75, 1.0), l: randomFloat(0.4, 0.7) })); break;
        case 'Pastel': candidates = Array.from({length: 20}, () => ({ h: (baseHsl.h + randomInt(-60, 60)) % 360, s: randomFloat(0.25, 0.55), l: randomFloat(0.8, 0.95) })); break;
        case 'Dark':
            candidates = Array.from({length: 20}, () => ({ h: harmonyHues[randomInt(0, harmonyHues.length - 1)], s: randomFloat(0.5, 1.0), l: randomFloat(0.1, 0.35) }));
            break;
        case 'Warm':
            const warmHues = Array.from({length: 10}, () => randomInt(-60, 60));
            const mixedWarmHues = [...harmonyHues, ...warmHues, ...warmHues].map(h => (h + 360) % 360);
            candidates = Array.from({length: 20}, () => ({ h: mixedWarmHues[randomInt(0, mixedWarmHues.length - 1)], s: randomFloat(0.5, 1.0), l: randomFloat(0.3, 0.8) }));
            break;
        case 'Cool':
            const coolHues = Array.from({length: 10}, () => randomInt(150, 270));
            const mixedCoolHues = [...harmonyHues, ...coolHues, ...coolHues];
            candidates = Array.from({length: 20}, () => ({ h: mixedCoolHues[randomInt(0, mixedCoolHues.length - 1)], s: randomFloat(0.5, 1.0), l: randomFloat(0.3, 0.8) }));
            break;
        case 'Brands':
            const primary = { h: baseHsl.h, s: randomFloat(0.8, 1.0), l: randomFloat(0.4, 0.6) };
            const secondaryHue = [ (baseHsl.h + 30) % 360, (baseHsl.h + 150) % 360, (baseHsl.h + 180) % 360 ][randomInt(0,2)];
            const secondary = { h: secondaryHue, s: randomFloat(0.7, 0.9), l: randomFloat(0.5, 0.7) };
            const neutrals = [
                { h: baseHsl.h, s: randomFloat(0.05, 0.15), l: randomFloat(0.9, 0.98) }, // light
                { h: baseHsl.h, s: randomFloat(0.05, 0.1), l: randomFloat(0.6, 0.75) }, // mid
                { h: baseHsl.h, s: randomFloat(0.05, 0.1), l: randomFloat(0.15, 0.25) } // dark
            ];
            candidates = [primary, secondary, ...neutrals.sort(() => 0.5 - Math.random())];
            break;
        default: // Harmonious
             candidates = Array.from({length: 20}, () => ({ h: harmonyHues[randomInt(0, harmonyHues.length - 1)], s: randomFloat(0.3, 0.9), l: randomFloat(0.2, 0.85) }));
             break;
    }

    const finalPalette: string[] = includeBase ? [baseHex] : [];
    const usedHex = new Set<string>(finalPalette);

    for (const candidate of candidates) {
        if (finalPalette.length >= count) break;
        const hex = hslToHex(candidate.h, candidate.s, candidate.l);
        if (!usedHex.has(hex)) {
            finalPalette.push(hex);
            usedHex.add(hex);
        }
    }
    
    while (finalPalette.length < count) {
        const randomHue = (baseHsl.h + randomInt(0, 360)) % 360;
        const newHex = hslToHex(randomHue, randomFloat(0.4, 1.0), randomFloat(0.3, 0.8));
        if(!usedHex.has(newHex)) {
            finalPalette.push(newHex);
            usedHex.add(newHex);
        }
    }

    return finalPalette;
};

const generateSimilarPalette = (basePalette: string[]): string[] => {
    return basePalette.map(hex => {
        const hsl = hexToHsl(hex);
        if (!hsl) return hex;
        const newH = (hsl.h + randomInt(-10, 10) + 360) % 360;
        const newS = Math.max(0, Math.min(1, hsl.s + randomFloat(-0.1, 0.1)));
        const newL = Math.max(0, Math.min(1, hsl.l + randomFloat(-0.1, 0.1)));
        return hslToHex(newH, newS, newL);
    });
};


const createGradientFromPalette = (palette: string[], style: Style): Gradient => {
    let css = '';
    let type: GradientType;
    const typeRoll = Math.random();
    const shuffledPalette = [...palette].sort(() => 0.5 - Math.random());
    if (typeRoll < 0.5) {
        type = 'linear';
        const angle = randomInt(0, 360);
        css = `linear-gradient(${angle}deg, ${shuffledPalette.join(', ')})`;
    } else if (typeRoll < 0.8) {
        type = 'radial';
        const shapes = ['circle', 'ellipse'];
        const shape = shapes[randomInt(0, 1)];
        css = `radial-gradient(${shape}, ${shuffledPalette.join(', ')})`;
    } else if (typeRoll < 0.95) {
        type = 'conic';
        const from = randomInt(0, 360);
        css = `conic-gradient(from ${from}deg, ${shuffledPalette.join(', ')}, ${shuffledPalette[0]})`;
    } else {
        type = 'mesh';
        const stops = shuffledPalette.slice(0, 5).map((color) => {
            const pos1 = randomInt(0, 100);
            const pos2 = randomInt(0, 100);
            return `radial-gradient(at ${pos1}% ${pos2}%, ${color} 0px, transparent 50%)`;
        }).join(', ');
        css = stops;
    }
    return { css, colors: palette, style, type };
};

const randomHex = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

// --- Palette Extraction from Image (Client-side) ---
const extractPaletteFromImage = (base64Image: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 100;
            const MAX_HEIGHT = 100;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error("Could not get canvas context"));
            }
            ctx.drawImage(img, 0, 0, width, height);

            try {
                const imageData = ctx.getImageData(0, 0, width, height).data;
                const colorMap: { [key: string]: { r: number, g: number, b: number, count: number } } = {};
                
                // Use a reduced color space for binning
                const BITS = 4; // 16 colors per channel, 4096 total
                const SHIFT = 8 - BITS;

                for (let i = 0; i < imageData.length; i += 4) {
                    // Sample every pixel for small canvas
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];
                    const a = imageData[i + 3];

                    if (a < 128) continue; // Skip transparent pixels

                    const rKey = r >> SHIFT;
                    const gKey = g >> SHIFT;
                    const bKey = b >> SHIFT;
                    const key = `${rKey},${gKey},${bKey}`;

                    if (!colorMap[key]) {
                        colorMap[key] = { r: 0, g: 0, b: 0, count: 0 };
                    }
                    colorMap[key].r += r;
                    colorMap[key].g += g;
                    colorMap[key].b += b;
                    colorMap[key].count++;
                }

                const sortedColors = Object.values(colorMap)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 6) // Get top 6 colors
                    .map(color => {
                        const avgR = Math.round(color.r / color.count);
                        const avgG = Math.round(color.g / color.count);
                        const avgB = Math.round(color.b / color.count);
                        return rgbToHex(avgR, avgG, avgB);
                    });

                if (sortedColors.length === 0) {
                     return reject(new Error("Could not find any dominant colors in the image."));
                }

                resolve(sortedColors);

            } catch (error) {
                reject(new Error("Could not process image data. The image might be from a different origin."));
            }
        };
        img.onerror = () => {
            reject(new Error("Failed to load the image."));
        };
        img.src = `data:image/jpeg;base64,${base64Image}`;
    });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error("Failed to convert blob to base64"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};


// --- UI COMPONENTS ---
const ActionButton: React.FC<{ item: Gradient | Palette, isFavorite: boolean, showRemove?: boolean, onSave: (item: Gradient | Palette) => void, onRemove: (item: Gradient | Palette) => void }> = 
({ item, isFavorite, showRemove, onSave, onRemove }) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isFavorite ? onRemove(item) : onSave(item);
    }
    const label = showRemove ? 'Remove' : (isFavorite ? 'Saved' : 'Save');
    const className = `card-action-button ${showRemove ? 'remove' : ''} ${isFavorite ? 'saved' : ''} ${showRemove ? 'show-always' : ''}`;
    return <button className={className} onClick={handleClick}>{label}</button>
}

const GradientCard: React.FC<{ gradient: Gradient, isFavorite: boolean, onSave: (g: Gradient) => void, onRemove: (g: Gradient) => void, showRemove?: boolean }> = 
({ gradient, isFavorite, onSave, onRemove, showRemove }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(gradient.css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="gradient-card">
      {gradient.brandName && <div className="brand-badge">{gradient.brandName}</div>}
      <ActionButton item={gradient} isFavorite={isFavorite} showRemove={showRemove} onSave={onSave} onRemove={onRemove} />
      <div className="gradient-preview" style={{ background: gradient.css }}></div>
      <div className="gradient-info">
        <div className="color-swatches">
          {gradient.colors.map((color, index) => (
            <div key={index} className="swatch" style={{ backgroundColor: color }} title={color}></div>
          ))}
        </div>
        <div className="css-code">
          <code>{gradient.css}</code>
          <button onClick={handleCopy} className="copy-button">{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
};

const PaletteCard: React.FC<{ palette: Palette, isFavorite: boolean, onSave: (p: Palette) => void, onRemove: (p: Palette) => void, showRemove?: boolean }> =
({ palette, isFavorite, onSave, onRemove, showRemove }) => {
    const [copiedColor, setCopiedColor] = useState<string | null>(null);

    const handleCopy = (color: string) => {
        navigator.clipboard.writeText(color);
        setCopiedColor(color);
        setTimeout(() => setCopiedColor(null), 2000);
    };

    return (
        <div className="palette-card">
            {palette.brandName && <div className="brand-badge">{palette.brandName}</div>}
            <ActionButton item={palette} isFavorite={isFavorite} showRemove={showRemove} onSave={onSave} onRemove={onRemove} />
            <div className="palette-colors">
                {palette.colors.map((color) => (
                    <div
                        key={color}
                        className="palette-color-block"
                        style={{ backgroundColor: color }}
                        onClick={() => handleCopy(color)}
                        title={`Click to copy ${color}`}
                    >
                        {copiedColor === color && (
                            <div className="copied-feedback">
                                <span>Copied!</span>
                                <span className="hex-code">{color}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ColorPickerDialog: React.FC<{
    color: string;
    onClose: () => void;
    onChange: (newColor: string) => void;
}> = ({ color, onClose, onChange }) => {
    const [localColor, setLocalColor] = useState(color);
    const hsl = useMemo(() => hexToHsl(localColor) || { h: 0, s: 1, l: 0.5 }, [localColor]);
    const rgb = useMemo(() => hexToRgb(localColor) || { r: 0, g: 0, b: 0 }, [localColor]);
    
    const svPlaneRef = useRef<HTMLDivElement>(null);
    const hueSliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => onChange(localColor), [localColor, onChange]);

    const handleSVChange = (e: React.MouseEvent | React.TouchEvent) => {
        if (!svPlaneRef.current) return;
        const rect = svPlaneRef.current.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
        
        const v = 1 - Math.max(0, Math.min(1, y / rect.height));
        const s = Math.max(0, Math.min(1, x / rect.width));
        const l = v * (1 - s / 2);
        const newS = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);

        setLocalColor(hslToHex(hsl.h, newS, l));
    };

    const handleHueChange = (e: React.MouseEvent | React.TouchEvent) => {
        if (!hueSliderRef.current) return;
        const rect = hueSliderRef.current.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const h = Math.max(0, Math.min(360, (x / rect.width) * 360));
        setLocalColor(hslToHex(h, hsl.s, hsl.l));
    };
    
    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        if (!value.startsWith('#')) value = '#' + value;
        setLocalColor(value);
    };

    const handleRgbChange = (channel: 'r' | 'g' | 'b', value: string) => {
        const numValue = Math.max(0, Math.min(255, parseInt(value) || 0));
        setLocalColor(rgbToHex(channel === 'r' ? numValue : rgb.r, channel === 'g' ? numValue : rgb.g, channel === 'b' ? numValue : rgb.b));
    };

    const handleHslChange = (channel: 'h' | 's' | 'l', value: string) => {
        const numValue = parseInt(value) || 0;
        if(channel === 'h') setLocalColor(hslToHex(Math.max(0, Math.min(360, numValue)), hsl.s, hsl.l));
        if(channel === 's') setLocalColor(hslToHex(hsl.h, Math.max(0, Math.min(100, numValue))/100, hsl.l));
        if(channel === 'l') setLocalColor(hslToHex(hsl.h, hsl.s, Math.max(0, Math.min(100, numValue))/100));
    };
    
    const addWindowEvents = (moveHandler: (e: any) => void) => {
      const upHandler = () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('touchmove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
        window.removeEventListener('touchend', upHandler);
      };
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('touchmove', moveHandler);
      window.addEventListener('mouseup', upHandler);
      window.addEventListener('touchend', upHandler);
    };
    
    const v = hsl.l + hsl.s * Math.min(hsl.l, 1 - hsl.l);
    const sValue = v === 0 ? 0 : 2 * (1 - hsl.l / v);

    return (
        <div className="picker-dialog-overlay" onMouseDown={onClose}>
            <div className="picker-dialog" onMouseDown={(e) => e.stopPropagation()}>
                <div className="color-preview" style={{ backgroundColor: localColor }} />
                <div className="hsv-picker">
                    <div 
                        ref={svPlaneRef} 
                        className="sv-plane" 
                        style={{background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, hsl(${hsl.h}, 100%, 50%))`}}
                        onMouseDown={(e) => { handleSVChange(e); addWindowEvents(handleSVChange); }}
                        onTouchStart={(e) => { handleSVChange(e); addWindowEvents(handleSVChange); }}
                    >
                        <div className="sv-plane-thumb" style={{ top: `${(1-v) * 100}%`, left: `${sValue * 100}%`, backgroundColor: localColor }}/>
                    </div>
                    <div ref={hueSliderRef} className="hue-slider-container" 
                        onMouseDown={(e) => { handleHueChange(e); addWindowEvents(handleHueChange); }}
                        onTouchStart={(e) => { handleHueChange(e); addWindowEvents(handleHueChange); }}
                    >
                        <div className="hue-slider">
                            <div className="hue-slider-thumb" style={{ left: `${(hsl.h / 360) * 100}%`}} />
                        </div>
                    </div>
                </div>
                <div className="color-inputs">
                    <label>HEX</label><input className="hex-input" type="text" value={localColor} onChange={handleHexChange} />
                    <label>RGB</label>
                    <div className="input-group-row">
                        <input type="number" value={Math.round(rgb.r)} onChange={e => handleRgbChange('r', e.target.value)} />
                        <input type="number" value={Math.round(rgb.g)} onChange={e => handleRgbChange('g', e.target.value)} />
                        <input type="number" value={Math.round(rgb.b)} onChange={e => handleRgbChange('b', e.target.value)} />
                    </div>
                    <label>HSL</label>
                     <div className="input-group-row">
                        <input type="number" value={Math.round(hsl.h)} onChange={e => handleHslChange('h', e.target.value)} />
                        <input type="number" value={Math.round(hsl.s * 100)} onChange={e => handleHslChange('s', e.target.value)} />
                        <input type="number" value={Math.round(hsl.l * 100)} onChange={e => handleHslChange('l', e.target.value)} />
                    </div>
                </div>
            </div>
        </div>
    )
}


const FilterControls: React.FC<{
    activeFilter: 'All' | Style,
    setActiveFilter: (filter: 'All' | Style) => void,
    options: ('All' | Style)[]
}> = ({ activeFilter, setActiveFilter, options }) => (
    <div className="filter-controls">
        {options.map(filter => (
            <button key={filter} className={`filter-btn ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)}>
              {filter}{filter === 'Brands' && ' ✨'}
            </button>
        ))}
    </div>
);


type GeneratorPropsType = {
    favorites: Favorites,
    onSaveGradient: (g: Gradient) => void,
    onRemoveGradient: (g: Gradient) => void,
    onSavePalette: (p: Palette) => void,
    onRemovePalette: (p: Palette) => void,
    generatorState: GeneratorConfig,
    onStateChange: (newState: Partial<GeneratorConfig>) => void;
}

const GeneratorContainer: React.FC<{
    onGenerate: (palette: string[], count: number) => void,
    onGenerateRandom: (count: number) => void,
    generatorState: GeneratorConfig,
    onStateChange: (newState: Partial<GeneratorConfig>) => void,
    children?: React.ReactNode,
}> = ({ onGenerate, onGenerateRandom, generatorState, onStateChange, children }) => {
    const { mode, palette, suggestionCount } = generatorState;
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingColor, setEditingColor] = useState<{index: number, color: string} | null>(null);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const amountInputRef = useRef<HTMLInputElement>(null);
    
    const handleGenerate = () => {
        if(palette.length === 0) {
            setError("Please add at least one color to the palette.");
            return;
        }
        setError(null);
        onGenerate(palette, suggestionCount);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);
        try {
            const base64 = await blobToBase64(file);
            const extractedPalette = await extractPaletteFromImage(base64);
            if (extractedPalette.length > 0) {
                onStateChange({ palette: extractedPalette });
                onGenerate(extractedPalette, suggestionCount);
            }
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    
    const updatePaletteColor = (index: number, newColor: string) => {
        const newPalette = [...palette];
        newPalette[index] = newColor;
        onStateChange({ palette: newPalette });
    };
    
    const addColor = () => onStateChange({ palette: [...palette, randomHex()]});
    const removeColor = (index: number) => onStateChange({ palette: palette.filter((_, i) => i !== index) });
    
    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const newPalette = [...palette];
        const draggedItemContent = newPalette.splice(dragItem.current, 1)[0];
        newPalette.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        onStateChange({ palette: newPalette });
    };

    return (
        <>
            <div className="controls">
              <div className="generator-config-layout">
                <div className="config-left">
                  <div className="input-group">
                      <label>Base Colors</label>
                       <div className="mode-toggle">
                          <button className={mode === 'single' ? 'active' : ''} onClick={() => onStateChange({ mode: 'single' })}>Single</button>
                          <button className={mode === 'palette' ? 'active' : ''} onClick={() => onStateChange({ mode: 'palette' })}>Palette</button>
                      </div>
                      <div className="palette-editor">
                          {(mode === 'single' ? palette.slice(0, 1) : palette).map((color, index) => (
                               <div 
                                  key={index}
                                  className="palette-swatch" 
                                  style={{backgroundColor: color}}
                                  onClick={() => setEditingColor({index: mode === 'single' ? 0 : index, color})}
                                  draggable={mode === 'palette'}
                                  onDragStart={() => dragItem.current = index}
                                  onDragEnter={() => dragOverItem.current = index}
                                  onDragEnd={handleDragSort}
                                  onDragOver={(e) => e.preventDefault()}
                              >
                                  {mode === 'palette' && palette.length > 1 && <div className="remove-swatch" onClick={(e) => { e.stopPropagation(); removeColor(index); }}>&times;</div>}
                              </div>
                          ))}
                           {mode === 'palette' && <button className="add-swatch-btn" onClick={addColor}>+</button>}
                      </div>
                      {mode === 'palette' && (
                          <div className="extract-from-image-container">
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }}/>
                            <button className="button-like secondary" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                                Extract from Image {isLoading && <span className="spinner" />}
                            </button>
                          </div>
                       )}
                  </div>
                </div>
                <div className="config-right">
                  <div className="generator-config">
                      <div className="config-column">
                          <div className="input-group">
                            <label htmlFor="suggestion-count">Amount</label>
                            <div className="input-row" onClick={() => amountInputRef.current?.focus()}>
                              <input ref={amountInputRef} id="suggestion-count" type="number" min="1" max="50" value={suggestionCount} onChange={(e) => onStateChange({ suggestionCount: Math.max(1, parseInt(e.target.value, 10) || 1)})} aria-label="Number of suggestions"/>
                            </div>
                          </div>
                          {children}
                      </div>
                       <div className="config-column">
                          <div className="button-row">
                               <div className="main-actions">
                                <button onClick={handleGenerate} disabled={isLoading || palette.length === 0}>Generate from Color(s)</button>
                                <button onClick={() => onGenerateRandom(suggestionCount)} disabled={isLoading}>Generate Random</button>
                               </div>
                          </div>
                       </div>
                  </div>
                </div>
              </div>
            </div>
            {error && <p className="message" style={{color: '#ff8a80'}}>{error}</p>}
            {editingColor && (
                <ColorPickerDialog 
                    color={editingColor.color}
                    onClose={() => setEditingColor(null)}
                    onChange={(newColor) => updatePaletteColor(editingColor.index, newColor)}
                />
            )}
        </>
    )
}

const GradientGenerator: React.FC<GeneratorPropsType> = (props) => {
    const { favorites, onSaveGradient, onRemoveGradient, generatorState, onStateChange } = props;
    const { mode, palette, gradientMinColors, gradientMaxColors } = generatorState;
    const [gradients, setGradients] = useState<Gradient[]>([]);
    const [activeFilter, setActiveFilter] = useState<'All' | Style>('All');
    const [gradientTypeFilter, setGradientTypeFilter] = useState<'all' | GradientType>('all');
    
    const minInputRef = useRef<HTMLInputElement>(null);
    const maxInputRef = useRef<HTMLInputElement>(null);
    const [minInput, setMinInput] = useState(gradientMinColors.toString());
    const [maxInput, setMaxInput] = useState(gradientMaxColors.toString());

    useEffect(() => {
        setMinInput(gradientMinColors.toString());
    }, [gradientMinColors]);

    useEffect(() => {
        setMaxInput(gradientMaxColors.toString());
    }, [gradientMaxColors]);
    
    const favoriteCssSet = useMemo(() => new Set(favorites.gradients.map(g => g.css)), [favorites.gradients]);

    const generate = useCallback((sourcePalette: string[], count: number) => {
        const suggestions: Gradient[] = [];
        if (sourcePalette.length === 0) return;

        const shuffledStyles: Style[] = [...PALETTE_STYLES].filter(s => s !== 'Brands').sort(() => 0.5 - Math.random());

        for (let i = 0; i < count; i++) {
            const style = shuffledStyles[i % shuffledStyles.length];
            let finalPalette: string[];

            if (mode === 'palette') {
                const effectiveMin = Math.max(gradientMinColors, sourcePalette.length);
                const effectiveMax = Math.max(effectiveMin, gradientMaxColors);
                const colorCount = randomInt(effectiveMin, effectiveMax);
                
                finalPalette = [...sourcePalette];
                const existingColors = new Set(sourcePalette);
                
                let attempts = 0;
                while(finalPalette.length < colorCount && attempts < 50) {
                    const seedColor = sourcePalette[randomInt(0, sourcePalette.length - 1)];
                    const baseHsl = hexToHsl(seedColor);
                    if (baseHsl) {
                        const candidatePalette = generateStyledPalette(baseHsl, style, 3, false);
                        for (const candidate of candidatePalette) {
                            if (!existingColors.has(candidate) && finalPalette.length < colorCount) {
                                finalPalette.push(candidate);
                                existingColors.add(candidate);
                            }
                        }
                    }
                    attempts++;
                }
            } else { // Single mode
                const currentSeedColor = sourcePalette[0];
                const baseHsl = hexToHsl(currentSeedColor);
                if (!baseHsl) continue;
                
                const effectiveMin = gradientMinColors;
                const effectiveMax = Math.max(effectiveMin, gradientMaxColors);
                const colorCount = randomInt(effectiveMin, effectiveMax);
                finalPalette = generateStyledPalette(baseHsl, style, colorCount);
            }
            
            suggestions.push(createGradientFromPalette(finalPalette, style));
        }
        const uniqueGradients = Array.from(new Map(suggestions.map(g => [g.css, g])).values());
        setGradients(uniqueGradients.slice(0, count));
    }, [mode, gradientMinColors, gradientMaxColors]);


    const generateRandom = useCallback((count: number) => {
        const newGradients: Gradient[] = [];
        const shuffledStyles: Style[] = [...PALETTE_STYLES].sort(() => 0.5 - Math.random());
        for (let i = 0; i < count + 5; i++) {
            const style = shuffledStyles[i % shuffledStyles.length];
            const baseHsl = hexToHsl(randomHex());
            if(!baseHsl) continue;
            const colorCount = randomInt(gradientMinColors, gradientMaxColors);
            const palette = generateStyledPalette(baseHsl, style, colorCount);
            newGradients.push(createGradientFromPalette(palette, style));
        }
        const uniqueGradients = Array.from(new Map(newGradients.map(g => [g.css, g])).values());
        setGradients(uniqueGradients.slice(0, count));
    }, [gradientMinColors, gradientMaxColors]);

    useEffect(() => { generateRandom(8); }, [generateRandom]);

    const filteredGradients = useMemo(() => {
        const styleFiltered = gradients.filter(g => {
            if (activeFilter === 'All') return true;
            if (activeFilter === 'Duotone') return g.colors.length === 2;
            return g.style === activeFilter;
        });
        return styleFiltered.filter(g => gradientTypeFilter === 'all' || g.type === gradientTypeFilter);
    }, [gradients, activeFilter, gradientTypeFilter]);
    
    const gradientTypeOptions: ('all' | GradientType)[] = ['all', 'linear', 'radial', 'conic', 'mesh'];

    const handleMinBlur = () => {
        let newMin = parseInt(minInput, 10);
        if (isNaN(newMin)) {
            setMinInput(gradientMinColors.toString());
            return;
        }
        newMin = Math.max(2, Math.min(10, newMin));
        const newMax = Math.max(newMin, gradientMaxColors);
        onStateChange({ gradientMinColors: newMin, gradientMaxColors: newMax });
    };

    const handleMaxBlur = () => {
        let newMax = parseInt(maxInput, 10);
        if (isNaN(newMax)) {
            setMaxInput(gradientMaxColors.toString());
            return;
        }
        newMax = Math.max(2, Math.min(10, newMax));
        const newMin = Math.min(newMax, gradientMinColors);
        onStateChange({ gradientMinColors: newMin, gradientMaxColors: newMax });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <>
            <GeneratorContainer onGenerate={generate} onGenerateRandom={generateRandom} generatorState={generatorState} onStateChange={onStateChange}>
                <div className="input-group">
                    <label>Color Count</label>
                    <div className="input-row-group">
                        <div className="input-row" onClick={() => minInputRef.current?.focus()}>
                            <span>Min</span>
                            <input ref={minInputRef} type="number" value={minInput} onChange={e => setMinInput(e.target.value)} onBlur={handleMinBlur} onKeyDown={handleKeyDown} min="2" max="10" />
                        </div>
                        <div className="input-row" onClick={() => maxInputRef.current?.focus()}>
                            <span>Max</span>
                            <input ref={maxInputRef} type="number" value={maxInput} onChange={e => setMaxInput(e.target.value)} onBlur={handleMaxBlur} onKeyDown={handleKeyDown} min="2" max="10" />
                        </div>
                    </div>
                </div>
            </GeneratorContainer>
            
            <FilterControls activeFilter={activeFilter} setActiveFilter={setActiveFilter} options={['All', ...PALETTE_STYLES]} />
            <div className="filter-controls">
                {gradientTypeOptions.map(type => (
                    <button key={type} className={`filter-btn ${gradientTypeFilter === type ? 'active' : ''}`} onClick={() => setGradientTypeFilter(type)}>{type}</button>
                ))}
            </div>

            <div className="grid-container">
                {filteredGradients.length > 0 ? (
                    filteredGradients.map((gradient) => <GradientCard key={gradient.css} gradient={gradient} isFavorite={favoriteCssSet.has(gradient.css)} onSave={onSaveGradient} onRemove={onRemoveGradient} />)
                ) : (
                    <div className="message">No gradients match the filter. Try generating some more!</div>
                )}
            </div>
        </>
    );
};

const PaletteGenerator: React.FC<GeneratorPropsType> = (props) => {
    const { favorites, onSavePalette, onRemovePalette, generatorState, onStateChange } = props;
    const { mode, paletteMinColors, paletteMaxColors } = generatorState;
    const [palettes, setPalettes] = useState<Palette[]>([]);
    const [activeFilter, setActiveFilter] = useState<'All' | Style>('All');
    const favoritePalettesSet = useMemo(() => new Set(favorites.palettes.map(p => p.colors.join('-'))), [favorites.palettes]);
    
    const minInputRef = useRef<HTMLInputElement>(null);
    const maxInputRef = useRef<HTMLInputElement>(null);
    const [minInput, setMinInput] = useState(paletteMinColors.toString());
    const [maxInput, setMaxInput] = useState(paletteMaxColors.toString());

    useEffect(() => {
        setMinInput(paletteMinColors.toString());
    }, [paletteMinColors]);

    useEffect(() => {
        setMaxInput(paletteMaxColors.toString());
    }, [paletteMaxColors]);
    
    const generate = useCallback((sourcePalette: string[], count: number) => {
        const suggestions: Palette[] = [];
        if (sourcePalette.length === 0) return;

        const shuffledStyles: Style[] = [...PALETTE_STYLES].filter(s => s !== 'Brands').sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < count; i++) {
            const style = shuffledStyles[i % shuffledStyles.length];
            let finalPalette: string[];

            if (mode === 'palette') {
                const effectiveMin = Math.max(paletteMinColors, sourcePalette.length);
                const effectiveMax = Math.max(effectiveMin, paletteMaxColors);
                const colorCount = randomInt(effectiveMin, effectiveMax);
                
                finalPalette = [...sourcePalette];
                const existingColors = new Set(sourcePalette);
                
                let attempts = 0;
                while(finalPalette.length < colorCount && attempts < 50) {
                    const seedColor = sourcePalette[randomInt(0, sourcePalette.length - 1)];
                    const baseHsl = hexToHsl(seedColor);
                    if (baseHsl) {
                        const candidatePalette = generateStyledPalette(baseHsl, style, 3, false);
                        for (const candidate of candidatePalette) {
                            if (!existingColors.has(candidate) && finalPalette.length < colorCount) {
                                finalPalette.push(candidate);
                                existingColors.add(candidate);
                            }
                        }
                    }
                    attempts++;
                }
            } else { // Single mode
                const currentSeedColor = sourcePalette[0];
                const baseHsl = hexToHsl(currentSeedColor);
                if (!baseHsl) continue;
                
                const effectiveMin = paletteMinColors;
                const effectiveMax = Math.max(effectiveMin, paletteMaxColors);
                const colorCount = randomInt(effectiveMin, effectiveMax);
                finalPalette = generateStyledPalette(baseHsl, style, colorCount);
            }
            
            suggestions.push({ colors: finalPalette, style });
        }
        
        const uniquePalettes = Array.from(new Map(suggestions.map(p => [p.colors.join('-'), p])).values());
        setPalettes(uniquePalettes.slice(0, count));
    }, [mode, paletteMinColors, paletteMaxColors]);

    const generateRandom = useCallback((count: number) => {
        const newPalettes: Palette[] = [];
        const shuffledStyles: Style[] = [...PALETTE_STYLES].sort(() => 0.5 - Math.random());
        for (let i = 0; i < count + 5; i++) {
            const style = shuffledStyles[i % shuffledStyles.length];
            const baseHsl = hexToHsl(randomHex());
            if(!baseHsl) continue;
            const colors = generateStyledPalette(baseHsl, style, randomInt(paletteMinColors, paletteMaxColors));
            newPalettes.push({ colors, style });
        }
        const uniquePalettes = Array.from(new Map(newPalettes.map(p => [p.colors.join('-'), p])).values());
        setPalettes(uniquePalettes.slice(0, count));
    }, [paletteMinColors, paletteMaxColors]);

    useEffect(() => { generateRandom(8); }, [generateRandom]);

    const filteredPalettes = useMemo(() => {
        if (activeFilter === 'All') return palettes;
        if (activeFilter === 'Duotone') {
            return palettes.filter(p => p.colors.length === 2);
        }
        return palettes.filter(p => p.style === activeFilter);
    }, [palettes, activeFilter]);

    const handleMinBlur = () => {
        let newMin = parseInt(minInput, 10);
        if (isNaN(newMin)) {
            setMinInput(paletteMinColors.toString());
            return;
        }
        newMin = Math.max(2, Math.min(10, newMin));
        const newMax = Math.max(newMin, paletteMaxColors);
        onStateChange({ paletteMinColors: newMin, paletteMaxColors: newMax });
    };

    const handleMaxBlur = () => {
        let newMax = parseInt(maxInput, 10);
        if (isNaN(newMax)) {
            setMaxInput(paletteMaxColors.toString());
            return;
        }
        newMax = Math.max(2, Math.min(10, newMax));
        const newMin = Math.min(newMax, paletteMinColors);
        onStateChange({ paletteMinColors: newMin, paletteMaxColors: newMax });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };
    
    return (
        <>
            <GeneratorContainer onGenerate={generate} onGenerateRandom={generateRandom} generatorState={generatorState} onStateChange={onStateChange}>
                <div className="input-group">
                    <label>Colors per Palette</label>
                    <div className="input-row-group">
                        <div className="input-row" onClick={() => minInputRef.current?.focus()}>
                            <span>Min</span>
                            <input ref={minInputRef} type="number" value={minInput} onChange={e => setMinInput(e.target.value)} onBlur={handleMinBlur} onKeyDown={handleKeyDown} min="2" max="10" />
                        </div>
                         <div className="input-row" onClick={() => maxInputRef.current?.focus()}>
                            <span>Max</span>
                            <input ref={maxInputRef} type="number" value={maxInput} onChange={e => setMaxInput(e.target.value)} onBlur={handleMaxBlur} onKeyDown={handleKeyDown} min="2" max="10" />
                        </div>
                    </div>
                </div>
            </GeneratorContainer>

            <FilterControls activeFilter={activeFilter} setActiveFilter={setActiveFilter} options={['All', ...PALETTE_STYLES]} />

            <div className="grid-container">
                {filteredPalettes.map((palette) => {
                    const key = palette.colors.join('-');
                    return <PaletteCard key={key} palette={palette} isFavorite={favoritePalettesSet.has(key)} onSave={onSavePalette} onRemove={onRemovePalette} />
                })}
            </div>
        </>
    );
};


const TrendingView: React.FC<Omit<GeneratorPropsType, 'generatorState' | 'onStateChange'>> = ({ favorites, onSaveGradient, onRemoveGradient, onSavePalette, onRemovePalette }) => {
    const [allGradients, setAllGradients] = useState<Gradient[]>([]);
    const [allPalettes, setAllPalettes] = useState<Palette[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<'All' | Style>('All');
    
    const favoriteCssSet = useMemo(() => new Set(favorites.gradients.map(g => g.css)), [favorites.gradients]);
    const favoritePalettesSet = useMemo(() => new Set(favorites.palettes.map(p => p.colors.join('-'))), [favorites.palettes]);


    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}trending.json`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                const standardGradients = data.standard?.gradients || [];
                const brandGradients = (data.brands?.gradients || []).map((g: any) => ({...g, style: 'Brands' as Style, brandName: g.brandName}));
                setAllGradients([...standardGradients, ...brandGradients]);
                
                const standardPalettes = data.standard?.palettes || [];
                const brandPalettes = (data.brands?.palettes || []).map((p: any) => ({...p, style: 'Brands' as Style, brandName: p.brandName}));
                setAllPalettes([...standardPalettes, ...brandPalettes]);
            })
            .catch(err => {
                console.error("Failed to fetch trending data:", err);
                setError("Could not load trending palettes. Please try again later.");
            });
    }, []);

    const filteredGradients = useMemo(() => {
        if (activeFilter === 'All') return allGradients;
        if (activeFilter === 'Duotone') {
            return allGradients.filter(g => g.colors.length === 2);
        }
        return allGradients.filter(g => g.style === activeFilter);
    }, [allGradients, activeFilter]);
    const filteredPalettes = useMemo(() => {
        if (activeFilter === 'All') return allPalettes;
        if (activeFilter === 'Duotone') {
            return allPalettes.filter(p => p.colors.length === 2);
        }
        return allPalettes.filter(p => p.style === activeFilter);
    }, [allPalettes, activeFilter]);

    return (
        <div>
            <FilterControls activeFilter={activeFilter} setActiveFilter={setActiveFilter} options={['All', ...PALETTE_STYLES]} />
            {error && <p className="message" style={{color: '#ff8a80'}}>{error}</p>}
            
            {filteredGradients.length > 0 && <div className="trending-section">
                <h2>Trending Gradients</h2>
                <div className="grid-container">
                    {filteredGradients.map((gradient) => (
                        <GradientCard key={gradient.css} gradient={gradient} isFavorite={favoriteCssSet.has(gradient.css)} onSave={onSaveGradient} onRemove={onRemoveGradient}/>
                    ))}
                </div>
            </div>}
            
            {filteredPalettes.length > 0 && <div className="trending-section">
                <h2>Trending Palettes</h2>
                <div className="grid-container">
                    {filteredPalettes.map((palette) => {
                        const key = palette.colors.join('-');
                        return <PaletteCard key={key} palette={palette} isFavorite={favoritePalettesSet.has(key)} onSave={onSavePalette} onRemove={onRemovePalette}/>
                    })}
                </div>
            </div>}
        </div>
    );
};

const FavoritesView: React.FC<Omit<GeneratorPropsType, 'generatorState' | 'onStateChange'>> = ({ favorites, onRemoveGradient, onRemovePalette }) => {
    const [activeFilter, setActiveFilter] = useState<'All' | Style>('All');

    const filteredGradients = useMemo(() => {
        if (activeFilter === 'All') return favorites.gradients;
        if (activeFilter === 'Duotone') {
            return favorites.gradients.filter(g => g.colors.length === 2);
        }
        return favorites.gradients.filter(g => g.style === activeFilter);
    }, [favorites.gradients, activeFilter]);
    const filteredPalettes = useMemo(() => {
        if (activeFilter === 'All') return favorites.palettes;
        if (activeFilter === 'Duotone') {
            return favorites.palettes.filter(p => p.colors.length === 2);
        }
        return favorites.palettes.filter(p => p.style === activeFilter);
    }, [favorites.palettes, activeFilter]);

    return (
        <div>
             <FilterControls activeFilter={activeFilter} setActiveFilter={setActiveFilter} options={['All', ...PALETTE_STYLES]} />
            {favorites.gradients.length === 0 && favorites.palettes.length === 0 ? (
                <p className="message">You haven't saved any favorites yet. Start exploring and save what you love!</p>
            ) : (
                <>
                    {filteredGradients.length > 0 && (
                        <div className="favorites-section">
                            <h2>Saved Gradients</h2>
                            <div className="grid-container">
                                {filteredGradients.map((gradient) => (
                                    <GradientCard key={gradient.css} gradient={gradient} isFavorite={true} onSave={()=>{}} onRemove={onRemoveGradient} showRemove={true}/>
                                ))}
                            </div>
                        </div>
                    )}
                     {filteredPalettes.length > 0 && (
                        <div className="favorites-section">
                            <h2>Saved Palettes</h2>
                            <div className="grid-container">
                                {filteredPalettes.map((palette) => (
                                    <PaletteCard key={palette.colors.join('-')} palette={palette} isFavorite={true} onSave={()=>{}} onRemove={onRemovePalette} showRemove={true}/>
                                ))}
                            </div>
                        </div>
                     )}
                     {(filteredGradients.length === 0 || filteredPalettes.length === 0) && (activeFilter !== 'All') &&
                        <p className="message">No saved items match this filter.</p>
                     }
                </>
            )}
        </div>
    );
}


const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('gradients');
  const [favorites, setFavorites] = useState<Favorites>({ gradients: [], palettes: [] });
  const [generatorState, setGeneratorState] = useState<GeneratorConfig>({
    mode: 'single',
    palette: ['#ff8c00'],
    suggestionCount: 8,
    gradientMinColors: 2,
    gradientMaxColors: 5,
    paletteMinColors: 4,
    paletteMaxColors: 6,
  });

  const onStateChange = (newState: Partial<GeneratorConfig>) => {
      setGeneratorState(prevState => ({ ...prevState, ...newState }));
  };

  useEffect(() => {
    try {
        const savedFavorites = localStorage.getItem('huedini-favorites');
        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    } catch (error) { console.error("Could not load favorites:", error); }
  }, []);

  useEffect(() => {
      try {
          localStorage.setItem('huedini-favorites', JSON.stringify(favorites));
      } catch(error) { console.error("Could not save favorites:", error); }
  }, [favorites]);

  const onSaveGradient = (gradient: Gradient) => setFavorites(f => ({ ...f, gradients: [...f.gradients, gradient] }));
  const onRemoveGradient = (gradient: Gradient) => setFavorites(f => ({ ...f, gradients: f.gradients.filter(g => g.css !== gradient.css) }));
  const onSavePalette = (palette: Palette) => setFavorites(f => ({ ...f, palettes: [...f.palettes, palette] }));
  const onRemovePalette = (palette: Palette) => setFavorites(f => ({ ...f, palettes: f.palettes.filter(p => p.colors.join('-') !== palette.colors.join('-')) }));
  
  const generatorProps = { favorites, onSaveGradient, onRemoveGradient, onSavePalette, onRemovePalette, generatorState, onStateChange };

  const renderContent = () => {
    switch (mode) {
        case 'gradients': return <GradientGenerator {...generatorProps} />;
        case 'palettes': return <PaletteGenerator {...generatorProps} />;
        case 'trending': return <TrendingView {...{favorites, onSaveGradient, onRemoveGradient, onSavePalette, onRemovePalette}} />;
        case 'favorites': return <FavoritesView {...{favorites, onSaveGradient, onRemoveGradient, onSavePalette, onRemovePalette}}/>;
        default: return <GradientGenerator {...generatorProps}/>;
    }
  };

  const getSubtitle = () => {
      switch(mode) {
          case 'gradients': return "Discover stunning, algorithmically-generated gradients for your next project.";
          case 'palettes': return "Generate harmonious color palettes based on color theory.";
          case 'trending': return "Inspiration from the latest trends in color and design.";
          case 'favorites': return "Your personal collection of saved gradients and palettes.";
      }
  }

  return (
    <>
      <nav>
          <button className={`nav-btn ${mode === 'gradients' ? 'active' : ''}`} onClick={() => setMode('gradients')}>Gradients</button>
          <button className={`nav-btn ${mode === 'palettes' ? 'active' : ''}`} onClick={() => setMode('palettes')}>Palettes</button>
          <button className={`nav-btn ${mode === 'trending' ? 'active' : ''}`} onClick={() => setMode('trending')}>Trending</button>
          <button className={`nav-btn ${mode === 'favorites' ? 'active' : ''}`} onClick={() => setMode('favorites')}>Favorites</button>
      </nav>
      <div className="title-container">
        <img src="huediniproto.png" alt="Huedini Logo" className="logo" />
        <h1>Huedini</h1>
      </div>
      <p className="subtitle">{getSubtitle()}</p>
      {renderContent()}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);