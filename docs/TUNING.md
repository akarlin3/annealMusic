# Tuning Systems & Microtonality in AnnealMusic v4.1

With the launch of **v4.1**, AnnealMusic introduces full support for selectable tuning systems and custom microtonal scales across Patches, Pieces, and Listening Sessions. This guide explains the technical details of the implementation, the built-in tuning scales, Scala (`.scl`) format support, and acoustic framing guidelines.

---

## 1. Supported Tuning Systems

AnnealMusic ships with 10 built-in tuning systems, selectable in the **Tuning & Scales** settings panel:

### 1.1 Standard Equal Temperament (`equal`)

- **Description:** The modern Western standard, dividing the octave into 12 semitones using the ratio $2^{1/12}$.
- **Acoustic Profile:** Perfectly uniform and symmetrical across all keys, but thirds and sixths contain prominent beating compared to pure acoustic intervals.

### 1.2 Just Intonation (5-limit) (`just-5`)

- **Description:** Built on simple integer ratios of prime factors 2, 3, and 5.
- **Ratios:** `[1/1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 16/9, 15/8]`
- **Acoustic Profile:** Sweet, beatless perfect major thirds (5:4) and perfect fifths (3:2), but restricts easy key modulation.

### 1.3 Just Intonation (7-limit) (`just-7`)

- **Description:** Expands 5-limit Just Intonation to include prime factor 7.
- **Ratios:** `[1/1, 15/14, 8/7, 7/6, 5/4, 4/3, 7/5, 3/2, 8/5, 12/7, 7/4, 15/8]`
- **Acoustic Profile:** Introduces highly resonant septimal intervals like the septimal minor third (7:6) and natural minor seventh (7:4), providing a highly colorful acoustic texture.

### 1.4 Pythagorean (`pythagorean`)

- **Description:** Constructed entirely from chains of pure perfect fifths (3:2).
- **Ratios:** Derived using perfect fifth divisions.
- **Acoustic Profile:** Fifth-centric tuning with exceptionally pure fifths but sharp, tense major thirds.

### 1.5 Solfeggio "Frequencies" (`solfeggio`)

- **Description:** A sparse set of nine historical frequencies: `174, 285, 396, 417, 528, 639, 741, 852, 963 Hz`.
- **Acoustic Profile:** Completely non-octave-equivalent. Absolute pitches snap to the closest of these nine frequencies, creating a highly characteristic, resonant, and unique texture.

### 1.6 Well-Temperaments & Historical Western

- **Werckmeister III (`werckmeister3`):** Baroque well-temperament distributing Pythagorean comma across four fifths.
- **Kirnberger III (`kirnberger3`):** Keeps C-E completely just, concentrating tempering on the D-A fifth.
- **Quarter-Comma Meantone (`meantone-quarter`):** dominantly used in the Renaissance. Narrows fifths to achieve perfectly pure major thirds.
- **Vallotti (`valotti`):** Circulating well-temperament widely used for Baroque ensembles.
- **Young (`young`):**circulating temperament placing the sweetest keys close to C Major.

---

## 2. Custom Scala (.scl) Imports

AnnealMusic strictly supports importing custom scale files in the official **Scala (.scl)** format.

### 2.1 Scale Format Spec

- Line-by-line strict parser handles trailing comments (denoted by `!`), inline comments, blank lines, and whitespace.
- Supports pitches represented as **Cents** (floats containing a decimal point, e.g. `1200.0` cents) and **Ratios** (fractions like `3/2` or integers like `2`).
- The last pitch line determines the scale's octave/equivalence interval.

### 2.2 Microtonal Lattice Mapping

When a custom microtonal scale of size $K \neq 12$ is imported, the synthesis engine maps the 8 standard pure partials to their closest scale-cents degree (scanning steps from $0$ to $120$) to maintain structural coherence in the generative orbits.

---

## 3. Honest Framing Baseline

To foster scientific integrity, AnnealMusic displays explicit disclaimers inside the user interface when specific tunings are loaded:

### 3.1 Solfeggio Disclaimer

> "These nine frequencies are a modern reconstruction often associated with healing claims. AnnealMusic supports them because they produce a distinct non-octave-equivalent texture. The peer-reviewed evidence for specific clinical effects of these frequencies is absent."

### 3.2 432 Hz Disclaimer

> "The claim that 432 Hz possesses unique natural healing or acoustic properties is unsupported by scientific literature. AnnealMusic includes this option because the slight downward pitch shift produces a subtly warmer and different timbre."

### 3.3 Historical Temperaments Disclaimer

> "Historical Western temperaments give different keys unique 'colors' due to unevenly distributed intervals. They produce beautiful acoustic textures but do not offer targeted physiological or medical benefits."
