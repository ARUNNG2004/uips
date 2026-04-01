import os
import json
import torch

class BehaviorEncoder:
    def extract_behavior_features(self, log_path: str) -> torch.Tensor:
        """Parse structured engagement logs capturing standard interactions."""
        if not os.path.exists(log_path):
            return torch.zeros((5,), dtype=torch.float32)

        total_events = 0
        typing_events = 0
        mouse_events = 0
        types = set()
        
        try:
            with open(log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for line in lines:
                    try:
                        data = json.loads(line)
                        total_events += 1
                        etype = data.get("event_type")
                        if etype:
                            types.add(etype)
                        if etype == "keydown":
                            typing_events += 1
                        elif etype == "mousemove":
                            mouse_events += 1
                    except json.JSONDecodeError:
                        continue
        except Exception:
            return torch.zeros((5,), dtype=torch.float32)

        typing_rate_per_min = typing_events
        idle_ratio = 1.0 if total_events == 0 else max(0.0, 1.0 - total_events / 100.0)
        mouse_activity_ratio = mouse_events / max(1, total_events)
        unique_event_types = len(types)

        features = [float(total_events), float(typing_rate_per_min), float(idle_ratio), float(mouse_activity_ratio), float(unique_event_types)]
        return torch.tensor(features, dtype=torch.float32)

    def detect_behavior_anomaly(self, log_path: str) -> dict:
        """Apply rules-based diagnostics targeting the JSON log."""
        result = {"anomaly": False, "type": None, "severity": None}
        if not os.path.exists(log_path):
            return result
        
        try:
            features = self.extract_behavior_features(log_path)
            total_events, typing_rate, idle_ratio, mouse_ratio, unique = features.tolist()
            
            if idle_ratio > 0.7:
                result["anomaly"] = True
                result["type"] = "high_idle"
                result["severity"] = "medium"
            elif typing_rate < 5 and total_events > 0:
                result["anomaly"] = True
                result["type"] = "low_typing"
                result["severity"] = "low"
            elif mouse_ratio == 0.0 and total_events > 0:
                result["anomaly"] = True
                result["type"] = "suspicious"
                result["severity"] = "low"
        except Exception:
            pass
            
        return result

if __name__ == "__main__":
    enc = BehaviorEncoder()
    print("Behavior encoder init successful.")
