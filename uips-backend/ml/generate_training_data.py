import os
import numpy as np

def generate_dataset(num_samples=2000):
    """Generate synthetic multimodal dataset mimicking DAISEE."""
    os.makedirs(os.path.join(os.path.dirname(__file__), "training_data"), exist_ok=True)
    
    visual_features = np.zeros((num_samples, 576), dtype=np.float32)
    audio_features = np.zeros((num_samples, 42), dtype=np.float32)
    behavior_features = np.zeros((num_samples, 5), dtype=np.float32)
    labels = np.zeros((num_samples,), dtype=np.int32)
    suspicion_scores = np.zeros((num_samples,), dtype=np.float32)

    # Realistic class imbalance: 20% suspicious (score>50), 80% normal
    num_suspicious = int(num_samples * 0.2)
    
    for i in range(num_samples):
        is_suspicious = i < num_suspicious
        
        if is_suspicious:
            labels[i] = np.random.choice([0, 1])  # not engaged or barely engaged
            # suspicious scenarios have higher suspicion scores derived from anomalies
            # like face_absent (+40), multiple_faces (+50), audio_anomaly (+30), etc.
            base_suspicion = np.random.uniform(50, 95)
            suspicion = base_suspicion + np.random.normal(0, 5.0)
            
            # Simulated features for anomalous behavior
            v = np.random.normal(0.8, 0.4, 576)
            a = np.random.normal(0.7, 0.3, 42)
            b = np.random.normal(1.0, 0.5, 5)
        else:
            labels[i] = np.random.choice([2, 3])  # engaged or highly engaged
            suspicion = np.random.uniform(0, 40) + np.random.normal(0, 2.0)
            
            # Simulated features for normal behavior
            v = np.random.normal(0.1, 0.2, 576)
            a = np.random.normal(0.2, 0.1, 42)
            b = np.random.normal(0.5, 0.2, 5)
            
        suspicion_scores[i] = float(np.clip(suspicion, 0.0, 100.0))
        visual_features[i] = v
        audio_features[i] = a
        behavior_features[i] = b

    # Shuffle dataset
    indices = np.arange(num_samples)
    np.random.shuffle(indices)
    
    visual_features = visual_features[indices]
    audio_features = audio_features[indices]
    behavior_features = behavior_features[indices]
    labels = labels[indices]
    suspicion_scores = suspicion_scores[indices]

    save_path = os.path.join(os.path.dirname(__file__), "training_data", "dataset.npz")
    np.savez_compressed(
        save_path,
        visual_features=visual_features,
        audio_features=audio_features,
        behavior_features=behavior_features,
        labels=labels,
        suspicion_scores=suspicion_scores
    )

    print(f"Dataset generated successfully at {save_path}")
    print(f"Total samples: {num_samples}")
    print(f"Suspicious samples (>50): {np.sum(suspicion_scores > 50)}")
    print(f"Visual shape: {visual_features.shape}")
    print(f"Audio shape: {audio_features.shape}")
    print(f"Behavior shape: {behavior_features.shape}")
    print(f"Labels distribution (0-3): {np.bincount(labels)}")

if __name__ == "__main__":
    generate_dataset()
