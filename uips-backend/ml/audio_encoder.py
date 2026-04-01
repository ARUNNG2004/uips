import os
import torch
import numpy as np
import librosa

class AudioEncoder:
    def extract_audio_features(self, audio_path: str) -> torch.Tensor:
        """Extract multi-dimensional audio feature representations over 42-d space."""
        if not audio_path or not os.path.exists(audio_path):
            return torch.zeros((42,), dtype=torch.float32)
            
        try:
            y, sr = librosa.load(audio_path, sr=16000, duration=10.0)
            if len(y) == 0:
                return torch.zeros((42,), dtype=torch.float32)
                
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
            mfccs_mean = np.mean(mfccs, axis=1) # (40,)
            
            centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
            centroid_mean = np.mean(centroid) # (1,)
            
            zcr = librosa.feature.zero_crossing_rate(y)
            zcr_mean = np.mean(zcr) # (1,)
            
            features = np.concatenate([mfccs_mean, [centroid_mean], [zcr_mean]])
            return torch.tensor(features, dtype=torch.float32)
            
        except Exception as e:
            return torch.zeros((42,), dtype=torch.float32)

    def detect_audio_anomaly(self, audio_path: str) -> dict:
        """Run anomaly heuristics for E-Learning environment."""
        result = {"anomaly": False, "type": None, "severity": None}
        if not audio_path or not os.path.exists(audio_path):
            return result
            
        try:
            y, sr = librosa.load(audio_path, sr=16000, duration=10.0)
            if len(y) == 0:
                return result
                
            rms = librosa.feature.rms(y=y)
            rms_mean = np.mean(rms)
            
            if rms_mean < 0.005: 
                result["anomaly"] = True
                result["type"] = "silence"
                result["severity"] = "low"
            elif rms_mean > 0.2: 
                result["anomaly"] = True
                result["type"] = "loud_noise"
                result["severity"] = "high"
                
        except Exception:
            pass
            
        return result

if __name__ == "__main__":
    enc = AudioEncoder()
    print("Audio encoder init successful.")
