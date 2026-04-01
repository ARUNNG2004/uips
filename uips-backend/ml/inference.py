import os
import time
import glob
import torch

try:
    from database.db import db
    from models.session import ExamSession
    from models.event import SuspicionEvent
except ImportError:
    pass

try:
    from ml.visual_encoder import VisualEncoder
    from ml.audio_encoder import AudioEncoder
    from ml.behavior_encoder import BehaviorEncoder
    from ml.transformer import MTTSEPModel
except ImportError:
    pass

class InferenceEngine:
    def __init__(self):
        try:
            self.vis_enc = VisualEncoder()
            self.aud_enc = AudioEncoder()
            self.beh_enc = BehaviorEncoder()
            self.model = MTTSEPModel()
            
            # Map robust file path linking from wherever execution exists
            base_dir = os.path.dirname(__file__)
            model_path = os.path.abspath(os.path.join(base_dir, "..", "trained_models", "mtt_sep.pth"))
            
            if os.path.exists(model_path):
                self.model.load_state_dict(torch.load(model_path, map_location="cpu"))
                print(f"[ML] Successfully loaded trained model from {model_path}")
            else:
                print("[ML] Warning: Model weights not found! Falling back to random initialized weights.")
                
            self.model.eval()
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.model.to(self.device)
        except Exception as e:
            print("[ML] Failed to initialize models internally:", e)

    def run_inference(self, session_id: int) -> dict:
        t0 = time.time()
        result = {
            "session_id": session_id,
            "suspicion_index": 0.0,
            "face_detected": False,
            "face_count": 0,
            "anomalies": [],
            "timestamp": time.time(),
            "inference_time_ms": 0
        }
        
        # Safely query actual uploads space!
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "sessions", str(session_id)))
        if not os.path.exists(base_dir):
            return result
            
        # Get latest media files
        vid_files = sorted(glob.glob(f"{base_dir}/video/*.jpg"))
        aud_files = sorted(glob.glob(f"{base_dir}/audio/*.wav"))
        beh_log = f"{base_dir}/behavior/log.json"
        
        vid_path = vid_files[-1] if vid_files else ""
        aud_path = aud_files[-1] if aud_files else ""
        
        try:
            v_feat = self.vis_enc.extract_visual_features(vid_path).unsqueeze(0).to(self.device)
            a_feat = self.aud_enc.extract_audio_features(aud_path).unsqueeze(0).to(self.device)
            b_feat = self.beh_enc.extract_behavior_features(beh_log).unsqueeze(0).to(self.device)
            
            # Diagnostic detection anomalies mapped structurally
            v_anom = self.vis_enc.detect_face(vid_path)
            result["face_detected"] = v_anom.get("face_detected", False)
            result["face_count"] = v_anom.get("face_count", 0)
            if v_anom.get("anomaly_type"):
                result["anomalies"].append({
                    "source": "visual", 
                    "type": v_anom["anomaly_type"], 
                    "severity": "high"
                })
                
            a_anom = self.aud_enc.detect_audio_anomaly(aud_path)
            if a_anom.get("anomaly"):
                result["anomalies"].append({
                    "source": "audio", 
                    "type": a_anom.get("type"), 
                    "severity": a_anom.get("severity", "medium")
                })
                
            b_anom = self.beh_enc.detect_behavior_anomaly(beh_log)
            if b_anom.get("anomaly"):
                result["anomalies"].append({
                    "source": "behavior", 
                    "type": b_anom.get("type"), 
                    "severity": b_anom.get("severity", "low")
                })
                
            # Full transformer model evaluation
            with torch.no_grad():
                out = self.model(v_feat, a_feat, b_feat)
                prob = out.item()
                
            result["suspicion_index"] = round(prob * 100, 2)
            
        except Exception as e:
            print("[ML] Detailed inference execution error:", e)
            
        result["inference_time_ms"] = int((time.time() - t0) * 1000)
        return result

# Handle python singleton instantiation appropriately
engine = None

def run_inference(session_id: int) -> dict:
    """Invoked manually via Socket controllers to analyze particular endpoints via latest dumps!"""
    global engine
    if engine is None:
        engine = InferenceEngine()
    return engine.run_inference(session_id)


def save_inference_result(session_id: int, result: dict) -> None:
    """Rolling average hook explicitly updating the suspicion log bound"""
    session = ExamSession.query.get(session_id)
    if not session:
        return
        
    old_score = session.suspicion_index
    new_score = result.get("suspicion_index", 0.0)
    
    # Bound rolling expectation tracking changes smoothly.
    session.suspicion_index = round(0.7 * old_score + 0.3 * new_score, 2)
    
    valid_event_types = ["face_absent", "multiple_faces", "audio_anomaly", "gaze_deviation", "typing_anomaly", "posture_alert"]
    
    for anom in result.get("anomalies", []):
        raw_type = anom.get("type", "")
        # Safe-enum default bridging!
        etype = "posture_alert"
        if raw_type == "face_absent": etype = "face_absent"
        elif raw_type == "multiple_faces": etype = "multiple_faces"
        elif raw_type in ("silence", "loud_noise"): etype = "audio_anomaly"
        elif raw_type == "low_typing": etype = "typing_anomaly"
        elif raw_type == "high_idle": etype = "typing_anomaly"
        
        event = SuspicionEvent(
            session_id=session_id,
            event_type=etype,
            severity=anom.get("severity", "low"),
            score_delta=10.0 # Bounded to the requested +10 scaling limit arbitrarily
        )
        db.session.add(event)
        
    db.session.commit()

if __name__ == "__main__":
    res = run_inference(1)
    print("Inference generic execution test completed resulting:", res)
