# MIR & Machine Learning Recipes

These recipes focus on high-throughput offline dataset generation, frame-by-frame feature extractions, clustering, and training classifier models.

---

## Recipe 10: Generate a 10,000-Clip Audio Dataset

- **Goal:** Generate a massive dataset of 10,000 diverse ambient textures for ML training.
- **Prose Walkthrough:** Write a batch sweep configuration file detailing parameter intervals and run the headless CLI `batch` tool with high multi-core concurrency.

### Sweep Configuration (`sweep_10k.json`):

```json
{
  "base": {
    "schema_ver": 20,
    "payload": "m=open&e=sine&rootFreq=147&spread=1.0"
  },
  "varies": [
    { "key": "coupling", "range": { "min": 0.0, "max": 1.0, "steps": 10 } },
    { "key": "drift", "range": { "min": 0.0, "max": 1.0, "steps": 10 } },
    { "key": "brightness", "range": { "min": 0.1, "max": 0.9, "steps": 10 } }
  ],
  "duration": "5s",
  "seeds": [42, 137, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]
}
```

### CLI Command Execution:

```bash
# Run with 8 concurrent rendering threads
annealmusic batch sweep_10k.json -o ./dataset/ --jobs 8
```

---

## Recipe 11: Extract Telemetry & Perform Clustering

- **Goal:** Collect real-time spectral features and run a K-Means clustering algorithm.
- **Prose Walkthrough:** Run a 30-minute generative session with active datalogging, load the resulting CSV dataset in Python, and partition the acoustic states using Scikit-Learn.

### Jupyter Notebook Code:

```python
import pandas as pd
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt

# 1. Load telemetry logged from the session datalogger
df = pd.read_json("datalogger.jsonl", lines=True)

# 2. Extract spectral features
features = df[['features.rms', 'features.spectralCentroid', 'features.spectralFlux', 'features.zcr']]

# 3. Fit K-Means model to find 4 unique acoustic states
kmeans = KMeans(n_clusters=4, random_state=42)
df['cluster'] = kmeans.fit_predict(features)

print("Cluster centers:")
print(kmeans.cluster_centers_)

# 4. Plot clusters
plt.scatter(df['features.spectralCentroid'], df['features.rms'], c=df['cluster'])
plt.xlabel("Spectral Centroid (Hz)")
plt.ylabel("RMS Energy")
plt.title("Generative Acoustic States Clustering")
plt.show()
```

---

## Recipe 12: Train a Synthesis Engine Classifier

- **Goal:** Train a random forest model to predict which synthesis engine (`sine`, `fm`, `waveguide`, or `bowed`) generated an audio sample based solely on spectral features.
- **Prose Walkthrough:** Render clips across all four engines, compile a structured features dataframe, and train a Scikit-Learn classifier.

### Python Notebook Code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

# 1. Load engine-labeled sweep features dataset
# Columns: rms, centroid, flux, zcr, label (engineId)
data = pd.read_csv("engine_sweep_features.csv")

X = data[['rms', 'centroid', 'flux', 'zcr']]
y = data['label']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 2. Train Random Forest model
clf = RandomForestClassifier(n_estimators=100)
clf.fit(X_train, y_train)

# 3. Evaluate Parity & Accuracy
y_pred = clf.predict(X_test)
print(classification_report(y_test, y_pred))
```
