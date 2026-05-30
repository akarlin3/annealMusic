# AnnealMusic · Scientific Experiment Templates

This document details the pre-curated scientific experiment script recipes included in the AnnealMusic Scripting Library. Researchers can run these scripts directly in the sandboxed Scripting Console to register and deploy studies immediately.

---

## Template 1: Auditory Consonance Rating Study

Measures the perceptual pleasantness of different intervals (consonant vs. dissonant dyad states) using a 7-point Likert scale response component.

### Python Definition

```python
import anneal
from anneal.experiment import Experiment, Stimulus, LikertResponse, Block, DemographicSurvey

# 1. Define perfect fifth vs tritone stimuli
dyads = [
    Stimulus(id="perfect_fifth", patch={"engine": "sine", "rootFreq": 150, "brightness": 0.5}, duration=2.5),
    Stimulus(id="tritone", patch={"engine": "sine", "rootFreq": 150, "brightness": 0.8}, duration=2.5),
]

# 2. Compile into a randomized block
consonance_block = Block(
    name="Auditory Consonance Rating",
    trials=[
        {"stimulus": dyads[0], "response": LikertResponse(prompt="Rate the pleasantness of this perfect fifth dyad:", scale=7)},
        {"stimulus": dyads[1], "response": LikertResponse(prompt="Rate the pleasantness of this tritone dyad:", scale=7)},
    ],
    randomize="full"
)

# 3. Assemble and launch experiment
exp = Experiment(
    title="Dyad Consonance Perception Study",
    description="A scientific perceptual study investigating consonant vs dissonant intervals.",
    consent_text="Click accept to participate in this brief, non-invasive auditory perception study...",
    debrief_text="Thank you for participating! Your responses help us analyze pitch ratio pleasantness."
)
exp.add_demographics(DemographicSurvey(["age", "musical_experience"]))
exp.add_block(consonance_block)

print("Registering Consonance Rating Study...")
exp.run()
```

---

## Template 2: Spectral Brightness Matching Study

A parameter matching task where subjects listen to drone profiles and continuously adjust a parameter slider to match target synthesizer levels.

### Python Definition

```python
import anneal
from anneal.experiment import Experiment, Stimulus, AdjustValue, Block, DemographicSurvey

# 1. Define target stimuli profile
stimuli = [
    Stimulus(id="dark_drone", patch={"engine": "waveguide", "brightness": 0.2, "drift": 0.1}, duration=5.0),
    Stimulus(id="bright_drone", patch={"engine": "waveguide", "brightness": 0.8, "drift": 0.1}, duration=5.0),
]

# 2. Define block with parameter adjustments matching waveguide states
match_block = Block(
    name="Synthesizer Brightness Matching",
    trials=[
        {"stimulus": stimuli[0], "response": AdjustValue(prompt="Tweak brightness to match the dark drone profile:", range=[0.0, 1.0], step=0.01, target_param="brightness")},
        {"stimulus": stimuli[1], "response": AdjustValue(prompt="Tweak brightness to match the bright drone profile:", range=[0.0, 1.0], step=0.01, target_param="brightness")},
    ],
    randomize="full"
)

# 3. Assemble and execute
exp = Experiment(
    title="Spectral Brightness Matching Task",
    description="A tuning task to measure continuous parameter adjustments against synthetic models.",
    consent_text="Click accept to participate in the parameter calibration match study...",
    debrief_text="Tuning study completed successfully! Your data records have been generated."
)
exp.add_demographics(DemographicSurvey(["age", "hearing_loss"]))
exp.add_block(match_block)

print("Registering Brightness Tuning Study...")
exp.run()
```
