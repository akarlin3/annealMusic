# Music Cognition Researcher Recipes

These recipes focus on perceptual testing, behavioral tracking, zero-tracking IRB compliance, and psychophysical studies.

---

## Recipe 7: Consonance-Dissonance Rating Experiment

- **Goal:** Create a 7-point Likert experiment comparing the perceived consonance of perfect intervals vs tritones/minor seconds.
- **Prose Walkthrough:** Define an `Experiment` block using standard synthetic parameters to represent intervals, compile stimulus-response trials, and register the layout to the browser runner.

### Python Code:

```python
from anneal.experiment import Experiment, Block, Stimulus, LikertResponse, DemographicSurvey

# Initialize the experiment structure
exp = Experiment(
    title="Dyad Consonance Perception Study",
    description="A psychoacoustic study measuring interval consonance.",
    consent_text="Click below to consent to this anonymous study.",
    debrief_text="Thank you for participating!"
)

# 1. Define Intake Demographic Questions
survey = DemographicSurvey(fields=["age", "musical_experience", "hearing_loss"])
exp.add_demographics(survey)

# 2. Define Stimuli (perfect fifth vs tritone)
perfect_fifth = Stimulus(id="perfect_fifth", patch={"rootFreq": 110.0, "spread": 1.0, "coupling": 0.9}, duration=4.0)
tritone = Stimulus(id="tritone", patch={"rootFreq": 110.0, "spread": 1.15, "coupling": 0.1}, duration=4.0)

# 3. Define Response Gate
rating_scale = LikertResponse(prompt="Rate the consonance of this sound (1=Dissonant, 7=Consonant)", scale=7)

# 4. Compile trials into a block
trials = [
    {"stimulus": perfect_fifth, "response": rating_scale},
    {"stimulus": tritone, "response": rating_scale}
]
block = Block(name="Dyad Rating Block", trials=trials, randomize="full")
exp.add_block(block)

# Register the experiment runner
exp.run()
```

---

## Recipe 8: 2AFC Pitch-Direction Experiment

- **Goal:** Test pitch discrimination thresholds using a randomized, counterbalanced Two-Alternative Forced Choice (2AFC) study.
- **Prose Walkthrough:** Configure dyad trials that present sequential sounds and ask whether the second pitch is higher or lower.

### Python Code:

```python
from anneal.experiment import Experiment, Block, Stimulus, ForcedChoice

exp = Experiment(
    title="2AFC Pitch Discrimination Test",
    consent_text="Consenting to pitch discrimination tracking."
)

stim_low = Stimulus(id="pitch_low", patch={"rootFreq": 220.0}, duration=2.0)
stim_high = Stimulus(id="pitch_high", patch={"rootFreq": 220.5}, duration=2.0)

choice = ForcedChoice(
    prompt="Was the second sound higher or lower in pitch than the first?",
    options=["Higher", "Lower"]
)

trials = [
    {"stimulus": stim_low, "response": choice},
    {"stimulus": stim_high, "response": choice}
]

# Create counterbalanced trials (A-B vs B-A)
block = Block(name="Thresholds Block", trials=trials, counterbalance=True)
exp.add_block(block)
exp.run()
```

---

## Recipe 9: Continuous-Response Valence Rating

- **Goal:** Collect continuous, real-time valence telemetry from participants during a 2-minute generative session with visualizers hidden.
- **Prose Walkthrough:** Present a slow generative segment and overlay a continuous rating slider, hiding the FFT visualizer to avoid acoustic-to-visual bias.

### Python Code:

```python
from anneal.experiment import Experiment, Block, Stimulus, Continuous

exp = Experiment(
    title="Continuous Affect Mapping",
    consent_text="Consent for continuous session rating."
)

# Set custom parameter drift for an evolving meditative composition
meditative_stim = Stimulus(
    id="evolving_drone",
    patch={"rootFreq": 147.0, "coupling": 0.4, "space": 0.8},
    duration=120.0 # 2 minute trial
)

# Hide visualizer animation completely in active participant panel
meditative_stim.to_dict()["visualizer"] = False

# Establish continuous response tracking slider
continuous_slider = Continuous(
    prompt="Map your moment-to-moment valence (dissonance/consonance feeling)",
    duration=120.0,
    scale=100
)

trials = [{"stimulus": meditative_stim, "response": continuous_slider}]
block = Block(name="Valence Mapping Block", trials=trials)
exp.add_block(block)
exp.run()
```
