#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Uniforms
uniform vec2 u_resolution;
uniform float u_dpr;
uniform float u_base_radius;
uniform float u_rms;
uniform float u_input_level;
uniform int u_partial_count;
uniform vec4 u_partials[16];     // Packed coords: vec4(x, y, freq, amp)
uniform sampler2D u_spectrum;    // 1D spectrum trace texture (512x1)
uniform int u_show_spectrum;
uniform vec3 u_loop_levels;      // Loop slot levels (0..1)
uniform vec3 u_loop_frozen;      // Loop slot frozen status (0.0 or 1.0)
uniform float u_calm;

// Constants matching canvas palettes
const vec3 COLOR_BG    = vec3(12.0 / 255.0, 10.0 / 255.0, 9.0 / 255.0); // #0c0a09
const vec3 COLOR_AMBER = vec3(245.0 / 255.0, 158.0 / 255.0, 11.0 / 255.0);
const vec3 COLOR_ROSE  = vec3(248.0 / 255.0, 113.0 / 255.0, 113.0 / 255.0);
const vec3 COLOR_CYAN  = vec3(125.0 / 255.0, 211.0 / 255.0, 252.0 / 255.0);
const vec3 COLOR_CORE  = vec3(254.0 / 255.0, 215.0 / 255.0, 170.0 / 255.0);
const vec3 COLOR_MID   = vec3(251.0 / 255.0, 191.0 / 255.0, 36.0 / 255.0);
const vec3 COLOR_EDGE  = vec3(251.0 / 255.0, 146.0 / 255.0, 60.0 / 255.0);

const float PI = 3.14159265359;

// Distance from point to line segment
float distanceToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

void main() {
    // Current pixel in physical coordinates, flipped vertically to match Canvas 2D
    vec2 fragCoord = vec2(v_uv.x, 1.0 - v_uv.y) * u_resolution;
    vec2 center = u_resolution * 0.5;
    float dist = distance(fragCoord, center);

    // 1. Base Background Color
    vec3 color = COLOR_BG;
    float calmScale = (u_calm > 0.5) ? 0.6 : 1.0;

    // 2. Central Halo
    float haloRadius = u_base_radius * 1.6;
    float haloT = smoothstep(haloRadius, 0.0, dist);
    color += COLOR_AMBER * (0.04 * calmScale) * haloT;

    // 3. Faint Input Ring (driven by live-input amplitude)
    if (u_input_level >= 0.0) {
        float ringR = u_base_radius * 1.6 * (1.0 + u_input_level * 0.25);
        float ringAlpha = 0.05 + u_input_level * 0.18;
        
        float ringDist = abs(dist - ringR);
        // Antialiased 1.5px ring
        float ringEdge = smoothstep(1.5 * u_dpr, 0.5 * u_dpr, ringDist);
        color += COLOR_MID * ringAlpha * ringEdge * calmScale;
    }

    // 4. Per-slot Loop Rings (amber, rose, cyan)
    float loopRadii[3] = float[](1.78, 1.98, 2.18);
    vec3 loopColors[3] = vec3[](COLOR_AMBER, COLOR_ROSE, COLOR_CYAN);
    
    // Compute pixel angle [0, 2PI] relative to center
    float angle = atan(fragCoord.y - center.y, fragCoord.x - center.x);
    if (angle < 0.0) angle += 2.0 * PI;

    for (int slot = 0; slot < 3; slot++) {
        float lvl = u_loop_levels[slot];
        float isFrozen = u_loop_frozen[slot];
        
        // Loop ring is visible if slot has active level or is frozen
        if (lvl > 0.0 || isFrozen > 0.0) {
            float radius = u_base_radius * loopRadii[slot] * (1.0 + lvl * 0.18);
            float ringAlpha = 0.06 + lvl * 0.22 + (isFrozen > 0.0 ? 0.06 : 0.0);
            
            float ringDist = abs(dist - radius);
            // Antialiased 1.5px ring
            float ringEdge = smoothstep(1.5 * u_dpr, 0.5 * u_dpr, ringDist);

            float start = (float(slot) * 2.0 * PI) / 3.0;
            float sweep = (isFrozen > 0.0) ? 2.0 * PI : 1.7;
            
            // Handle angular wrap-around for partial loop ring arcs
            float relAngle = mod(angle - start, 2.0 * PI);
            if (relAngle < 0.0) relAngle += 2.0 * PI;

            if (relAngle <= sweep) {
                color += loopColors[slot] * ringAlpha * ringEdge * calmScale;
            }
        }
    }

    // 5. Ambient Partial Orbits
    for (int i = 0; i < u_partial_count; i++) {
        vec4 p = u_partials[i]; // (x, y, freq, amp)
        vec2 pCenter = p.xy;
        float amp = p.w;
        float pDist = distance(fragCoord, pCenter);

        float glowRadius = (5.0 + amp * 22.0) * u_dpr;
        if (pDist < glowRadius) {
            float t = pDist / glowRadius;
            vec3 pColor;
            float pAlpha;

            // Interpolate radial gradient colors and alphas
            if (t < 0.4) {
                float n = t / 0.4;
                pColor = mix(COLOR_CORE, COLOR_MID, n);
                pAlpha = mix(0.55 + amp * 0.35, 0.3 + amp * 0.25, n);
            } else {
                float n = (t - 0.4) / 0.6;
                pColor = mix(COLOR_MID, COLOR_EDGE, n);
                // Edge opacity fades out completely to 0.0 at t=1.0
                pAlpha = mix(0.3 + amp * 0.25, 0.0, n);
            }
            
            color += pColor * pAlpha * calmScale;
        }
    }

    // 6. Spectrum Trace at the Bottom
    if (u_show_spectrum == 1) {
        float bottomPad = 10.0 * u_dpr;
        float spectrumHeight = 36.0 * u_dpr;
        float bottomY = u_resolution.y - bottomPad;
        
        float usableFrac = 0.45;
        float normX = fragCoord.x / u_resolution.x;
        
        if (normX >= 0.0 && normX <= 1.0) {
            float texCoord = normX * usableFrac;
            float val = texture(u_spectrum, vec2(texCoord, 0.5)).r;
            float traceY = bottomY - val * spectrumHeight;

            // Sample adjacent bins to draw a continuous connected segment
            float stepW = 1.0 / u_resolution.x;
            
            float valPrev = texture(u_spectrum, vec2(max(0.0, normX - stepW) * usableFrac, 0.5)).r;
            float valNext = texture(u_spectrum, vec2(min(1.0, normX + stepW) * usableFrac, 0.5)).r;

            vec2 pPrev = vec2(fragCoord.x - 1.0, bottomY - valPrev * spectrumHeight);
            vec2 pCurr = vec2(fragCoord.x, traceY);
            vec2 pNext = vec2(fragCoord.x + 1.0, bottomY - valNext * spectrumHeight);

            float d1 = distanceToSegment(fragCoord, pPrev, pCurr);
            float d2 = distanceToSegment(fragCoord, pCurr, pNext);
            float minD = min(d1, d2);

            // Antialiased 1.0px spectrum trace line
            float traceAlpha = smoothstep(1.0 * u_dpr, 0.0 * u_dpr, minD);
            color += vec3(245.0 / 255.0, 245.0 / 255.0, 244.0 / 255.0) * 0.16 * traceAlpha * calmScale;
        }
    }

    fragColor = vec4(color, 1.0);
}
